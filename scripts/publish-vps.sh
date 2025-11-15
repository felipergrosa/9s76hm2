#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/zanonr/desenvolvimento/taktchat"
IMAGE_TAG="${1:-latest}"

info() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

if [ ! -d "${REPO_DIR}/.git" ]; then
  echo "Repositório não encontrado em ${REPO_DIR}."
  exit 1
fi

info "Acessando repositório em ${REPO_DIR}"
cd "${REPO_DIR}"

info "Atualizando branch main"
git fetch origin main
git checkout main
git pull --ff-only origin main

info "Exportando variáveis de ambiente para build de produção"
export FRONT_PUBLIC_URL="https://taktchat.alivesolucoes.com.br"
export FRONT_BACKEND_URL="https://taktchat-api.alivesolucoes.com.br"
export FRONT_SOCKET_URL="https://taktchat-api.alivesolucoes.com.br"
export FORCE_REBUILD=true
export DOCKER_BUILDKIT=0

info "Executando scripts/update-docker-images.sh ${IMAGE_TAG}"
"${REPO_DIR}/scripts/update-docker-images.sh" "${IMAGE_TAG}"

info "Publicação finalizada."

