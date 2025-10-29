import { PoolClient } from "pg";

import { env } from "../config/env";
import { findAccountById } from "../repositories/accountRepository";
import { insertAnomalyEvent, insertRiskMetric } from "../repositories/riskRepository";
import {
	listTransactionsForAccount,
	TransactionRecord
} from "../repositories/transactionRepository";
import { IsolationForest } from "../utils/isolationForest";

import { raiseRiskAlert } from "./alertService";

const DETECTOR_VERSION = "iforest-1.0";
const OBSERVATION_WINDOW_DAYS = 90;
const ANOMALY_THRESHOLD = 0.65;

export interface RiskEvaluationResult {
	exposure: number;
	leverage: number;
	lossRatio: number;
	anomalyScore?: number;
}

const toNumber = (value: string | number): number => {
	const parsed = typeof value === "number" ? value : Number(value);
	if (Number.isNaN(parsed)) {
		return 0;
	}
	return parsed;
};

const computeMetrics = (
	accountBalance: number,
	transactions: TransactionRecord[]
): RiskEvaluationResult => {
	let totalDebits = 0;
	let totalCredits = 0;
	let rollingLoss = 0;

	for (const tx of transactions) {
		const amount = Math.abs(toNumber(tx.amount));
		if (tx.direction === "debit") {
			totalDebits += amount;
			rollingLoss += amount;
		} else {
			totalCredits += amount;
			rollingLoss -= amount;
		}
	}

	const netOutflow = totalDebits - totalCredits;
	const exposure = Math.max(0, netOutflow);
	const leverage = totalDebits / Math.max(accountBalance, 1);
	const lossRatio = Math.max(0, rollingLoss) / Math.max(totalCredits, 1);

	return {
		exposure,
		leverage,
		lossRatio
	};
};

const buildFeatureVector = (transaction: TransactionRecord): number[] => {
	const amount = Math.abs(toNumber(transaction.amount));
	const logAmount = Math.log(amount + 1);
	const direction = transaction.direction === "debit" ? 1 : 0;
	const timestamp =
		transaction.created_at instanceof Date
			? transaction.created_at
			: new Date(transaction.created_at);
	const hourOfDay = timestamp.getUTCHours() / 24;
	const counterparty = transaction.counterparty_account_id ? 1 : 0;
	const memoLength = transaction.memo ? transaction.memo.length : 0;
	return [logAmount, direction, hourOfDay, counterparty, memoLength];
};

const detectAnomaly = async (
	accountId: string,
	transactions: TransactionRecord[],
	client?: PoolClient
): Promise<number | undefined> => {
	if (transactions.length < 5) {
		return undefined;
	}

	const features = transactions.map(buildFeatureVector);
	const forest = new IsolationForest(75, Math.min(128, transactions.length));
	forest.fit(features);

	const latestFeature = features[0];
	const score = forest.score(latestFeature);

	if (score >= ANOMALY_THRESHOLD) {
		const latestTransaction = transactions[0];
		await insertAnomalyEvent(
			{
				transactionId: latestTransaction.id,
				accountId,
				score,
				threshold: ANOMALY_THRESHOLD,
				detectorVersion: DETECTOR_VERSION,
				metadata: {
					amount: toNumber(latestTransaction.amount),
					direction: latestTransaction.direction,
					timestamp: latestTransaction.created_at,
					counterpartyAccountId: latestTransaction.counterparty_account_id
				}
			},
			client
		);

		if (env.nodeEnv !== "test") {
			await raiseRiskAlert(
				{
					accountId,
					alertType: "anomaly_detection",
					severity: "high",
					details: {
						score,
						threshold: ANOMALY_THRESHOLD,
						transactionId: latestTransaction.id
					}
				},
				client
			);
		}
	}

	return score;
};

const checkThresholds = async (
	accountId: string,
	metrics: RiskEvaluationResult,
	accountBalance: number,
	client?: PoolClient
) => {
	if (metrics.leverage > 2 && env.nodeEnv !== "test") {
		await raiseRiskAlert(
			{
				accountId,
				alertType: "leverage_threshold",
				severity: "high",
				details: {
					leverage: metrics.leverage,
					threshold: 2
				}
			},
			client
		);
	}

	if (metrics.lossRatio > 0.1 && env.nodeEnv !== "test") {
		await raiseRiskAlert(
			{
				accountId,
				alertType: "loss_threshold",
				severity: "medium",
				details: {
					lossRatio: metrics.lossRatio,
					threshold: 0.1
				}
			},
			client
		);
	}

	if (metrics.exposure > accountBalance * 0.5 && metrics.exposure > 0 && env.nodeEnv !== "test") {
		await raiseRiskAlert(
			{
				accountId,
				alertType: "exposure_threshold",
				severity: "medium",
				details: {
					exposure: metrics.exposure,
					balance: accountBalance,
					ratio: accountBalance === 0 ? null : metrics.exposure / accountBalance
				}
			},
			client
		);
	}
};

export const evaluateAccountRisk = async (
	accountId: string,
	client?: PoolClient
): Promise<RiskEvaluationResult> => {
	const account = await findAccountById(accountId, client);
	if (!account) {
		throw new Error(`Account ${accountId} not found for risk evaluation.`);
	}

	const transactions = await listTransactionsForAccount(accountId, 200, client);
	const metrics = computeMetrics(Number(account.balance), transactions);

	await insertRiskMetric(
		{
			accountId,
			exposure: metrics.exposure,
			leverage: metrics.leverage,
			lossRatio: metrics.lossRatio,
			windowInDays: OBSERVATION_WINDOW_DAYS
		},
		client
	);

	await checkThresholds(accountId, metrics, Number(account.balance), client);
	const anomalyScore = await detectAnomaly(accountId, transactions, client);

	return {
		...metrics,
		anomalyScore
	};
};
