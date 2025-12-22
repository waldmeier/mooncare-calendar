# --- deps ---
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# --- build ---
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma (generate) + Next build
RUN npx prisma generate
RUN npm run build

# --- run ---
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# wichtig: SQLite DB ausserhalb vom Image
RUN mkdir -p /data

# App übernehmen
COPY --from=builder /app ./

EXPOSE 3000

# Migration beim Start (prod)
CMD ["sh", "-lc", "npx prisma migrate deploy && node node_modules/next/dist/bin/next start -p 3000"]