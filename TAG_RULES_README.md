# Sistema de Regras Automáticas de Tags

## Problema Resolvido

### 1. Tags Transacionais vs Tags de Permissão

**Antes:** Quando um usuário tinha tags transacionais (sem #) nas permissões, os contatos sumiam da lista.

**Agora:** O sistema filtra automaticamente apenas tags de permissão (que começam com #) antes de aplicar a lógica de visibilidade.

**Exemplo:**
- Usuário tem: `[#FERNANDA-FREITAS, #REPRESENTANTES, TRANSACIONAL]`
- Sistema usa apenas: `[#FERNANDA-FREITAS, #REPRESENTANTES]` para filtrar contatos
- Tag `TRANSACIONAL` é ignorada no filtro de permissões

### 2. Lógica de Visibilidade

**Regra:** Contato só aparece se tiver TODAS as tags de permissão (#) que o usuário possui.

**Exemplos:**

Usuário Fernanda: `[#FERNANDA-FREITAS, #REPRESENTANTES]`

| Contato | Tags | Aparece? |
|---------|------|----------|
| João | `[#FERNANDA-FREITAS, #REPRESENTANTES]` | ✅ Sim |
| Maria | `[#REPRESENTANTES]` | ❌ Não (falta #FERNANDA-FREITAS) |
| Pedro | `[#FERNANDA-FREITAS]` | ❌ Não (falta #REPRESENTANTES) |
| Ana | `[#BRUNA]` | ❌ Não |
| Carlos | `[#FERNANDA-FREITAS, #REPRESENTANTES, Ativo]` | ✅ Sim (tag sem # não conta) |

## Sistema de Automação de Tags

### Visão Geral

Permite criar regras para aplicar tags automaticamente baseado em dados do contato (código representante, região, segmento, etc).

### Estrutura de Regras

Cada tag pode ter múltiplas regras. O contato deve atender **TODAS** as regras (AND) para receber a tag.

**Campos da regra:**
- `tagId`: ID da tag a ser aplicada
- `field`: Campo do contato (ex: representativeCode, region, segment, city)
- `operator`: Tipo de comparação (equals, contains, in, not_null)
- `value`: Valor ou lista de valores
- `active`: Se a regra está ativa

### Operadores Disponíveis

| Operador | Descrição | Exemplo |
|----------|-----------|---------|
| `equals` | Campo igual ao valor | `field: "representativeCode"`, `value: "123"` |
| `contains` | Campo contém o valor | `field: "city"`, `value: "Paulo"` |
| `in` | Campo está em lista | `field: "region"`, `value: '["Sul", "Sudeste"]'` |
| `not_null` | Campo não é nulo | `field: "email"`, `value: ""` |

### Exemplo Prático

**Objetivo:** Aplicar tag `#FERNANDA-FREITAS` automaticamente em contatos da carteira dela.

**Regras criadas:**

1. Código do representante = 123
```json
{
  "tagId": 5,
  "field": "representativeCode",
  "operator": "equals",
  "value": "123"
}
```

2. Região Sul ou Sudeste
```json
{
  "tagId": 5,
  "field": "region",
  "operator": "in",
  "value": "[\"Sul\", \"Sudeste\"]"
}
```

3. Segmento Varejo
```json
{
  "tagId": 5,
  "field": "segment",
  "operator": "equals",
  "value": "Varejo"
}
```

**Resultado:** Contatos que atendem TODAS as 3 regras recebem automaticamente a tag `#FERNANDA-FREITAS`.

## API Endpoints

### 1. Listar Regras de uma Tag

```http
GET /tag-rules/tag/:tagId
Authorization: Bearer {token}
```

**Resposta:**
```json
[
  {
    "id": 1,
    "tagId": 5,
    "field": "representativeCode",
    "operator": "equals",
    "value": "123",
    "active": true,
    "tag": {
      "id": 5,
      "name": "#FERNANDA-FREITAS",
      "color": "#FF5733"
    }
  }
]
```

### 2. Criar Regra

```http
POST /tag-rules
Authorization: Bearer {token}
Content-Type: application/json

{
  "tagId": 5,
  "field": "representativeCode",
  "operator": "equals",
  "value": "123",
  "active": true
}
```

### 3. Atualizar Regra

```http
PUT /tag-rules/:ruleId
Authorization: Bearer {token}
Content-Type: application/json

{
  "field": "region",
  "operator": "in",
  "value": "[\"Sul\", \"Sudeste\", \"Centro-Oeste\"]",
  "active": true
}
```

### 4. Remover Regra

```http
DELETE /tag-rules/:ruleId
Authorization: Bearer {token}
```

### 5. Aplicar Regras Manualmente

**Aplicar regras de uma tag específica:**
```http
POST /tag-rules/apply/5
Authorization: Bearer {token}
```

**Aplicar TODAS as regras de todas as tags:**
```http
POST /tag-rules/apply
Authorization: Bearer {token}
```

**Aplicar em contato específico:**
```http
POST /tag-rules/apply
Authorization: Bearer {token}
Content-Type: application/json

{
  "contactId": 123
}
```

**Resposta:**
```json
{
  "message": "Regras aplicadas com sucesso",
  "results": [
    {
      "tagId": 5,
      "tagName": "#FERNANDA-FREITAS",
      "contactsAffected": 15
    },
    {
      "tagId": 6,
      "tagName": "#BRUNA",
      "contactsAffected": 8
    }
  ]
}
```

## Automação com Cron

Para processar automaticamente novos contatos, adicione um cron job:

```javascript
// No arquivo de cron jobs
import cron from 'node-cron';
import ApplyTagRulesService from './services/TagServices/ApplyTagRulesService';

// Executa a cada hora
cron.schedule('0 * * * *', async () => {
  console.log('Aplicando regras de tags...');
  
  const results = await ApplyTagRulesService({
    companyId: 1 // Ou buscar todas as companies
  });
  
  console.log('Regras aplicadas:', results);
});
```

## Instalação

1. **Rodar migration:**
```bash
cd backend
npx sequelize-cli db:migrate
```

2. **Reiniciar backend:**
```bash
npm run dev
```

3. **Testar:**
- Crie uma tag de permissão (ex: `#FERNANDA-FREITAS`)
- Crie regras para essa tag via API
- Execute `POST /tag-rules/apply/5` para aplicar
- Verifique os contatos que receberam a tag

## Campos Disponíveis do Contato

Você pode criar regras baseadas em qualquer campo do modelo Contact:

- `name` - Nome do contato
- `number` - Número do WhatsApp
- `email` - Email
- `representativeCode` - Código do representante
- `region` - Região
- `segment` - Segmento de mercado
- `city` - Cidade
- `state` - Estado
- `company` - Empresa
- E qualquer outro campo customizado

## Benefícios

✅ **Automação completa** - Novos contatos recebem tags automaticamente  
✅ **Flexível** - Múltiplas regras por tag, múltiplos operadores  
✅ **Escalável** - Processa milhares de contatos  
✅ **Auditável** - Histórico de aplicações  
✅ **Segregação perfeita** - Cada vendedor vê apenas sua carteira  
✅ **Zero manutenção** - Cron job mantém tudo atualizado  

## Troubleshooting

**Problema:** Contatos não aparecem após adicionar tag transacional

**Solução:** O sistema agora filtra automaticamente apenas tags #. Tags sem # não afetam visibilidade.

---

**Problema:** Regras não estão sendo aplicadas

**Solução:** 
1. Verifique se as regras estão `active: true`
2. Execute manualmente `POST /tag-rules/apply`
3. Verifique os logs para erros

---

**Problema:** Muitos contatos recebendo a tag

**Solução:** Adicione mais regras para refinar o filtro. Todas as regras devem ser atendidas (AND).
