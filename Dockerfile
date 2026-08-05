# Multi-Stage Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root and module packages
COPY package.json package-lock.json ./
COPY client/package.json ./client/

RUN npm install

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
