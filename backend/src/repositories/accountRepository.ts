import { PoolClient } from "pg";

import { db } from "../db/pool";

export interface AccountRecord {
	id: string;
	user_id: string;
	name: string;
	balance: string;
	currency: string;
	created_at: Date;
	updated_at: Date;
}

export const createAccount = async (
	userId: string,
	name: string,
	currency: string,
	client?: PoolClient
): Promise<AccountRecord> => {
	const executor: Pick<PoolClient, "query"> = client ?? db;
	const result = await executor.query<AccountRecord>(
		`INSERT INTO accounts (user_id, name, currency)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, name, balance, currency, created_at, updated_at`,
		[userId, name, currency]
	);
	return result.rows[0];
};

export const findAccountByIdForUpdate = async (
	accountId: string,
	client: PoolClient
): Promise<AccountRecord | null> => {
	const result = await client.query<AccountRecord>(
		`SELECT id, user_id, name, balance, currency, created_at, updated_at
     FROM accounts
     WHERE id = $1
     FOR UPDATE`,
		[accountId]
	);
	return result.rows[0] ?? null;
};

export const findAccountById = async (
	accountId: string,
	client?: PoolClient
): Promise<AccountRecord | null> => {
	const executor: Pick<PoolClient, "query"> = client ?? db;
	const result = await executor.query<AccountRecord>(
		`SELECT id, user_id, name, balance, currency, created_at, updated_at
     FROM accounts
     WHERE id = $1`,
		[accountId]
	);
	return result.rows[0] ?? null;
};

export const listAccounts = async (): Promise<AccountRecord[]> => {
	const result = await db.query<AccountRecord>(
		"SELECT id, user_id, name, balance, currency, created_at, updated_at FROM accounts ORDER BY created_at DESC"
	);
	return result.rows;
};

export const findAccountsByUser = async (userId: string): Promise<AccountRecord[]> => {
	const result = await db.query<AccountRecord>(
		"SELECT id, user_id, name, balance, currency, created_at, updated_at FROM accounts WHERE user_id = $1",
		[userId]
	);
	return result.rows;
};
