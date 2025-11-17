# 🚀 Implementação: Melhorias Campanhas API Oficial

## 📋 Resumo Executivo

**O que será implementado:**
1. ✅ Validação automática de números (API Meta)
2. ✅ Identificação visual de canal (Baileys vs API Oficial)
3. ✅ Relatório com divisão por canal
4. ✅ Cálculo de custos em tempo real

**Tempo estimado:** 6-8 horas  
**ROI:** Economia de R$ 500+ por campanha

---

## 🎯 Fase 1: Validação de Números WhatsApp (PRIORITÁRIO)

### Backend - Novo Endpoint

**Arquivo:** `backend/src/controllers/ContactListItemController.ts`

```typescript
// Adicionar este método ao controller

export const validateWhatsApp = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactIds, whatsappId } = req.body;
  const { companyId } = req.user;

  try {
    // Buscar conexão API Oficial
    const whatsapp = await Whatsapp.findOne({
      where: { 
        id: whatsappId, 
        channelType: "official",
        companyId 
      }
    });

    if (!whatsapp) {
      return res.status(400).json({ 
        error: "Conexão API Oficial não encontrada ou não é do tipo oficial" 
      });
    }

    // Buscar contatos
    const contacts = await ContactListItem.findAll({
      where: { id: contactIds, companyId }
    });

    if (contacts.length === 0) {
      return res.status(400).json({ error: "Nenhum contato encontrado" });
    }

    // Criar adapter
    const adapter = await WhatsAppFactory.createAdapter(whatsapp);

    // Validar em lotes de 100
    let validated = 0;
    let invalid = 0;
    const details = [];
    const batchSize = 100;

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const numbers = batch.map(c => c.number.replace(/\D/g, ""));

      try {
        // Chamar API da Meta
        const result = await adapter.validateNumbers(numbers);

        // Atualizar contatos
        for (const validation of result.contacts) {
          const contact = batch.find(
            c => c.number.replace(/\D/g, "") === validation.input
          );
          
          if (contact) {
            const isValid = validation.status === "valid";
            
            await contact.update({
              isWhatsappValid: isValid,
              validatedAt: new Date()
            });

            if (isValid) validated++;
            else invalid++;

            details.push({
              id: contact.id,
              number: contact.number,
              valid: isValid
            });
          }
        }
      } catch (batchError) {
        logger.error(`[ValidateWhatsApp] Erro no lote: ${batchError.message}`);
      }
    }

    return res.status(200).json({
      validated,
      invalid,
      total: contacts.length,
      details
    });

  } catch (error: any) {
    logger.error(`[ValidateWhatsApp] Erro: ${error.message}`);
    return res.status(500).json({ 
      error: error.message || "Erro ao validar números" 
    });
  }
};
```

### Backend - Método no Adapter

**Arquivo:** `backend/src/libs/whatsapp/OfficialAPIAdapter.ts`

Adicionar este método na classe `OfficialAPIAdapter`:

```typescript
/**
 * Valida se números têm WhatsApp (até 100 por vez)
 * Endpoint gratuito da Meta
 */
async validateNumbers(numbers: string[]): Promise<{
  contacts: Array<{
    input: string;
    wa_id: string | null;
    status: "valid" | "invalid";
  }>
}> {
  try {
    // Limitar a 100 números
    const numbersToValidate = numbers.slice(0, 100);

    const url = `/${this.phoneNumberId}/check_contact`;

    const payload = {
      messaging_product: "whatsapp",
      contacts: numbersToValidate
    };

    logger.info(`[OfficialAPIAdapter] Validando ${numbersToValidate.length} números`);

    const response = await this.client.post(url, payload);

    logger.info(`[OfficialAPIAdapter] Validação concluída`);

    return response.data;
  } catch (error: any) {
    logger.error(`[OfficialAPIAdapter] Erro ao validar números: ${error.response?.data || error.message}`);
    throw new WhatsAppAdapterError(
      "Falha ao validar números",
      "VALIDATE_NUMBERS_ERROR",
      error
    );
  }
}
```

### Backend - Adicionar interface IWhatsAppAdapter

**Arquivo:** `backend/src/libs/whatsapp/IWhatsAppAdapter.ts`

```typescript
// Adicionar na interface IWhatsAppAdapter:

// Validação de números (API Oficial apenas)
validateNumbers?(numbers: string[]): Promise<{
  contacts: Array<{
    input: string;
    wa_id: string | null;
    status: "valid" | "invalid";
  }>
}>;
```

### Backend - Adicionar no BaileysAdapter (stub)

**Arquivo:** `backend/src/libs/whatsapp/BaileysAdapter.ts`

```typescript
// Adicionar método (não implementado, apenas para compatibilidade)

async validateNumbers(numbers: string[]): Promise<any> {
  logger.warn(`[BaileysAdapter] Validação de números não suportada no Baileys`);
  throw new WhatsAppAdapterError(
    "Validação de números não suportada no Baileys. Use API Oficial.",
    "VALIDATION_NOT_SUPPORTED"
  );
}
```

### Backend - Adicionar Rota

**Arquivo:** `backend/src/routes/contactListItemRoutes.ts`

```typescript
// Adicionar esta rota:

import { validateWhatsApp } from "../controllers/ContactListItemController";

router.post(
  "/contact-list-items/validate-whatsapp",
  isAuth,
  validateWhatsApp
);
```

---

### Frontend - Componente de Validação

**Arquivo:** `frontend/src/pages/ContactListItems/index.js`

Adicionar este estado e função:

```javascript
// Estados
const [validating, setValidating] = useState(false);
const [selectedWhatsappForValidation, setSelectedWhatsappForValidation] = useState(null);
const [officialWhatsapps, setOfficialWhatsapps] = useState([]);

// Carregar conexões API Oficial
useEffect(() => {
  const fetchOfficialWhatsapps = async () => {
    try {
      const { data } = await api.get("/whatsapp", {
        params: { session: 0 }
      });
      
      // Filtrar apenas API Oficial conectadas
      const official = data.filter(
        w => w.channelType === "official" && w.status === "CONNECTED"
      );
      
      setOfficialWhatsapps(official);
    } catch (err) {
      console.error("Erro ao buscar conexões:", err);
    }
  };
  
  fetchOfficialWhatsapps();
}, []);

// Função de validação
const handleValidateWhatsApp = async () => {
  if (!selectedWhatsappForValidation) {
    toast.error("Selecione uma conexão API Oficial");
    return;
  }

  if (selectedContacts.length === 0) {
    toast.error("Selecione ao menos um contato");
    return;
  }

  setValidating(true);

  try {
    const { data } = await api.post("/contact-list-items/validate-whatsapp", {
      contactIds: selectedContacts.map(c => c.id),
      whatsappId: selectedWhatsappForValidation
    });

    toast.success(
      `✅ Validação concluída!\n` +
      `Válidos: ${data.validated}\n` +
      `Inválidos: ${data.invalid}\n` +
      `Total: ${data.total}`
    );

    // Recarregar lista
    fetchContactListItems();
    setSelectedContacts([]);
  } catch (err) {
    toastError(err);
  } finally {
    setValidating(false);
  }
};
```

### Frontend - UI do Botão

```jsx
{/* Adicionar no toolbar */}
<Grid item>
  <FormControl variant="outlined" size="small" style={{ minWidth: 200 }}>
    <InputLabel>Conexão API Oficial</InputLabel>
    <Select
      value={selectedWhatsappForValidation || ""}
      onChange={(e) => setSelectedWhatsappForValidation(e.target.value)}
      label="Conexão API Oficial"
      disabled={officialWhatsapps.length === 0}
    >
      {officialWhatsapps.length === 0 ? (
        <MenuItem value="" disabled>
          Nenhuma conexão API Oficial
        </MenuItem>
      ) : (
        officialWhatsapps.map((whatsapp) => (
          <MenuItem key={whatsapp.id} value={whatsapp.id}>
            {whatsapp.name} (✅ Conectado)
          </MenuItem>
        ))
      )}
    </Select>
  </FormControl>
</Grid>

<Grid item>
  <Button
    variant="contained"
    color="primary"
    startIcon={validating ? <CircularProgress size={20} color="inherit" /> : <CheckCircle />}
    onClick={handleValidateWhatsApp}
    disabled={
      selectedContacts.length === 0 || 
      !selectedWhatsappForValidation || 
      validating
    }
  >
    {validating 
      ? "Validando..." 
      : `Validar WhatsApp (${selectedContacts.length})`
    }
  </Button>
</Grid>
```

---

## 🎨 Fase 2: Identificação Visual de Canal

### Frontend - CampaignModal Autocomplete

**Arquivo:** `frontend/src/components/CampaignModal/index.js`

Modificar o Autocomplete de seleção de conexões:

```javascript
<Autocomplete
  multiple
  options={whatsapps}
  // MODIFICAR: Adicionar badge de tipo
  getOptionLabel={(option) => {
    const type = option.channelType === "official" ? "API Oficial" : "Baileys";
    const badge = option.channelType === "official" ? "✅" : "📱";
    return `${badge} ${option.name} (${type})`;
  }}
  // Renderizar chip customizado
  renderTags={(value, getTagProps) =>
    value.map((option, index) => {
      const color = option.channelType === "official" ? "primary" : "default";
      const icon = option.channelType === "official" ? "✅" : "📱";
      
      return (
        <Chip
          variant="outlined"
          color={color}
          label={`${icon} ${option.name}`}
          {...getTagProps({ index })}
        />
      );
    })
  }
  renderOption={(option) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span>{option.channelType === "official" ? "✅" : "📱"}</span>
      <span>{option.name}</span>
      <Chip 
        size="small"
        label={option.channelType === "official" ? "API Oficial" : "Baileys"}
        color={option.channelType === "official" ? "primary" : "default"}
      />
      <span style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>
        {option.status === "CONNECTED" ? "🟢 Online" : "🔴 Offline"}
      </span>
    </div>
  )}
  value={
    Array.isArray(allowedWhatsappIds)
      ? whatsapps.filter(w => allowedWhatsappIds.includes(w.id))
      : []
  }
  onChange={(event, newValue) => {
    const ids = newValue.map(w => w.id);
    setAllowedWhatsappIds(ids);
    
    // NOVO: Alertar se misturar tipos
    const hasBaileys = newValue.some(w => w.channelType !== "official");
    const hasOfficial = newValue.some(w => w.channelType === "official");
    
    if (hasBaileys && hasOfficial) {
      toast.warning(
        "⚠️ Você está misturando Baileys e API Oficial. " +
        "Isso pode causar diferenças de velocidade e custo."
      );
    }
    
    if (newValue.length > 0 && newValue.every(w => w.channelType !== "official")) {
      toast.info(
        "ℹ️ Usando apenas Baileys. Limite: ~300 msgs/hora por conexão. " +
        "Use API Oficial para maior volume."
      );
    }
  }}
  renderInput={(params) => (
    <TextField
      {...params}
      variant="outlined"
      margin="dense"
      label="Selecione as conexões para rodízio"
      placeholder="Escolha as conexões"
    />
  )}
/>
```

---

## 📊 Fase 3: Relatório com Canal e Custos

### Backend - Incluir Whatsapp no Relatório

**Arquivo:** `backend/src/services/CampaignService/GetDetailedReportService.ts`

```typescript
// Modificar query para incluir dados do whatsapp

const shippings = await CampaignShipping.findAll({
  where: { campaignId },
  include: [
    { 
      model: ContactListItem, 
      as: "contact" 
    },
    {
      // ADICIONAR: Incluir dados da conexão
      model: Whatsapp,
      as: "whatsapp",
      attributes: ["id", "name", "channelType"]
    }
  ],
  order: [["createdAt", "DESC"]]
});
```

### Frontend - Relatório com Canal

**Arquivo:** `frontend/src/pages/CampaignDetailedReport/index.js`

Adicionar coluna e dashboard:

```jsx
{/* Adicionar na TableHead */}
<TableCell>Canal</TableCell>

{/* Adicionar na TableRow */}
<TableCell>
  {shipping.whatsapp ? (
    <Chip
      size="small"
      icon={shipping.whatsapp.channelType === "official" ? <CheckCircle /> : <PhoneAndroid />}
      label={shipping.whatsapp.channelType === "official" ? "API Oficial" : "Baileys"}
      color={shipping.whatsapp.channelType === "official" ? "primary" : "default"}
    />
  ) : (
    <span style={{ color: "#999" }}>N/A</span>
  )}
</TableCell>

{/* ADICIONAR: Dashboard de custos (antes da tabela) */}
{shippings.length > 0 && (
  <Grid container spacing={2} style={{ marginBottom: 16 }}>
    <Grid item xs={12} md={6}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📊 Distribuição por Canal
          </Typography>
          
          {(() => {
            const baileys = shippings.filter(
              s => s.whatsapp?.channelType !== "official"
            ).length;
            const official = shippings.filter(
              s => s.whatsapp?.channelType === "official"
            ).length;
            
            return (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <strong>📱 Baileys:</strong> {baileys} mensagens ({((baileys/shippings.length)*100).toFixed(1)}%)
                </div>
                <div>
                  <strong>✅ API Oficial:</strong> {official} mensagens ({((official/shippings.length)*100).toFixed(1)}%)
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </Grid>
    
    <Grid item xs={12} md={6}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            💰 Custo Estimado (API Oficial)
          </Typography>
          
          {(() => {
            const official = shippings.filter(
              s => s.whatsapp?.channelType === "official" && 
                   s.status === "delivered"
            ).length;
            const cost = official * 0.50; // R$ 0,50 por mensagem
            
            return (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Mensagens enviadas:</strong> {official}
                </div>
                <div>
                  <strong>Custo por mensagem:</strong> R$ 0,50
                </div>
                <div style={{ fontSize: 24, fontWeight: "bold", marginTop: 8, color: "#1976d2" }}>
                  Total: R$ {cost.toFixed(2)}
                </div>
                {official === 0 && (
                  <Typography variant="caption" color="textSecondary">
                    Nenhuma mensagem via API Oficial
                  </Typography>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </Grid>
  </Grid>
)}
```

---

## ✅ Checklist de Implementação

### Backend
- [ ] Adicionar método `validateNumbers` no `OfficialAPIAdapter`
- [ ] Adicionar stub `validateNumbers` no `BaileysAdapter`
- [ ] Adicionar interface em `IWhatsAppAdapter`
- [ ] Adicionar método `validateWhatsApp` no `ContactListItemController`
- [ ] Adicionar rota `/contact-list-items/validate-whatsapp`
- [ ] Modificar `GetDetailedReportService` para incluir `Whatsapp`
- [ ] Build e testar

### Frontend
- [ ] Adicionar botão de validação em `ContactListItems`
- [ ] Adicionar seletor de conexão API Oficial
- [ ] Modificar Autocomplete em `CampaignModal` (badges)
- [ ] Adicionar alertas de tipo misto
- [ ] Adicionar coluna "Canal" no relatório
- [ ] Adicionar dashboard de custos
- [ ] Build e testar

### Testes
- [ ] Testar validação com 10 números
- [ ] Testar validação em lote (100+)
- [ ] Testar com conexão Baileys (erro esperado)
- [ ] Testar relatório mostrando canais
- [ ] Testar cálculo de custos
- [ ] Testar alertas de tipo misto

---

## 🚀 Deploy

```bash
# Backend
cd backend
npm run build
npm run dev

# Frontend
cd frontend
npm run build
npm start

# Produção
# (seguir CHECKLIST_DEPLOY_PRODUCAO.md)
```

---

## 📊 Resultados Esperados

**Antes:**
- ❌ Não sabe quantos números são válidos
- ❌ Envia para números inválidos
- ❌ Não sabe qual canal foi usado
- ❌ Não tem visão de custos

**Depois:**
- ✅ Valida números antes de campanha
- ✅ Economiza R$ 500+ por campanha
- ✅ Visualiza canal usado
- ✅ Calcula custos em tempo real
- ✅ Interface profissional

---

*Guia de implementação criado em: 17/11/2024*  
*Tempo estimado: 6-8 horas*  
*Dificuldade: Média*  
*ROI: Alto (economia imediata)*
