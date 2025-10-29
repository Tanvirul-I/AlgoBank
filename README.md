# AlgoBank Platform

AlgoBank is a quantitative risk and trading simulation platform that unifies:

-   Algorithmic trading research and analytics
-   Bank-grade account, transaction, and compliance services
-   Secure, distributed infrastructure patterns

This repository is structured as a monorepo with dedicated workspaces for the backend services, analytics libraries, and frontend dashboard.

```
backend/   # Node.js API for authentication, accounts, transactions, risk monitoring, and compliance
analytics/ # Python quantitative analytics and optimization engine
frontend/  # React dashboard for real-time portfolio, compliance, and market analytics
docs/      # Architecture diagrams, OpenAPI specs, and module guides
```

## Backend Core

The backend service provides secure account, transaction, and authentication primitives with layered defense:

-   **Authentication & Authorization** – JWT access/refresh token pairs, rotation + revocation support, and role-based guards for admin, auditor, and client personas.
-   **Accounts & Transactions** – Double-entry accounting with balance reconciliation, vault-backed encryption, and audit-log chaining for tamper evidence.
-   **Risk & Compliance** – Exposure/leverage monitoring, Isolation Forest anomaly scoring, mock KYC/AML checks, and optional Redis Streams alert broadcasting.

Refer to `backend/README.md` for configuration, migrations, pentesting helpers, and the `docs/openapi.yml` contract.

## Quantitative Analytics Engine

The analytics workspace ships with a fully featured research toolkit:

-   **Strategy Templates** – Mean reversion, statistical arbitrage, and Black–Scholes pricing utilities ready for backtesting.
-   **Backtesting & Metrics** – Parameter sweeps, PnL tracking, Sharpe/Max Drawdown/VaR/CVaR computation, and persistence helpers for PostgreSQL.
-   **Optimization** – Markowitz optimization via cvxpy when available with PyTorch-powered gradient routines as a fallback.
-   **Integration Layer** – Lightweight REST bridge for backend orchestration and notebooks for exploratory validation.

See `analytics/README.md` and the modules within `analytics/python/quant_engine/` for usage examples.

## Web Dashboard

The frontend Vite + React application visualizes platform data end-to-end:

-   **Authentication & Routing** – Protected route shells with role-aware navigation, global theming, and session handling.
-   **Views** – Portfolio overview (positions, balances, PnL), compliance console (flagged alerts, audit trails), and market analytics (strategy performance + charts).
-   **Realtime Connectivity** – REST client abstractions and WebSocket hooks for market and risk event streaming.

Frontend setup instructions live in `frontend/README.md`, while API integration and deployment details are documented under `docs/frontend/`.

## Getting Started

1. **Clone & Install Dependencies**
    ```bash
    git clone <repo>
    cd musical-octo-invention
    cd backend && npm install
    ```
2. **Provision Environment Variables**
    ```bash
    cp backend/.env.example backend/.env
    ```
    Populate the RSA key variables using the commands documented in `backend/README.md`. If you plan to enable Vault encryption or Redis alert streaming, also provide the Vault and Redis connection variables described in that file.
3. **Launch Infrastructure**
    ```bash
    docker compose up -d
    ```
4. **Run Database Migrations**
    ```bash
    cd backend
    npm run migrate
    ```
5. **Start the API**
    ```bash
    npm run dev
    ```

The backend API will be available on `http://localhost:4000`. Consult `docs/openapi.yml` for detailed endpoint contracts.

## Continuous Integration

A GitHub Actions workflow (`.github/workflows/ci.yml`) lints and builds the backend service on every push and pull request.

## Next Steps

-   Expand analytics persistence with historical benchmarking datasets.
-   Harden the backend with chaos testing and load profiles.
-   Extend infrastructure automation with Kubernetes manifests and multi-service orchestration.
