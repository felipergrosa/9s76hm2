#!/usr/bin/env bash
set -euo pipefail

# Script para atualizar o frontend a partir da branch informada (padrão: main)
# Uso: frontend/update-code.sh [branch]

BRANCH="${1:-main}"

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "Erro: não foi possível localizar o diretório raiz do repositório git."
  exit 1
fi

echo ">> Repositório: ${REPO_ROOT}"
echo ">> Branch alvo: ${BRANCH}"

cd "${REPO_ROOT}"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull origin "${BRANCH}"

cd "${REPO_ROOT}/frontend"
echo ">> Instalando dependências do frontend"
npm install --legacy-peer-deps

echo ">> Gerando build do frontend"
npm run build

echo ">> Frontend atualizado com sucesso!"

