import fs from "fs";
import path from "path";

import { db } from "../db/pool";

async function runMigrations() {
	const migrationsDir = path.resolve(__dirname, "../../db/migrations");
	const files = fs
		.readdirSync(migrationsDir)
		.filter((file) => file.endsWith(".sql"))
		.sort();

	for (const file of files) {
		const filePath = path.join(migrationsDir, file);
		const sql = fs.readFileSync(filePath, "utf8");
		// eslint-disable-next-line no-console
		console.log(`Applying migration ${file}`);
		await db.query(sql);
	}

	// eslint-disable-next-line no-console
	console.log("Migrations complete.");
}

runMigrations()
	.catch((error) => {
		// eslint-disable-next-line no-console
		console.error("Migration failed", error);
		process.exit(1);
	})
	.finally(() => {
		process.exit(0);
	});
