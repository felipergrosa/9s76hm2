# Sistema Multi-Device WhatsApp

## Visão Geral

Este documento descreve a implementação do suporte a múltiplas conexões do mesmo número WhatsApp (Multi-Device) no Whaticket.

## O que é Multi-Device?

O WhatsApp permite que um número seja conectado em até **4 dispositivos simultâneos** (companion devices):

| Dispositivo | Tipo | Limite |
|-------------|------|--------|
| WhatsApp Mobile | Primary | 1 |
| WhatsApp Web | Companion | Até 4 |
| WhatsApp Windows/Mac | Companion | Até 4 |
| Whaticket (Baileys) | Companion | Até 4 |

**Cada dispositivo tem seu próprio QR Code e sessão independente.**

## Como Funciona

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ARQUITETURA MULTI-DEVICE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  WhatsApp Mobile (primary)                                          │
│  ├─ Conectado ao número 5511999991111                               │
│  └─ Sessão nativa do celular                                        │
│                                                                      │
│  Whaticket DEV (companion)                                          │
│  ├─ QR Code separado                                                │
│  ├─ Sessão: sessions:13:* (Redis) ou private/sessions/1/13/ (FS)   │
│  └─ LÍDER para processamento                                        │
│                                                                      │
│  Whaticket PROD (companion)                                         │
│  ├─ QR Code separado                                                │
│  ├─ Sessão: sessions:20:* (Redis) ou private/sessions/1/20/ (FS)    │
│  └─ FOLLOWER (standby)                                              │
│                                                                      │
│  ✅ TODOS recebem mensagens simultaneamente                         │
│  ✅ Apenas o LÍDER processa (cria tickets, dispara automações)      │
│  ✅ FOLLOWERS apenas salvam histórico                               │
│  ✅ Se LÍDER cai, FOLLOWER assume automaticamente                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Componentes Implementados

### 1. Leader Election Service (`wbotLeaderService.ts`)

**Função:** Coordena qual conexão é o líder para cada número.

**Características:**
- Lock distribuído via Redis por número (não por whatsappId)
- TTL de 30 segundos com renovação automática
- Detecção de líder morto (60 segundos sem renovação)
- Failover automático

**Chaves Redis:**
```
wbot:leader:<phoneNumber> → "instanceId:whatsappId:timestamp"
```

### 2. Deduplicação de Mensagens

**Problema:** A mesma mensagem chega em múltiplas conexões simultaneamente.

**Solução:**
- Verificação por `wid` (messageId) antes de salvar
- Índice único no banco: `messages_wid_company_id_unique`
- `CreateMessageService` retorna mensagem existente se já foi salva

### 3. Verificação de Líder no `wbotMessageListener`

**Comportamento:**
- **LÍDER:** Processa mensagens normalmente (cria tickets, dispara automações)
- **FOLLOWER:** Apenas salva mensagens para histórico (sem processamento)

### 4. Liberação de Liderança no `wbot.ts`

**Quando acontece:**
- Conexão desconecta permanentemente (loggedOut)
- Sessão é deletada
- Permite que outro dispositivo assuma

## Fluxo de Mensagens

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FLUXO DE MENSAGEM RECEBIDA                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Mensagem chega no WhatsApp                                      │
│     └─ WhatsApp entrega para TODOS os dispositivos conectados       │
│                                                                      │
│  2. DEV e PROD recebem a mensagem                                   │
│     ├─ DEV: Verifica se é LÍDER → SIM                               │
│     │   ├─ Processa mensagem (cria ticket, dispara automação)       │
│     │   └─ Salva no banco                                           │
│     │                                                                │
│     └─ PROD: Verifica se é LÍDER → NÃO                              │
│         ├─ Verifica se mensagem já existe (deduplicação)            │
│         └─ Se não existe: salva para histórico (sem processamento)  │
│                                                                      │
│  3. Frontend recebe notificação                                     │
│     └─ Socket.IO emite evento (apenas uma vez, deduplicado)         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Proteções Implementadas

### 1. Deduplicação de Mensagens
- **Camada 1:** `CreateMessageService` verifica se `wid` já existe
- **Camada 2:** Índice único no banco garante integridade

### 2. Deduplicação de Tickets
- Líder cria tickets, followers não
- Se follower tentar criar, verifica se já existe

### 3. Deduplicação de Notificações
- Socket.IO emite apenas uma vez por mensagem
- Frontend ignora duplicados por `wid`

### 4. Failover Automático
- Se líder cai, lock expira em 30 segundos
- Próximo heartbeat de follower detecta e assume
- Transição transparente para o usuário

## Configuração

### Variáveis de Ambiente

```bash
# Redis obrigatório para Multi-Device
REDIS_URI=redis://localhost:6379

# Driver de sessões (redis recomendado para Multi-Device)
SESSIONS_DRIVER=redis

# Debug de Socket.IO (opcional)
SOCKET_DEBUG=true
```

### Migration

```bash
cd backend
npm run migrate
```

Isso cria o índice único de deduplicação.

## Logs Importantes

### Líder Conectado
```
[wbotMessageListener] ✅ Esta conexão é LÍDER para 5511999991111
```

### Follower Conectado
```
[wbotMessageListener] ⚠️ Esta conexão é FOLLOWER para 5511999991111 (apenas sincroniza histórico)
```

### Mensagem Duplicada
```
[CreateMessageService] Mensagem já existe (deduplicada): wid=3EB0...
```

### Líder Morto Detectado
```
[LeaderService] Líder morto detectado para 5511999991111. Tentando assumir.
```

## Limitações

1. **Redis Obrigatório:** Multi-Device não funciona com `SESSIONS_DRIVER=fs`
2. **Apenas 1 Líder por Número:** Apenas um dispositivo processa mensagens por vez
3. **Delay de Failover:** Até 30 segundos para follower assumir

## Troubleshooting

### Problema: Mensagens duplicadas no banco

**Verificar:**
```sql
SELECT wid, COUNT(*) FROM Messages GROUP BY wid HAVING COUNT(*) > 1;
```

**Solução:**
```bash
npm run migrate  # Garante que índice único existe
```

### Problema: Dois líderes para o mesmo número

**Verificar:**
```bash
redis-cli KEYS "wbot:leader:*"
```

**Solução:**
```bash
redis-cli DEL "wbot:leader:5511999991111"
# Reiniciar conexões para nova eleição
```

### Problema: Follower não assume quando líder cai

**Verificar:**
- Redis está acessível?
- `LEADER_DEAD_THRESHOLD_MS` está configurado corretamente?

## Testando Multi-Device

1. **Conectar DEV:**
   - Escanear QR Code
   - Verificar log: "✅ Esta conexão é LÍDER"

2. **Conectar PROD (mesmo número):**
   - Escanear QR Code
   - Verificar log: "⚠️ Esta conexão é FOLLOWER"

3. **Enviar mensagem:**
   - Verificar que apenas DEV processou
   - Verificar que PROD salvou para histórico

4. **Derrubar DEV:**
   - Aguardar 30 segundos
   - Verificar que PROD assumiu como líder

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `backend/src/libs/wbotLeaderService.ts` | **NOVO** - Leader Election Service |
| `backend/src/services/WbotServices/wbotMessageListener.ts` | Verificação de líder |
| `backend/src/services/MessageServices/CreateMessageService.ts` | Deduplicação |
| `backend/src/libs/wbot.ts` | Liberação de liderança |
| `backend/src/database/migrations/20260221000000-add-unique-index-messages-wid.ts` | **NOVO** - Índice único |

## Referências

- [WhatsApp Multi-Device Documentation](https://faq.whatsapp.com/general/download-and-installation/about-linked-devices/)
- [Baileys Multi-Device](https://github.com/WhiskeySockets/Baileys)
