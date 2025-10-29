# AlgoBank Frontend

React + Vite dashboard for portfolio, compliance, and market analytics monitoring.

## Stack

-   **Vite + React 18 + TypeScript** for a fast development workflow.
-   **Tailwind CSS** for utility-first styling.
-   **react-router-dom** for SPA routing with protected routes.
-   **Axios** for REST integration.
-   **react-chartjs-2 / Chart.js** for interactive visualizations.
-   **Custom providers** for authentication, theming, and WebSocket connectivity.

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

Configure the API endpoints via `.env.local` (see `.env.example`). The development server runs on `http://localhost:5173`.

## Project Structure

```
frontend/
├── src/
│   ├── components/    # UI primitives (cards, charts, tables)
│   ├── layouts/       # Layout shells (sidebar + outlet)
│   ├── pages/         # Route views (portfolio, compliance, analytics, login)
│   ├── providers/     # Context providers (auth, theme, realtime)
│   ├── services/      # API clients and realtime utilities
│   └── utils/         # Helpers and formatters
└── docs/frontend/     # Integration + deployment guides
```

## Linting & Builds

-   `npm run lint` — static analysis with ESLint.
-   `npm run build` — production build output to `dist/`.
-   `npm run preview` — preview the production bundle locally.

Refer to `docs/frontend/api-integration.md` and `docs/frontend/deployment.md` for backend integration and deployment details.
