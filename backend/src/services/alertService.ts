import { PoolClient } from "pg";

import { env } from "../config/env";
import { insertRiskAlert, listRecentAlerts, RiskAlertRecord } from "../repositories/riskRepository";
import { publishToStream } from "../utils/redis";

import { recordAuditEvent } from "./auditLogService";

export type RiskAlertSeverity = "low" | "medium" | "high" | "critical";

const RISK_ALERT_STREAM = "risk-alerts";

export const raiseRiskAlert = async (
	input: {
		accountId?: string | null;
		alertType: string;
		severity: RiskAlertSeverity;
		details: Record<string, unknown>;
	},
	client?: PoolClient
): Promise<RiskAlertRecord> => {
	const alert = await insertRiskAlert(
		{
			accountId: input.accountId ?? null,
			alertType: input.alertType,
			severity: input.severity,
			details: input.details
		},
		client
	);

	await recordAuditEvent(
		"risk.alert.raised",
		{
			alertId: alert.id,
			alertType: alert.alert_type,
			severity: alert.severity,
			accountId: alert.account_id,
			details: alert.details
		},
		client
	);

	if (env.enableRedisStreams) {
		await publishToStream(RISK_ALERT_STREAM, {
			id: alert.id,
			type: alert.alert_type,
			severity: alert.severity,
			accountId: alert.account_id ?? "",
			triggeredAt: alert.triggered_at.toISOString()
		});
	}

	return alert;
};

export const fetchRecentAlerts = async (limit = 100): Promise<RiskAlertRecord[]> => {
	return listRecentAlerts(limit);
};
