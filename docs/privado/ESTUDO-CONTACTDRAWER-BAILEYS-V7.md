# Estudo: Melhorias no ContactDrawer - Baileys v7 & WhatsApp Web Features

## Resumo do Escopo
Análise de recursos disponíveis no Baileys v7 e WhatsApp Web que podem ser habilitados no ContactDrawer para deixá-lo robusto igual ao WhatsApp original.

---

## 1. Análise do GroupInfoDrawer (Referência Existente)

O projeto já possui `GroupInfoDrawer` com funcionalidades avançadas que podem ser reaproveitadas:

### ✅ Já Implementado no GroupInfoDrawer:
- **SharedMediaPanel** (`frontend/src/components/SharedMediaPanel/index.js`)
  - Abas: Fotos, Vídeos, Docs, Áudios
  - Grid de imagens com preview
  - Lista de documentos/áudios com download
  - API: `GET /messages/${ticketId}/media?type={image|video|document|audio}`

- **Configurações do Grupo** (switches)
  - Apenas admins enviam mensagens (announce)
  - Apenas admins editam dados (restrict)

- **Edição de Perfil**
  - Upload de foto
  - Edição de nome
  - Edição de descrição

- **Lista de Participantes**
  - Avatares, nomes, números
  - Menu de contexto (promover/remover)

- **Ações**
  - Adicionar membro
  - Convidar via link
  - Sair do grupo

---

## 2. Baileys v7 - Recursos Disponíveis

### 2.1 Mídias Compartilhadas
```typescript
// Disponível via MessageController
socket.getMessages(chatId, { count: 100 })
// Filtrar por: messageType === 'image' | 'video' | 'document' | 'audio' | 'ptt'
```

**Status:** ✅ Já implementado via `SharedMediaPanel`

### 2.2 Dados de Contato (Baileys)
```typescript
// Disponível via Baileys Store
{
  "contacts": {
    "5511999999999@s.whatsapp.net": {
      "id": "5511999999999@s.whatsapp.net",
      "name": "João Silva",           // Nome do catálogo
      "notify": "João",                // Nome de notificação
      "verifiedName": "João Silva LTDA", // Nome verificado (API Oficial)
      "imgUrl": "https://...",         // URL do avatar
      "status": "Disponível para trabalhos", // Status (recado)
      "lid": "1234567890@lid"          // ID LID (novo WhatsApp)
    }
  }
}
```

**Recursos aproveitáveis:**
- ✅ Nome do catálogo (já usamos parcialmente)
- ✅ Avatar (já usamos)
- ⚠️ **Status/Recado** - NÃO IMPLEMENTADO
- ⚠️ **Nome verificado** - NÃO IMPLEMENTADO
- ⚠️ **LID** - Parcialmente implementado

### 2.3 Presença/Digitando
```typescript
// Disponível via eventos presence
{
  "id": "5511999999999@s.whatsapp.net",
  "presences": {
    "5511999999999@s.whatsapp.net": {
      "lastKnownPresence": "composing" | "available" | "unavailable",
      "lastSeen": timestamp
    }
  }
}
```

**Status:** ✅ Já implementado no TicketInfo (bolinha "digitando...")

### 2.4 Dispositivos Vinculados
```typescript
// Companions devices
{
  "companionDevices": [
    {
      "id": "...",
      "name": "iPhone do João",
      "platform": "ios" | "android" | "web",
      "lastActive": timestamp
    }
  ]
}
```

**Status:** ⚠️ NÃO IMPLEMENTADO

### 2.5 Informações de Negócio (API Oficial)
```typescript
// Business profile
{
  "businessProfile": {
    "description": "Descrição da empresa",
    "email": "contato@empresa.com",
    "website": ["https://empresa.com"],
    "address": "Rua ...",
    "businessHours": { ... },
    "category": "Serviços",
    "latitude": -23.5,
    "longitude": -46.6
  }
}
```

**Status:** ⚠️ NÃO IMPLEMENTADO

---

## 3. Recomendações de Implementação

### Prioridade Alta (Impacto Imediato)

#### 1. SharedMediaPanel no ContactDrawer
**Arquivos:**
- `frontend/src/components/ContactDrawer/index.js`

**Implementação:**
```javascript
// Adicionar após TagsKanbanContainer
<Paper square variant="outlined" style={{ marginTop: 8 }}>
  <Typography variant="subtitle1" style={{ padding: '8px 16px' }}>
    Mídia, links e docs
  </Typography>
  <div style={{ height: 320 }}>
    <SharedMediaPanel ticketId={ticket?.id} />
  </div>
</Paper>
```

**Backend:** Já existe endpoint `/messages/${ticketId}/media`

---

#### 2. Status/Recado do Contato
**Arquivos:**
- Backend: Novo campo em `Contact` ou busca dinâmica via Baileys
- Frontend: `ContactDrawer/index.js`

**Implementação Backend:**
```typescript
// Em ContactController ou novo service
const getContactStatus = async (contactNumber: string) => {
  const wbot = getWbot(whatsappId);
  const status = await wbot.fetchStatus(contactNumber);
  return status?.status || null; // "Disponível para trabalhos"
};
```

**Implementação Frontend:**
```javascript
{contact.status && (
  <div style={{ marginTop: 8, padding: '0 16px' }}>
    <Typography style={{ color: "#8696a0", fontSize: 12 }}>
      Status
    </Typography>
    <Typography style={{ color: "#111b21", fontSize: 14 }}>
      {contact.status}
    </Typography>
  </div>
)}
```

---

#### 3. Configurações de Notificação (Mute/Arquivar)
**Arquivos:**
- Backend: `TicketController.ts` ou novo endpoint
- Frontend: `ContactDrawer/index.js`

**Implementação Backend:**
```typescript
// Novo endpoint: PUT /tickets/:ticketId/notifications
{
  mute: boolean,
  muteUntil: timestamp | null,  // null = para sempre
  starred: boolean
}
```

**Implementação Frontend (estilo WhatsApp):**
```javascript
// Seção "Configurações de notificação"
<FormControlLabel
  control={<Switch checked={isMuted} onChange={handleMute} />}
  label="Silenciar notificações"
/>
{isMuted && (
  <Select value={muteDuration} onChange={handleDuration}>
    <MenuItem value="8h">8 horas</MenuItem>
    <MenuItem value="1week">1 semana</MenuItem>
    <MenuItem value="always">Sempre</MenuItem>
  </Select>
)}
```

---

### Prioridade Média

#### 4. Mensagens Temporárias (Disappearing Messages)
**Baileys v7:** Suporta via ` disappearingMessagesInChat `

```typescript
// GET /chats/:id/disappearing
{
  "duration": 86400 | 604800 | 7776000 | null // 24h | 7d | 90d | desligado
}
```

**Frontend:**
- Switch "Mensagens temporárias"
- Seletor de duração quando ligado

---

#### 5. Encriptação de Ponta a Ponta
**Implementação:** Informativo apenas
```javascript
// Seção visual igual ao WhatsApp
<div style={{ padding: '16px', textAlign: 'center' }}>
  <LockIcon style={{ color: '#8696a0' }} />
  <Typography style={{ color: '#8696a0', fontSize: 12 }}>
    As mensagens são protegidas com criptografia de ponta a ponta.
  </Typography>
</div>
```

---

#### 6. Dispositivos Vinculados (Companions)
**Baileys v7:** Lista de dispositivos conectados

```typescript
// GET /connections/:whatsappId/devices
[
  {
    "name": "iPhone do João",
    "platform": "ios",
    "lastActive": "2025-04-01T10:00:00Z"
  }
]
```

**Frontend:**
```javascript
<Typography variant="subtitle1">Dispositivos conectados</Typography>
{devices.map(device => (
  <ListItem key={device.name}>
    <ListItemIcon>
      {device.platform === 'ios' ? <AppleIcon /> : <AndroidIcon />}
    </ListItemIcon>
    <ListItemText 
      primary={device.name}
      secondary={`Última atividade: ${formatDate(device.lastActive)}`}
    />
  </ListItem>
))}
```

---

### Prioridade Baixa

#### 7. Grupos em Comum
**Implementação:** Consultar grupos onde contato e usuário estão juntos

```typescript
// GET /contacts/:id/common-groups
[
  {
    "id": 123,
    "name": "Família Silva",
    "participants": 15
  }
]
```

---

#### 8. Business Profile (API Oficial)
Para contatos de API Oficial com business:
```typescript
// GET /contacts/:id/business
{
  "description": "...",
  "email": "...",
  "website": "...",
  "hours": "...",
  "category": "..."
}
```

---

## 4. Estrutura Proposta do ContactDrawer

```
┌─────────────────────────────┐
│  ✕ Dados do contato         │  ← Header (estilo GroupInfoDrawer)
├─────────────────────────────┤
│                             │
│  [Avatar Grande]            │  ← Avatar 200x200 com ícone de câmera
│  Nome do Contato            │
│  +55 11 99999-9999          │
│                             │
├─────────────────────────────┤
│  Status                     │  ← NOVO: Recado do contato
│  "Disponível para..."       │
├─────────────────────────────┤
│  ÍCONES DE AÇÃO             │  ← NOVO: Estilo WhatsApp Web
│  [📷] [🔊] [🔕] [⭐]        │  (mídia, som, silenciar, favoritar)
├─────────────────────────────┤
│  Mídia, links e docs    [6] │  ← NOVO: SharedMediaPanel
│  ┌────┬────┬────┬────┐     │
│  │ 📷 │ 📷 │ 📷 │ ➕ │     │
│  └────┴────┴────┴────┘     │
├─────────────────────────────┤
│  Configurações              │  ← NOVO
│  [ ] Silenciar              │
│  [ ] Mensagens temp.        │
│  [ ] Fixar conversa         │
├─────────────────────────────┤
│  🔒 Criptografia ponta...   │  ← NOVO: Informativo
├─────────────────────────────┤
│  Tags do Contato            │  ← EXISTENTE (já implementado)
│  [tag1] [tag2]              │
├─────────────────────────────┤
│  Etapa Kanban               │  ← EXISTENTE
│  [──────────▼]              │
├─────────────────────────────┤
│  Carteira (Responsável)     │  ← EXISTENTE
│  [#ADMIN]                   │
├─────────────────────────────┤
│  Notas                      │  ← EXISTENTE
├─────────────────────────────┤
│  Dispositivos conectados    │  ← NOVO (média prioridade)
├─────────────────────────────┤
│  Grupos em comum            │  ← NOVO (baixa prioridade)
└─────────────────────────────┘
```

---

## 5. APIs Backend Necessárias

### Endpoints Existentes (Reutilizar):
- ✅ `GET /messages/${ticketId}/media?type=image|video|document|audio`
- ✅ `GET /contacts/${contactId}`
- ✅ `PUT /contacts/${contactId}`
- ✅ `PUT /tickets/${ticketId}/tags`

### Novos Endpoints Necessários:

```typescript
// 1. Status do contato (Baileys)
GET /contacts/:id/status
Response: { "status": "Disponível para trabalhos" }

// 2. Configurações de notificação do ticket
PUT /tickets/:id/notifications
Body: { mute: boolean, muteUntil: Date, starred: boolean }

// 3. Dispositivos vinculados (Baileys companions)
GET /connections/:whatsappId/devices
Response: [{ name, platform, lastActive }]

// 4. Grupos em comum
GET /contacts/:id/common-groups
Response: [{ id, name, participants }]
```

---

## 6. Componentes Frontend a Criar/Reutilizar

### Reutilizar:
1. **SharedMediaPanel** - Já funciona perfeitamente
2. **TagKanbanContainer** - Já implementado

### Criar:
1. **ContactStatus** - Exibir recado do contato
2. **NotificationSettings** - Silenciar/favoritar
3. **EncryptionBanner** - Informativo criptografia
4. **CompanionDevicesList** - Dispositivos vinculados
5. **CommonGroupsList** - Grupos em comum

---

## 7. Checklist de Implementação

### Fase 1 - Mínimo Viável (1-2 dias)
- [ ] Adicionar SharedMediaPanel ao ContactDrawer
- [ ] Re-estilizar header igual GroupInfoDrawer
- [ ] Adicionar seção de Status/Recado

### Fase 2 - Configurações (2-3 dias)
- [ ] Criar endpoint de notificações no backend
- [ ] Adicionar switches de silenciar/favoritar
- [ ] Criar endpoint para status do contato (Baileys)

### Fase 3 - Avançado (3-5 dias)
- [ ] Dispositivos vinculados
- [ ] Grupos em comum
- [ ] Business profile

---

## 8. Considerações Técnicas

### Baileys v7 - Limitações:
- **Status/Recado:** Pode não estar disponível para todos os contatos (depende de privacidade)
- **Dispositivos:** Só disponível se o WhatsApp estiver conectado
- **Business Profile:** Só para contatos de API Oficial ou contas business

### Performance:
- Carregar mídias sob demanda (lazy load)
- Cache de status do contato (TTL 5 min)
- SharedMediaPanel já tem paginação/limit

---

## Conclusão

O projeto já tem a base necessária (`SharedMediaPanel`, `GroupInfoDrawer`) para implementar rapidamente um ContactDrawer robusto.

**Próximos passos recomendados:**
1. Copiar estrutura do `GroupInfoDrawer` para `ContactDrawer`
2. Reutilizar `SharedMediaPanel` (1 linha de código)
3. Adicionar busca de status via Baileys
4. Criar endpoints simples para configurações

**Esforço estimado:**
- MVP (SharedMedia + redesign): 4-6 horas
- Completo (todas features): 2-3 dias
