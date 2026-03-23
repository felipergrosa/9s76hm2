# Sistema de Status de Usuário em Tempo Real

## Visão Geral

Sistema completo para detectar e exibir status de usuários (online/ausente/offline) em tempo real em todas as páginas do sistema.

## Estados de Status

| Estado | Cor | Condições |
|--------|-----|-----------|
| **Online** | 🟢 Verde | `online=true`, `status=null`, `lastActivityAt < 2h` |
| **Ausente** | 🟡 Amarelo | `online=true`, `status="ausente"`, `lastActivityAt entre 2h e 3h` |
| **Offline** | 🔴 Cinza | `online=false`, `status=null`, `lastActivityAt > 3h` |

## Arquitetura de Detecção (3 Camadas)

### 1. HTTP Middleware (`trackUserActivity`)
- **Arquivo**: `backend/src/middleware/trackUserActivity.ts`
- **Trigger**: Toda requisição HTTP autenticada
- **Ação**: 
  - Atualiza `lastActivityAt`
  - Se usuário estava offline/inativo há >3h, coloca online e emite evento Socket.IO

### 2. Socket.IO Heartbeat
- **Arquivo**: `backend/src/libs/socket.ts` (handler) + `frontend/src/services/SocketWorker.js` (sender)
- **Trigger**: A cada 1 minuto enquanto conectado via Socket.IO
- **Ação**:
  - Envia evento `userHeartbeat` com `userId`
  - Backend atualiza `lastActivityAt`
  - Se usuário estava offline/inativo há >3h, coloca online e emite evento

### 3. Cron Job (`UserStatusJob`)
- **Arquivo**: `backend/src/jobs/UserStatusJob.ts`
- **Trigger**: A cada 5 minutos
- **Ação**:
  - Verifica todos usuários
  - Atualiza status baseado em `lastActivityAt`
  - Emite eventos Socket.IO para cada mudança

## Fluxo de Eventos Socket.IO

### Evento Emitido
```
Nome: company-{companyId}-user
Payload: {
  "action": "update",
  "user": {
    "id": 1,
    "online": true,
    "status": null,
    "lastActivityAt": "2026-03-23T16:00:00Z"
  }
}
```

### Páginas que Escutam

| Página | Arquivo | Ação |
|--------|---------|------|
| `/users` | `frontend/src/pages/Users/index.js` | Atualiza lista de usuários (reducer `UPDATE_USERS`) |
| `/dashboard` | `frontend/src/pages/Dashboard/index.js` | Atualiza contador de atendentes online |

## Componente de Exibição

**Arquivo**: `frontend/src/components/UserModal/statusIcon.js`

```jsx
<UserStatusIcon user={user} />
```

Lógica:
1. Se `online=true` e `status="ausente"` → 🟡 Amarelo
2. Se `online=true` e `status=null` → 🟢 Verde
3. Se `online=false` → 🔴 Cinza

## Cenários de Teste

### Cenário 1: Login
1. Usuário faz login
2. `UpdateUserOnlineStatusService` é chamado
3. `online=true`, `lastActivityAt=agora`
4. Evento emitido → Frontend atualiza

### Cenário 2: Atividade Contínua
1. Usuário navega pelo sistema
2. `trackUserActivity` middleware atualiza `lastActivityAt`
3. Socket.IO heartbeat atualiza `lastActivityAt` a cada 1 min
4. Status permanece 🟢 Online

### Cenário 3: Inatividade 2h
1. Usuário para de usar (aba aberta, sem ações)
2. Heartbeat para se socket desconectar
3. Após 2h: `UserStatusJob` marca `status="ausente"`
4. Evento emitido → Frontend mostra 🟡 Amarelo

### Cenário 4: Inatividade 3h
1. Após 3h: `UserStatusJob` marca `online=false`
2. Evento emitido → Frontend mostra 🔴 Cinza

### Cenário 5: Retorno à Atividade
1. Usuário volta a usar (qualquer ação HTTP ou Socket.IO)
2. `trackUserActivity` ou `userHeartbeat` detecta `online=false`
3. Atualiza `online=true`, `status=null`
4. Evento emitido → Frontend mostra 🟢 Verde

## Configuração

### Variáveis de Ambiente
Nenhuma variável específica necessária. O sistema usa configurações padrão.

### Intervalos (hardcoded, podem ser parametrizados)
- Heartbeat Socket.IO: 60 segundos
- Verificação UserStatusJob: 5 minutos
- Threshold Ausente: 2 horas
- Threshold Offline: 3 horas

## Troubleshooting

### Status não atualiza em realtime
1. Verificar se Socket.IO está conectado (console: `window.__SOCKET_IO__.connected`)
2. Verificar logs do backend: `[Heartbeat]`, `[TrackActivity]`, `[UserStatusJob]`
3. Verificar se evento `company-{companyId}-user` está sendo recebido

### Usuário fica offline mesmo ativo
1. Verificar se heartbeat está rodando (deve enviar a cada 1 min)
2. Verificar se `lastActivityAt` está sendo atualizado no banco
3. Verificar se `UserStatusJob` não está marcando incorretamente

### Status não muda para ausente
1. Verificar se `UserStatusJob` está rodando (logs a cada 5 min)
2. Verificar se `lastActivityAt` está correto no banco

## Arquivos Modificados

### Backend
- `src/libs/socket.ts` - Handler `userHeartbeat`
- `src/middleware/trackUserActivity.ts` - Detecção de retorno à atividade
- `src/jobs/UserStatusJob.ts` - Logs detalhados
- `src/services/UserServices/UpdateUserOnlineStatusService.ts` - Emissão de eventos

### Frontend
- `src/services/SocketWorker.js` - Métodos `startHeartbeat`, `stopHeartbeat`, `sendHeartbeat`
- `src/pages/Users/index.js` - Listener Socket.IO
- `src/pages/Dashboard/index.js` - Listener Socket.IO
- `src/components/UserModal/statusIcon.js` - Exibição dos estados

## Próximos Passos (Sugestões)

1. **Parametrizar intervalos via .env**
   - `USER_HEARTBEAT_INTERVAL_MS=60000`
   - `USER_STATUS_JOB_INTERVAL="*/5 * * * *"`
   - `USER_AWAY_THRESHOLD_HOURS=2`
   - `USER_OFFLINE_THRESHOLD_HOURS=3`

2. **Adicionar indicador visual de "visto por último"**
   - Mostrar "visto há X minutos/horas" para usuários offline

3. **Notificar usuário quando ficar ausente**
   - Toast ou som quando status mudar para ausente

4. **Página de administração de status**
   - Ver todos usuários e seus status em tempo real
   - Forçar logout de usuários inativos
