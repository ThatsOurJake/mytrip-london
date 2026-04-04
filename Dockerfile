# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

# Enable corepack so pnpm is available without a separate install
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy lockfile and manifests first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:24-alpine AS runner

WORKDIR /app

# Only copy what the server needs at runtime
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./

# adapter-node requires the production deps at runtime
# (only a handful — no devDeps, no source)
RUN corepack enable && corepack prepare pnpm@latest --activate \
  && pnpm install --prod --frozen-lockfile --ignore-scripts

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["node", "build"]
