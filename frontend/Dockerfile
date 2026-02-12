# Etapa de build
FROM node:20-alpine AS build
WORKDIR /app

# Copia o package.json e instala as dependências
COPY package*.json ./
RUN npm install --legacy-peer-deps || npm install --legacy-peer-deps || npm install --legacy-peer-deps

# Copia o restante dos arquivos
COPY . .

# Defina a URL do backend aqui!
# Troque pelo seu domínio público do backend (ou use ARG se quiser mais flexibilidade)
ENV REACT_APP_BACKEND_URL=https://chatsapi.nobreluminarias.com.br

# Versão do frontend injetada no build (vinda do CI)
ARG REACT_APP_FRONTEND_VERSION
ENV REACT_APP_FRONTEND_VERSION=$REACT_APP_FRONTEND_VERSION

# Build da aplicação React
RUN NODE_OPTIONS=--max-old-space-size=6144 npm run build

# Etapa de deploy
FROM nginx:alpine

# Copia o build pronto para a pasta pública do nginx
COPY --from=build /app/build /usr/share/nginx/html

# nginx.conf simples (veja abaixo)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
