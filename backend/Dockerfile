# syntax=docker/dockerfile:1
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV DEBIAN_FRONTEND=noninteractive

# Instala dependências de runtime + build tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        chromium \
        ffmpeg \
        libcairo2 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libjpeg62-turbo \
        libgif7 \
        librsvg2-2 \
        graphicsmagick \
        ghostscript \
        fonts-liberation \
        git \
        python3 \
        make \
        g++ \
        gcc \
        pkg-config \
        libcairo2-dev \
        libpango1.0-dev \
        libjpeg-dev \
        libgif-dev \
        librsvg2-dev && \
    rm -rf /var/lib/apt/lists/*

# Copia apenas os arquivos necessários para instalar dependências
COPY package*.json ./

# Instala APENAS dependências de produção com cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm install --legacy-peer-deps --no-audit --no-fund --omit=dev && \
    npm cache clean --force

# Copia o restante do código
COPY . .

# Normaliza scripts .sh (CRLF -> LF)
RUN if [ -d ./scripts ]; then \
        find ./scripts -maxdepth 1 -type f -name "*.sh" -exec sed -i 's/\r$//' {} + && \
        find ./scripts -maxdepth 1 -type f -name "*.sh" -exec chmod +x {} +; \
    fi

# Build info
ARG GIT_COMMIT
ARG BUILD_DATE
ARG BACKEND_VERSION
ENV BUILD_DATE=$BUILD_DATE
ENV GIT_COMMIT=$GIT_COMMIT
ENV BACKEND_VERSION=$BACKEND_VERSION
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN COMMIT="${GIT_COMMIT:-$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')}"; \
    DATE="${BUILD_DATE:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"; \
    printf "%s" "$COMMIT" > .git-commit; \
    printf "%s" "$DATE" > .build-date

# Garante diretórios
RUN mkdir -p public private

# Build TypeScript
RUN npm run build

# Remove build tools para reduzir tamanho
RUN apt-get purge -y --auto-remove \
        python3 make g++ gcc pkg-config \
        libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev && \
    rm -rf /var/lib/apt/lists/* \
        src tsconfig.json .eslint* .prettier* \
        node_modules/.cache 2>/dev/null || true

EXPOSE 8080

CMD ["node", "dist/server.js"]
