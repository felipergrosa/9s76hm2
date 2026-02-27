# Etapa de build
FROM node:20-alpine AS build
WORKDIR /app

# Copia o package.json e instala as dependências
COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund && \
    npm cache clean --force

# Copia o restante dos arquivos
COPY . .

# Define a URL do backend
ENV REACT_APP_BACKEND_URL=https://chatsapi.nobreluminarias.com.br

# Versão do frontend injetada no build
ARG REACT_APP_FRONTEND_VERSION
ENV REACT_APP_FRONTEND_VERSION=$REACT_APP_FRONTEND_VERSION

# Build da aplicação React (memória otimizada para Docker Desktop)
RUN NODE_OPTIONS=--max-old-space-size=3072 npm run build

# Remove node_modules após build (não precisa mais)
RUN rm -rf node_modules

# Etapa de deploy
FROM nginx:alpine

# Copia o build pronto para a pasta pública do nginx
COPY --from=build /app/build /usr/share/nginx/html

# Remove arquivos desnecessários do nginx
RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/index.html.default 2>/dev/null || true

# nginx.conf simples
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
