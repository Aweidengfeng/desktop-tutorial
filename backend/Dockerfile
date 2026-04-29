FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
# Generate Prisma client for PostgreSQL
RUN DATABASE_PROVIDER=postgresql DATABASE_URL="postgresql://placeholder/placeholder" node scripts/generate-prisma-client.js || true

FROM node:24-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder --chown=nodejs:nodejs /app /app
RUN mkdir -p /app/uploads && chown nodejs:nodejs /app/uploads
USER nodejs
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1
CMD ["node", "app.js"]
