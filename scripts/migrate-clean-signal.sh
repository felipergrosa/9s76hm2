#!/bin/bash
# migrate-clean-signal.sh - Script de "migration" para limpar sessões Signal corrompidas
# Roda dentro do container ou via docker exec
# Uso: docker exec -it whaticket-backend sh /app/scripts/migrate-clean-signal.sh

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  🧹 MIGRATION: Limpeza de Sessões Signal Corrompidas"
echo "═══════════════════════════════════════════════════════════════"

# Configurações
SESSIONS_BASE_DIR="/app/private/sessions"
REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
DRY_RUN="${DRY_RUN:-false}"  # Set true para simular sem deletar

# Função para limpar sessão de um whatsapp
limpar_sessao() {
    local company_id=$1
    local whatsapp_id=$2
    local session_dir="$SESSIONS_BASE_DIR/$company_id/$whatsapp_id"
    
    echo ""
    echo "📁 Processando: company=$company_id, whatsapp=$whatsapp_id"
    echo "   Diretório: $session_dir"
    
    if [ ! -d "$session_dir" ]; then
        echo "   ⚠️  Diretório não existe, pulando..."
        return 0
    fi
    
    # Contar arquivos antes
    local count_session=$(find "$session_dir" -name "session-*" -type f 2>/dev/null | wc -l)
    local count_sender=$(find "$session_dir" -name "sender-key-*" -type f 2>/dev/null | wc -l)
    local count_prekey=$(find "$session_dir" -name "pre-key-*" -type f 2>/dev/null | wc -l)
    local total=$((count_session + count_sender + count_prekey))
    
    echo "   Arquivos Signal encontrados:"
    echo "      - session-*: $count_session"
    echo "      - sender-key-*: $count_sender"
    echo "      - pre-key-*: $count_prekey"
    echo "      TOTAL: $total"
    
    # Verificar se há creds (importante!)
    if [ ! -f "$session_dir/creds-"*.json ]; then
        echo "   ⚠️  ATENÇÃO: Nenhum arquivo creds-* encontrado!"
        echo "   ⚠️  Isso significa que será necessário escanear QR Code novamente!"
        read -p "   Continuar mesmo assim? (s/N): " resposta
        if [ "$resposta" != "s" ] && [ "$resposta" != "S" ]; then
            echo "   ❌ Cancelado pelo usuário"
            return 1
        fi
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        echo "   🚫 DRY RUN - Nenhum arquivo foi deletado (simulação)"
        return 0
    fi
    
    # Fazer backup (zip rápido)
    local backup_file="/tmp/signal-backup-${company_id}-${whatsapp_id}-$(date +%Y%m%d_%H%M%S).zip"
    echo "   💾 Criando backup: $backup_file"
    cd "$session_dir"
    zip -q "$backup_file" session-* sender-key-* pre-key-* 2>/dev/null || true
    echo "      Backup criado ($(stat -c%s "$backup_file" 2>/dev/null || echo 0) bytes)"
    
    # Deletar arquivos Signal
    echo "   🗑️  Deletando arquivos Signal..."
    find "$session_dir" -name "session-*" -type f -delete 2>/dev/null || true
    find "$session_dir" -name "sender-key-*" -type f -delete 2>/dev/null || true
    find "$session_dir" -name "pre-key-*" -type f -delete 2>/dev/null || true
    
    # Verificar resultado
    local count_after=$(find "$session_dir" -name "session-*" -o -name "sender-key-*" -o -name "pre-key-*" 2>/dev/null | wc -l)
    echo "   ✅ Limpeza concluída - $count_after arquivos Signal restantes (esperado: 0)"
    
    # Listar o que sobrou (deve ser apenas creds e app-state)
    echo "   📋 Arquivos preservados:"
    ls -1 "$session_dir"/ | grep -E "^creds-|^app-state-" | sed 's/^/      - /' || echo "      (nenhum)"
    
    return 0
}

# Verificar se está rodando dentro do container
if [ ! -d "$SESSIONS_BASE_DIR" ]; then
    echo "❌ ERRO: Diretório $SESSIONS_BASE_DIR não encontrado!"
    echo "   Este script deve rodar DENTRO do container whaticket-backend."
    echo ""
    echo "   Execute assim:"
    echo "   docker exec -it whaticket-backend sh /app/scripts/migrate-clean-signal.sh"
    exit 1
fi

echo ""
echo "🔍 Escaneando sessões em $SESSIONS_BASE_DIR..."

# Encontrar todas as sessões (diretórios dentro de companyId/whatsappId)
find "$SESSIONS_BASE_DIR" -mindepth 2 -maxdepth 2 -type d | while read session_dir; do
    # Extrair companyId e whatsappId do path
    rel_path="${session_dir#$SESSIONS_BASE_DIR/}"
    company_id=$(echo "$rel_path" | cut -d'/' -f1)
    whatsapp_id=$(echo "$rel_path" | cut -d'/' -f2)
    
    # Verificar se há arquivos Signal
    signal_count=$(find "$session_dir" \( -name "session-*" -o -name "sender-key-*" -o -name "pre-key-*" \) -type f 2>/dev/null | wc -l)
    
    if [ "$signal_count" -gt 0 ]; then
        echo ""
        echo "───────────────────────────────────────────────────────────────"
        echo "🎯 Sessão encontrada: company=$company_id, whatsapp=$whatsapp_id"
        echo "   Arquivos Signal: $signal_count"
        echo ""
        
        if [ "$DRY_RUN" = "true" ]; then
            limpar_sessao "$company_id" "$whatsapp_id"
        else
            read -p "   Deseja limpar esta sessão? (s/N): " resposta
            if [ "$resposta" = "s" ] || [ "$resposta" = "S" ]; then
                limpar_sessao "$company_id" "$whatsapp_id"
            else
                echo "   ⏭️  Pulando..."
            fi
        fi
    fi
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ MIGRATION CONCLUÍDA"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📋 Resumo:"
echo "   - Backups criados em: /tmp/signal-backup-*.zip"
echo "   - Sessões limpas: reinicie o container para reconectar"
echo ""
echo "🔧 Próximos passos:"
echo "   1. docker restart whaticket-backend"
echo "   2. docker logs whaticket-backend -f --tail 100"
echo "   3. Aguarde 'Conexão estabelecida' nas logs"
echo ""
echo "⚠️  IMPORTANTE: Não é necessário escanear QR Code novamente!"
echo "   Os arquivos creds-* foram preservados."
echo ""
