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
BUILDX_AVAILABLE=false
BUILD_CMD=(docker build)
FRONT_BACKEND_URL="${FRONT_BACKEND_URL:-http://localhost:8080}"
FRONT_SOCKET_URL="${FRONT_SOCKET_URL:-$FRONT_BACKEND_URL}"
FRONT_PRIMARY_COLOR="${FRONT_PRIMARY_COLOR:-#2563EB}"
FRONT_PRIMARY_DARK="${FRONT_PRIMARY_DARK:-#1E3A8A}"
FRONT_PUBLIC_URL="${FRONT_PUBLIC_URL:-http://localhost:3000}"
FRONT_VERSION="${FRONT_VERSION:-${IMAGE_TAG}}"
FORCE_REBUILD="${FORCE_REBUILD:-false}"
COMMON_BUILD_ARGS=()

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

warn() {
  printf '\n[%s][WARN] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

run_with_feedback() {
  local description=$1
  shift
  log "${description} (executando...)"
  if "$@"; then
    log "${description} (concluído)"
    return 0
  else
    log "${description} (falhou)"
    return 1
  fi
}

build_and_push() {
  local image_name=$1
  local dockerfile=$2
  local context_dir=$3
  shift 3
  local extra_build_args=("$@")

  run_with_feedback "Construindo ${image_name}:${IMAGE_TAG}" \
    "${BUILD_CMD[@]}" \
      "${COMMON_BUILD_ARGS[@]}" \
      -f "${dockerfile}" \
      -t "${image_name}:${IMAGE_TAG}" \
      "${context_dir}" \
      "${extra_build_args[@]}"

  run_with_feedback "Enviando ${image_name}:${IMAGE_TAG} para o Docker Hub" \
    docker push "${image_name}:${IMAGE_TAG}"
}

setup_build_command() {
  if command -v docker >/dev/null 2>&1 && docker buildx version >/dev/null 2>&1; then
    BUILDX_AVAILABLE=true
    BUILD_CMD=(docker buildx build --load)
    log "Docker Buildx detectado; usando buildx --load"
  else
    warn "Buildx não detectado; usando builder legado (considere instalar buildx para evitar o aviso)."
  fi

  if [ "${FORCE_REBUILD}" = "true" ]; then
    COMMON_BUILD_ARGS+=(--no-cache --pull)
    log "FORCE_REBUILD habilitado: adicionando --no-cache e --pull ao comando de build."
  fi
}

log "Iniciando atualização das imagens Docker (tag: ${IMAGE_TAG})"
setup_build_command

build_and_push "${FRONT_IMAGE}" "${REPO_ROOT}/frontend/Dockerfile" "${REPO_ROOT}/frontend" \
  --build-arg "REACT_APP_BACKEND_URL=${FRONT_BACKEND_URL}" \
  --build-arg "REACT_APP_SOCKET_URL=${FRONT_SOCKET_URL}" \
  --build-arg "REACT_APP_PRIMARY_COLOR=${FRONT_PRIMARY_COLOR}" \
  --build-arg "REACT_APP_PRIMARY_DARK=${FRONT_PRIMARY_DARK}" \
  --build-arg "PUBLIC_URL=${FRONT_PUBLIC_URL}" \
  --build-arg "REACT_APP_FRONTEND_VERSION=${FRONT_VERSION}"

build_and_push "${BACK_IMAGE}" "${REPO_ROOT}/backend/Dockerfile" "${REPO_ROOT}/backend"

log "Processo concluído com sucesso!"

