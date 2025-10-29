FROM node:20-alpine AS base

WORKDIR /app/backend

COPY package*.json tsconfig.json ./
RUN npm install --production=false

COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app/backend
COPY --from=base /app/backend/package.json ./
COPY --from=base /app/backend/node_modules ./node_modules
COPY --from=base /app/backend/dist ./dist
COPY --from=base /app/backend/scripts ./scripts
COPY --from=base /app/backend/db ./db

ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
