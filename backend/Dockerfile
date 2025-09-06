FROM node:18-bullseye AS build
WORKDIR /app
ENV NODE_ENV=development
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NPM_CONFIG_LEGACY_PEER_DEPS=true
ENV PYTHON=/usr/bin/python3
ENV npm_config_python=/usr/bin/python3

# Copia apenas manifestos para aproveitar cache
COPY package*.json ./

# Toolchain para dependências nativas (mysql2/pg/node-gyp, etc.)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python-is-python3 build-essential pkg-config libssl-dev \
  && rm -rf /var/lib/apt/lists/*

# Instala dependências baseadas no package-lock (mais reprodutível) com diagnóstico detalhado e fallback
RUN set -eux; \
  npm ci --legacy-peer-deps --no-audit --no-fund --loglevel=verbose \
  || npm install --legacy-peer-deps --no-audit --no-fund --loglevel=verbose \
  || { \
    echo 'npm install failed, dumping npm logs'; \
    ls -lah /root/.npm/_logs || true; \
    for f in /root/.npm/_logs/*; do echo "==== $f ===="; tail -n 200 "$f" || true; done; \
    exit 1; \
  }

# Copia o restante do código
COPY . .

# Build Typescript -> dist
RUN npm run build

# Remover devDependencies e cache para reduzir imagem
RUN npm prune --omit=dev \
  && npm cache clean --force

# --- Runtime ---
FROM node:18-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Copia manifestos, dependências já instaladas e artefatos compilados
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/certs ./certs
COPY --from=build /app/scripts ./scripts
RUN mkdir -p ./private

EXPOSE 8080

# Executa o servidor compilado (sem nodemon em produção)
CMD ["node", "dist/server.js"]
