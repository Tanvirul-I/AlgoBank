import { Pool, PoolClient } from "pg";

import { env } from "../config/env";

class Database {
	private pool: Pool;
	public readonly query: Pool["query"];

	constructor() {
		this.pool = new Pool({
			host: env.postgres.host,
			port: env.postgres.port,
			user: env.postgres.user,
			password: env.postgres.password,
			database: env.postgres.database,
			ssl: env.postgres.ssl ? { rejectUnauthorized: false } : undefined
		});

		this.query = this.pool.query.bind(this.pool);

		this.pool.on("error", (error: Error) => {
			// eslint-disable-next-line no-console
			console.error("Unexpected PostgreSQL error", error);
		});
	}

	async withTransaction<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			const result = await handler(client);
			await client.query("COMMIT");
			return result;
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	}
}

export const db = new Database();
