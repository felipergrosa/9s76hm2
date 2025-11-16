#!/usr/bin/env bash

# Este script é executado após um timer para:
# 1) Atualizar main local com origin/main
# 2) Auditar todas as branches locais
# 3) Empurrar branches sem remoto e gerar links de PR
# 4) Registrar relatório em .docs/diagnosticos/

set -u

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root" || exit 1

timestamp="$(date +"%Y%m%d-%H%M%S")"
report_dir=".docs/diagnosticos"
report_file="${report_dir}/branches-${timestamp}.md"
mkdir -p "$report_dir"

echo "## Auditoria de branches (${timestamp})" > "$report_file"
echo "" >> "$report_file"

# Descobrir URL do repositório remoto origin (https)
origin_url="$(git remote get-url origin 2>/dev/null || true)"
if [[ -z "$origin_url" ]]; then
  echo "- ERRO: remoto 'origin' não configurado." | tee -a "$report_file"
  exit 0
fi

# Normalizar URL para https://github.com/owner/repo
normalized_url="$origin_url"
if [[ "$normalized_url" =~ ^git@github.com:(.*)\.git$ ]]; then
  normalized_url="https://github.com/${BASH_REMATCH[1]}"
elif [[ "$normalized_url" =~ ^https://github.com/(.*)\.git$ ]]; then
  normalized_url="https://github.com/${BASH_REMATCH[1]}"
fi
repo_web="$normalized_url"

echo "- Remoto origin: $origin_url" | tee -a "$report_file"
echo "- Repositório web: $repo_web" | tee -a "$report_file"
echo "" >> "$report_file"

echo "### 1) Atualização da main" | tee -a "$report_file"
git fetch origin --prune
if git rev-parse --verify main >/dev/null 2>&1; then
  git checkout main
  if git merge-base --is-ancestor origin/main main; then
    git pull --ff-only origin main || true
  else
    # Tentar rebase rápido para alinhar
    git pull --rebase origin main || true
  fi
  echo "- main atualizada com origin/main" | tee -a "$report_file"
else
  echo "- Branch local 'main' não encontrado." | tee -a "$report_file"
fi
echo "" >> "$report_file"

echo "### 2) Auditoria de branches locais" | tee -a "$report_file"
branches=($(git for-each-ref refs/heads --format='%(refname:short)'))
if [[ ${#branches[@]} -eq 0 ]]; then
  echo "- Nenhuma branch local encontrada." | tee -a "$report_file"
  exit 0
fi

for br in "${branches[@]}"; do
  if [[ "$br" == "main" ]]; then
    continue
  fi
  echo "" | tee -a "$report_file"
  echo "#### Branch: \`$br\`" | tee -a "$report_file"

  # Verifica se existe remoto para a branch
  if git ls-remote --exit-code --heads origin "$br" >/dev/null 2>&1; then
    has_remote="sim"
  else
    has_remote="nao"
  fi

  # Divergência com remoto (se existir)
  ahead=0
  behind=0
  if [[ "$has_remote" == "sim" ]]; then
    ahead=$(git rev-list --left-only --count "$br"...origin/"$br" 2>/dev/null || echo 0)
    behind=$(git rev-list --right-only --count "$br"...origin/"$br" 2>/dev/null || echo 0)
  fi

  echo "- Possui remoto: ${has_remote}" | tee -a "$report_file"
  if [[ "$has_remote" == "sim" ]]; then
    echo "- Divergência (ahead=${ahead}, behind=${behind})" | tee -a "$report_file"
  fi

  # Se não tem remoto, fazer push
  if [[ "$has_remote" == "nao" ]]; then
    echo "- Publicando branch no remoto..." | tee -a "$report_file"
    if git push -u origin "$br"; then
      echo "- Publicada com sucesso." | tee -a "$report_file"
    else
      echo "- ERRO ao publicar a branch \`$br\`." | tee -a "$report_file"
      continue
    fi
  fi

  # Gerar link de PR (compare main...branch)
  pr_url="${repo_web}/compare/main...${br}?expand=1"
  echo "- Link para abrir PR: ${pr_url}" | tee -a "$report_file"
done

echo "" >> "$report_file"
echo "### 3) Conclusão" | tee -a "$report_file"
echo "- Relatório salvo em \`${report_file}\`" | tee -a "$report_file"

exit 0

