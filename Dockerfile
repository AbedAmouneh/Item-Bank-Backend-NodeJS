# ── Stage 1: builder ─────────────────────────────────────────────────────────
# Installs all deps (including devDeps for tsc), compiles TypeScript.
# Nothing from this stage leaks into the final image.
FROM node:24-alpine AS builder

RUN apk add --no-cache bash git curl
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec tsc

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
# Minimal image: only production dependencies + compiled output.
# No devDependencies, no source files, no build tooling.
FROM node:24-alpine AS runtime

RUN corepack enable

WORKDIR /app

# Install prod-only deps from lockfile for reproducible builds
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output
COPY --from=builder /app/dist ./dist

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1
