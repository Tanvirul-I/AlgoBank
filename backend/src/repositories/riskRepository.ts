import { PoolClient } from "pg";

import { db } from "../db/pool";

export interface RiskMetricRecord {
	id: string;
	account_id: string;
	exposure: string;
	leverage: string;
	loss_ratio: string;
	observation_window: number;
	created_at: Date;
}

export interface RiskAlertRecord {
	id: string;
	account_id: string | null;
	alert_type: string;
	severity: "low" | "medium" | "high" | "critical";
	details: unknown;
	triggered_at: Date;
	resolved_at: Date | null;
	acknowledgement: string | null;
}

export interface RiskAnomalyRecord {
	id: string;
	transaction_id: string;
	account_id: string;
	anomaly_score: string;
	score_threshold: string;
	detector_version: string;
	metadata: unknown;
	created_at: Date;
}

const getExecutor = (client?: PoolClient): Pick<PoolClient, "query"> => client ?? db;

export const insertRiskMetric = async (
	input: {
		accountId: string;
		exposure: number;
		leverage: number;
		lossRatio: number;
		windowInDays: number;
	},
	client?: PoolClient
): Promise<RiskMetricRecord> => {
	const executor = getExecutor(client);
	const result = await executor.query<RiskMetricRecord>(
		`INSERT INTO risk_metrics (account_id, exposure, leverage, loss_ratio, observation_window)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, account_id, exposure, leverage, loss_ratio, observation_window, created_at`,
		[input.accountId, input.exposure, input.leverage, input.lossRatio, input.windowInDays]
	);
	return result.rows[0];
};

export const insertRiskAlert = async (
	input: {
		accountId?: string | null;
		alertType: string;
		severity: "low" | "medium" | "high" | "critical";
		details: unknown;
	},
	client?: PoolClient
): Promise<RiskAlertRecord> => {
	const executor = getExecutor(client);
	const result = await executor.query<RiskAlertRecord>(
		`INSERT INTO risk_alerts (account_id, alert_type, severity, details)
     VALUES ($1, $2, $3, $4)
     RETURNING id, account_id, alert_type, severity, details, triggered_at, resolved_at, acknowledgement`,
		[input.accountId ?? null, input.alertType, input.severity, input.details]
	);
	return result.rows[0];
};

export const listRecentAlerts = async (limit = 100): Promise<RiskAlertRecord[]> => {
	const result = await db.query<RiskAlertRecord>(
		`SELECT id, account_id, alert_type, severity, details, triggered_at, resolved_at, acknowledgement
     FROM risk_alerts
     ORDER BY CASE severity
             WHEN 'critical' THEN 4
             WHEN 'high' THEN 3
             WHEN 'medium' THEN 2
             WHEN 'low' THEN 1
             ELSE 0
     END DESC, triggered_at DESC
     LIMIT $1`,
		[limit]
	);
	return result.rows;
};

export const insertAnomalyEvent = async (
	input: {
		transactionId: string;
		accountId: string;
		score: number;
		threshold: number;
		detectorVersion: string;
		metadata?: unknown;
	},
	client?: PoolClient
): Promise<RiskAnomalyRecord> => {
	const executor = getExecutor(client);
	const result = await executor.query<RiskAnomalyRecord>(
		`INSERT INTO risk_anomalies (transaction_id, account_id, anomaly_score, score_threshold, detector_version, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, transaction_id, account_id, anomaly_score, score_threshold, detector_version, metadata, created_at`,
		[
			input.transactionId,
			input.accountId,
			input.score,
			input.threshold,
			input.detectorVersion,
			input.metadata ?? {}
		]
	);
	return result.rows[0];
};

export const fetchLatestMetricsForAccount = async (
	accountId: string,
	limit = 1
): Promise<RiskMetricRecord[]> => {
	const result = await db.query<RiskMetricRecord>(
		`SELECT id, account_id, exposure, leverage, loss_ratio, observation_window, created_at
     FROM risk_metrics
     WHERE account_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
		[accountId, limit]
	);
	return result.rows;
};
