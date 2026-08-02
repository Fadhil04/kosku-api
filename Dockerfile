# Stage 1: Builder — install dependencies dan compile TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files dan install semua dependency (termasuk devDependencies)
COPY package*.json ./
RUN npm install

# Copy source code dan prisma schema
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript
RUN npm run build

# ──────────────────────────────────────────────────────────
# Stage 2: Production — image yang lebih kecil tanpa dev tools
FROM node:20-alpine AS production

WORKDIR /app

# Install hanya production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy Prisma schema dan generated client dari builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

# Copy compiled JavaScript dari builder
COPY --from=builder /app/dist ./dist

# User non-root untuk keamanan
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "dist/app.js"]