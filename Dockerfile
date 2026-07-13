# NetAlign API image (Bun + Hono + SQLite)
FROM oven/bun:1.3-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Application source (server + shared types used by the API)
COPY server ./server
COPY shared ./shared

ENV NODE_ENV=production
ENV PORT=5000
# Persist SQLite on a mounted volume (see docker-compose.yml)
ENV NETALIGN_DB_PATH=/data/netalign.db

# Seed JSON ships with the image; import runs only when the DB is empty
RUN mkdir -p /data

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "const r=await fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health'); if(!r.ok) process.exit(1)"

CMD ["bun", "run", "server/index.ts"]
