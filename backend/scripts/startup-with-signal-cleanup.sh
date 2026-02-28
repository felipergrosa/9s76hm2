#!/bin/bash
# startup-with-signal-cleanup.sh - Script de startup com migrations + limpeza Signal
# Executado automaticamente quando o container inicia em produção
#
# Uso no Dockerfile:
#   CMD ["sh", "./scripts/startup-with-signal-cleanup.sh"]
#
# Ou no docker-compose/stack.portainer.yml:
#   command: ["sh", "./scripts/startup-with-signal-cleanup.sh"]

set -e

# Cores para logs (se terminal suportar)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[startup]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[startup]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[startup]${NC} $1"
}

log_error() {
    echo -e "${RED}[startup]${NC} $1"
}

echo "═══════════════════════════════════════════════════════════════"
echo "  🚀 WHATICKET STARTUP - Migrations + Signal Cleanup"
echo "═══════════════════════════════════════════════════════════════"

# ============================================================================
# ETAPA 1: MIGRATIONS DO BANCO (igual ao auto-migrate.sh original)
# ============================================================================

log_info "Inicializando startup com auto-migration..."

# Controla se deve rodar migrations automaticamente
if [ "${AUTO_MIGRATE:-true}" != "true" ]; then
    log_warn "AUTO_MIGRATE != true -> pulando migrations."
else
    # Aguarda o banco ficar acessível
    ATTEMPTS=${DB_WAIT_ATTEMPTS:-30}
    SLEEP_SECONDS=${DB_WAIT_SLEEP_SECONDS:-5}

    i=1
    while [ "$i" -le "$ATTEMPTS" ]; do
        if npx sequelize db:migrate:status >/dev/null 2>&1; then
            log_success "Banco de dados acessível."
            break
        fi
        log_warn "Banco ainda não acessível ($i/$ATTEMPTS). Tentando novamente em ${SLEEP_SECONDS}s..."
        i=$((i + 1))
        sleep "$SLEEP_SECONDS"
    done

    if [ "$i" -gt "$ATTEMPTS" ]; then
        log_warn "Aviso: Banco não respondeu após $ATTEMPTS tentativas. Prosseguindo mesmo assim."
    fi

    # Aplica migrations
    log_info "Executando migrations..."
    if ! npx sequelize db:migrate; then
        log_error "Falha ao aplicar migrations."
        npx sequelize db:migrate
        log_warn "Verifique logs/variáveis de ambiente. Prosseguindo com start do servidor."
    else
        log_success "Migrations aplicadas com sucesso (ou já estavam atualizadas)."
    fi
fi

# ============================================================================
# ETAPA 2: LIMPEZA SIGNAL PREVENTIVA NO STARTUP
# ============================================================================

SESSIONS_BASE_DIR="/app/private/sessions"
CLEANUP_ON_STARTUP="${SIGNAL_CLEANUP_ON_STARTUP:-false}"  # Default: não limpa no startup
CLEANUP_MAX_AGE_HOURS="${SIGNAL_CLEANUP_MAX_AGE_HOURS:-168}"  # 7 dias

if [ "$CLEANUP_ON_STARTUP" = "true" ]; then
    log_info "SIGNAL_CLEANUP_ON_STARTUP=true - Verificando sessões Signal antigas..."
    
    if [ -d "$SESSIONS_BASE_DIR" ]; then
        find "$SESSIONS_BASE_DIR" -mindepth 2 -maxdepth 2 -type d | while read session_dir; do
            rel_path="${session_dir#$SESSIONS_BASE_DIR/}"
            company_id=$(echo "$rel_path" | cut -d'/' -f1)
            whatsapp_id=$(echo "$rel_path" | cut -d'/' -f2)
            
            # Verificar se há arquivos Signal antigos (mais de X horas)
            old_files=$(find "$session_dir" \( -name "session-*" -o -name "sender-key-*" -o -name "pre-key-*" \) -type f -mmin +$((CLEANUP_MAX_AGE_HOURS * 60)) 2>/dev/null | wc -l)
            
            if [ "$old_files" -gt 0 ]; then
                log_warn "Sessão $whatsapp_id (company $company_id): $old_files arquivos Signal antigos encontrados (> ${CLEANUP_MAX_AGE_HOURS}h)"
                
                # Verificar se há creds antes de limpar
                if [ -f "$session_dir/creds-"*.json ]; then
                    log_info "  → Limpando arquivos Signal antigos (preservando creds)..."
                    find "$session_dir" \( -name "session-*" -o -name "sender-key-*" -o -name "pre-key-*" \) -type f -mmin +$((CLEANUP_MAX_AGE_HOURS * 60)) -delete 2>/dev/null || true
                    log_success "  → $old_files arquivos antigos removidos"
                else
                    log_warn "  → Pulando: creds-* não encontrado (evitando perda de sessão)"
                fi
            fi
        done
    fi
else
    log_info "SIGNAL_CLEANUP_ON_STARTUP=false - Pulando limpeza preventiva."
    log_info "  (Para ativar: definir SIGNAL_CLEANUP_ON_STARTUP=true e opcionalmente SIGNAL_CLEANUP_MAX_AGE_HOURS=168)"
fi

# ============================================================================
# ETAPA 3: INICIAR SERVIDOR
# ============================================================================

log_success "Iniciando servidor Node.js..."
echo "═══════════════════════════════════════════════════════════════"

exec node dist/server.js
