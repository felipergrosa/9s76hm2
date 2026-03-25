# Sistema de Agentes IA - Atualização 2025

## Status: Implementado
**Data:** 2025-03-25
**Contexto:** Remoção do sistema legado de Prompts e consolidação com AI Agents

---

## Resumo das Mudanças

### Remoções (Sistema Legado)
- ❌ Modelo `Prompt.ts` e suas associações
- ❌ Rotas `/prompts` do backend
- ❌ Página `Prompts/index.js` do frontend
- ❌ Componentes `PromptModal` e `PromptEnhancements`
- ❌ Menu "Prompts (Legado)" do sidebar
- ❌ Tutorial `PromptsIATutorial`

### Sistema Atual (AI Agents)

O sistema agora utiliza **AI Agents** como a principal forma de configurar comportamento de IA:

```
┌─────────────────────────────────────────────────────────┐
│                    AI AGENTS                             │
├─────────────────────────────────────────────────────────┤
│ • Configuração por Fila (Queue)                         │
│ • Múltiplos provedores (OpenAI, Gemini, DeepSeek, Grok) │
│ • Funil de vendas com estágios                          │
│ • Skills/funções habilitadas                            │
│ • Integração com RAG                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Arquitetura de Configuração

### 1. ResolvePresetConfigService
Resolve configurações de IA com fallback inteligente:

```typescript
// Prioridade de resolução:
1. Preset específico do módulo (preset-ticket, preset-campaign, etc.)
2. Configurações globais do provedor preferido
3. Fallback: OpenAI → Gemini
```

### 2. ResolveAIIntegrationService
Resolve integração de IA por contexto:

```typescript
// Prioridade de resolução:
1. integrationId da Fila (queueId)
2. integrationId da Conexão WhatsApp (whatsappId)
3. Provedor preferido da empresa
4. Fallback: OpenAI → Gemini
```

### 3. AIOrchestrator
Orquestra todas as requisições de IA:

```typescript
// Funcionalidades:
• Fallback automático entre provedores
• Integração com RAG
• Logging de uso e custos
• Métricas de performance
```

---

## Módulos Suportados

| Módulo | Uso | Contexto |
|--------|-----|----------|
| `general` | Uso geral | Chat assistant, transformações de texto |
| `ticket` | Atendimentos | Respostas automáticas em tickets |
| `campaign` | Campanhas | Mensagens de campanhas |
| `prompt` | Engenharia | Assistente de prompts |
| `training` | Treinamento | Sandbox de treinamento |

---

## Configuração de Presets

### Estrutura de um Preset

```json
{
  "name": "Atendimento Profissional",
  "module": "ticket",
  "systemPrompt": "Você é um atendente profissional...",
  "temperature": 0.7,
  "maxTokens": 500,
  "tone": "Profissional",
  "emotions": "Médio",
  "hashtags": "Sem hashtags",
  "length": "Médio",
  "language": "Português (Brasil)",
  "brandVoice": "Empresa XYZ",
  "allowedVariables": "{nome} {cidade}"
}
```

### Endpoints de Preset

```
GET  /preset              # Lista presets
POST /preset              # Cria preset
PUT  /preset/:id          # Atualiza preset
DELETE /preset/:id        # Remove preset
```

---

## Assistente de IA (ChatAssistantService)

### Modos Suportados

| Modo | Descrição | Uso |
|------|-----------|-----|
| `enhance` | Aprimora texto | Melhora mensagens |
| `translate` | Traduz texto | Tradução de mensagens |
| `spellcheck` | Corrige ortografia | Revisão de textos |
| `create` | Cria do zero | Geração de mensagens |

### Fluxo de Processamento

```
1. Recebe requisição (modo, texto, contexto)
2. Resolve configuração (preset ou global)
3. Busca contexto RAG (se habilitado)
4. Constrói prompts (ChatAssistantService.buildPrompts)
5. Executa no provedor (AIOrchestrator)
6. Pós-processa resultado
7. Retorna resposta
```

---

## Integração com RAG

### Configuração

```json
{
  "ragEnabled": true,
  "ragTopK": 4,
  "ragEmbeddingModel": "text-embedding-3-small",
  "ragEmbeddingDims": 1536,
  "autoIndex": true,
  "chunkSize": 1000,
  "overlap": 200
}
```

### Fontes de Conhecimento

1. **FileManager**: Documentos enviados
2. **Conversations**: Histórico de conversas
3. **ExternalLinks**: URLs indexadas

---

## Assistente de Prompts (AIPromptAssistantController)

### Funcionalidades

```
POST /ai/prompt-assistant/rewrite     # Reescreve prompt
POST /ai/prompt-assistant/suggest     # Sugere melhorias
GET  /ai/prompt-assistant/variables    # Lista variáveis disponíveis
```

### Exemplo de Uso

```json
// POST /ai/prompt-assistant/rewrite
{
  "currentPrompt": "Você é um assistente...",
  "command": "Torne mais formal",
  "agentId": 1  // Opcional: usa provedor do agente
}
```

---

## Versionamento de Prompts

### Endpoints

```
POST /ai/prompt-versions              # Cria versão
GET  /ai/prompt-versions              # Lista versões
GET  /ai/prompt-versions/:versionId   # Obtém versão
POST /ai/prompt-versions/:versionId/rollback  # Restaura versão
GET  /ai/prompt-versions/compare      # Compara versões
```

---

## Métricas e Estatísticas

### Endpoint Principal

```
GET /ai/orchestrator/stats?days=7
```

### Métricas Disponíveis

```json
{
  "totalRequests": 1500,
  "todayRequests": 45,
  "totalTokens": 125000,
  "avgProcessingTimeMs": 850,
  "successRate": 98.5,
  "providers": [...],
  "modules": [...],
  "dailyUsage": [...]
}
```

---

## Provedores Suportados

| Provedor | Modelos | Status |
|----------|---------|--------|
| OpenAI | gpt-4o-mini, gpt-4o, gpt-3.5-turbo | ✅ Estável |
| Gemini | gemini-2.0-flash, gemini-2.0-pro | ✅ Estável |
| DeepSeek | deepseek-chat, deepseek-reasoner | ✅ Estável |
| Grok | grok-2-latest | ✅ Estável |

---

## Configuração no Frontend (AISettings)

### Abas Disponíveis

1. **Provedores**: Configuração de API keys e modelos
2. **RAG**: Base de conhecimento
3. **Presets**: Configurações por módulo

### Estatísticas Exibidas

- Total de Requisições
- Requisições Hoje
- Tokens Consumidos
- Tempo Médio
- Taxa de Sucesso

---

## Migração de Prompts Legados

Para migrar configurações do sistema antigo para AI Agents:

1. Acesse **Configurações → AI Agents**
2. Crie um novo Agente
3. Configure o systemPrompt com o conteúdo do prompt antigo
4. Associe o agente à fila desejada
5. Configure provedor e modelo

---

## Troubleshooting

### Erro: "Nenhuma integração de IA disponível"

**Causa:** Não há provedor configurado com API key válida.

**Solução:**
1. Acesse Configurações → IA
2. Configure pelo menos um provedor (OpenAI ou Gemini)
3. Salve a API key

### Erro: "Preset não encontrado"

**Causa:** Não há preset para o módulo solicitado.

**Solução:**
1. O sistema usa configurações globais automaticamente
2. Para criar preset específico, acesse Configurações → IA → Presets

### Lentidão nas respostas

**Possíveis causas:**
1. RAG habilitado com muitos documentos
2. Modelo muito pesado (gpt-4o vs gpt-4o-mini)
3. Provedor com latência alta

**Soluções:**
1. Reduza `ragTopK` para 2-3
2. Use modelos mais rápidos (gpt-4o-mini, gemini-2.0-flash)
3. Configure fallback para provedor alternativo

---

## Próximos Passos

1. ✅ Remoção completa do sistema legado de Prompts
2. ✅ Consolidação com AI Agents
3. ✅ Atualização do AISettings
4. 📋 Implementar melhorias do AI-TRAINING-MELHORIAS-FUTURAS.md
5. 📋 Testes A/B em produção
6. 📋 Auto-treinamento com feedback loop

---

## Referências

- `backend/src/services/IA/AIOrchestrator.ts` - Orquestrador principal
- `backend/src/services/IA/ResolvePresetConfigService.ts` - Resolução de presets
- `backend/src/services/IA/usecases/ChatAssistantService.ts` - Assistente de chat
- `backend/src/controllers/AIPromptAssistantController.ts` - Assistente de prompts
- `frontend/src/components/AISettings/index.js` - Interface de configuração
