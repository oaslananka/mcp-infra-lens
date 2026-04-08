FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --ignore-scripts \
    && npm rebuild better-sqlite3

COPY . .
RUN npm run build

FROM node:20-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps --ignore-scripts \
    && npm rebuild better-sqlite3

COPY --from=build /app/dist ./dist
COPY --from=build /app/LICENSE ./LICENSE
COPY --from=build /app/README.md ./README.md
COPY --from=build /app/docs ./docs

# Run as non-root.
RUN useradd -m -u 1001 appuser
USER appuser

# Data directory for SQLite.
ENV INFRA_LENS_DB=/home/appuser/.mcp-infra-lens/metrics.db
RUN mkdir -p /home/appuser/.mcp-infra-lens

CMD ["node", "dist/mcp.js"]
