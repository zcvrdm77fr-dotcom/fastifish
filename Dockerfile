# FastFishing API
FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates gosu \
 && npm ci --omit=dev \
 && apt-get purge -y python3 make g++ \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

COPY --chown=node:node . .
RUN chmod 0755 /app/docker-entrypoint.sh

ENV DATA_DIR=/var/data
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
