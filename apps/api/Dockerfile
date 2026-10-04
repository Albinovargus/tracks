FROM node:24-slim AS base
RUN corepack enable
WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
COPY apps/api/package.json apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# Copy source
COPY packages/types/ packages/types/
COPY packages/config/ packages/config/
COPY apps/api/ apps/api/

# Build
RUN pnpm --filter @tracks/types build
RUN pnpm --filter @tracks/api build

# Production stage
FROM node:24-slim AS production
RUN corepack enable
WORKDIR /app

COPY --from=base /app/pnpm-workspace.yaml /app/package.json /app/pnpm-lock.yaml ./
COPY --from=base /app/packages/types/package.json packages/types/
COPY --from=base /app/packages/config/package.json packages/config/
COPY --from=base /app/apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile --prod

COPY --from=base /app/packages/types/dist/ packages/types/dist/
COPY --from=base /app/apps/api/dist/ apps/api/dist/

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "apps/api/dist/server.js"]
