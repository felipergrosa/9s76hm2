Copyright

## Guia de Produção (Realtime e Integrações)

Esta seção documenta os pontos críticos para o funcionamento do realtime (Socket.IO) e de mídias (ffmpeg) em produção.

### Realtime com Socket.IO

- __Namespaces__: o backend expõe namespaces no formato `/workspace-<companyId>`.
- __Salas__: cada ticket utiliza seu `ticket.uuid` como sala para eventos como `company-<companyId>-appMessage`.
- __Adapter Redis__: habilitado via `REDIS_URI_ACK` (ou `SOCKET_REDIS_URL`). Ex.: `redis://redis:6379/0`.
- __Fallback de broadcast__: em produção habilite `SOCKET_FALLBACK_NS_BROADCAST="true"` para mitigar race conditions entre `joinChatBox` e o primeiro `emit`.
- __Debug opcional__: `SOCKET_DEBUG="true"` adiciona logs detalhados de emissão e salas.

### Variáveis de ambiente essenciais

- Backend:
  - `FRONTEND_URL=https://chats.seu-dominio.com`
  - `BACKEND_URL=https://api.seu-dominio.com`
  - `REDIS_URI=redis://redis:6379/0`
  - `REDIS_URI_ACK=redis://redis:6379/0`
  - `SOCKET_FALLBACK_NS_BROADCAST=true`
  - `SOCKET_DEBUG=false` (em produção, geralmente false)

- Frontend:
  - `REACT_APP_BACKEND_URL=https://api.seu-dominio.com`

### ffmpeg (áudio/mídia)

Para processamento de áudios/imagens/vídeos, o binário `ffmpeg` deve estar instalado na imagem do backend.

Exemplo (Debian/Ubuntu base):
```
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
```

Exemplo (Alpine base):
```
RUN apk add --no-cache ffmpeg
```

### Diagnóstico rápido

- __Socket conectado no front__: verificar no console do navegador o log `Socket conectado` e namespace `/workspace-<companyId>`.
- __Recebimento de eventos__: `window.__SOCKET_IO__?.onAny((e,...a)=>console.log('[SOCKET EVENT]',e,a))`.
- __Servidor emitindo__: no backend, com `SOCKET_DEBUG=true`, verificar `[SOCKET EMIT]` e `count` da sala.

---
Última atualização: produção estabilizada com fallback de broadcast ativado.
