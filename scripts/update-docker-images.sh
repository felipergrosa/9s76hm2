#!/usr/bin/env bash
set -euo pipefail

#
# Script para construir e publicar as imagens Docker do Taktchat (frontend e backend)
# Uso:
#   scripts/update-docker-images.sh [tag]
#     tag -> opcional, padrão "latest". Será aplicada nas duas imagens.
#

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_TAG="${1:-latest}"

DOCKER_USER="${DOCKER_USER:-zanonalivesolucoes}"
FRONT_IMAGE="${FRONT_IMAGE:-${DOCKER_USER}/taktchat-frontend}"
BACK_IMAGE="${BACK_IMAGE:-${DOCKER_USER}/taktchat-backend}"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

build_and_push() {
  local image_name=$1
  local dockerfile=$2
  local context_dir=$3

  log "Construindo ${image_name}:${IMAGE_TAG}"
  docker build \
    -f "${dockerfile}" \
    -t "${image_name}:${IMAGE_TAG}" \
    "${context_dir}"

  log "Enviando ${image_name}:${IMAGE_TAG} para o Docker Hub"
  docker push "${image_name}:${IMAGE_TAG}"
}

log "Iniciando atualização das imagens Docker (tag: ${IMAGE_TAG})"

build_and_push "${FRONT_IMAGE}" "${REPO_ROOT}/frontend/Dockerfile" "${REPO_ROOT}/frontend"
build_and_push "${BACK_IMAGE}" "${REPO_ROOT}/backend/Dockerfile" "${REPO_ROOT}/backend"

log "Processo concluído com sucesso!"

