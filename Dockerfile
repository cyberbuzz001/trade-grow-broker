# Multi-Stage Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies (needed for native addons)
RUN apk add --no-cache python3 make g++

# Copy root package files and install root deps
COPY package.json package-lock.json ./
RUN npm install

# Copy client package files and install client deps fresh for Linux
# (removes any Windows-generated lock to avoid @rollup/rollup-linux-x64-musl missing bug)
COPY client/package.json client/package-lock.json ./client/
RUN rm -f ./client/package-lock.json && cd client && npm install

COPY . .

# Build backend & client
RUN npm run build

# Production Stage
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

COPY package.json package-lock.json ./
RUN npm install --only=production

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/docs ./docs

EXPOSE 5000

CMD ["node", "server/dist/index.js"]
