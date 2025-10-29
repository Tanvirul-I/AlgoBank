import { PoolClient } from "pg";

import { db } from "../db/pool";

export interface ComplianceCheckRecord {
	id: string;
	user_id: string;
	transaction_id: string | null;
	check_type: string;
	status: "pending" | "passed" | "failed";
	details: unknown;
	created_at: Date;
}

const getExecutor = (client?: PoolClient): Pick<PoolClient, "query"> => client ?? db;

export const insertComplianceCheck = async (
	input: {
		userId: string;
		transactionId?: string | null;
		checkType: string;
		status: "pending" | "passed" | "failed";
		details?: unknown;
	},
	client?: PoolClient
): Promise<ComplianceCheckRecord> => {
	const executor = getExecutor(client);
	const result = await executor.query<ComplianceCheckRecord>(
		`INSERT INTO compliance_checks (user_id, transaction_id, check_type, status, details)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, transaction_id, check_type, status, details, created_at`,
		[
			input.userId,
			input.transactionId ?? null,
			input.checkType,
			input.status,
			input.details ?? {}
		]
	);
	return result.rows[0];
};

export const listComplianceChecksForUser = async (
	userId: string,
	limit = 50
): Promise<ComplianceCheckRecord[]> => {
	const result = await db.query<ComplianceCheckRecord>(
		`SELECT id, user_id, transaction_id, check_type, status, details, created_at
     FROM compliance_checks
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
		[userId, limit]
	);
	return result.rows;
};
