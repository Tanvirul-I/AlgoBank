import { PoolClient } from "pg";

import { env } from "../config/env";
import { insertComplianceCheck } from "../repositories/complianceRepository";

import { raiseRiskAlert } from "./alertService";
import { recordAuditEvent } from "./auditLogService";

const AML_THRESHOLD = 50000;
const HIGH_RISK_MEMO_PATTERNS = [/offshore/i, /crypto/i, /shell/i, /hawala/i];

export interface ComplianceResult {
	checkType: string;
	status: "pending" | "passed" | "failed";
	details: Record<string, unknown>;
}

const simulateKyc = async (userId: string, client?: PoolClient): Promise<ComplianceResult> => {
	const result = await insertComplianceCheck(
		{
			userId,
			checkType: "kyc-profile",
			status: "passed",
			details: {
				verificationProvider: "MockID+",
				riskScore: 0.12
			}
		},
		client
	);

	return {
		checkType: result.check_type,
		status: result.status,
		details: result.details as Record<string, unknown>
	};
};

const simulateAml = async (
	userId: string,
	transactionId: string,
	amount: number,
	currency: string,
	memo: string | null,
	client?: PoolClient
): Promise<ComplianceResult> => {
	const memoMatch = memo ? HIGH_RISK_MEMO_PATTERNS.some((pattern) => pattern.test(memo)) : false;
	const isHighValue = amount >= AML_THRESHOLD;
	const flagged = memoMatch || isHighValue;
	const status = flagged ? "failed" : "passed";

	const result = await insertComplianceCheck(
		{
			userId,
			transactionId,
			checkType: "aml-transaction",
			status,
			details: {
				amount,
				currency,
				memo,
				rulesTriggered: {
					highValue: isHighValue,
					memoPattern: memoMatch
				}
			}
		},
		client
	);

	if (status === "failed" && env.nodeEnv !== "test") {
		await raiseRiskAlert(
			{
				accountId: null,
				alertType: "aml_flag",
				severity: "critical",
				details: {
					userId,
					transactionId,
					amount,
					currency,
					reason: memoMatch ? "memo_pattern" : "high_value"
				}
			},
			client
		);
	}

	return {
		checkType: result.check_type,
		status: result.status,
		details: result.details as Record<string, unknown>
	};
};

export const runComplianceSimulation = async (
	input: {
		userId: string;
		transactionId: string;
		amount: number;
		currency: string;
		memo?: string | null;
	},
	client?: PoolClient
): Promise<ComplianceResult[]> => {
	const kycResult = await simulateKyc(input.userId, client);
	const amlResult = await simulateAml(
		input.userId,
		input.transactionId,
		input.amount,
		input.currency,
		input.memo ?? null,
		client
	);

	const results = [kycResult, amlResult];

	if (env.nodeEnv !== "test") {
		await recordAuditEvent(
			"compliance.simulation.completed",
			{
				transactionId: input.transactionId,
				userId: input.userId,
				results
			},
			client
		);
	}

	return results;
};
