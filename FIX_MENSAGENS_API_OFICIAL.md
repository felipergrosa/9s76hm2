# 🔧 Correção: Mensagens e Mídias API Oficial

## 🐛 Problemas Identificados

### 1️⃣ Mensagens Enviadas Não Aparecem no Chat
**Sintoma:** Ao enviar mensagem pelo Whaticket, ela vai para o WhatsApp mas não aparece no chat do Whaticket.

**Causa:** O código envia a mensagem mas **não salva no banco de dados**.

```typescript
// backend/src/controllers/MessageController.ts - Linha 757
await SendWhatsAppMessageUnified({ body, ticket, quotedMsg, vCard });
// ❌ Não salva no banco!
// ❌ Não emite evento Socket.IO!
// ❌ Mensagem não aparece no chat!
```

### 2️⃣ Imagens Quebradas (404)
**Sintoma:** Imagens recebidas aparecem como quebradas.

**Logs:**
```
Failed to load resource: net::ERR_NAME_NOT_RESOLVED
estaticad.nobre.luminarias.a7c474343d4d6d5d1.0
```

**Causa:** O código salva o **ID da mídia da Meta** (ex: `id123`) em vez de baixar a mídia e salvar a URL local.

```typescript
// backend/src/services/WbotServices/ProcessWhatsAppWebhook.ts - Linha 210
case "image":
  mediaUrl = message.image?.id; // ❌ ID da Meta, não URL real!
  break;
```

---

## ✅ SOLUÇÕES

### Solução 1: Salvar Mensagens Enviadas

**Arquivo:** `backend/src/controllers/MessageController.ts`

**Problema (Linha 756-757):**
```typescript
if (ticket.channel === "whatsapp" && isPrivate === "false") {
  await SendWhatsAppMessageUnified({ body, ticket, quotedMsg, vCard });
  // ❌ Para aqui, não salva!
}
```

**Correção:**
```typescript
if (ticket.channel === "whatsapp" && isPrivate === "false") {
  // Enviar mensagem
  const sentMessage = await SendWhatsAppMessageUnified({ body, ticket, quotedMsg, vCard });
  
  // Salvar no banco
  const messageData = {
    wid: sentMessage.id || `${Date.now()}`,
    ticketId: ticket.id,
    contactId: ticket.contactId,
    body: body || "",
    fromMe: true,
    mediaType: !isNil(vCard) ? "contactMessage" : "extendedTextMessage",
    read: true,
    quotedMsgId: quotedMsg?.id || null,
    ack: 1, // Enviado
    remoteJid: ticket.contact?.remoteJid,
  };
  
  await CreateMessageService({ 
    messageData, 
    companyId: ticket.companyId 
  });
}
```

---

### Solução 2: Download de Mídia da API Oficial

#### Passo A: Criar Função de Download

**Novo arquivo:** `backend/src/services/WbotServices/DownloadOfficialMediaService.ts`

```typescript
import axios from "axios";
import fs from "fs";
import path from "path";
import logger from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";

interface DownloadMediaOptions {
  mediaId: string;
  whatsapp: Whatsapp;
  companyId: number;
  mediaType: "image" | "video" | "audio" | "document";
}

/**
 * Baixa mídia da WhatsApp Official API e salva localmente
 * @returns URL local da mídia
 */
export const DownloadOfficialMediaService = async ({
  mediaId,
  whatsapp,
  companyId,
  mediaType
}: DownloadMediaOptions): Promise<string> => {
  try {
    logger.info(`[DownloadOfficialMedia] Baixando mídia ${mediaId}`);

    const accessToken = whatsapp.wabaAccessToken;
    
    // 1. Obter URL da mídia
    const mediaInfoResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const mediaUrl = mediaInfoResponse.data.url;
    const mimeType = mediaInfoResponse.data.mime_type;
    
    logger.debug(`[DownloadOfficialMedia] URL: ${mediaUrl}`);

    // 2. Baixar arquivo
    const mediaResponse = await axios.get(mediaUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      responseType: "arraybuffer"
    });

    // 3. Determinar extensão
    const ext = getExtensionFromMimeType(mimeType) || getDefaultExtension(mediaType);
    const filename = `${mediaId}.${ext}`;

    // 4. Criar pasta se não existir
    const publicDir = path.join(
      process.cwd(),
      "public",
      `company${companyId}`
    );

    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // 5. Salvar arquivo
    const filePath = path.join(publicDir, filename);
    fs.writeFileSync(filePath, mediaResponse.data);

    logger.info(`[DownloadOfficialMedia] Mídia salva: ${filename}`);

    // 6. Retornar URL pública
    return `/public/company${companyId}/${filename}`;

  } catch (error: any) {
    logger.error(`[DownloadOfficialMedia] Erro: ${error.message}`);
    throw error;
  }
};

function getExtensionFromMimeType(mimeType: string): string | null {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/aac": "aac",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  };

  return map[mimeType] || null;
}

function getDefaultExtension(mediaType: string): string {
  const defaults: Record<string, string> = {
    image: "jpg",
    video: "mp4",
    audio: "mp3",
    document: "pdf"
  };

  return defaults[mediaType] || "bin";
}

export default DownloadOfficialMediaService;
```

#### Passo B: Atualizar ProcessWhatsAppWebhook

**Arquivo:** `backend/src/services/WbotServices/ProcessWhatsAppWebhook.ts`

**Problema (Linhas 207-229):**
```typescript
case "image":
  body = message.image?.caption || "";
  mediaType = "image";
  mediaUrl = message.image?.id; // ❌ ID, não URL!
  break;
```

**Correção:**
```typescript
import DownloadOfficialMediaService from "./DownloadOfficialMediaService";

// ...

// Extrair corpo da mensagem
let body = "";
let mediaType: string | undefined;
let mediaUrl: string | undefined;

switch (message.type) {
  case "text":
    body = message.text?.body || "";
    break;

  case "image":
    body = message.image?.caption || "";
    mediaType = "image";
    
    // ✅ Baixar mídia ao invés de salvar ID
    if (message.image?.id) {
      try {
        mediaUrl = await DownloadOfficialMediaService({
          mediaId: message.image.id,
          whatsapp,
          companyId,
          mediaType: "image"
        });
      } catch (error: any) {
        logger.error(`[WebhookProcessor] Erro ao baixar imagem: ${error.message}`);
        mediaUrl = undefined; // Falha silenciosa
      }
    }
    break;

  case "video":
    body = message.video?.caption || "";
    mediaType = "video";
    
    if (message.video?.id) {
      try {
        mediaUrl = await DownloadOfficialMediaService({
          mediaId: message.video.id,
          whatsapp,
          companyId,
          mediaType: "video"
        });
      } catch (error: any) {
        logger.error(`[WebhookProcessor] Erro ao baixar vídeo: ${error.message}`);
        mediaUrl = undefined;
      }
    }
    break;

  case "audio":
    body = "";
    mediaType = "audio";
    
    if (message.audio?.id) {
      try {
        mediaUrl = await DownloadOfficialMediaService({
          mediaId: message.audio.id,
          whatsapp,
          companyId,
          mediaType: "audio"
        });
      } catch (error: any) {
        logger.error(`[WebhookProcessor] Erro ao baixar áudio: ${error.message}`);
        mediaUrl = undefined;
      }
    }
    break;

  case "document":
    body = message.document?.caption || message.document?.filename || "";
    mediaType = "document";
    
    if (message.document?.id) {
      try {
        mediaUrl = await DownloadOfficialMediaService({
          mediaId: message.document.id,
          whatsapp,
          companyId,
          mediaType: "document"
        });
      } catch (error: any) {
        logger.error(`[WebhookProcessor] Erro ao baixar documento: ${error.message}`);
        mediaUrl = undefined;
      }
    }
    break;

  case "button":
    body = message.button?.text || "";
    break;

  case "interactive":
    if (message.interactive?.button_reply) {
      body = message.interactive.button_reply.title;
    } else if (message.interactive?.list_reply) {
      body = message.interactive.list_reply.title;
    }
    break;

  default:
    logger.warn(`[WebhookProcessor] Tipo de mensagem não suportado: ${message.type}`);
    body = `[${message.type}]`;
}
```

---

## 📊 Comparação Antes/Depois

### Mensagens Enviadas

#### ❌ Antes:
```
Usuário envia "Olá"
  ↓
SendWhatsAppMessageUnified() ✅
  ↓
Vai para WhatsApp ✅
  ↓
NÃO salva no banco ❌
  ↓
NÃO aparece no chat ❌
```

#### ✅ Depois:
```
Usuário envia "Olá"
  ↓
SendWhatsAppMessageUnified() ✅
  ↓
Vai para WhatsApp ✅
  ↓
CreateMessageService() ✅
  ↓
Salva no banco ✅
  ↓
Emite Socket.IO ✅
  ↓
Aparece no chat ✅
```

### Mídias Recebidas

#### ❌ Antes:
```
Recebe imagem
  ↓
mediaUrl = "id12345" ❌
  ↓
Salva no banco
  ↓
Frontend tenta carregar "id12345" ❌
  ↓
404 Not Found ❌
  ↓
Imagem quebrada 💔
```

#### ✅ Depois:
```
Recebe imagem
  ↓
Baixa da Meta API ✅
  ↓
Salva em /public/company1/id12345.jpg ✅
  ↓
mediaUrl = "/public/company1/id12345.jpg" ✅
  ↓
Salva no banco
  ↓
Frontend carrega URL correta ✅
  ↓
Imagem aparece ✅ 🖼️
```

---

## 🧪 Como Testar

### Teste 1: Mensagens Enviadas

```
1. Abrir chat no Whaticket
2. Enviar mensagem "Teste 123"
3. Verificar:
   ✅ Mensagem aparece no chat
   ✅ Status: "enviado" (1 check)
   ✅ Depois: "entregue" (2 checks)
```

### Teste 2: Imagens Recebidas

```
1. Enviar imagem do celular
2. Verificar no Whaticket:
   ✅ Imagem aparece (não quebrada)
   ✅ Arquivo salvo em backend/public/companyX/
   ✅ URL correta no banco
```

---

## 📋 Checklist de Implementação

- [ ] Criar `DownloadOfficialMediaService.ts`
- [ ] Atualizar `ProcessWhatsAppWebhook.ts` (import + download)
- [ ] Atualizar `MessageController.ts` (salvar mensagens enviadas)
- [ ] Testar envio de texto
- [ ] Testar recebimento de texto
- [ ] Testar envio de imagem
- [ ] Testar recebimento de imagem
- [ ] Testar recebimento de vídeo
- [ ] Testar recebimento de áudio
- [ ] Testar recebimento de documento

---

## 🎯 Resultado Esperado

**Mensagens:**
- ✅ Enviadas aparecem no chat imediatamente
- ✅ Recebidas aparecem no chat
- ✅ Status (ack) atualiza corretamente
- ✅ Sincronização perfeita

**Mídias:**
- ✅ Imagens aparecem (não quebradas)
- ✅ Vídeos reproduzem
- ✅ Áudios tocam
- ✅ Documentos fazem download
- ✅ Tudo salvo localmente

---

**IMPORTANTE:** Estas correções são essenciais para o funcionamento correto da API Oficial!
