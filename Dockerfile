FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY packages/core/package.json packages/core/package.json
COPY apps/radar/package.json apps/radar/package.json
COPY apps/editor/package.json apps/editor/package.json
COPY apps/ops/package.json apps/ops/package.json

RUN npm install --omit=dev=false

COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts
COPY docker/entrypoint.sh /entrypoint.sh

ARG APP=radar
ENV POLLARD_APP=${APP}
ENV NODE_ENV=production
ENV PORT=3000
ENV WORKFLOW_TARGET_WORLD=@workflow/world-postgres

WORKDIR /app/apps/${APP}
RUN npx eve build

RUN chmod +x /entrypoint.sh
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-3000}/eve/v1/health" || exit 1

ENTRYPOINT ["/entrypoint.sh"]
