# Stage 1: build
FROM node:22 AS builder
WORKDIR /app
# Copy workspace manifests first for layer caching
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
RUN npm install --ignore-engines
# Copy all source
COPY . .
RUN npm run build

# Stage 2: production
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
RUN npm ci --omit=dev --ignore-engines
# Built API + frontend (web builds into api/dist/client)
COPY --from=builder /app/apps/api/dist ./apps/api/dist
# DB source + migrations needed for migrate script (runs via tsx at startup)
COPY packages/db/src ./packages/db/src
COPY packages/db/drizzle ./packages/db/drizzle
COPY packages/db/drizzle.config.ts ./packages/db/
EXPOSE 3000
CMD ["sh", "-c", "npm run migrate && npm run start"]
