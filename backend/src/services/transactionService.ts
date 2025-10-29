import { Request } from "express";
import { validationResult } from "express-validator";

import { db } from "../db/pool";
import { findAccountByIdForUpdate } from "../repositories/accountRepository";
import { insertTransaction } from "../repositories/transactionRepository";
import type { TransactionRecord } from "../repositories/transactionRepository";
import { AuthenticatedUser } from "../types";
import { AppError, ForbiddenError } from "../utils/errors";

import { recordAuditEvent } from "./auditLogService";
import { runComplianceSimulation } from "./complianceService";
import type { ComplianceResult } from "./complianceService";
import { encryptPayload, EncryptedPayload } from "./encryptionService";
import { evaluateAccountRisk } from "./riskMonitoringService";
import type { RiskEvaluationResult } from "./riskMonitoringService";

export const createTransfer = async (
	req: Request,
	requester: AuthenticatedUser
): Promise<{
	debit: TransactionRecord;
	credit: TransactionRecord;
	encryptedPayload: EncryptedPayload;
	compliance: ComplianceResult[];
	sourceRisk: RiskEvaluationResult;
	destinationRisk: RiskEvaluationResult;
}> => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		throw new AppError(
			`Validation failed: ${errors
				.array()
				.map((e) => e.msg)
				.join(", ")}`,
			422
		);
	}

	const { sourceAccountId, destinationAccountId, amount, currency, memo } = req.body as {
		sourceAccountId: string;
		destinationAccountId: string;
		amount: number;
		currency: string;
		memo?: string;
	};

	if (sourceAccountId === destinationAccountId) {
		throw new AppError("Source and destination accounts must differ.");
	}

	const sanitizedAmount = Number(amount);
	if (Number.isNaN(sanitizedAmount) || sanitizedAmount <= 0) {
		throw new AppError("Amount must be a positive number.");
	}

	const payloadForEncryption = {
		sourceAccountId,
		destinationAccountId,
		amount: sanitizedAmount,
		currency,
		memo,
		createdBy: requester.id
	};
	const encryptedPayload = await encryptPayload(payloadForEncryption);

	const result = await db.withTransaction(async (client) => {
		const sourceAccount = await findAccountByIdForUpdate(sourceAccountId, client);
		const destinationAccount = await findAccountByIdForUpdate(destinationAccountId, client);

		if (!sourceAccount || !destinationAccount) {
			throw new AppError("Account not found.", 404);
		}

		if (requester.role === "client" && requester.id !== sourceAccount.user_id) {
			throw new ForbiddenError("You may only transfer from your own accounts.");
		}

		if (sourceAccount.currency !== currency || destinationAccount.currency !== currency) {
			throw new AppError("Currency mismatch between accounts and payload.");
		}

		const sourceBalance = Number(sourceAccount.balance);
		if (Number.isNaN(sourceBalance) || sourceBalance < sanitizedAmount) {
			throw new AppError("Insufficient funds.");
		}

		await client.query("UPDATE accounts SET balance = balance - $1 WHERE id = $2", [
			sanitizedAmount,
			sourceAccountId
		]);
		await client.query("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [
			sanitizedAmount,
			destinationAccountId
		]);

		const serializedPayload = JSON.stringify(encryptedPayload);

		const debit = await insertTransaction(client, {
			accountId: sourceAccountId,
			counterpartyAccountId: destinationAccountId,
			amount: sanitizedAmount.toString(),
			currency,
			direction: "debit",
			memo,
			encryptedPayload: serializedPayload
		});

		const credit = await insertTransaction(client, {
			accountId: destinationAccountId,
			counterpartyAccountId: sourceAccountId,
			amount: sanitizedAmount.toString(),
			currency,
			direction: "credit",
			memo,
			encryptedPayload: serializedPayload
		});

		await recordAuditEvent(
			"transaction.transfer",
			{
				debitTransactionId: debit.id,
				creditTransactionId: credit.id,
				sourceAccountId,
				destinationAccountId,
				amount: sanitizedAmount,
				currency,
				createdBy: requester.id
			},
			client
		);

		const compliance = await runComplianceSimulation(
			{
				userId: sourceAccount.user_id,
				transactionId: debit.id,
				amount: sanitizedAmount,
				currency,
				memo: memo ?? null
			},
			client
		);

		const sourceRisk = await evaluateAccountRisk(sourceAccountId, client);
		const destinationRisk = await evaluateAccountRisk(destinationAccountId, client);

		return { debit, credit, compliance, sourceRisk, destinationRisk };
	});

	return {
		...result,
		encryptedPayload
	};
};
