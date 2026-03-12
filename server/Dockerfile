# ============================================================================
# AI-World Backend - Multi-stage Dockerfile
# ============================================================================

# --- Base ---
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# --- Dependencies ---
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --only=production && cp -R node_modules /tmp/prod_modules
RUN npm ci

# --- Development ---
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# --- Build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- Production ---
FROM base AS production
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=deps --chown=nestjs:nodejs /tmp/prod_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma
COPY package.json ./
RUN npx prisma generate
RUN mkdir -p uploads && chown nestjs:nodejs uploads
USER nestjs
EXPOSE 3000
CMD ["node", "dist/main"]
