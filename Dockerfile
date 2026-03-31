# Stage 1: build (full image for native bindings)
FROM node:22 AS builder
WORKDIR /app
COPY package*.json ./
RUN rm -rf node_modules package-lock.json && npm install
COPY . .
RUN npm run build

# Stage 2: production
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts
COPY --from=builder /app/dist ./dist
COPY src ./src
EXPOSE 3000
CMD ["npm", "start"]
