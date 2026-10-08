# wacalls — microserviço de chamadas WhatsApp (whatsmeow)

Skeleton do "WhatsApp Plus — Voz + Msg" da referência Fluxoo. Serviço **separado** do backend principal (Go + `go.mau.fi/whatsmeow`), localizado em `wacalls/`.

## O que está implementado

- **Sessões whatsmeow** persistidas em sqlite (`sqlstore`) — reconectam no boot
- **Pareamento por QR** (`POST /sessions` → polling) e **por código** (`POST /sessions/:id/pair-code`)
- **Detecção de chamadas**: `CallOffer`/`CallOfferNotice`/`CallAccept`/`CallTerminate`/`CallReject` → `callEvent`
- **Agregação**: offer→término vira um único registro com duração/status (answered/missed/rejected)
- **Integração com o backend**: `POST /call-logs` com `X-Service-Token` (já implementado na Onda 5) + `POST /call-logs/incoming` (endpoint a criar se quiser push em tempo real)
- **Dockerfile** multi-stage — não precisa de Go instalado local

## Como rodar

```bash
cd wacalls
docker build -t wacalls .            # ou: go mod tidy && go run .
docker run -p 8090:8090 --env-file .env wacalls
```

Env vars (`wacalls/.env.example`): `LISTEN_ADDR`, `BACKEND_URL`, `INTERNAL_SERVICE_TOKEN` (mesmo do backend), `WACALLS_SESSION_DB`, `LOG_LEVEL`.

## API de gestão (X-Service-Token)

| Método | Rota | Uso |
|---|---|---|
| GET | `/health` | healthcheck |
| POST | `/sessions` | `{companyId, whatsappId, label}` → inicia pareamento, retorna `{id, qr}` |
| GET | `/sessions` | lista sessões |
| POST | `/sessions/:id/pair-code` | `{phone}` → código de 8 dígitos |
| POST | `/sessions/:id/reject-call` | `{callId, from}` → rejeita (pendente: sinalização) |
| DELETE | `/sessions/:id` | logout + remove |

## Pendências para paridade total (fluxo de chamada real)

1. **`RejectCall`**: o whatsmeow expõe `client.RejectCall` — verificar assinatura na versão pinada e ligar ao endpoint `/sessions/:id/reject-call`.
2. **Notificação em tempo real**: `POST /call-logs/incoming` está sendo enviado mas o backend ainda não tem esse endpoint — criar rota que emita socket `company-{id}-incoming-call` para o frontend abrir um modal de "chamada recebida".
3. **Bridge de mídia** (a parte proprietária do Fluxoo): aceitar a chamada no protocolo e ponte RTP↔WebRTC no browser (H.264/Opus). whatsmeow entrega sinalização, mas a captura/injeção de mídia é trabalho custom — não existe pacote pronto.
4. **Atribuição de tenant**: `POST /sessions` recebe `companyId`/`whatsappId` — falta o backend criar uma conexão tipo `wacalls` e chamar este serviço (integração Connections → wacalls API).
5. **Idempotência**: `CallLogs` não tem `externalId` único — se o wacalls reenviar (retry), duplica. Adicionar coluna única + upsert se necessário.

## Arquitetura

```
wacalls (Go)
├── main.go       — bootstrap, config, shutdown gracioso
├── config.go     — env vars
├── sessions.go   — SessionManager: pairing QR/código, restore, event handler
├── calls.go      — mapCallEvent (whatsmeow→callEvent) + CallTracker → POST /call-logs
├── api.go        — REST de gestão
├── Dockerfile    — build multi-stage (Go não precisa estar local)
└── .env.example
```
