#!/bin/bash

# 🚀 SCRIPT AUTOMÁTICO PARA PRODUÇÃO - DETECTAR E CORRIGIR SESSÕES CORROMPIDAS
# Uso: ./auto-fix-sessions.sh [whatsappId]

set -e

LOG_FILE="/var/log/whaticket-auto-fix.log"
WHATSAPP_ID=${1:-"all"}
BACKEND_URL="http://localhost:8080"
REDIS_URL="redis://127.0.0.1:6379/0"

# Função de log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Função para verificar se backend está online
check_backend() {
    if curl -s "$BACKEND_URL/health" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Função para detectar erros de sessão nos logs
detect_session_errors() {
    local whatsapp_id=$1
    local error_count=0
    
    # Procura por erros típicos de sessão corrompida
    if docker logs whaticket-backend --tail=100 2>&1 | grep -i "Invalid PreKey ID\|Bad MAC\|PreKeyError\|failed to decrypt message" | grep -i "whatsappId=$whatsapp_id" > /dev/null; then
        error_count=$(docker logs whaticket-backend --tail=100 2>&1 | grep -i "Invalid PreKey ID\|Bad MAC\|PreKeyError" | grep -c "whatsappId=$whatsapp_id" || echo "0")
    fi
    
    echo $error_count
}

# Função para resetar sessão específica
reset_session() {
    local whatsapp_id=$1
    
    log "🔧 Resetando sessão WhatsApp ID: $whatsapp_id"
    
    # 1. Desconectar via API
    log "📱 Desconectando WhatsApp $whatsapp_id..."
    curl -X PUT "$BACKEND_URL/whatsapp/$whatsapp_id/disconnect" \
         -H "Content-Type: application/json" \
         -d '{}' \
         -s -o /dev/null || log "⚠️  Falha ao desconectar via API"
    
    # 2. Limpar arquivos de sessão
    log "📁 Limpando arquivos de sessão..."
    if [ -d "/app/private/sessions/1/$whatsapp_id" ]; then
        rm -rf "/app/private/sessions/1/$whatsapp_id"
        log "✅ Arquivos de sessão removidos"
    fi
    
    # 3. Limpar cache Redis
    log "🗄️  Limpando cache Redis..."
    if command -v redis-cli &> /dev/null; then
        redis-cli -u "$REDIS_URL" flushall > /dev/null 2>&1 || log "⚠️  Falha ao limpar Redis"
    fi
    
    # 4. Esperar um momento
    sleep 5
    
    # 5. Reconectar
    log "🔄 Reconectando WhatsApp $whatsapp_id..."
    curl -X PUT "$BACKEND_URL/whatsapp/$whatsapp_id/start-session" \
         -H "Content-Type: application/json" \
         -d '{}' \
         -s -o /dev/null || log "⚠️  Falha ao reconectar via API"
    
    log "✅ Sessão $whatsapp_id resetada com sucesso"
}

# Função para verificar todas as sessões
check_all_sessions() {
    log "🔍 Verificando todas as sessões ativas..."
    
    # Obter lista de conexões WhatsApp ativas
    local sessions=$(curl -s "$BACKEND_URL/whatsapp" | jq -r '.[] | select(.status == "OPENED") | .id' 2>/dev/null || echo "")
    
    if [ -z "$sessions" ]; then
        log "⚠️  Nenhuma sessão ativa encontrada"
        return
    fi
    
    for session_id in $sessions; do
        log "📊 Verificando sessão $session_id..."
        
        local error_count=$(detect_session_errors "$session_id")
        
        if [ "$error_count" -gt "5" ]; then
            log "🚨 ERROS DETECTADOS na sessão $session_id: $error_count ocorrências"
            reset_session "$session_id"
        else
            log "✅ Sessão $session_id OK ($error_count erros)"
        fi
    done
}

# Início do script
log "🚀 INICIANDO AUTO-FIX DE SESSÕES WHATSAPP"

# Verificar se backend está online
if ! check_backend; then
    log "❌ Backend não está online. Abortando."
    exit 1
fi

log "✅ Backend online, continuando..."

# Processar based no parâmetro
if [ "$WHATSAPP_ID" = "all" ]; then
    check_all_sessions
else
    local error_count=$(detect_session_errors "$WHATSAPP_ID")
    
    if [ "$error_count" -gt "5" ]; then
        log "🚨 ERROS DETECTADOS na sessão $WHATSAPP_ID: $error_count ocorrências"
        reset_session "$WHATSAPP_ID"
    else
        log "✅ Sessão $WHATSAPP_ID OK ($error_count erros)"
    fi
fi

log "🎯 AUTO-FIX CONCLUÍDO"
