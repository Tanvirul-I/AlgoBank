import crypto from "crypto";

import { PoolClient } from "pg";

import { fetchLatestHash, insertAuditLog } from "../repositories/auditLogRepository";

export const recordAuditEvent = async (
	eventType: string,
	payload: unknown,
	client?: PoolClient
): Promise<void> => {
	const previousHash = await fetchLatestHash(client);
	const serialized = JSON.stringify({ eventType, payload, previousHash });
	const hash = crypto.createHash("sha256").update(serialized).digest("hex");

	await insertAuditLog(
		{
			eventType,
			payload,
			previousHash,
			hash
		},
		client
	);
};
