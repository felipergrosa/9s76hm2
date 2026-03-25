# Sistema de Skills para AI Agents

## Visão Geral

O sistema de Skills padroniza e organiza as capacidades dos agentes de IA, tornando os prompts mais estruturados, consistentes e fáceis de manter.

## Estrutura de uma Skill

```typescript
interface AISkill {
  name: string;              // Identificador único
  category: SkillCategory;   // Grupo: communication, sales, support, crm, routing, sdr, rag, scheduling
  description: string;       // O que a skill faz
  triggers: SkillTrigger[];  // Gatilhos que ativam a skill
  examples: SkillExample[];  // Exemplos de uso
  functions: string[];       // Funções do BotFunctions relacionadas
  conditions?: SkillCondition[]; // Condições para usar a skill
  priority: number;          // 1-10, maior = mais prioridade
  enabled: boolean;          // Se está ativa
  metadata?: object;         // Metadados opcionais
}
```

## Categorias de Skills

| Categoria | Descrição | Exemplos |
|-----------|-----------|----------|
| `communication` | Saudações, despedidas, agradecimentos | greeting, farewell |
| `sales` | Vendas, catálogos, tabelas de preço | send_catalog, send_price_table |
| `support` | Suporte, dúvidas, problemas | search_knowledge |
| `crm` | Cadastro, atualização de dados | update_contact, check_registration |
| `routing` | Transferência, escalonamento | transfer_to_attendant, transfer_to_seller |
| `sdr` | Qualificação de leads | qualify_lead, calculate_score |
| `rag` | Busca em base de conhecimento | search_knowledge |
| `scheduling` | Agendamentos | schedule_meeting |

## Skills Padrão

O sistema inclui 12 skills padrão pré-configuradas:

1. **greeting** - Cumprimenta o cliente
2. **farewell** - Despede-se cordialmente
3. **send_catalog** - Lista e envia catálogos
4. **send_price_table** - Lista e envia tabelas de preços (requer cadastro)
5. **send_info** - Lista e envia informativos
6. **update_contact** - Atualiza dados cadastrais
7. **check_registration** - Verifica cadastro completo
8. **transfer_to_attendant** - Transfere para atendente humano
9. **transfer_to_seller** - Transfere para vendedor responsável
10. **search_knowledge** - Busca na base de conhecimento (RAG)
11. **qualify_lead** - Qualifica leads (SDR)
12. **schedule_meeting** - Agenda reuniões

## API Endpoints

### Listar Skills de um Agente
```
GET /ai-skills/agents/:agentId/skills
```

Retorna skills padrão + customizadas do agente.

### Listar Skills Padrão (Template)
```
GET /ai-skills/default
```

### Criar Skill Customizada
```
POST /ai-skills/agents/:agentId/skills
```

Body:
```json
{
  "name": "enviar_orcamento",
  "category": "sales",
  "description": "Envia orçamento personalizado para o cliente",
  "triggers": [
    { "type": "keyword", "value": "orçamento", "weight": 0.9 },
    { "type": "keyword", "value": "orcamento", "weight": 0.9 }
  ],
  "examples": [
    {
      "user": "Quero um orçamento",
      "assistant": "Vou preparar um orçamento para você!",
      "function": "enviar_orcamento"
    }
  ],
  "functions": ["enviar_orcamento"],
  "priority": 8
}
```

### Atualizar Skill
```
PUT /ai-skills/agents/:agentId/skills/:skillId
```

### Remover Skill
```
DELETE /ai-skills/agents/:agentId/skills/:skillId
```

### Ativar/Desativar Skill
```
PATCH /ai-skills/agents/:agentId/skills/:skillId/toggle
```

Body:
```json
{
  "enabled": false
}
```

### Duplicar Skill Padrão
```
POST /ai-skills/agents/:agentId/skills/fork/:skillName
```

Permite customizar uma skill padrão sem afetar outras.

### Validar Skill
```
POST /ai-skills/validate
```

Valida estrutura e funções referenciadas.

### Importar Skills em Massa
```
POST /ai-skills/agents/:agentId/skills/import
```

Body:
```json
{
  "skills": [...],
  "overwrite": true
}
```

### Exportar Skills
```
GET /ai-skills/agents/:agentId/skills/export
```

Retorna JSON para backup ou template.

## Integração com o Prompt

O sistema gera automaticamente um bloco de prompt estruturado:

```
# SKILLS DISPONÍVEIS

Você possui as seguintes capacidades (skills). Use a skill apropriada baseada no contexto:

### GREETING
Cumprimenta o cliente de forma calorosa e profissional
  Gatilhos: oi, olá, bom dia, boa tarde, boa noite
  Exemplos:
  Cliente: "Oi, tudo bem?"
  Você: "Olá! Tudo ótimo, e com você? 😊 Como posso ajudar hoje?"

### SEND_CATALOG
Lista e envia catálogos de produtos. SEMPRE liste primeiro antes de enviar.
  Gatilhos: catálogo, catalogo, quais produtos
  Funções disponíveis: listar_catalogos, enviar_catalogo
  Condições: contact.cnpj exists, contact.email exists
  Exemplos:
  Cliente: "Quero ver o catálogo"
  Você: "Claro! Vou listar as opções para você."
  [listar_catalogos]

## REGRAS IMPORTANTES:
1. SEMPRE use a skill com maior prioridade quando múltiplas aplicam
2. SEMPRE liste opções antes de enviar
3. VERIFIQUE condições antes de usar skills restritivas
4. USE as funções disponíveis - não simule ações
```

## Fluxo de Uso

1. **Descoberta**: IA analisa mensagem do cliente
2. **Matching**: Sistema encontra skills aplicáveis pelos gatilhos
3. **Priorização**: Skills ordenadas por prioridade + peso dos gatilhos
4. **Validação**: Condições são verificadas
5. **Execução**: Função correspondente é chamada

## Boas Práticas

### Triggers
- Use `intent` para intenções claras (peso alto)
- Use `keyword` para palavras-chave (peso médio)
- Use `entity` para entidades extraídas (CNPJ, email)
- Use `condition` para contexto (sdr_enabled, business_hours)

### Prioridade
- 9-10: Skills críticas (transferência, cadastro)
- 7-8: Skills importantes (vendas, suporte)
- 5-6: Skills comuns (comunicação)
- 1-4: Skills secundárias

### Condições
- Útil para restringir acesso a funcionalidades
- Verifica campos do contato, configurações do agente
- Exemplo: `contact.cnpj exists` para tabela de preços

## Migration

Para criar a tabela de skills customizadas:

```bash
npx sequelize-cli migration:run
```

Ou executar o migration manualmente:
```
backend/src/database/migrations/20250120000001-create-ai-agent-skills.ts
```

## Exemplos de Uso

### Criar skill de envio de orçamento

```typescript
await SkillManagerService.createSkill({
  agentId: 1,
  name: "enviar_orcamento",
  category: "sales",
  description: "Gera e envia orçamento personalizado",
  triggers: [
    { type: "keyword", value: "orçamento", weight: 0.9 },
    { type: "keyword", value: "cotar", weight: 0.8 }
  ],
  examples: [
    {
      user: "Preciso de um orçamento",
      assistant: "Vou preparar o orçamento para você!",
      function: "enviar_orcamento"
    }
  ],
  functions: ["enviar_orcamento"],
  conditions: [
    { field: "contact.cnpj", operator: "exists" }
  ],
  priority: 8
});
```

### Customizar skill padrão

```typescript
// Duplicar skill padrão com modificações
await SkillManagerService.forkDefaultSkill(1, "greeting", {
  description: "Cumprimenta com foco em vendas",
  examples: [
    {
      user: "Oi",
      assistant: "Olá! Seja bem-vindo à nossa loja! 🛍️ Como posso te ajudar hoje?"
    }
  ]
});
```

## Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `services/IA/AISkill.ts` | Definição de tipos e skills padrão |
| `models/AIAgentSkill.ts` | Modelo Sequelize para skills customizadas |
| `services/AIAgentServices/SkillManagerService.ts` | CRUD e lógica de skills |
| `controllers/AIAgentSkillController.ts` | Endpoints HTTP |
| `routes/aiSkillRoutes.ts` | Rotas da API |
| `migrations/20250120...ts` | Migration do banco |

## Benefícios

1. **Padronização**: Todas as skills seguem mesma estrutura
2. **Manutenibilidade**: Fácil adicionar/remover capacidades
3. **Clareza**: IA entende melhor quando usar cada skill
4. **Customização**: Cada agente pode ter skills específicas
5. **Validação**: Sistema verifica se funções existem
6. **Observabilidade**: Logs de uso de cada skill
