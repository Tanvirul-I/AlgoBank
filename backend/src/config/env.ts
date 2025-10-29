import dotenv from "dotenv";

dotenv.config();

const DEFAULT_CORS_ORIGINS = [
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"http://localhost:4173",
	"http://127.0.0.1:4173",
	"http://localhost:8080",
	"http://127.0.0.1:8080",
	"http://localhost:3000",
	"http://127.0.0.1:3000"
] as const;

const REQUIRED_VARS = [
	"JWT_ACCESS_SECRET",
	"JWT_REFRESH_SECRET",
	"POSTGRES_HOST",
	"POSTGRES_PORT",
	"POSTGRES_USER",
	"POSTGRES_PASSWORD",
	"POSTGRES_DB",
	"RSA_PRIVATE_KEY",
	"RSA_PUBLIC_KEY"
] as const;

const SECURITY_SENSITIVE_VARS = [
	"VAULT_ADDR",
	"VAULT_TOKEN",
	"VAULT_TRANSIT_PATH",
	"REDIS_URL"
] as const;

type RequiredVar = (typeof REQUIRED_VARS)[number];

const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

if (missing.length > 0) {
	const message = `Missing environment variables: ${missing.join(", ")}`;
	if (process.env.NODE_ENV === "production") {
		throw new Error(message);
	}
	// eslint-disable-next-line no-console
	console.warn(message);
}

const missingSensitive = SECURITY_SENSITIVE_VARS.filter((key) => !process.env[key]);

if (missingSensitive.length > 0) {
	// eslint-disable-next-line no-console
	console.warn(
		`Security-sensitive environment variables are not fully configured: ${missingSensitive.join(
			", "
		)}`
	);
}

const parseCorsOrigins = (value: string | undefined): string[] => {
	if (!value) {
		return [...DEFAULT_CORS_ORIGINS];
	}

	const trimmed = value.trim();

	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		try {
			const parsed = JSON.parse(trimmed);

			if (Array.isArray(parsed)) {
				const originsFromJson = parsed
					.filter((origin): origin is string => typeof origin === "string")
					.map((origin) => origin.trim())
					.filter(Boolean);

				if (originsFromJson.length > 0) {
					return originsFromJson;
				}
			}
		} catch (error) {
			// eslint-disable-next-line no-console
			console.warn("Failed to parse CORS origins from JSON value", error);
		}
	}

	const origins = trimmed
		.split(/[,\s]+/)
		.map((origin) => origin.trim())
		.filter(Boolean);

	console.log(origins);

	return origins.length > 0 ? origins : [...DEFAULT_CORS_ORIGINS];
};

export const env = {
	nodeEnv: process.env.NODE_ENV ?? "development",
	port: Number(process.env.PORT ?? 4000),
	jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? "change-me-access",
	jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? "change-me-refresh",
	jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? "15 minutes",
	jwtRefreshTtl: process.env.JWT_REFRESH_TTL ?? "7 days",
	postgres: {
		host: process.env.POSTGRES_HOST ?? "localhost",
		port: Number(process.env.POSTGRES_PORT ?? 5432),
		user: process.env.POSTGRES_USER ?? "algobank",
		password: process.env.POSTGRES_PASSWORD ?? "algobank",
		database: process.env.POSTGRES_DB ?? "algobank",
		ssl: process.env.POSTGRES_SSL === "true"
	},
	redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
	enableRedisStreams: process.env.ENABLE_REDIS_STREAMS === "true",
	vault: {
		addr: process.env.VAULT_ADDR ?? "",
		token: process.env.VAULT_TOKEN ?? "",
		transitPath: process.env.VAULT_TRANSIT_PATH ?? "transit/algobank",
		encryptionKeyName: process.env.VAULT_ENCRYPTION_KEY ?? "algobank-transit"
	},
	rsaPrivateKey: process.env.RSA_PRIVATE_KEY ?? "",
	rsaPublicKey: process.env.RSA_PUBLIC_KEY ?? "",
	cors: {
		allowedOrigins: parseCorsOrigins(process.env.CORS_ALLOWED_ORIGINS)
	}
};

export const hasRequiredEnv = (key: RequiredVar): boolean => Boolean(process.env[key]);
