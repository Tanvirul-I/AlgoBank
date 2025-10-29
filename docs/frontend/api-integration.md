# Frontend API Integration Guide

The AlgoBank dashboard consumes both REST and WebSocket services from the backend. This guide describes how to configure the React client and add new data integrations.

## Configuration

Environment variables are loaded via Vite's `import.meta.env` API. Copy `.env.example` to `.env.local` and provide the service URLs that match your deployment:

```bash
cp frontend/.env.example frontend/.env.local
```

| Variable            | Description                            | Default                  |
| ------------------- | -------------------------------------- | ------------------------ |
| `VITE_API_BASE_URL` | Base URL for REST endpoints.           | `http://localhost:8080`  |
| `VITE_REALTIME_URL` | WebSocket endpoint for streaming data. | `ws://localhost:8080/ws` |

> **Note:** The client automatically attaches the stored JWT token to every API request through an Axios interceptor.

## REST Endpoints

All REST requests should be made with the `request` helper in `src/services/apiClient.ts`.

```ts
import { request } from "@/services/apiClient";

const positions = await request<PositionRow[]>({
	url: "/portfolio/positions",
	params: { desk: "macro" }
});
```

The helper enforces a consistent base URL, automatically applies the bearer token when present, and allows for ad-hoc response transforms.

### Adding a new query

1. Define the expected response TypeScript interface near the component that consumes it.
2. Fetch the data in a `useEffect` or `useQuery` hook using the `request` helper.
3. Add optimistic fallback data inside the `.catch` block if you want the UI to remain populated during development.

## Authentication

The `AuthProvider` handles login, registration, logout, and profile retrieval:

-   `POST /auth/login` and `POST /auth/register` should both return `{ accessToken: string, refreshToken: string }`.
-   `GET /auth/me` returns the authenticated user. If this call fails, the provider will clear the session and redirect to the login page.

Update these endpoints to align with your backend if the routes differ.

## Real-time Streams

The `RealtimeProvider` establishes a single WebSocket connection using the URL from `VITE_REALTIME_URL`. Components can subscribe to channels through the `useRealtime` hook:

```ts
const { client } = useRealtime();

useEffect(() => {
	const handler = (payload: StrategyUpdate) => {
		setUpdates((current) => [...current, payload]);
	};

	client.subscribe("analytics.performance", handler);
	return () => client.unsubscribe("analytics.performance", handler);
}, [client]);
```

Back-end messages should follow this envelope to route payloads to the correct subscribers:

```json
{
	"channel": "analytics.performance",
	"payload": {
		"timestamp": "2024-04-04T13:00:00Z",
		"alpha": 1.45,
		"beta": 0.92
	}
}
```

## Error Handling

Each page seeds fallback data when an API call fails. Replace the placeholder logic with domain-specific error handling (e.g., toast notifications or error boundaries) once the backend endpoints are ready.
