# Stage 1: build (full image for native bindings)
FROM node:22 AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --ignore-engines
COPY . .
RUN npm run build

# Stage 2: production
FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-engines
COPY --from=builder /app/dist ./dist
COPY src ./src
COPY drizzle ./drizzle
EXPOSE 3000
CMD ["sh", "-c", "npm run migrate && npm start"]
