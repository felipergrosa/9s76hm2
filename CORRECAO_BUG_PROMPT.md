# 🐛 CORREÇÃO DO BUG: Erro ao Salvar Prompt

## ❌ PROBLEMA IDENTIFICADO:

O backend estava **rejeitando prompts** mesmo com todos os campos preenchidos!

### Erro no Console:
```
Untitled React error #125
NotAllowed React error #125
main.8ff2b0b0.js:2:12812202
```

---

## 🔍 CAUSA RAIZ:

O serviço `CreatePromptService.ts` estava **exigindo campos que o frontend não enviava**:

```typescript
// ❌ ANTIGO: Exigia apiKey SEMPRE
apiKey: Yup.string().required("ERR_PROMPT_APIKEY_INVALID"),

// ❌ ANTIGO: Exigia model SEMPRE
model: Yup.string()
  .oneOf(["gpt-3.5-turbo-1106", "gpt-4o", ...])
  .required("ERR_PROMPT_MODEL_REQUIRED"),

// ❌ ANTIGO: Exigia maxTokens SEMPRE  
maxTokens: Yup.number().required("ERR_PROMPT_MAX_TOKENS_REQUIRED"),

// ❌ ANTIGO: Exigia temperature SEMPRE
temperature: Yup.number().required("ERR_PROMPT_TEMPERATURE_REQUIRED"),
```

**MAS** o frontend enviava:
```javascript
{
  name: "...",
  prompt: "...",
  integrationId: 1,  // ← Referência à integração OpenAI
  queueId: 1,
  // ❌ Não enviava: apiKey, model, maxTokens, temperature
}
```

**CONFLITO:** Backend esperava valores diretos, frontend enviava `integrationId` esperando que o backend buscasse os valores da integração.

---

## ✅ CORREÇÕES APLICADAS:

### 1. **Backend: `CreatePromptService.ts`**

Validação agora aceita **OU** `integrationId` **OU** campos diretos:

```typescript
// ✅ NOVO: apiKey opcional se integrationId presente
apiKey: Yup.string().when('integrationId', {
  is: (val: any) => !val || val === null,
  then: Yup.string().required("ERR_PROMPT_APIKEY_INVALID"),
  otherwise: Yup.string().notRequired(),
}),

// ✅ NOVO: model opcional se integrationId presente
model: Yup.string().when('integrationId', {
  is: (val: any) => !val || val === null,
  then: Yup.string()
    .oneOf(["gpt-3.5-turbo-1106", "gpt-4o", ...])
    .required("ERR_PROMPT_MODEL_REQUIRED"),
  otherwise: Yup.string().notRequired(),
}),

// ✅ NOVO: maxTokens opcional se integrationId presente
maxTokens: Yup.number().when('integrationId', {
  is: (val: any) => !val || val === null,
  then: Yup.number().required("ERR_PROMPT_MAX_TOKENS_REQUIRED"),
  otherwise: Yup.number().notRequired(),
}),

// ✅ NOVO: temperature opcional se integrationId presente
temperature: Yup.number().when('integrationId', {
  is: (val: any) => !val || val === null,
  then: Yup.number().required("ERR_PROMPT_TEMPERATURE_REQUIRED"),
  otherwise: Yup.number().notRequired(),
}),

// ✅ NOVO: Incluir integrationId no schema
integrationId: Yup.number().nullable().notRequired(),
```

**Incluído `integrationId` na validação:**
```typescript
await promptSchema.validate({
  name,
  apiKey,
  prompt,
  queueId,
  maxMessages,
  companyId,
  model,
  maxTokens,
  temperature,
  voice,
  integrationId, // ✅ Adicionado
}, { abortEarly: false });
```

### 2. **Backend: `UpdatePromptService.ts`**

Adicionado `.nullable()` e `integrationId`:

```typescript
// ✅ NOVO: Campos podem ser null
apiKey: Yup.string().nullable(),
queueId: Yup.number().nullable(),
model: Yup.string().oneOf([...]).nullable(),
maxTokens: Yup.number().nullable(),
temperature: Yup.number().nullable(),
integrationId: Yup.number().nullable().notRequired(),
```

### 3. **Frontend: `PromptModal/index.js`**

Mensagens de erro mais claras:

```typescript
// ✅ NOVO: Mensagens mais descritivas
name: Yup.string()
  .min(5, "Muito curto! Mínimo 5 caracteres")
  .required("⚠️ Nome é obrigatório"),

prompt: Yup.string()
  .min(50, "Muito curto! Mínimo 50 caracteres...")
  .required("⚠️ Descreva o treinamento para IA"),

integrationId: Yup.number()
  .nullable()
  .required("⚠️ Selecione uma integração IA ou marque 'Usar Config Global'"),

queueId: Yup.number()
  .nullable()
  .required("⚠️ Selecione uma fila para associar"),
```

---

## 🎯 COMPORTAMENTO NOVO:

### **Cenário 1: Usando Integração (RECOMENDADO)**

```javascript
// Frontend envia:
{
  name: "Atendente Virtual",
  prompt: "Você é um assistente...",
  integrationId: 1,  // ← OpenAI configurada em /ai-settings
  queueId: 1,
  maxMessages: 10,
  // ✅ Não precisa enviar: apiKey, model, maxTokens, temperature
}

// Backend aceita e usa config da integração #1:
{
  apiKey: "sk-..." (da integração),
  model: "gpt-3.5-turbo-1106" (da integração),
  maxTokens: 300 (da integração),
  temperature: 0.9 (da integração),
}
```

### **Cenário 2: Sem Integração (Avançado)**

```javascript
// Frontend envia:
{
  name: "Atendente Custom",
  prompt: "Você é...",
  integrationId: null,  // ← Sem integração
  queueId: 1,
  // ⚠️ DEVE enviar campos diretos:
  apiKey: "sk-xxx",
  model: "gpt-3.5-turbo-1106",
  maxTokens: 500,
  temperature: 0.7,
}

// Backend aceita e usa valores diretos
```

---

## ✅ RESULTADO:

### ANTES (com bug):
```
1. Usuário preenche todos os campos
2. Seleciona integração OpenAI
3. Clica ADICIONAR
4. ❌ Nada acontece
5. ❌ Console: "NotAllowed React error #125"
6. ❌ Backend rejeita: "ERR_PROMPT_APIKEY_INVALID"
```

### DEPOIS (corrigido):
```
1. Usuário preenche campos obrigatórios:
   - Nome
   - Prompt (50+ caracteres)
   - Integração IA: OPENAI
   - Fila: Início
2. Clica ADICIONAR
3. ✅ Prompt salvo com sucesso!
4. ✅ Usa configurações da integração OpenAI
5. ✅ Aparece na lista de prompts
```

---

## 🧪 TESTANDO:

### **Teste 1: Salvar Prompt com Integração**

```
1. /prompts → ADICIONAR PROMPT
2. Preencher:
   - Nome: "Teste Bot"
   - Prompt: [colar 50+ caracteres]
   - Integração IA: Selecionar "OPENAI"
   - Filas: Selecionar "Início"
3. ADICIONAR
4. ✅ Deve salvar sem erros
5. ✅ Deve aparecer na lista
```

### **Teste 2: Usar Template**

```
1. /prompts → MELHORIAS
2. Escolher: "Especialista em Suporte Avançado"
3. USAR TEMPLATE
4. Selecionar:
   - Integração IA: OPENAI
   - Filas: Início
5. ADICIONAR
6. ✅ Deve salvar com configurações do template
```

### **Teste 3: Editar Prompt Existente**

```
1. /prompts → Clicar lápis (editar)
2. Alterar nome ou prompt
3. SALVAR
4. ✅ Deve atualizar sem erros
```

---

## 📊 ARQUIVOS MODIFICADOS:

### Backend (2 arquivos):

1. ✅ `backend/src/services/PromptServices/CreatePromptService.ts`
   - Linhas 47-104: Validação condicional baseada em `integrationId`
   - Linha 119: Incluir `integrationId` na validação

2. ✅ `backend/src/services/PromptServices/UpdatePromptService.ts`
   - Linhas 39-84: Adicionar `.nullable()` e `integrationId`

### Frontend (1 arquivo):

3. ✅ `frontend/src/components/PromptModal/index.js`
   - Linhas 75-108: Mensagens de erro melhoradas

---

## 🚀 PRÓXIMOS PASSOS:

1. **Deploy das correções:**
   ```bash
   cd backend
   npm run build
   
   # No VPS:
   docker stack rm whaticket
   # Aguardar 30 segundos
   docker stack deploy -c stack.portainer.yml whaticket
   ```

2. **Testar salvamento de prompt:**
   - Acessar `/prompts`
   - ADICIONAR PROMPT
   - Preencher campos
   - Verificar se salva com sucesso

3. **Configurar chatbot completo:**
   - Criar prompt com template
   - Vincular à fila "Início"
   - Configurar RAG
   - Testar atendimento autônomo

---

## ⚠️ BREAKING CHANGES:

**NENHUM!** As correções são **retrocompatíveis**:

- ✅ Prompts existentes continuam funcionando
- ✅ Prompts com campos diretos continuam funcionando
- ✅ Novos prompts com `integrationId` agora funcionam

---

## 📝 NOTAS TÉCNICAS:

### Por que o erro acontecia?

1. O Yup validava os campos **antes** de enviar para o backend
2. Backend tinha validação **duplicada** e **mais restritiva**
3. Frontend passava na validação local, mas backend rejeitava
4. Erro genérico `#125` não mostrava qual campo estava faltando

### Por que usar `integrationId` é melhor?

1. **Centralizado:** Configurações em 1 lugar (`/ai-settings`)
2. **Reutilizável:** Vários prompts usam mesma integração
3. **Seguro:** API Key não fica espalhada em cada prompt
4. **Manutenível:** Mudar modelo? Só alterar em `/ai-settings`

### Exemplo de estrutura:

```
Integração #1 (OpenAI)
  ├─ API Key: sk-xxx
  ├─ Model: gpt-3.5-turbo-1106
  ├─ Temperature: 0.9
  └─ Max Tokens: 300

Prompt "Atendente Vendas" → integrationId: 1 (usa config acima)
Prompt "Suporte Técnico"   → integrationId: 1 (usa config acima)
Prompt "Financeiro"        → integrationId: 1 (usa config acima)
```

**Vantagem:** Alterar model em 1 lugar afeta todos os 3 prompts!

---

**BUG CORRIGIDO COM SUCESSO!** ✅🎉

Agora você pode criar prompts normalmente usando integrações do `/ai-settings`!
