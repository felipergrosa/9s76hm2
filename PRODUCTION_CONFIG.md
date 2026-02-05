# Configuração de Produção - Stack Portainer

## Atualização do stack.portainer.yml

Adicione estas variáveis ao serviço `whaticketback` no seu `stack.portainer.yml`:

```yaml
services:
  whaticketback:
    environment:
      # ... (manter variáveis existentes) ...
      
      # ==========================================
      # CONFIGURAÇÕES DAS 7 SOLUÇÕES IMPLEMENTADAS
      # ==========================================
      
      # Solução 1: Connection State Recovery
      # (Nativo do Socket.IO - não precisa de configuração extra)
      # O recovery automático já está ativo com 2 minutos de retenção
      
      # Solução 2, 3, 4, 5: Configurações gerais Socket.IO
      # DEBUG: Em produção, desativar logs detalhados
      SOCKET_DEBUG: "false"
      
      # FALLBACK: Em produção, manter fallback ativado para garantir entrega
      # mesmo quando a sala está vazia momentaneamente
      SOCKET_FALLBACK_NS_BROADCAST: "true"
      
      # Solução 6: BullMQ Event Queue (Fila Persistente)
      # RECOMENDADO para produção com múltiplas réplicas
      # Ativa fila persistente no Redis para garantir entrega de eventos
      SOCKET_USE_QUEUE: "true"
      
      # URL do Redis para o Socket Adapter (obrigatório com múltiplas réplicas)
      # Já configurado no stack: REDIS_URI e REDIS_URI_ACK
      # Socket Adapter usará o mesmo Redis
      SOCKET_REDIS_URL: redis://:SuaSenhaForteAqui123!@redis:6379/0
      
      # Solução 7: CQRS Básico
      # Debug do Event Bus (desativar em produção)
      CQRS_DEBUG: "false"
      
      # ==========================================
      # RECOMENDAÇÕES PARA MÚLTIPLAS RÉPLICAS
      # ==========================================
      # Se você tem replicas: 2 ou mais no deploy:
      # 
      # 1. SESSIONS_DRIVER deve ser "redis" (já configurado)
      # 2. SOCKET_USE_QUEUE: "true" é OBRIGATÓRIO
      # 3. SOCKET_REDIS_URL deve apontar para o mesmo Redis
      #
      # Isso garante que eventos Socket.IO sejam sincronizados entre todas
      # as instâncias do backend via Redis Adapter + Bull Queue
```

---

## Checklist de Configuração para Produção

### Antes de fazer deploy:

1. **Atualizar stack.portainer.yml**
   ```bash
   # Adicionar estas linhas ao environment do whaticketback
   SOCKET_DEBUG: "false"
   SOCKET_FALLBACK_NS_BROADCAST: "true"
   SOCKET_USE_QUEUE: "true"
   SOCKET_REDIS_URL: redis://:SuaSenhaForteAqui123!@redis:6379/0
   CQRS_DEBUG: "false"
   ```

2. **Verificar Redis está acessível**
   ```bash
   # Testar conexão Redis (dentro do container backend)
   redis-cli -h redis -p 6379 -a SuaSenhaForteAqui123! ping
   # Deve retornar: PONG
   ```

3. **Confirmar múltiplas réplicas**
   ```yaml
   deploy:
     mode: replicated
     replicas: 2  # ou mais
   ```

### Depois do deploy:

4. **Verificar logs das soluções**
   ```bash
   # Logs devem mostrar:
   # - "[SOCKET RECOVERY] ✅ Conexão RECUPERADA" (quando houver reconexão)
   # - "[SocketEventQueue] Evento enfileirado" (quando SOCKET_USE_QUEUE=true)
   # - NÃO deve mostrar logs de debug em excesso (SOCKET_DEBUG=false)
   ```

5. **Testar reconexão**
   ```bash
   # Simular desconexão temporária
   # 1. Abrir ticket no frontend
   # 2. Desabilitar WiFi por 30 segundos
   # 3. Reabilitar WiFi
   # 4. Verificar se mensagens aparecem sem F5
   ```

---

## Configuração Completa (Bloco para Copiar)

Adicione este bloco no `environment` do serviço `whaticketback`:

```yaml
      # Socket.IO - Soluções de Realtime Sync
      SOCKET_DEBUG: "false"
      SOCKET_FALLBACK_NS_BROADCAST: "true"
      SOCKET_USE_QUEUE: "true"
      SOCKET_REDIS_URL: redis://:SuaSenhaForteAqui123!@redis:6379/0
      
      # CQRS - Event Bus
      CQRS_DEBUG: "false"
```

---

## O que muda em Produção vs Desenvolvimento

| Variável | Dev | Produção | Motivo |
|----------|-----|----------|--------|
| SOCKET_DEBUG | "true" | "false" | Menos logs = mais performance |
| SOCKET_USE_QUEUE | "false" | "true" | Garante entrega entre réplicas |
| SOCKET_REDIS_URL | (opcional) | **obrigatório** | Adapter Redis para multi-instância |
| CQRS_DEBUG | "true" | "false" | Menos logs = mais performance |

---

## Importante: Comportamento das Soluções

### Solução 1 - Connection State Recovery
- ✅ **Funciona automaticamente** - não precisa de config
- Recupera eventos de até 2 minutos de desconexão
- Guarda rooms e estado do socket automaticamente

### Solução 2 - Optimistic UI  
- ✅ **Funciona automaticamente** - código já no frontend
- Mensagens aparecem em 0ms (antes da resposta do servidor)
- Reconciliação automática quando servidor confirma

### Solução 3 - Last Event ID
- ✅ **Funciona automaticamente** - usa localStorage
- Recupera mensagens perdidas ao reconectar
- Endpoint `recoverMissedMessages` já disponível

### Solução 4 - Acknowledgement com Retry
- ✅ **Código pronto** - usar `emitWithAck()` quando necessário
- Maior overhead - usar apenas para mensagens críticas

### Solução 5 - Polling Adaptativo
- ✅ **Funciona automaticamente** - código já no frontend  
- 5s quando desconectado, 30s quando conectado

### Solução 6 - BullMQ Event Queue
- ⚠️ **Requer `SOCKET_USE_QUEUE: "true"`**
- Obrigatório para múltiplas réplicas
- Garante entrega persistente via Redis

### Solução 7 - CQRS Básico
- ✅ **Código pronto** - usar `MessageCommandService` e `MessageQueryService`
- Event Bus já configurado
- Migração gradual do código legado

---

## Redeploy do Stack

```bash
# 1. Atualizar stack.portainer.yml
# 2. Deploy no Portainer ou via docker stack deploy

docker stack deploy -c stack.portainer.yml whaticket

# 3. Verificar se containers subiram
docker stack ps whaticket

# 4. Verificar logs do backend
docker service logs whaticket_whaticketback --tail 100 -f
```

---

**Data da atualização:** 2025-02-04  
**Versão das soluções:** 7/7 implementadas
