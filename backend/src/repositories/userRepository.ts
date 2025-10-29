import { PoolClient } from "pg";

import { db } from "../db/pool";
import { UserRole } from "../types";

interface UserRecord {
	id: string;
	email: string;
	password_hash: string;
	role: UserRole;
	created_at: Date;
	updated_at: Date;
}

export const createUser = async (
	email: string,
	passwordHash: string,
	role: UserRole,
	client?: PoolClient
): Promise<UserRecord> => {
	const query = `
    INSERT INTO users (email, password_hash, role)
    VALUES ($1, $2, $3)
    RETURNING id, email, password_hash, role, created_at, updated_at
  `;

	const executor: Pick<PoolClient, "query"> = client ?? db;
	const result = await executor.query<UserRecord>(query, [email, passwordHash, role]);
	return result.rows[0];
};

export const findUserByEmail = async (email: string): Promise<UserRecord | null> => {
	const result = await db.query<UserRecord>(
		"SELECT id, email, password_hash, role, created_at, updated_at FROM users WHERE email = $1",
		[email]
	);
	return result.rows[0] ?? null;
};

export const findUserById = async (id: string): Promise<UserRecord | null> => {
	const result = await db.query<UserRecord>(
		"SELECT id, email, password_hash, role, created_at, updated_at FROM users WHERE id = $1",
		[id]
	);
	return result.rows[0] ?? null;
};
