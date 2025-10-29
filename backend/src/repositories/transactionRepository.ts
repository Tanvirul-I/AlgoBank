import { PoolClient } from "pg";

import { db } from "../db/pool";

export interface TransactionRecord {
	id: string;
	account_id: string;
	counterparty_account_id: string | null;
	amount: string;
	currency: string;
	direction: "credit" | "debit";
	memo: string | null;
	encrypted_payload: string;
	created_at: Date;
}

export const insertTransaction = async (
	client: PoolClient,
	input: {
		accountId: string;
		counterpartyAccountId?: string | null;
		amount: string;
		currency: string;
		direction: "credit" | "debit";
		memo?: string | null;
		encryptedPayload: string;
	}
): Promise<TransactionRecord> => {
	const result = await client.query<TransactionRecord>(
		`INSERT INTO transactions (account_id, counterparty_account_id, amount, currency, direction, memo, encrypted_payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, account_id, counterparty_account_id, amount, currency, direction, memo, encrypted_payload, created_at`,
		[
			input.accountId,
			input.counterpartyAccountId ?? null,
			input.amount,
			input.currency,
			input.direction,
			input.memo ?? null,
			input.encryptedPayload
		]
	);
	return result.rows[0];
};

export const listTransactionsForAccount = async (
	accountId: string,
	limit = 50,
	client?: PoolClient
): Promise<TransactionRecord[]> => {
	const executor: Pick<PoolClient, "query"> = client ?? db;
	const result = await executor.query<TransactionRecord>(
		`SELECT id, account_id, counterparty_account_id, amount, currency, direction, memo, encrypted_payload, created_at
     FROM transactions
     WHERE account_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
		[accountId, limit]
	);
	return result.rows;
};
