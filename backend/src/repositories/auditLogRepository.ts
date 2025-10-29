import { PoolClient } from "pg";

import { db } from "../db/pool";

export interface AuditLogRecord {
	id: string;
	event_type: string;
	payload: unknown;
	hash: string;
	previous_hash: string | null;
	created_at: Date;
}

export const fetchLatestHash = async (client?: PoolClient): Promise<string | null> => {
	const executor: Pick<PoolClient, "query"> = client ?? db;
	const result = await executor.query<{ hash: string }>(
		"SELECT hash FROM audit_logs ORDER BY created_at DESC LIMIT 1"
	);
	return result.rows[0]?.hash ?? null;
};

export const insertAuditLog = async (
	input: { eventType: string; payload: unknown; hash: string; previousHash: string | null },
	client?: PoolClient
): Promise<AuditLogRecord> => {
	const executor: Pick<PoolClient, "query"> = client ?? db;
	const result = await executor.query<AuditLogRecord>(
		`INSERT INTO audit_logs (event_type, payload, hash, previous_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, event_type, payload, hash, previous_hash, created_at`,
		[input.eventType, input.payload, input.hash, input.previousHash]
	);
	return result.rows[0];
};
