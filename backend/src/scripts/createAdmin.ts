import dotenv from "dotenv";

import { createUser, findUserByEmail } from "../repositories/userRepository";
import { UserRole } from "../types";
import { hashPassword } from "../utils/password";

dotenv.config();

const validRoles: UserRole[] = ["admin", "auditor", "client"];

const emailArg = process.argv[2] ?? process.env.ADMIN_EMAIL;
const passwordArg = process.argv[3] ?? process.env.ADMIN_PASSWORD;
const roleArg = (process.argv[4] ?? process.env.ADMIN_ROLE ?? "admin") as UserRole;

if (!emailArg || !passwordArg) {
	// eslint-disable-next-line no-console
	console.error(
		"Provide an email and password via arguments or ADMIN_EMAIL/ADMIN_PASSWORD environment variables."
	);
	process.exit(1);
}

if (!validRoles.includes(roleArg)) {
	// eslint-disable-next-line no-console
	console.error(`Role must be one of: ${validRoles.join(", ")}.`);
	process.exit(1);
}

const run = async () => {
	const existing = await findUserByEmail(emailArg);
	if (existing) {
		// eslint-disable-next-line no-console
		console.log(`User ${emailArg} already exists with role ${existing.role}. Nothing to do.`);
		return;
	}

	const passwordHash = await hashPassword(passwordArg);
	await createUser(emailArg, passwordHash, roleArg);
	// eslint-disable-next-line no-console
	console.log(`Created ${roleArg} account for ${emailArg}.`);
};

run()
	.catch((error) => {
		// eslint-disable-next-line no-console
		console.error("Failed to create privileged account", error);
		process.exitCode = 1;
	})
	.finally(() => {
		process.exit();
	});
