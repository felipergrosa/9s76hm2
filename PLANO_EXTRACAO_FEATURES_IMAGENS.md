# 🎯 **PLANO DE EXTRAÇÃO DAS FEATURES FALTANTES**

## 📋 **ANÁLISE DAS IMAGENS VS ATUAL**

### ✅ **JÁ DISPONÍVEL (precisa apenas mover para main)**:
1. **ImportHistoryModal** - Componente frontend pronto
2. **ImportContactHistoryService** - Serviço backend completo
3. **ContactMergeService** - Mesclagem de contatos
4. **TicketActionButtonsCustom** - Já tem "Importar Histórico"

### ❌ **PRECISA CRIAR/EXTRAIR**:

## 🚀 **FASE 1: EXPORTAR CONVERSA**

### 1.1 Backend - ExportChatService
```typescript
// backend/src/services/MessageServices/ExportChatService.ts
const ExportChatService = async ({ ticketId, format }) => {
  // Exportar em JSON, CSV ou TXT
  // Incluir mídias? 
  // Compactar em ZIP?
}
```

### 1.2 Rota
```typescript
// backend/src/routes/messageRoutes.ts
messageRoutes.post("/messages/export/:ticketId", isAuth, MessageController.export);
```

### 1.3 Frontend - ExportChatModal
```javascript
// frontend/src/components/ExportChatModal/index.js
// Opções: JSON, CSV, TXT
// Incluir mídias: sim/não
// Período: personalizado
```

## 🚀 **FASE 2: MENU DE CONTATO AVANÇADO**

### 2.1 Criar ContactOptionsMenu
```javascript
// frontend/src/components/ContactOptionsMenu/index.js
// Menu com as opções da imagem 3:
// - View Contact Info
// - Export Chat
// - Find Duplicates
// - Merge Contacts
// - Edit Contact
```

### 2.2 Integrar no ContactCard
```javascript
// Adicionar botão de opções no ContactCard
// Chamar ContactOptionsMenu
```

## 🚀 **FASE 3: DETECÇÃO DE DUPLICATAS**

### 3.1 Backend - FindDuplicatesService
```typescript
// backend/src/services/ContactServices/FindDuplicatesService.ts
const FindDuplicatesService = async ({ companyId }) => {
  // Buscar por canonicalNumber
  // Buscar por nome + telefone
  // Retornar lista de grupos
}
```

### 3.2 Frontend - FindDuplicatesModal
```javascript
// frontend/src/components/FindDuplicatesModal/index.js
// Lista de duplicatas
// Checkbox para selecionar
// Botão "Merge Selected"
```

## 🚀 **FASE 4: MESCLAGEM DE CONTATOS**

### 4.1 Backend - MergeContactsController
```typescript
// backend/src/controllers/ContactController.ts
export const merge = async (req: Request, res: Response) => {
  // Receber array de contactIds
  // Escolher contato principal
  // Mesclar mantendo histórico
}
```

### 4.2 Frontend - MergeContactModal
```javascript
// frontend/src/components/MergeContactModal/index.js
// Selecionar contato principal
// Visualizar dados de cada um
// Confirmar mesclagem
```

## 🚀 **FASE 5: NORMALIZAÇÃO DE NÚMEROS**

### 5.1 Backend - NormalizeNumbersController (já existe)
```typescript
// Já existe em ContactController.normalizeNumbers
// Precisa apenas criar interface
```

### 5.2 Frontend - NormalizeNumbersModal
```javascript
// frontend/src/components/NormalizeNumbersModal/index.js
// Opções: Apenas nacionais, Internacionais
- Preview das mudanças
- Confirmar normalização
```

## 🚀 **FASE 6: ESTATÍSTICAS DE MENSAGENS**

### 6.1 Backend - MessageStatsService
```typescript
// backend/src/services/MessageServices/MessageStatsService.ts
const MessageStatsService = async ({ ticketId, period }) => {
  // Total de mensagens
  // Mídias trocadas
  // Primeira/última mensagem
  // Gráfico de atividade
}
```

### 6.2 Frontend - MessageStatsModal
```javascript
// frontend/src/components/MessageStatsModal/index.js
// Cards com estatísticas
// Gráfico de linha temporal
// Top palavras/mídias
```

## 📊 **IMPLEMENTAÇÃO PRIORITÁRIA**

### **Priority 1** (Impacto Imediato):
1. ✅ Importar Histórico (já pronto)
2. 🔥 Exportar Conversa
3. 🔥 Menu de Contato

### **Priority 2** (Qualidade de Dados):
4. Find Duplicates
5. Merge Contacts
6. Normalize Numbers

### **Priority 3** (Analytics):
7. Message Stats

## 🔧 **ARQUIVOS A CRIAR/COPIAR**

### Backend:
```
backend/src/services/MessageServices/
├── ExportChatService.ts (NOVO)
├── MessageStatsService.ts (NOVO)
└── FindDuplicatesService.ts (NOVO)

backend/src/controllers/
└── ContactController.ts (ADD merge method)

backend/src/routes/
├── messageRoutes.ts (ADD export)
└── contactRoutes.ts (ADD merge, find-duplicates)
```

### Frontend:
```
frontend/src/components/
├── ExportChatModal/ (NOVO)
├── ContactOptionsMenu/ (NOVO)
├── FindDuplicatesModal/ (NOVO)
├── MergeContactModal/ (NOVO)
├── NormalizeNumbersModal/ (NOVO)
└── MessageStatsModal/ (NOVO)
```

## 🎯 **PLANO DE AÇÃO**

1. **Hoje**: Exportar conversa (mais rápido de implementar)
2. **Amanhã**: Menu de contato + find duplicates
3. **Depois**: Merge + normalize
4. **Final**: Stats e melhorias

## 💡 **DICAS**

- Usar os serviços já existentes como base
- Manter padrão de modais já usado
- Adicionar permissões adequadas
- Incluir logs para auditoria

---

**Pronto para começar a implementação!**
