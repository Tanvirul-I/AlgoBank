const { randomUUID } = require("node:crypto");

const formatAmount = (value) => Number(value).toFixed(4);

const emptyState = () => ({
	users: [],
	accounts: [],
	transactions: [],
	refreshTokens: [],
	auditLogs: [],
	riskMetrics: [],
	riskAlerts: [],
	riskAnomalies: [],
	complianceChecks: []
});

const emptyResult = (rowCount = 0) => ({ rows: [], rowCount });

const cloneState = (state) => {
	if (typeof structuredClone === "function") {
		return structuredClone(state);
	}
	return JSON.parse(JSON.stringify(state));
};

const normalize = (sql) => sql.replace(/\s+/g, " ").trim().toLowerCase();

const selectUserByEmail = (state, email) =>
	state.users.find((user) => user.email === email) ?? null;

const selectUserById = (state, id) => state.users.find((user) => user.id === id) ?? null;

const selectAccountById = (state, id) =>
	state.accounts.find((account) => account.id === id) ?? null;

const selectRefreshTokens = (state, predicate) => state.refreshTokens.filter(predicate);

const executeQuery = (state, sql, params) => {
	const normalized = normalize(sql);

	if (normalized.startsWith("create extension")) {
		return emptyResult();
	}

	if (normalized.startsWith("create table")) {
		return emptyResult();
	}

	if (normalized.startsWith("create index")) {
		return emptyResult();
	}

	if (normalized.startsWith("truncate table")) {
		const section = normalized
			.slice("truncate table".length)
			.split(" restart")[0]
			.split(",")
			.map((value) => value.trim());

		for (const table of section) {
			if (table === "users") {
				state.users = [];
			} else if (table === "accounts") {
				state.accounts = [];
			} else if (table === "transactions") {
				state.transactions = [];
			} else if (table === "refresh_tokens") {
				state.refreshTokens = [];
			} else if (table === "audit_logs") {
				state.auditLogs = [];
			} else if (table === "risk_metrics") {
				state.riskMetrics = [];
			} else if (table === "risk_alerts") {
				state.riskAlerts = [];
			} else if (table === "risk_anomalies") {
				state.riskAnomalies = [];
			} else if (table === "compliance_checks") {
				state.complianceChecks = [];
			}
		}

		return emptyResult();
	}

	if (normalized.startsWith("insert into users")) {
		const [email, passwordHash, role] = params;
		const now = new Date();
		const record = {
			id: randomUUID(),
			email,
			password_hash: passwordHash,
			role,
			created_at: now,
			updated_at: now
		};
		state.users = [...state.users, record];
		return { rows: [record], rowCount: 1 };
	}

	if (
		normalized.startsWith(
			"select id, email, password_hash, role, created_at, updated_at from users where email"
		)
	) {
		const [email] = params;
		const record = selectUserByEmail(state, email);
		return record ? { rows: [record], rowCount: 1 } : emptyResult();
	}

	if (
		normalized.startsWith(
			"select id, email, password_hash, role, created_at, updated_at from users where id"
		)
	) {
		const [id] = params;
		const record = selectUserById(state, id);
		return record ? { rows: [record], rowCount: 1 } : emptyResult();
	}

	if (normalized.startsWith("insert into accounts")) {
		const [userId, name, currency] = params;
		const now = new Date();
		const record = {
			id: randomUUID(),
			user_id: userId,
			name,
			balance: 0,
			currency,
			created_at: now,
			updated_at: now
		};
		state.accounts = [...state.accounts, record];
		return {
			rows: [
				{
					...record,
					balance: formatAmount(record.balance)
				}
			],
			rowCount: 1
		};
	}

	if (
		normalized.startsWith(
			"select id, user_id, name, balance, currency, created_at, updated_at from accounts where id"
		)
	) {
		const [id] = params;
		const record = selectAccountById(state, id);
		if (!record) {
			return emptyResult();
		}

		return {
			rows: [
				{
					...record,
					balance: formatAmount(record.balance)
				}
			],
			rowCount: 1
		};
	}

	if (
		normalized ===
		"select id, user_id, name, balance, currency, created_at, updated_at from accounts order by created_at desc"
	) {
		const rows = state.accounts
			.slice()
			.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
			.map((record) => ({
				...record,
				balance: formatAmount(record.balance)
			}));
		return { rows, rowCount: rows.length };
	}

	if (
		normalized ===
		"select id, user_id, name, balance, currency, created_at, updated_at from accounts where user_id = $1"
	) {
		const [userId] = params;
		const rows = state.accounts
			.filter((record) => record.user_id === userId)
			.map((record) => ({
				...record,
				balance: formatAmount(record.balance)
			}));
		return { rows, rowCount: rows.length };
	}

	if (normalized.startsWith("update accounts set balance = balance - $1 where id = $2")) {
		const [amount, accountId] = params;
		const record = selectAccountById(state, accountId);
		if (!record) {
			return emptyResult();
		}
		record.balance = Number(record.balance) - Number(amount);
		record.updated_at = new Date();
		return emptyResult(1);
	}

	if (normalized.startsWith("update accounts set balance = balance + $1 where id = $2")) {
		const [amount, accountId] = params;
		const record = selectAccountById(state, accountId);
		if (!record) {
			return emptyResult();
		}
		record.balance = Number(record.balance) + Number(amount);
		record.updated_at = new Date();
		return emptyResult(1);
	}

	if (normalized.startsWith("insert into transactions")) {
		const [
			accountId,
			counterpartyAccountId,
			amount,
			currency,
			direction,
			memo,
			encryptedPayload
		] = params;
		const record = {
			id: randomUUID(),
			account_id: accountId,
			counterparty_account_id: counterpartyAccountId ?? null,
			amount,
			currency,
			direction,
			memo: memo ?? null,
			encrypted_payload: encryptedPayload,
			created_at: new Date()
		};
		state.transactions = [...state.transactions, record];
		return { rows: [record], rowCount: 1 };
	}

	if (
		normalized.startsWith(
			"select id, account_id, counterparty_account_id, amount, currency, direction, memo, encrypted_payload, created_at from transactions where account_id = $1 order by created_at desc limit"
		)
	) {
		const [accountId, limit] = params;
		const rows = state.transactions
			.filter((record) => record.account_id === accountId)
			.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
			.slice(0, Number(limit))
			.map((record) => ({ ...record }));
		return { rows, rowCount: rows.length };
	}

	if (normalized.startsWith("insert into refresh_tokens")) {
		const [id, userId, tokenId] = params;
		const record = {
			id,
			user_id: userId,
			token_id: tokenId,
			expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			revoked_at: null,
			created_at: new Date()
		};
		state.refreshTokens = [...state.refreshTokens, record];
		return emptyResult(1);
	}

	if (
		normalized.startsWith(
			"select id from refresh_tokens where user_id = $1 and token_id = $2 and revoked_at is null"
		)
	) {
		const [userId, tokenId] = params;
		const rows = selectRefreshTokens(
			state,
			(record) =>
				record.user_id === userId &&
				record.token_id === tokenId &&
				record.revoked_at === null
		).map((record) => ({ id: record.id }));
		return { rows, rowCount: rows.length };
	}

	if (normalized.startsWith("update refresh_tokens set revoked_at = now() where token_id = $1")) {
		const [tokenId] = params;
		let count = 0;
		const now = new Date();
		state.refreshTokens = state.refreshTokens.map((record) => {
			if (record.token_id === tokenId) {
				count += 1;
				return { ...record, revoked_at: now };
			}
			return record;
		});
		return emptyResult(count);
	}

	if (
		normalized.startsWith(
			"update refresh_tokens set revoked_at = now() where user_id = $1 and revoked_at is null"
		)
	) {
		const [userId] = params;
		let count = 0;
		const now = new Date();
		state.refreshTokens = state.refreshTokens.map((record) => {
			if (record.user_id === userId && record.revoked_at === null) {
				count += 1;
				return { ...record, revoked_at: now };
			}
			return record;
		});
		return emptyResult(count);
	}

	if (normalized.startsWith("select user_id from accounts where id = $1")) {
		const [accountId] = params;
		const record = selectAccountById(state, accountId);
		return record ? { rows: [{ user_id: record.user_id }], rowCount: 1 } : emptyResult();
	}

	if (normalized.startsWith("insert into risk_metrics")) {
		const [accountId, exposure, leverage, lossRatio, window] = params;
		const record = {
			id: randomUUID(),
			account_id: accountId,
			exposure: formatAmount(exposure),
			leverage: formatAmount(leverage),
			loss_ratio: Number(lossRatio).toFixed(6),
			observation_window: window,
			created_at: new Date()
		};
		state.riskMetrics = [...state.riskMetrics, record];
		return { rows: [record], rowCount: 1 };
	}

	if (
		normalized.startsWith(
			"select id, account_id, exposure, leverage, loss_ratio, observation_window, created_at from risk_metrics where account_id = $1 order by created_at desc limit"
		)
	) {
		const [accountId, limit] = params;
		const rows = state.riskMetrics
			.filter((record) => record.account_id === accountId)
			.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
			.slice(0, Number(limit))
			.map((record) => ({ ...record }));
		return { rows, rowCount: rows.length };
	}

	if (normalized.startsWith("insert into risk_alerts")) {
		const [accountId, alertType, severity, details] = params;
		const record = {
			id: randomUUID(),
			account_id: accountId,
			alert_type: alertType,
			severity,
			details,
			triggered_at: new Date(),
			resolved_at: null,
			acknowledgement: null
		};
		state.riskAlerts = [...state.riskAlerts, record];
		return { rows: [record], rowCount: 1 };
	}

	if (
		normalized.startsWith(
			"select id, account_id, alert_type, severity, details, triggered_at, resolved_at, acknowledgement from risk_alerts order by case severity when 'critical' then 4 when 'high' then 3 when 'medium' then 2 when 'low' then 1 else 0 end desc, triggered_at desc limit"
		)
	) {
		const [limit] = params;
		const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
		const rows = state.riskAlerts
			.slice()
			.sort((a, b) => {
				const severityDelta =
					(severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0);
				if (severityDelta !== 0) {
					return severityDelta;
				}
				return b.triggered_at.getTime() - a.triggered_at.getTime();
			})
			.slice(0, Number(limit))
			.map((record) => ({ ...record }));
		return { rows, rowCount: rows.length };
	}

	if (
		normalized.startsWith(
			"select id, account_id, alert_type, severity, details, triggered_at, resolved_at, acknowledgement from risk_alerts order by triggered_at desc limit"
		)
	) {
		const [limit] = params;
		const rows = state.riskAlerts
			.slice()
			.sort((a, b) => b.triggered_at.getTime() - a.triggered_at.getTime())
			.slice(0, Number(limit))
			.map((record) => ({ ...record }));
		return { rows, rowCount: rows.length };
	}

	if (normalized.startsWith("insert into risk_anomalies")) {
		const [transactionId, accountId, score, threshold, detectorVersion, metadata] = params;
		const record = {
			id: randomUUID(),
			transaction_id: transactionId,
			account_id: accountId,
			anomaly_score: Number(score).toFixed(6),
			score_threshold: Number(threshold).toFixed(6),
			detector_version: detectorVersion,
			metadata,
			created_at: new Date()
		};
		state.riskAnomalies = [...state.riskAnomalies, record];
		return { rows: [record], rowCount: 1 };
	}

	if (normalized.startsWith("insert into compliance_checks")) {
		const [userId, transactionId, checkType, status, details] = params;
		const record = {
			id: randomUUID(),
			user_id: userId,
			transaction_id: transactionId ?? null,
			check_type: checkType,
			status,
			details,
			created_at: new Date()
		};
		state.complianceChecks = [...state.complianceChecks, record];
		return { rows: [record], rowCount: 1 };
	}

	if (
		normalized.startsWith(
			"select check_type, status, details from compliance_checks where user_id = $1 order by created_at"
		)
	) {
		const [userId] = params;
		const rows = state.complianceChecks
			.filter((record) => record.user_id === userId)
			.sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
			.map((record) => ({
				check_type: record.check_type,
				status: record.status,
				details: record.details
			}));
		return { rows, rowCount: rows.length };
	}

	if (normalized.startsWith("insert into audit_logs")) {
		const [eventType, payload, hash, previousHash] = params;
		const record = {
			id: randomUUID(),
			event_type: eventType,
			payload,
			hash,
			previous_hash: previousHash ?? null,
			created_at: new Date()
		};
		state.auditLogs = [...state.auditLogs, record];
		return { rows: [record], rowCount: 1 };
	}

	if (normalized.startsWith("select hash from audit_logs order by created_at desc limit 1")) {
		const rows = state.auditLogs
			.slice()
			.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
			.slice(0, 1)
			.map((record) => ({ hash: record.hash }));
		return { rows, rowCount: rows.length };
	}

	throw new Error(`Unsupported SQL query: ${sql}`);
};

class MockPool {
	constructor(stateRef) {
		this._stateRef = stateRef;
	}

	async query(sql, params = []) {
		return executeQuery(this._stateRef.value, sql, params);
	}

	async connect() {
		return new MockClient(this);
	}

	on() {
		return this;
	}

	async end() {
		return this;
	}

	get state() {
		return this._stateRef.value;
	}

	set state(nextState) {
		this._stateRef.value = nextState;
	}
}

class MockClient {
	constructor(pool) {
		this._pool = pool;
		this._transactionState = null;
		this._inTransaction = false;
	}

	async query(sql, params = []) {
		const normalized = normalize(sql);
		if (normalized === "begin") {
			this._transactionState = cloneState(this._pool.state);
			this._inTransaction = true;
			return emptyResult();
		}

		if (normalized === "commit") {
			if (this._inTransaction && this._transactionState) {
				this._pool.state = this._transactionState;
			}
			this._transactionState = null;
			this._inTransaction = false;
			return emptyResult();
		}

		if (normalized === "rollback") {
			this._transactionState = null;
			this._inTransaction = false;
			return emptyResult();
		}

		const targetState =
			this._inTransaction && this._transactionState
				? this._transactionState
				: this._pool.state;
		const result = executeQuery(targetState, sql, params);
		if (this._inTransaction && this._transactionState) {
			this._transactionState = targetState;
		} else {
			this._pool.state = targetState;
		}
		return result;
	}

	release() {
		this._transactionState = null;
		this._inTransaction = false;
	}
}

module.exports = () => {
	const stateRef = { value: emptyState() };

	class BoundPool extends MockPool {
		constructor() {
			super(stateRef);
		}
	}

	const pgPath = require.resolve("pg");
	require.cache[pgPath] = {
		id: pgPath,
		filename: pgPath,
		loaded: true,
		exports: {
			Pool: class extends BoundPool {
				constructor() {
					super();
				}
			}
		}
	};

	const pool = new BoundPool();

	return {
		pool,
		getState: () => stateRef.value
	};
};
