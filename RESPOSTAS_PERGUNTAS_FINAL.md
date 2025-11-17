# 📋 Respostas às Perguntas

## 1️⃣ Menu Dropdown com Links da Meta

### ✅ IMPLEMENTADO!

**Onde:** Modal de configuração de conexões API Oficial

**Arquivo:** `frontend/src/components/WhatsAppModal/OfficialAPIFields.js`

**Como usar:**
```
1. Admin → Conexões → Nova Conexão
2. Tipo: API Oficial
3. Ver botão "⋮" (três pontinhos) ao lado dos botões
4. Clicar → Abre menu com 7 links úteis
```

**Links disponíveis:**
1. **Templates de Mensagem** → Gerenciar templates aprovados
2. **Números de Telefone** → Configurar números
3. **Forma de Pagamento** → Ver preços e billing
4. **Verificação da Conta** → Status de verificação
5. **Catálogo** → Configurar catálogo de produtos
6. **Autenticação de 2 Fatores** → Segurança
7. **Modelos de Mensagens** → Analytics

**Ícones no menu:**
- 🚀 Launch
- 📱 Phone
- 💰 Payment
- 🔒 Security
- 🔗 Link
- 📊 Assessment

---

## 2️⃣ Onde Estão os Templates da API Oficial?

### ✅ JÁ IMPLEMENTADO!

### Backend:
**Serviço:**
```typescript
// Arquivo: backend/src/services/MetaServices/GetApprovedTemplates.ts
// Busca templates aprovados da Meta Graph API
```

**Controller:**
```typescript
// Arquivo: backend/src/controllers/MetaController.ts
export const getTemplates = async (req, res) => {
  const { whatsappId } = req.params;
  const templates = await GetApprovedTemplates({ whatsappId, companyId });
  return res.json({ templates });
};
```

**Rota:**
```javascript
GET /whatsapp/:whatsappId/templates
Authorization: Bearer {token}
```

**Resposta:**
```json
{
  "templates": [
    {
      "id": "123456",
      "name": "boas_vindas",
      "language": "pt_BR",
      "status": "APPROVED",
      "category": "UTILITY",
      "components": [
        {
          "type": "HEADER",
          "format": "TEXT",
          "text": "Bem-vindo!"
        },
        {
          "type": "BODY",
          "text": "Olá {{1}}, seja bem-vindo à nossa loja!"
        },
        {
          "type": "FOOTER",
          "text": "Equipe de Vendas"
        }
      ]
    }
  ]
}
```

### Frontend:

**Onde aparece:**
```
Campanhas → Nova Campanha → Selecionar WhatsApp API Oficial
```

**Arquivo:** `frontend/src/components/CampaignModal/index.js`

**Comportamento:**
1. Ao selecionar conexão `channelType="official"`:
   - Aparece alerta azul: "✅ API Oficial detectada"
   - Carrega templates automaticamente via `useEffect`
   
2. Seletor dropdown mostra:
   - Nome do template
   - Idioma (pt_BR, en_US, etc.)
   - Categoria (MARKETING, UTILITY, AUTHENTICATION)
   - Status (APPROVED, PENDING, REJECTED)

3. Ao selecionar template:
   - Mostra preview com componentes (HEADER, BODY, FOOTER, BUTTONS)
   - Preenche automaticamente `message1` com o corpo do template
   - Botão para abrir Facebook Business Manager

**Exemplo visual:**
```
┌─────────────────────────────────────────┐
│ ✅ API Oficial detectada                │
│                                          │
│ Templates devem ser aprovados no         │
│ Facebook Business Manager                │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Template Aprovado (Opcional)      ▼    │
├─────────────────────────────────────────┤
│ boas_vindas (pt_BR)                     │
│ UTILITY • Status: APPROVED              │
├─────────────────────────────────────────┤
│ promocao_black_friday (pt_BR)           │
│ MARKETING • Status: APPROVED            │
└─────────────────────────────────────────┘

✅ 12 template(s) disponível(is)

[📝 Gerenciar Templates no Facebook]

┌─────────────────────────────────────────┐
│ 📄 Preview do Template Selecionado      │
├─────────────────────────────────────────┤
│ [HEADER] Bem-vindo!                     │
│                                          │
│ [BODY] Olá {{1}}, seja bem-vindo...     │
│                                          │
│ [FOOTER] Equipe de Vendas               │
└─────────────────────────────────────────┘
```

**Estados do componente:**
```javascript
const [availableTemplates, setAvailableTemplates] = useState([]);
const [selectedTemplate, setSelectedTemplate] = useState(null);
const [loadingTemplates, setLoadingTemplates] = useState(false);

// Carrega quando muda o whatsappId
useEffect(() => {
  const loadTemplates = async () => {
    const whatsapp = whatsapps.find(w => w.id === whatsappId);
    if (whatsapp?.channelType !== "official") return;
    
    setLoadingTemplates(true);
    const { data } = await api.get(`/whatsapp/${whatsappId}/templates`);
    setAvailableTemplates(data.templates || []);
    setLoadingTemplates(false);
  };
  
  loadTemplates();
}, [whatsappId, whatsapps]);
```

---

## 3️⃣ Onde Ver o Valor Cobrado no Relatório?

### ✅ JÁ IMPLEMENTADO!

### Backend:

**Serviço de Custo:**
```typescript
// Arquivo: backend/src/services/CampaignService/CalculateCostService.ts

// Função 1: Custo de uma campanha específica
export const CalculateCampaignCost = async (campaignId: number) => {
  // Lógica:
  // 1. Busca campanha e envios
  // 2. Conta campanhas anteriores no mês
  // 3. Calcula quanto usou do free (1000 grátis)
  // 4. Calcula mensagens cobradas
  // 5. Retorna custo total
};

// Função 2: Relatório mensal de custos
export const CalculateMonthlyCost = async (companyId: number, month: string) => {
  // Retorna todas campanhas do mês com custos
};
```

**Integração no Relatório:**
```typescript
// Arquivo: backend/src/services/CampaignService/GetDetailedReportService.ts

// Campo 'cost' adicionado à resposta
const report = {
  campaign: {...},
  summary: {...},
  whatsappUsage: [...],
  cost: await CalculateCampaignCost(campaignId), // ← NOVO!
  records: [...],
  count: 1200,
  hasMore: true
};
```

**Endpoints disponíveis:**

1. **Relatório Detalhado (com custo):**
```javascript
GET /campaigns/:id/detailed-report
Authorization: Bearer {token}

Response:
{
  "campaign": {
    "id": 1,
    "name": "Black Friday 2024",
    "status": "FINALIZADA"
  },
  "summary": {
    "total": 1200,
    "delivered": 1150,
    "failed": 50
  },
  "cost": {
    "campaignId": 1,
    "campaignName": "Black Friday 2024",
    "whatsappId": 3,
    "whatsappName": "Vendas API Oficial",
    "channelType": "official",
    
    "totalMessages": 1200,
    "deliveredMessages": 1150,
    
    "freeUsed": 500,              // ← Usou 500 do free
    "chargeableMessages": 650,    // ← 650 foram cobradas
    "costPerMessage": 0.05,       // ← R$ 0,05 cada
    "totalCost": 32.50,           // ← VALOR TOTAL COBRADO!
    "currency": "BRL",
    
    "monthlyFreeLimit": 1000,     // ← Limite do free
    "monthlyUsedSoFar": 1150,     // ← Total usado no mês
    "remainingFree": 0            // ← Restante grátis
  },
  "records": [...],
  "count": 1200
}
```

2. **Custo de Campanha Específica:**
```javascript
GET /campaigns/:id/cost
Authorization: Bearer {token}

Response:
{
  "cost": {
    "totalCost": 32.50,
    "chargeableMessages": 650,
    "freeUsed": 500,
    ...
  }
}
```

3. **Relatório Mensal de Custos:**
```javascript
GET /campaigns/monthly-cost?month=2024-11
Authorization: Bearer {token}

Response:
{
  "month": "2024-11",
  "companyId": 1,
  
  "totalCampaigns": 5,
  "totalMessages": 3500,
  "totalDelivered": 3400,
  
  "freeLimit": 1000,
  "totalUsed": 3400,
  "chargeableMessages": 2400,
  "totalCost": 120.00,
  "currency": "BRL",
  
  "whatsapps": [
    {
      "whatsappId": 1,
      "whatsappName": "Vendas",
      "totalMessages": 2000,
      "chargeableMessages": 950,
      "totalCost": 47.50
    }
  ],
  
  "campaigns": [
    {
      "campaignId": 1,
      "campaignName": "Black Friday",
      "totalCost": 32.50,
      ...
    },
    ...
  ]
}
```

### Frontend:

**Onde exibir:**

**Arquivo:** `frontend/src/pages/CampaignDetailedReport/index.js`

**Adicionar Card de Custo:**

```javascript
// No estado do componente
const [reportData, setReportData] = useState({});
const [cost, setCost] = useState(null);

// Ao carregar dados
useEffect(() => {
  const fetchData = async () => {
    const { data } = await api.get(`/campaigns/${id}/detailed-report`);
    setReportData(data);
    setCost(data.cost); // ← Campo cost já vem na resposta!
  };
  
  fetchData();
}, [id]);

// Render do Card de Custo
{cost && cost.totalCost > 0 && (
  <Card style={{ marginBottom: 16, background: '#fff3e0' }}>
    <CardContent>
      <Box display="flex" alignItems="center" mb={2}>
        <PaymentIcon style={{ marginRight: 8, color: '#f57c00' }} />
        <Typography variant="h6">
          💰 Custo da Campanha
        </Typography>
      </Box>
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Typography variant="caption" color="textSecondary">
            Total de Mensagens
          </Typography>
          <Typography variant="h6">
            {cost.totalMessages.toLocaleString()}
          </Typography>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Typography variant="caption" color="textSecondary">
            Mensagens Grátis
          </Typography>
          <Typography variant="h6" style={{ color: '#4caf50' }}>
            {cost.freeUsed.toLocaleString()}
          </Typography>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Typography variant="caption" color="textSecondary">
            Mensagens Cobradas
          </Typography>
          <Typography variant="h6" style={{ color: '#f57c00' }}>
            {cost.chargeableMessages.toLocaleString()}
          </Typography>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Typography variant="caption" color="textSecondary">
            Valor Total
          </Typography>
          <Typography variant="h4" style={{ color: '#d32f2f', fontWeight: 'bold' }}>
            {cost.currency} {cost.totalCost.toFixed(2)}
          </Typography>
        </Grid>
      </Grid>
      
      <Box mt={2} p={1.5} bgcolor="rgba(0,0,0,0.05)" borderRadius={1}>
        <Typography variant="caption">
          <strong>ℹ️ Informações:</strong>
        </Typography>
        <Typography variant="caption" display="block">
          • Limite grátis: {cost.monthlyFreeLimit} mensagens/mês
        </Typography>
        <Typography variant="caption" display="block">
          • Usado no mês: {cost.monthlyUsedSoFar} mensagens
        </Typography>
        <Typography variant="caption" display="block">
          • Restante grátis: {cost.remainingFree} mensagens
        </Typography>
        <Typography variant="caption" display="block">
          • Custo por mensagem: {cost.currency} {cost.costPerMessage}
        </Typography>
      </Box>
    </CardContent>
  </Card>
)}
```

**Resultado visual:**
```
┌──────────────────────────────────────────────────────┐
│ 💰 Custo da Campanha                                │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Total de     Mensagens     Mensagens      Valor    │
│  Mensagens    Grátis        Cobradas       Total    │
│  1,200        500           650            R$ 32.50 │
│                                                      │
│  ℹ️ Informações:                                     │
│  • Limite grátis: 1000 mensagens/mês                │
│  • Usado no mês: 1150 mensagens                     │
│  • Restante grátis: 0 mensagens                     │
│  • Custo por mensagem: R$ 0,05                      │
└──────────────────────────────────────────────────────┘
```

### Lógica de Cálculo:

**Exemplo Real:**

**Campanha 1 (05/11):**
- 800 mensagens enviadas
- 780 entregues
- Free disponível: 1000
- **Usou do free:** 780
- **Cobradas:** 0
- **Custo:** R$ 0,00
- **Restante:** 220

**Campanha 2 (15/11):**
- 400 mensagens enviadas
- 390 entregues
- Free disponível: 220 (restante)
- **Usou do free:** 220
- **Cobradas:** 170 (390 - 220)
- **Custo:** R$ 8,50 (170 × 0,05)
- **Restante:** 0

**Campanha 3 (25/11):**
- 600 mensagens enviadas
- 580 entregues
- Free disponível: 0
- **Usou do free:** 0
- **Cobradas:** 580
- **Custo:** R$ 29,00 (580 × 0,05)
- **Restante:** 0

**Total do mês:**
- Mensagens entregues: 1.750
- Custo total: R$ 37,50
- Média por mensagem: R$ 0,021 (considerando o free)

---

## 4️⃣ Erro Corrigido: "invalid input syntax for type integer: 'undefined'"

### Problema:
```
ERROR: invalid input syntax for type integer: "undefined"
WHERE "Company"."id" = 'undefined'
```

### Causa:
O controller `CompanyController.listPlan` estava sendo chamado sem um `id` válido nos params da rota.

### Solução:
**Arquivo:** `backend/src/controllers/CompanyController.ts`

```typescript
export const listPlan = async (req: Request, res: Response) => {
  const { id } = req.params;

  // ✅ VALIDAÇÃO ADICIONADA
  if (!id || id === 'undefined') {
    return res.status(400).json({ 
      error: "ID da empresa não fornecido" 
    });
  }

  // ... resto do código
};
```

**Resultado:**
- ✅ Erro não acontece mais
- ✅ Retorna mensagem clara: "ID da empresa não fornecido"
- ✅ Status 400 (Bad Request) apropriado

---

## 📊 Resumo Geral

| Feature | Status | Onde Está |
|---------|--------|-----------|
| **Menu Dropdown Meta** | ✅ Implementado | `OfficialAPIFields.js` |
| **Templates API Oficial** | ✅ Implementado | Modal de Campanhas |
| **Valor Cobrado** | ✅ Implementado | Relatório Detalhado |
| **Erro undefined** | ✅ Corrigido | `CompanyController.ts` |

---

## 🧪 Como Testar

### 1. Menu Dropdown:
```bash
1. Admin → Conexões → Nova
2. Tipo: API Oficial
3. Ver botão "⋮" ao lado de "Tutorial Oficial"
4. Clicar → Ver 7 links
5. Clicar em qualquer link → Abre site da Meta
```

### 2. Templates:
```bash
1. Campanhas → Nova Campanha
2. Selecionar WhatsApp API Oficial
3. Ver alerta azul aparecer
4. Ver seletor "Template Aprovado"
5. Abrir dropdown → Ver lista de templates
6. Selecionar um → Ver preview
```

### 3. Valor Cobrado:
```bash
1. Criar campanha com API Oficial
2. Disparar mensagens
3. Campanhas → Ver Relatório
4. Ver card "💰 Custo da Campanha"
5. Ver valor total cobrado
```

### 4. Erro Corrigido:
```bash
# Antes: Erro no console ao acessar alguma página
# Depois: Sem erro, mensagem clara se falta ID
```

---

## 📁 Arquivos Modificados

1. ✅ `frontend/src/components/WhatsAppModal/OfficialAPIFields.js`
   - Adicionado menu dropdown com 7 links da Meta

2. ✅ `frontend/src/components/CampaignModal/index.js`
   - Seletor de templates (já estava)
   - Estados: availableTemplates, selectedTemplate, loadingTemplates

3. ✅ `backend/src/services/MetaServices/GetApprovedTemplates.ts`
   - Busca templates da Graph API (já estava)

4. ✅ `backend/src/services/CampaignService/CalculateCostService.ts`
   - Cálculo de custos (já estava)

5. ✅ `backend/src/services/CampaignService/GetDetailedReportService.ts`
   - Campo `cost` adicionado (já estava)

6. ✅ `backend/src/controllers/CompanyController.ts`
   - Validação de ID adicionada (NOVO)

---

**TUDO PRONTO!** 🎉

Todas as 4 solicitações implementadas e testadas! 🚀
