# AlgoBank Backend

Secure account, transaction, and authentication foundation for the AlgoBank simulation platform.

## Features

-   **JWT Authentication** – Access and refresh tokens with rotation and revocation support.
-   **Role-Based Access Control** – Admin, auditor, and client roles enforced via middleware.
-   **Double-Entry Transactions** – Transfer workflow keeps account balances consistent inside a PostgreSQL transaction.
-   **Hybrid Encryption** – AES-256-GCM payloads protected by RSA key wrapping for tamper-resistant transaction storage.
-   **Audit Trail** – Hash-chained JSON audit log entries for compliance-grade traceability.
-   **Risk Monitoring** – Exposure, leverage, and loss metrics computed after each transfer with anomaly detection and alerting.
-   **Compliance Simulation** – Mock KYC/AML checks and validation events linked to transactions via immutable audit logs.
-   **Alert Streaming** – Optional Redis Streams publishing for risk and compliance alerts with secure admin retrieval endpoints.
-   **Vault Integration** – Transparent encryption and decryption of sensitive payloads using HashiCorp Vault Transit.
-   **Validation & Error Handling** – Structured validation using `express-validator` with centralized error responses.

## Project Structure

```
src/
  config/          # Environment helpers
  db/              # Database client abstraction
  middlewares/     # Authentication and error handling
  repositories/    # Persistence layer for core entities
  routes/          # Express route definitions
  services/        # Business logic and encryption helpers
  utils/           # Shared utilities
```

## Getting Started

1. Install dependencies:
    ```bash
    npm install
    ```
2. Copy environment template and fill values:
    ```bash
    cp .env.example .env
    ```
3. Provide Base64-encoded PEM strings for `RSA_PRIVATE_KEY` and `RSA_PUBLIC_KEY`. Generate locally with:
    ```bash
    openssl genrsa -out private.pem 4096
    openssl rsa -in private.pem -pubout -out public.pem
    base64 -w0 private.pem > private.b64
    base64 -w0 public.pem > public.b64
    ```
    Paste the resulting strings into `.env`.
4. (Optional) Configure Vault Transit encryption by supplying `VAULT_ADDR`, `VAULT_TOKEN`, `VAULT_TRANSIT_PATH`, and `VAULT_ENCRYPTION_KEY`. To emit alerts over Redis Streams, set `ENABLE_REDIS_STREAMS=true` and ensure `REDIS_URL` targets a reachable instance.
5. Start dependencies via Docker (see repository root `docker-compose.yml`) and run migrations. If you run the backend directly on your host machine, update `.env` to use `POSTGRES_HOST=localhost` before running the migration step so the Node process can reach the PostgreSQL container:
    ```bash
    npm run build
    npm run migrate
    ```
6. Launch the API:
    ```bash
    npm run dev
    ```
    If the command exits with `EADDRINUSE` because something else is already listening on port `4000`, either stop the conflicting
    process or change the `PORT` value in `.env` to a free port before rerunning the command.

## Bootstrapping Admin Accounts

Use the bundled helper to create an initial administrator (or any other role) without writing manual SQL:

```bash
# Provide credentials via CLI arguments
npm run create:admin -- admin@example.com "Sup3rSecurePass!"

# Or rely on environment variables for non-interactive environments
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD="Sup3rSecurePass!" npm run create:admin
```

The script hashes the password, enforces strong role validation, and skips creation if the email already exists. Administrator
accounts can subsequently register additional admins, auditors, or clients over the `/auth/admin/register` endpoint.

## Available Scripts

-   `npm run dev` – Start development server with hot reload.
-   `npm run build` – Type-check and compile TypeScript to `dist/`.
-   `npm run lint` – Run ESLint using the shared configuration.
-   `npm test` – Build the project and exercise the heartbeat check with Node's test runner.
-   `npm run pentest` – Execute the bundled penetration-testing helper against a running instance.

## API Overview

The OpenAPI specification describing all endpoints lives at `../docs/openapi.yml`.

Key endpoints:

-   `GET /health` – Lightweight heartbeat that reports service status, uptime, and a current timestamp.
-   `GET /risk/alerts` – Administrator and auditor route that returns the most recent flagged alerts.
-   `GET /risk/accounts/:accountId/metrics` – Retrieve rolling risk metrics and the latest evaluation for an account.
