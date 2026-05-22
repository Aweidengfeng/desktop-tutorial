FROM node:24-alpine AS builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ .
# Generate Prisma client for PostgreSQL
RUN DATABASE_PROVIDER=postgresql DATABASE_URL="postgresql://placeholder/placeholder" node scripts/generate-prisma-client.js || true

FROM node:24-alpine
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
# Copy frontend files to root
COPY --chown=nodejs:nodejs index.html ./
COPY --chown=nodejs:nodejs admin.html ./
COPY --chown=nodejs:nodejs guide-portal.html ./
COPY --chown=nodejs:nodejs club-portal.html ./
COPY --chown=nodejs:nodejs expedition-detail.html ./
COPY --chown=nodejs:nodejs investor.html ./
COPY --chown=nodejs:nodejs manifest.json ./
COPY --chown=nodejs:nodejs sw.js ./
COPY --chown=nodejs:nodejs VERSION ./
# Copy optional directories if they exist
COPY --chown=nodejs:nodejs assets ./assets
COPY --chown=nodejs:nodejs public ./public
COPY --chown=nodejs:nodejs www ./www
# Copy backend
COPY --from=builder --chown=nodejs:nodejs /app/backend ./backend
RUN mkdir -p /app/backend/uploads && chown nodejs:nodejs /app/backend/uploads
USER nodejs
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1
CMD ["node", "backend/app.js"]
