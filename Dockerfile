# Stage 1: build
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: production
FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts
COPY --from=builder /app/dist ./dist
COPY src ./src
EXPOSE 3000
CMD ["npm", "start"]
