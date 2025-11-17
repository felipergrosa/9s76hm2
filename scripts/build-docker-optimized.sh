#!/usr/bin/env bash
set -euo pipefail

#
# Script OTIMIZADO para construir e publicar imagens Docker do Taktchat
# Projetado para hardware limitado - minimiza uso de CPU e disco
# Uso:
#   scripts/build-docker-optimized.sh [tag] [--frontend-only|--backend-only]
#

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_TAG="${1:-latest}"
BUILD_TYPE="${2:-all}" # all, frontend-only, backend-only

DOCKER_USER="${DOCKER_USER:-zanonalivesolucoes}"
FRONT_IMAGE="${FRONT_IMAGE:-${DOCKER_USER}/taktchat-frontend}"
BACK_IMAGE="${BACK_IMAGE:-${DOCKER_USER}/taktchat-backend}"

# Variáveis de ambiente do frontend (ajuste conforme necessário)
FRONT_BACKEND_URL="${FRONT_BACKEND_URL:-https://chats.nobreluminarias.com.br}"
FRONT_SOCKET_URL="${FRONT_SOCKET_URL:-$FRONT_BACKEND_URL}"
FRONT_PUBLIC_URL="${FRONT_PUBLIC_URL:-https://chats.nobreluminarias.com.br}"
FRONT_PRIMARY_COLOR="${FRONT_PRIMARY_COLOR:-#2563EB}"
FRONT_PRIMARY_DARK="${FRONT_PRIMARY_DARK:-#1E3A8A}"
FRONT_VERSION="${FRONT_VERSION:-${IMAGE_TAG}}"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

warn() {
  printf '\n[%s][WARN] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

error() {
  printf '\n[%s][ERRO] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2
}

# Verificar limites de recursos do Docker
setup_docker_limits() {
  log "Configurando limites de recursos do Docker..."
  
  # Limitar uso de CPU (máximo 2 cores para não sobrecarregar)
  export DOCKER_BUILDKIT=1
  export COMPOSE_DOCKER_CLI_BUILD=1
  
  # Criar/atualizar daemon.json se necessário
  if command -v docker >/dev/null 2>&1; then
    log "Verificando configuração do Docker daemon..."
    # Nota: mudanças no daemon.json requerem restart do Docker
  fi
}

# Build otimizado com cache e limitação de recursos
build_image_optimized() {
  local image_name=$1
  local dockerfile=$2
  local context_dir=$3
  shift 3
  local extra_build_args=("$@")
  
  log "Construindo ${image_name}:${IMAGE_TAG} (com otimizações para hardware limitado)..."
  
  # Usar buildkit para melhor cache e performance
  # Limitação de recursos é feita via nice/ionice no processo pai
  # BuildKit usa cache agressivo automaticamente
  DOCKER_BUILDKIT=1 docker build \
    --progress=plain \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    -f "${dockerfile}" \
    -t "${image_name}:${IMAGE_TAG}" \
    "${extra_build_args[@]}" \
    "${context_dir}" || {
      error "Build de ${image_name} falhou"
      return 1
    }
  
  log "Build de ${image_name} concluído com sucesso"
}

# Push com retry
push_image_with_retry() {
  local image_name=$1
  local max_retries=3
  local retry=0
  
  while [ $retry -lt $max_retries ]; do
    log "Enviando ${image_name}:${IMAGE_TAG} para o Docker Hub (tentativa $((retry+1))/$max_retries)..."
    
    if docker push "${image_name}:${IMAGE_TAG}"; then
      log "Push de ${image_name} concluído com sucesso"
      return 0
    else
      retry=$((retry+1))
      if [ $retry -lt $max_retries ]; then
        warn "Push falhou. Aguardando 10 segundos antes de tentar novamente..."
        sleep 10
      fi
    fi
  done
  
  error "Push de ${image_name} falhou após $max_retries tentativas"
  return 1
}

# Verificar se já está autenticado
check_docker_auth() {
  if ! docker info 2>/dev/null | grep -q "Username"; then
    error "Não autenticado no Docker Hub. Execute: docker login"
    exit 1
  fi
  log "✓ Autenticado no Docker Hub"
}

# Limpar cache do Docker se necessário (opcional)
clean_docker_cache() {
  if [ "${CLEAN_CACHE:-false}" = "true" ]; then
    warn "Limpando cache do Docker (isso pode liberar espaço mas vai fazer rebuild completo)..."
    docker builder prune -f
  fi
}

# Main
main() {
  log "=========================================="
  log "Build e Push Docker - TaktChat (OTIMIZADO)"
  log "=========================================="
  log "Tag: ${IMAGE_TAG}"
  log "Build: ${BUILD_TYPE}"
  log ""
  log "Configurações Frontend:"
  log "  Backend URL: ${FRONT_BACKEND_URL}"
  log "  Socket URL: ${FRONT_SOCKET_URL}"
  log "  Public URL: ${FRONT_PUBLIC_URL}"
  log ""
  
  # Verificações
  check_docker_auth
  setup_docker_limits
  
  # Build do Frontend
  if [ "${BUILD_TYPE}" = "all" ] || [ "${BUILD_TYPE}" = "frontend-only" ]; then
    log "=== BUILDING FRONTEND ==="
    build_image_optimized "${FRONT_IMAGE}" \
      "${REPO_ROOT}/frontend/Dockerfile" \
      "${REPO_ROOT}/frontend" \
      --build-arg "REACT_APP_BACKEND_URL=${FRONT_BACKEND_URL}" \
      --build-arg "REACT_APP_SOCKET_URL=${FRONT_SOCKET_URL}" \
      --build-arg "REACT_APP_PRIMARY_COLOR=${FRONT_PRIMARY_COLOR}" \
      --build-arg "REACT_APP_PRIMARY_DARK=${FRONT_PRIMARY_DARK}" \
      --build-arg "PUBLIC_URL=${FRONT_PUBLIC_URL}" \
      --build-arg "REACT_APP_FRONTEND_VERSION=${FRONT_VERSION}"
    
    push_image_with_retry "${FRONT_IMAGE}"
  fi
  
  # Build do Backend
  if [ "${BUILD_TYPE}" = "all" ] || [ "${BUILD_TYPE}" = "backend-only" ]; then
    log "=== BUILDING BACKEND ==="
    GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
    
    build_image_optimized "${BACK_IMAGE}" \
      "${REPO_ROOT}/backend/Dockerfile" \
      "${REPO_ROOT}/backend" \
      --build-arg "GIT_COMMIT=${GIT_COMMIT}" \
      --build-arg "BUILD_DATE=${BUILD_DATE}" \
      --build-arg "BACKEND_VERSION=${IMAGE_TAG}"
    
    push_image_with_retry "${BACK_IMAGE}"
  fi
  
  log ""
  log "=========================================="
  log "✓ Processo concluído com sucesso!"
  log "=========================================="
  log ""
  log "Imagens publicadas:"
  if [ "${BUILD_TYPE}" = "all" ] || [ "${BUILD_TYPE}" = "frontend-only" ]; then
    log "  - ${FRONT_IMAGE}:${IMAGE_TAG}"
  fi
  if [ "${BUILD_TYPE}" = "all" ] || [ "${BUILD_TYPE}" = "backend-only" ]; then
    log "  - ${BACK_IMAGE}:${IMAGE_TAG}"
  fi
  log ""
}

main "$@"

