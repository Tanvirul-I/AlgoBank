const assert = require("node:assert/strict");
const { before, after, beforeEach, describe, it } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { generateKeyPairSync } = require("node:crypto");
const bcrypt = require("bcryptjs");

const initializeMockPg = require("./helpers/mockPg.cjs");

const { pool, getState } = initializeMockPg();

const migrationFiles = [
	"../db/migrations/0001_initial.sql",
	"../db/migrations/0002_risk_compliance.sql"
];

const migrationSql = migrationFiles
	.map((file) => fs.readFileSync(path.join(__dirname, file), "utf8"))
	.join("\n");

const rsaKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.RSA_PRIVATE_KEY = Buffer.from(
	rsaKeys.privateKey.export({ type: "pkcs1", format: "pem" }),
	"utf8"
).toString("base64");
process.env.RSA_PUBLIC_KEY = Buffer.from(
	rsaKeys.publicKey.export({ type: "pkcs1", format: "pem" }),
	"utf8"
).toString("base64");
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.JWT_ACCESS_TTL = "15 minutes";
process.env.JWT_REFRESH_TTL = "7 days";
process.env.NODE_ENV = "test";
process.env.POSTGRES_HOST = "mock";
process.env.POSTGRES_PORT = "5432";
process.env.POSTGRES_USER = "mock";
process.env.POSTGRES_PASSWORD = "mock";
process.env.POSTGRES_DB = "mock";

const runMigrations = async () => {
	const statements = migrationSql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim());
	for (const statement of statements) {
		if (statement.length > 0) {
			await pool.query(statement);
		}
	}
};

const uniqueEmail = (() => {
	let counter = 0;
	return (prefix) => `${prefix}-${Date.now()}-${counter++}@example.com`;
})();

const requestJson = async (method, url, { body, token } = {}) => {
	const headers = { Accept: "application/json" };
	if (body !== undefined) {
		headers["Content-Type"] = "application/json";
	}
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	const response = await fetch(url, {
		method,
		headers,
		body: body !== undefined ? JSON.stringify(body) : undefined
	});

	const contentType = response.headers.get("content-type") ?? "";
	const expectsJson = contentType.includes("application/json") && response.status !== 204;
	const data = expectsJson ? await response.json() : null;

	return { response, data };
};

const seedAdminUser = async () => {
	const credentials = {
		email: uniqueEmail("admin"),
		password: "Adm1nCreds!123"
	};
	const hash = await bcrypt.hash(credentials.password, 10);
	await pool.query("INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)", [
		credentials.email,
		hash,
		"admin"
	]);
	return credentials;
};

const loginUser = async (email, password) => {
	const login = await requestJson("POST", `${baseUrl}/auth/login`, {
		body: { email, password }
	});
	assert.equal(login.response.status, 200);
	return login.data;
};

const createAccountForUser = async (token, { name, currency }) => {
	const account = await requestJson("POST", `${baseUrl}/accounts`, {
		body: { name, currency },
		token
	});
	assert.equal(account.response.status, 201);
	return account.data;
};

const fundAccount = async (accountId, amount) => {
	await pool.query("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [
		amount,
		accountId
	]);
};

const performTransfer = async (
	token,
	{ sourceAccountId, destinationAccountId, amount, currency, memo }
) => {
	const transfer = await requestJson("POST", `${baseUrl}/transactions/transfer`, {
		body: { sourceAccountId, destinationAccountId, amount, currency, memo },
		token
	});
	assert.equal(transfer.response.status, 201);
	return transfer.data;
};

let server;
let baseUrl;
let adminCredentials;
let backendDb;

before(async () => {
	await runMigrations();
	const { createApp } = require("../dist/app");
	backendDb = require("../dist/db/pool");
	const app = createApp();

	await new Promise((resolve) => {
		server = app.listen(0, resolve);
	});

	const address = server.address();
	const port = typeof address === "string" ? Number(address) : address?.port;
	assert.ok(port, "Server should provide a listening port");
	baseUrl = `http://127.0.0.1:${port}`;
});

beforeEach(async () => {
	await pool.query(
		"TRUNCATE TABLE risk_anomalies, risk_metrics, risk_alerts, compliance_checks, audit_logs, transactions, refresh_tokens, accounts, users"
	);
	adminCredentials = await seedAdminUser();
});

after(async () => {
	if (server) {
		await new Promise((resolve, reject) => {
			server.close((error) => (error ? reject(error) : resolve()));
		});
	}
	if (backendDb?.db?.pool && typeof backendDb.db.pool.end === "function") {
		await backendDb.db.pool.end();
	}
});

describe("Health endpoint", () => {
	it("reports service heartbeat", async () => {
		const { response, data } = await requestJson("GET", `${baseUrl}/health`);
		assert.equal(response.status, 200);
		assert.equal(data.status, "ok");
		assert.equal(typeof data.uptime, "number");
		assert.equal(typeof data.timestamp, "string");
	});
});

describe("Authentication", () => {
	it("supports client registration, login, profile lookup, refresh, and logout", async () => {
		const email = uniqueEmail("client");
		const password = "ClientPass!789";

		const register = await requestJson("POST", `${baseUrl}/auth/register`, {
			body: { email, password }
		});
		assert.equal(register.response.status, 201);
		assert.ok(register.data.accessToken);
		assert.ok(register.data.refreshToken);

		const login = await requestJson("POST", `${baseUrl}/auth/login`, {
			body: { email, password }
		});
		assert.equal(login.response.status, 200);
		const accessToken = login.data.accessToken;
		const refreshToken = login.data.refreshToken;
		assert.ok(accessToken);
		assert.ok(refreshToken);

		const profile = await requestJson("GET", `${baseUrl}/auth/me`, {
			token: accessToken
		});
		assert.equal(profile.response.status, 200);
		assert.equal(profile.data.email, email);
		assert.equal(profile.data.role, "client");
		assert.ok(profile.data.id);

		const refreshed = await requestJson("POST", `${baseUrl}/auth/refresh`, {
			body: { refreshToken }
		});
		assert.equal(refreshed.response.status, 200);
		assert.ok(refreshed.data.accessToken);
		assert.ok(refreshed.data.refreshToken);

		const logout = await requestJson("POST", `${baseUrl}/auth/logout`, {
			token: accessToken
		});
		assert.equal(logout.response.status, 204);
	});

	it("rejects duplicate registrations and invalid credentials", async () => {
		const email = uniqueEmail("duplicate");
		const password = "DupPass!456";

		const first = await requestJson("POST", `${baseUrl}/auth/register`, {
			body: { email, password }
		});
		assert.equal(first.response.status, 201);

		const second = await requestJson("POST", `${baseUrl}/auth/register`, {
			body: { email, password }
		});
		assert.equal(second.response.status, 409);

		const invalidLogin = await requestJson("POST", `${baseUrl}/auth/login`, {
			body: { email, password: "WrongPass!456" }
		});
		assert.equal(invalidLogin.response.status, 401);
	});

	it("limits administrative routes to administrators", async () => {
		const adminLogin = await requestJson("POST", `${baseUrl}/auth/login`, {
			body: { email: adminCredentials.email, password: adminCredentials.password }
		});
		assert.equal(adminLogin.response.status, 200);
		const adminToken = adminLogin.data.accessToken;

		const adminCreatesUser = await requestJson("POST", `${baseUrl}/auth/admin/register`, {
			body: {
				email: uniqueEmail("auditor"),
				password: "AuditorPass!321",
				role: "auditor"
			},
			token: adminToken
		});
		assert.equal(adminCreatesUser.response.status, 201);

		const clientRegistration = await requestJson("POST", `${baseUrl}/auth/register`, {
			body: { email: uniqueEmail("client-admin"), password: "ClientPass!321" }
		});
		const clientToken = clientRegistration.data.accessToken;

		const forbidden = await requestJson("POST", `${baseUrl}/auth/admin/register`, {
			body: {
				email: uniqueEmail("should-fail"),
				password: "ClientCannot!1",
				role: "client"
			},
			token: clientToken
		});
		assert.equal(forbidden.response.status, 403);
	});
});

describe("Accounts", () => {
	it("allows clients to manage accounts while enforcing access controls", async () => {
		const clientEmail = uniqueEmail("account-client");
		const clientPassword = "AccPass!654";
		const registration = await requestJson("POST", `${baseUrl}/auth/register`, {
			body: { email: clientEmail, password: clientPassword }
		});
		const clientToken = registration.data.accessToken;
		assert.equal(registration.response.status, 201);

		const firstAccount = await requestJson("POST", `${baseUrl}/accounts`, {
			body: { name: "Primary Checking", currency: "USD" },
			token: clientToken
		});
		assert.equal(firstAccount.response.status, 201);

		const secondAccount = await requestJson("POST", `${baseUrl}/accounts`, {
			body: { name: "Savings", currency: "USD" },
			token: clientToken
		});
		assert.equal(secondAccount.response.status, 201);

		const clientAccounts = await requestJson("GET", `${baseUrl}/accounts`, {
			token: clientToken
		});
		assert.equal(clientAccounts.response.status, 200);
		assert.equal(clientAccounts.data.length, 2);

		const otherRegistration = await requestJson("POST", `${baseUrl}/auth/register`, {
			body: { email: uniqueEmail("other-client"), password: "OtherPass!654" }
		});
		const otherToken = otherRegistration.data.accessToken;
		const otherProfile = await requestJson("GET", `${baseUrl}/auth/me`, {
			token: otherToken
		});

		const forbidden = await requestJson("POST", `${baseUrl}/accounts`, {
			body: {
				name: "Not Allowed",
				currency: "USD",
				userId: otherProfile.data.id
			},
			token: clientToken
		});
		assert.equal(forbidden.response.status, 403);

		const otherAccount = await requestJson("POST", `${baseUrl}/accounts`, {
			body: { name: "Peer Checking", currency: "USD" },
			token: otherToken
		});
		assert.equal(otherAccount.response.status, 201);

		const adminLogin = await requestJson("POST", `${baseUrl}/auth/login`, {
			body: { email: adminCredentials.email, password: adminCredentials.password }
		});
		const adminToken = adminLogin.data.accessToken;

		const adminView = await requestJson("GET", `${baseUrl}/accounts`, {
			token: adminToken
		});
		assert.equal(adminView.response.status, 200);
		assert.equal(adminView.data.length, 3);
	});
});

describe("Transactions", () => {
	it("processes transfers, updates balances, records transactions, and secures payloads", async () => {
		const clientEmail = uniqueEmail("txn-client");
		const clientPassword = "TxnPass!987";
		const registration = await requestJson("POST", `${baseUrl}/auth/register`, {
			body: { email: clientEmail, password: clientPassword }
		});
		const clientToken = registration.data.accessToken;

		const sourceAccount = await requestJson("POST", `${baseUrl}/accounts`, {
			body: { name: "Funding", currency: "USD" },
			token: clientToken
		});
		const destinationAccount = await requestJson("POST", `${baseUrl}/accounts`, {
			body: { name: "Spending", currency: "USD" },
			token: clientToken
		});

		await pool.query("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [
			1000,
			sourceAccount.data.id
		]);

		const transfer = await requestJson("POST", `${baseUrl}/transactions/transfer`, {
			body: {
				sourceAccountId: sourceAccount.data.id,
				destinationAccountId: destinationAccount.data.id,
				amount: 250,
				currency: "USD",
				memo: "Invoice payment"
			},
			token: clientToken
		});
		assert.equal(transfer.response.status, 201);
		assert.equal(transfer.data.debit.account_id, sourceAccount.data.id);
		assert.equal(transfer.data.credit.account_id, destinationAccount.data.id);
		assert.equal(transfer.data.debit.direction, "debit");
		assert.equal(transfer.data.credit.direction, "credit");
		assert.ok(transfer.data.encryptedPayload.ciphertext);

		const updatedAccounts = await requestJson("GET", `${baseUrl}/accounts`, {
			token: clientToken
		});
		const balancesById = Object.fromEntries(
			updatedAccounts.data.map((account) => [account.id, account.balance])
		);
		assert.equal(balancesById[sourceAccount.data.id], "750.0000");
		assert.equal(balancesById[destinationAccount.data.id], "250.0000");

		const sourceTransactions = await requestJson(
			"GET",
			`${baseUrl}/transactions/account/${sourceAccount.data.id}`,
			{ token: clientToken }
		);
		assert.equal(sourceTransactions.response.status, 200);
		assert.equal(sourceTransactions.data.length, 1);
		assert.equal(sourceTransactions.data[0].direction, "debit");

		const auditLogs = getState().auditLogs;
		assert.equal(auditLogs.length, 1);
		assert.equal(auditLogs[0].event_type, "transaction.transfer");

		const insufficient = await requestJson("POST", `${baseUrl}/transactions/transfer`, {
			body: {
				sourceAccountId: sourceAccount.data.id,
				destinationAccountId: destinationAccount.data.id,
				amount: 1000,
				currency: "USD"
			},
			token: clientToken
		});
		assert.equal(insufficient.response.status, 400);

		const otherClient = await requestJson("POST", `${baseUrl}/auth/register`, {
			body: { email: uniqueEmail("other-txn"), password: "OtherTxn!321" }
		});
		const otherToken = otherClient.data.accessToken;
		const otherAccount = await requestJson("POST", `${baseUrl}/accounts`, {
			body: { name: "Other Account", currency: "USD" },
			token: otherToken
		});
		await pool.query("UPDATE accounts SET balance = balance + $1 WHERE id = $2", [
			500,
			otherAccount.data.id
		]);

		const unauthorizedTransfer = await requestJson("POST", `${baseUrl}/transactions/transfer`, {
			body: {
				sourceAccountId: otherAccount.data.id,
				destinationAccountId: destinationAccount.data.id,
				amount: 50,
				currency: "USD"
			},
			token: clientToken
		});
		assert.equal(unauthorizedTransfer.response.status, 403);

		const unauthorizedView = await requestJson(
			"GET",
			`${baseUrl}/transactions/account/${otherAccount.data.id}`,
			{ token: clientToken }
		);
		assert.equal(unauthorizedView.response.status, 403);
	});
});

describe("Risk and compliance", () => {
	it("records compliance checks and risk metrics for transfers", async () => {
		const clientEmail = uniqueEmail("risk-client");
		const clientPassword = "RiskPass!321";
		const registration = await requestJson("POST", `${baseUrl}/auth/register`, {
			body: { email: clientEmail, password: clientPassword }
		});
		assert.equal(registration.response.status, 201);
		const clientToken = registration.data.accessToken;

		const profile = await requestJson("GET", `${baseUrl}/auth/me`, { token: clientToken });
		assert.equal(profile.response.status, 200);
		const userId = profile.data.id;

		const sourceAccount = await createAccountForUser(clientToken, {
			name: "Operating",
			currency: "USD"
		});
		const destinationAccount = await createAccountForUser(clientToken, {
			name: "Reserves",
			currency: "USD"
		});

		await fundAccount(sourceAccount.id, 1000);

		const transfer = await performTransfer(clientToken, {
			sourceAccountId: sourceAccount.id,
			destinationAccountId: destinationAccount.id,
			amount: 500,
			currency: "USD",
			memo: "Operating expense"
		});

		assert.equal(transfer.compliance.length, 2);
		const complianceByType = Object.fromEntries(
			transfer.compliance.map((entry) => [entry.checkType, entry])
		);
		assert.equal(complianceByType["kyc-profile"].status, "passed");
		assert.equal(complianceByType["aml-transaction"].status, "passed");
		assert.equal(complianceByType["aml-transaction"].details.rulesTriggered.highValue, false);

		assert.equal(transfer.sourceRisk.exposure, 500);
		assert.ok(Math.abs(transfer.sourceRisk.leverage - 1) < 0.0001);
		assert.ok(transfer.sourceRisk.lossRatio > 100);
		assert.equal(transfer.destinationRisk.exposure, 0);
		assert.equal(transfer.destinationRisk.lossRatio, 0);

		const complianceRows = await pool.query(
			"SELECT check_type, status, details FROM compliance_checks WHERE user_id = $1 ORDER BY created_at ASC",
			[userId]
		);
		assert.equal(complianceRows.rowCount, 2);
		const storedTypes = complianceRows.rows.map((row) => row.check_type).sort();
		assert.deepEqual(storedTypes, ["aml-transaction", "kyc-profile"]);

		const sourceMetrics = await pool.query(
			"SELECT id, account_id, exposure, leverage, loss_ratio, observation_window, created_at FROM risk_metrics WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2",
			[sourceAccount.id, 5]
		);
		assert.equal(sourceMetrics.rowCount, 1);
		assert.equal(Number(sourceMetrics.rows[0].exposure), 500);

		const destinationMetrics = await pool.query(
			"SELECT id, account_id, exposure, leverage, loss_ratio, observation_window, created_at FROM risk_metrics WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2",
			[destinationAccount.id, 5]
		);
		assert.equal(destinationMetrics.rowCount, 1);
		assert.equal(Number(destinationMetrics.rows[0].exposure), 0);
	});

	it("flags high-value transfers during compliance simulation", async () => {
		const clientEmail = uniqueEmail("aml-client");
		const clientPassword = "AMLPass!654";
		const registration = await requestJson("POST", `${baseUrl}/auth/register`, {
			body: { email: clientEmail, password: clientPassword }
		});
		assert.equal(registration.response.status, 201);
		const clientToken = registration.data.accessToken;

		const profile = await requestJson("GET", `${baseUrl}/auth/me`, { token: clientToken });
		const userId = profile.data.id;

		const sourceAccount = await createAccountForUser(clientToken, {
			name: "Escrow",
			currency: "USD"
		});
		const destinationAccount = await createAccountForUser(clientToken, {
			name: "Vendor",
			currency: "USD"
		});

		await fundAccount(sourceAccount.id, 100000);

		const transfer = await performTransfer(clientToken, {
			sourceAccountId: sourceAccount.id,
			destinationAccountId: destinationAccount.id,
			amount: 60000,
			currency: "USD",
			memo: "High value disbursement"
		});

		const amlResult = transfer.compliance.find(
			(entry) => entry.checkType === "aml-transaction"
		);
		assert.ok(amlResult);
		assert.equal(amlResult.status, "failed");
		assert.equal(amlResult.details.rulesTriggered.highValue, true);

		const complianceRows = await pool.query(
			"SELECT check_type, status, details FROM compliance_checks WHERE user_id = $1 ORDER BY created_at ASC",
			[userId]
		);
		const storedAml = complianceRows.rows.find((row) => row.check_type === "aml-transaction");
		assert.ok(storedAml);
		assert.equal(storedAml.status, "failed");
		assert.equal(storedAml.details.rulesTriggered.highValue, true);
	});

	it("enforces access to risk endpoints and surfaces evaluations", async () => {
		const clientEmail = uniqueEmail("risk-endpoints");
		const clientPassword = "RiskEnd!852";
		const registration = await requestJson("POST", `${baseUrl}/auth/register`, {
			body: { email: clientEmail, password: clientPassword }
		});
		const clientToken = registration.data.accessToken;

		const sourceAccount = await createAccountForUser(clientToken, {
			name: "Clearing",
			currency: "USD"
		});
		const destinationAccount = await createAccountForUser(clientToken, {
			name: "Receivables",
			currency: "USD"
		});

		await fundAccount(sourceAccount.id, 5000);

		await performTransfer(clientToken, {
			sourceAccountId: sourceAccount.id,
			destinationAccountId: destinationAccount.id,
			amount: 1200,
			currency: "USD",
			memo: "Quarterly payout"
		});

		await pool.query("TRUNCATE TABLE risk_metrics");

		const ownerMetrics = await requestJson(
			"GET",
			`${baseUrl}/risk/accounts/${sourceAccount.id}/metrics`,
			{ token: clientToken }
		);
		assert.equal(ownerMetrics.response.status, 200);
		assert.ok(Array.isArray(ownerMetrics.data.metrics));
		assert.ok(ownerMetrics.data.metrics.length >= 1);
		assert.equal(ownerMetrics.data.latestEvaluation.accountId, sourceAccount.id);

		const storedMetrics = await pool.query(
			"SELECT id, account_id, exposure, leverage, loss_ratio, observation_window, created_at FROM risk_metrics WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2",
			[sourceAccount.id, 1]
		);
		assert.equal(storedMetrics.rowCount, 1);

		const otherRegistration = await requestJson("POST", `${baseUrl}/auth/register`, {
			body: { email: uniqueEmail("other-risk"), password: "OtherRisk!951" }
		});
		const otherToken = otherRegistration.data.accessToken;
		const forbidden = await requestJson(
			"GET",
			`${baseUrl}/risk/accounts/${sourceAccount.id}/metrics`,
			{ token: otherToken }
		);
		assert.equal(forbidden.response.status, 403);

		const adminLogin = await loginUser(adminCredentials.email, adminCredentials.password);
		const adminView = await requestJson(
			"GET",
			`${baseUrl}/risk/accounts/${sourceAccount.id}/metrics`,
			{ token: adminLogin.accessToken }
		);
		assert.equal(adminView.response.status, 200);
		assert.ok(adminView.data.metrics.length >= 1);
	});

	it("restricts risk alerts to privileged roles", async () => {
		const clientRegistration = await requestJson("POST", `${baseUrl}/auth/register`, {
			body: { email: uniqueEmail("alerts-client"), password: "AlertsPass!147" }
		});
		const clientToken = clientRegistration.data.accessToken;

		const clientAccount = await createAccountForUser(clientToken, {
			name: "Alerts",
			currency: "USD"
		});

		await pool.query(
			"INSERT INTO risk_alerts (account_id, alert_type, severity, details) VALUES ($1, $2, $3, $4)",
			[clientAccount.id, "loss_threshold", "medium", { lossRatio: 0.2 }]
		);
		await pool.query(
			"INSERT INTO risk_alerts (account_id, alert_type, severity, details) VALUES ($1, $2, $3, $4)",
			[null, "aml_flag", "critical", { userId: "admin" }]
		);

		const clientAlerts = await requestJson("GET", `${baseUrl}/risk/alerts`, {
			token: clientToken
		});
		assert.equal(clientAlerts.response.status, 403);

		const adminLogin = await loginUser(adminCredentials.email, adminCredentials.password);
		const adminAlerts = await requestJson("GET", `${baseUrl}/risk/alerts?limit=1`, {
			token: adminLogin.accessToken
		});
		assert.equal(adminAlerts.response.status, 200);
		assert.equal(adminAlerts.data.length, 1);
		assert.equal(adminAlerts.data[0].alert_type, "aml_flag");
	});
});
