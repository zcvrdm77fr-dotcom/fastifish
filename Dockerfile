# Saalisfeedin palvelin. Toimii sellaisenaan missä tahansa Dockeria ajavassa palvelussa
# (Render, Fly.io, Railway, Hetzner, oma VPS).
FROM node:22-bookworm-slim

# better-sqlite3 ja sharp ovat natiivipaketteja - osa alustoista joutuu kääntämään ne itse,
# mikä vaatii python3:n ja g++:n. Poistetaan työkalut asennuksen jälkeen imagen koon vuoksi.
WORKDIR /app
COPY package.json package-lock.json ./
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && npm ci --omit=dev \
 && apt-get purge -y python3 make g++ \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

COPY . .

# Tietokanta ja saaliskuvat kirjoitetaan tänne. Liitä tähän polkuun pysyvä levy, muutta ne
# katoavat aina kun palvelu käynnistetään uudelleen.
ENV DATA_DIR=/var/data
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
