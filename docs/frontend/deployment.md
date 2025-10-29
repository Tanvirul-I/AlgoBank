# Frontend Deployment Instructions

This project uses Vite for the build pipeline. The commands below assume Node.js 18+ and npm are available. Replace npm with pnpm/yarn if your team prefers a different package manager.

## Local Development

```bash
cd frontend
npm install
npm run dev
```

The development server listens on [http://localhost:5173](http://localhost:5173) by default. API calls proxy directly to the URL defined by `VITE_API_BASE_URL`, so ensure the backend is reachable from your browser.

## Production Build

```bash
npm run build
npm run preview # optional smoke test
```

The compiled assets are generated in `frontend/dist`. Serve this directory with any static hosting solution (NGINX, S3 + CloudFront, Vercel, etc.).

### Docker (optional)

To containerize the frontend:

1. Build the static assets.
2. Use an NGINX image to host the files.

Example `Dockerfile` snippet:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend .
RUN npm run build

FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

Expose port 80 and mount a custom `nginx.conf` if you need to handle client-side routing (ensure `try_files $uri /index.html;`).

## Environment Variables

Set the `VITE_*` variables at build time. When deploying via a CI/CD pipeline, export them before calling `npm run build`:

```bash
export VITE_API_BASE_URL="https://api.algobank.internal"
export VITE_REALTIME_URL="wss://api.algobank.internal/ws"
npm run build
```

## Continuous Deployment Tips

-   Run `npm run lint` during CI to keep TypeScript/React code quality high.
-   Serve the app behind HTTPS so the WebSocket connection can upgrade successfully in browsers.
-   Cache `node_modules` between builds to speed up the pipeline.
