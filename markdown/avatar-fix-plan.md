# 🔧 Plano de Correção: Avatares do WhatsApp

## Diagnóstico Completo

### Problemas Identificados

| # | Problema | Impacto | Local |
|---|---------|---------|-------|
| 1 | URLs CDN do WhatsApp expiram em ~24h | Avatar some após expiração | Backend profilePicUrl |
| 2 | Download local desativado (AVATAR_DOWNLOAD_LOCAL_ENABLED=false) | Backend NÃO salva cópia local da imagem | RefreshContactAvatarService.ts |
| 3 | Frontend carrega direto da CDN sem proxy | Sujeito a CORS e expiração | ContactAvatar/index.js |
| 4 | Normalização de URL complexa e frágil | URLs corrompidas ou inalcançáveis | normalizeAvatarUrl() |

### Solução: Backend faz proxy da imagem (como WhatsApp Web)

1. Backend: Ativar AVATAR_DOWNLOAD_LOCAL_ENABLED=true (padrão)
2. Frontend: Simplificar ContactAvatar para confiar na urlPicture local
3. Modelo Contact: Garantir que o getter urlPicture retorna URL completa válida
