# 📋 Respostas - Melhorias em Campanhas e Integrações

## 1. 📝 Templates da Meta para Campanhas

### ❌ **PROBLEMA: NÃO IMPLEMENTADO**

Atualmente, o modal de campanhas **NÃO tem integração com templates da Meta**.

**O que precisa fazer:**

### ✅ **Solução Completa:**

```typescript
// backend/src/services/MetaServices/GetApprovedTemplates.ts
import axios from "axios";
import logger from "../../utils/logger";

interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  components: Array<{
    type: string;
    text?: string;
    format?: string;
    example?: any;
  }>;
}

export const GetApprovedTemplates = async (
  whatsappBusinessAccountId: string,
  accessToken: string
): Promise<MetaTemplate[]> => {
  try {
    logger.info(`[GetApprovedTemplates] Buscando templates aprovados para WABA ${whatsappBusinessAccountId}`);

    const url = `https://graph.facebook.com/v17.0/${whatsappBusinessAccountId}/message_templates`;
    
    const { data } = await axios.get(url, {
      params: {
        access_token: accessToken,
        fields: "id,name,language,status,category,components"
      }
    });

    // Filtrar apenas templates aprovados
    const approved = data.data.filter((t: any) => t.status === "APPROVED");
    
    logger.info(`[GetApprovedTemplates] ${approved.length} templates aprovados encontrados`);
    
    return approved;
  } catch (error: any) {
    logger.error(`[GetApprovedTemplates] Erro: ${error.message}`);
    throw error;
  }
};
```

### 📋 **Adicionar no Modal de Campanha:**

```javascript
// frontend/src/components/CampaignModal/index.js

// Adicionar no estado:
const [availableTemplates, setAvailableTemplates] = useState([]);
const [selectedTemplate, setSelectedTemplate] = useState(null);
const [showTemplateSelector, setShowTemplateSelector] = useState(false);

// Carregar templates quando usar API Oficial:
useEffect(() => {
  const loadTemplates = async () => {
    if (!selectedWhatsappId) return;
    
    const whatsapp = whatsapps.find(w => w.id === selectedWhatsappId);
    if (whatsapp?.channelType !== "official") return;
    
    try {
      const { data } = await api.get(`/whatsapp/${selectedWhatsappId}/templates`);
      setAvailableTemplates(data.templates || []);
    } catch (err) {
      console.error("Erro ao carregar templates", err);
    }
  };
  
  loadTemplates();
}, [selectedWhatsappId, whatsapps]);

// No JSX, adicionar antes das abas de mensagem:
{selectedWhatsapp?.channelType === "official" && (
  <Grid xs={12} item>
    <Alert severity="info">
      <strong>API Oficial requer Templates aprovados pela Meta</strong>
      <br />
      Selecione um template ou crie um novo no Facebook Business Manager.
    </Alert>
    
    <FormControl fullWidth margin="dense">
      <InputLabel>Template Aprovado</InputLabel>
      <Select
        value={selectedTemplate?.id || ""}
        onChange={(e) => {
          const template = availableTemplates.find(t => t.id === e.target.value);
          setSelectedTemplate(template);
          
          // Preencher mensagem com o template
          if (template?.components?.[0]?.text) {
            setFieldValue("message1", template.components[0].text);
          }
        }}
      >
        <MenuItem value="">
          <em>Nenhum</em>
        </MenuItem>
        {availableTemplates.map(template => (
          <MenuItem key={template.id} value={template.id}>
            {template.name} ({template.language}) - {template.category}
          </MenuItem>
        ))}
      </Select>
      <FormHelperText>
        Você tem {availableTemplates.length} templates aprovados disponíveis
      </FormHelperText>
    </FormControl>
    
    <Button
      size="small"
      variant="outlined"
      onClick={() => window.open("https://business.facebook.com/wa/manage/message-templates", "_blank")}
      style={{ marginTop: 8 }}
    >
      Gerenciar Templates no Facebook
    </Button>
  </Grid>
)}
```

**Tempo estimado:** 2-3 horas

---

## 2. 📱 Preview da Mensagem (Mockup iPhone)

### ✅ **Solução: Adicionar Preview à Direita**

```javascript
// frontend/src/components/CampaignModal/WhatsAppPreview.js
import React from "react";
import { Paper, Typography, Box, Avatar } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  phoneFrame: {
    width: 320,
    height: 640,
    borderRadius: 40,
    border: "12px solid #1f1f1f",
    background: "#e5ddd5", // Fundo do WhatsApp
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  },
  notch: {
    position: "absolute",
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: 140,
    height: 24,
    background: "#1f1f1f",
    borderRadius: "0 0 20px 20px",
    zIndex: 10,
  },
  header: {
    background: "#075e54", // Verde WhatsApp
    color: "#fff",
    padding: "48px 16px 12px", // Espaço para notch
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  chatArea: {
    flex: 1,
    padding: 16,
    overflowY: "auto",
    height: 500,
  },
  messageBubble: {
    background: "#dcf8c6", // Verde mensagem enviada
    padding: "8px 12px",
    borderRadius: "8px 8px 2px 8px",
    maxWidth: "80%",
    marginLeft: "auto",
    marginBottom: 8,
    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
  },
  messageText: {
    fontSize: 14,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  },
  mediaPreview: {
    width: "100%",
    maxWidth: 200,
    borderRadius: 8,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 11,
    color: "#667781",
    textAlign: "right",
    marginTop: 4,
  },
}));

const WhatsAppPreview = ({ 
  messages = [], 
  contactName = "Cliente",
  mediaUrls = {},
  companyName = "Empresa"
}) => {
  const classes = useStyles();

  return (
    <Box className={classes.phoneFrame}>
      {/* Notch do iPhone */}
      <div className={classes.notch} />
      
      {/* Header do WhatsApp */}
      <Box className={classes.header}>
        <Avatar style={{ width: 32, height: 32 }}>
          {contactName[0]}
        </Avatar>
        <Box>
          <Typography variant="body2" style={{ fontWeight: 600 }}>
            {contactName}
          </Typography>
          <Typography variant="caption" style={{ fontSize: 12, opacity: 0.8 }}>
            online
          </Typography>
        </Box>
      </Box>
      
      {/* Área de mensagens */}
      <Box className={classes.chatArea}>
        {messages.map((msg, idx) => {
          if (!msg || !msg.trim()) return null;
          
          const mediaUrl = mediaUrls[`mediaUrl${idx + 1}`];
          const isImage = mediaUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(mediaUrl);
          const isVideo = mediaUrl && /\.(mp4|webm)$/i.test(mediaUrl);
          
          return (
            <Box key={idx} className={classes.messageBubble}>
              {/* Mídia */}
              {mediaUrl && isImage && (
                <img 
                  src={mediaUrl} 
                  alt="Preview" 
                  className={classes.mediaPreview}
                  onError={(e) => e.target.style.display = 'none'}
                />
              )}
              {mediaUrl && isVideo && (
                <video 
                  src={mediaUrl} 
                  className={classes.mediaPreview}
                  controls
                />
              )}
              
              {/* Texto da mensagem */}
              <Typography className={classes.messageText}>
                {msg
                  .replace(/\{nome\}/gi, contactName)
                  .replace(/\{numero\}/gi, "(11) 99999-9999")
                  .replace(/\{email\}/gi, "cliente@exemplo.com")
                }
              </Typography>
              
              {/* Timestamp */}
              <Typography className={classes.timestamp}>
                {new Date().toLocaleTimeString('pt-BR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </Typography>
            </Box>
          );
        })}
        
        {messages.filter(m => m?.trim()).length === 0 && (
          <Typography 
            variant="caption" 
            style={{ 
              textAlign: "center", 
              color: "#667781",
              display: "block",
              marginTop: 100
            }}
          >
            Digite uma mensagem para ver o preview
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default WhatsAppPreview;
```

### 📋 **Integrar no Modal:**

```javascript
// No CampaignModal/index.js:

import WhatsAppPreview from "./WhatsAppPreview";

// Modificar o DialogContent para ter 2 colunas:
<DialogContent dividers style={{ display: "flex", gap: 16 }}>
  {/* Coluna esquerda - Formulário */}
  <Box flex={1}>
    {/* Todo o conteúdo atual do modal */}
  </Box>
  
  {/* Coluna direita - Preview */}
  <Box width={320} position="sticky" top={0}>
    <WhatsAppPreview
      messages={[
        values.message1,
        values.message2,
        values.message3,
        values.message4,
        values.message5,
      ].filter(Boolean)}
      mediaUrls={{
        mediaUrl1: values.mediaUrl1,
        mediaUrl2: values.mediaUrl2,
        mediaUrl3: values.mediaUrl3,
        mediaUrl4: values.mediaUrl4,
        mediaUrl5: values.mediaUrl5,
      }}
      contactName="João Silva"
    />
  </Box>
</DialogContent>
```

**Tempo estimado:** 2-3 horas

---

## 3. 🤖 Problema do Assistente de IA

### ❌ **PROBLEMA IDENTIFICADO:**

O assistente está configurado para contexto de **ticket**, mas em campanhas ele precisa de instruções diferentes.

### ✅ **Correção:**

```javascript
// frontend/src/components/CampaignModal/index.js

// Quando abre o assistente:
const handleOpenAssistant = (targetField, values) => {
  setAssistantTargetField(targetField);
  setAssistantOpen(true);
  
  // ESTE É O PROBLEMA: contexto errado!
  // Antes:
  // setAssistantContext("ticket"); // ❌ ERRADO
  
  // Depois:
  setAssistantContext("campaign"); // ✅ CORRETO
  
  // Adicionar resumo do contexto:
  setAssistantContextSummary(`
    Tipo: Campanha de mensagem em massa
    Objetivo: Escrever mensagens persuasivas e profissionais
    Público: ${values.contactListId ? "Lista específica" : "Todos os contatos"}
    Canal: ${selectedWhatsapp?.channelType === "official" ? "API Oficial (formal)" : "Baileys (informal ok)"}
    Mensagens: ${[values.message1, values.message2, values.message3].filter(Boolean).length} abas
  `);
};

// E no ChatAssistantPanel:
<ChatAssistantPanel
  open={assistantOpen}
  onClose={() => setAssistantOpen(false)}
  inputMessage={values[assistantTargetField] || ""}
  setInputMessage={(text) => setFieldValue(assistantTargetField, text)}
  assistantContext="campaign" // ✅ Importante!
  targetField={assistantTargetField}
  onApply={(text) => {
    setFieldValue(assistantTargetField, text);
    setAssistantOpen(false);
  }}
  contextSummary={assistantContextSummary}
  presets={[
    { label: "Promocional" },
    { label: "Informativo" },
    { label: "Lembrete" },
    { label: "Pesquisa" },
  ]}
/>
```

### 🔧 **Melhorar Prompts do Backend:**

```typescript
// backend/src/services/IA/usecases/ChatAssistantService.ts

// Adicionar prompt específico para campanhas:
const getCampaignPrompt = (mode: string, text: string, context: any) => {
  const baseInstructions = `
Você é um especialista em copywriting para WhatsApp.
Sua tarefa é melhorar mensagens de campanhas.

Diretrizes:
- Use emojis moderadamente (1-2 por mensagem)
- Seja direto e persuasivo
- Máximo 160 caracteres se possível
- Call-to-action claro
- Tom profissional mas amigável
`;

  if (mode === "enhance") {
    return `${baseInstructions}

Melhore esta mensagem de campanha:
"${text}"

${context?.summary || ""}

Retorne APENAS a mensagem melhorada, sem explicações.`;
  }
  
  // ... outros modos
};
```

**Tempo estimado:** 1 hora

---

## 4. 🔘 Botões da API Oficial nas Filas

### ✅ **Como Implementar:**

Os botões da API Oficial são chamados de **Interactive Messages** (Buttons, Lists, Reply Buttons).

```typescript
// backend/src/services/WbotServices/SendWhatsAppMessageOfficial.ts

interface InteractiveButton {
  type: "reply";
  reply: {
    id: string;
    title: string;
  };
}

interface InteractiveMessage {
  type: "button" | "list";
  header?: {
    type: "text";
    text: string;
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: {
    buttons?: InteractiveButton[];
    button?: string; // Para lista
    sections?: Array<{
      title: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>;
  };
}

export const SendInteractiveMessage = async (
  phoneNumberId: string,
  accessToken: string,
  to: string,
  interactive: InteractiveMessage
) => {
  const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;
  
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive,
  };
  
  const { data } = await axios.post(url, payload, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  
  return data;
};
```

### 📋 **Adicionar nas Filas:**

```javascript
// frontend/src/components/QueueModal/index.js

// Adicionar campo para botões quando API Oficial:
{whatsapp?.channelType === "official" && (
  <Box>
    <Typography variant="subtitle2">Botões Interativos</Typography>
    
    <FormControlLabel
      control={
        <Checkbox
          checked={useButtons}
          onChange={(e) => setUseButtons(e.target.checked)}
        />
      }
      label="Usar botões nas mensagens automáticas"
    />
    
    {useButtons && (
      <Box>
        {buttons.map((btn, idx) => (
          <Box key={idx} display="flex" gap={1} mb={1}>
            <TextField
              label={`Botão ${idx + 1}`}
              value={btn.title}
              onChange={(e) => {
                const newButtons = [...buttons];
                newButtons[idx] = {
                  ...btn,
                  title: e.target.value,
                  id: e.target.value.toLowerCase().replace(/\s/g, "_")
                };
                setButtons(newButtons);
              }}
              size="small"
              fullWidth
            />
            <IconButton onClick={() => removeButton(idx)}>
              <DeleteIcon />
            </IconButton>
          </Box>
        ))}
        
        <Button
          size="small"
          onClick={() => setButtons([...buttons, { id: "", title: "" }])}
          disabled={buttons.length >= 3} // Max 3 botões
        >
          Adicionar Botão
        </Button>
        
        <FormHelperText>
          Máximo 3 botões. Títulos até 20 caracteres.
        </FormHelperText>
      </Box>
    )}
  </Box>
)}
```

**Tempo estimado:** 3-4 horas

---

## 5. 🤖 N8N (Não é Flowise!)

### ⚠️ **CORREÇÃO: Não é Flowise, é N8N**

O Whaticket tem integração com:
1. **N8N** (automação de workflows)
2. **Typebot** (chatbot visual)
3. **DialogFlow** (Google AI)

### 📚 **O que é N8N:**

N8N é uma ferramenta de **automação de workflows** similar a Zapier/Make.

**Onde configurar:**
```
Admin → Integrações → N8N
Admin → Filas → Configurar Fila → Tab "Integrações"
```

### 🎯 **O que o N8N pode fazer no Whaticket:**

1. **Receber webhooks quando:**
   - Cliente envia mensagem
   - Ticket é criado
   - Ticket muda de fila
   - Ticket é fechado

2. **Enviar dados para:**
   - CRMs externos
   - Google Sheets
   - Bancos de dados
   - APIs REST

3. **Processar:**
   - ✅ Texto
   - ✅ Imagens (pode analisar via APIs externas)
   - ✅ Áudios (pode transcrever via Whisper/Google)
   - ❌ Não responde nativamente em áudio

### 📋 **Exemplo de Workflow N8N:**

```
Fluxo:
1. Cliente envia áudio no WhatsApp
   ↓
2. Webhook N8N recebe
   ↓
3. N8N envia áudio para Whisper API (transcrição)
   ↓
4. N8N envia texto para ChatGPT
   ↓
5. ChatGPT responde
   ↓
6. N8N envia resposta de volta pro Whaticket
```

### 🔧 **Como Configurar:**

```javascript
// 1. Na fila, adicionar URL do N8N:
Filas → Editar → Tab "Integrações"
Tipo: N8N
URL: https://seu-n8n.com/webhook/whaticket
```

```javascript
// 2. No N8N, criar workflow:
Webhook (receive) 
  → Filter (condições)
  → HTTP Request (APIs externas)
  → HTTP Request (enviar resposta)
```

### 🎤 **Para Áudio:**

O N8N **não gera áudio nativamente**. Você precisa:

1. **Transcrever:** Whisper API (OpenAI) ou Google Speech-to-Text
2. **Processar:** ChatGPT/Gemini
3. **Gerar áudio:** ElevenLabs API ou Google Text-to-Speech
4. **Enviar:** Volta pro Whaticket via API

**Exemplo completo:**
```
Cliente → áudio
  ↓ Whaticket detecta áudio
  ↓ Envia para N8N webhook
  ↓ N8N → Whisper (transcreve)
  ↓ N8N → ChatGPT (processa)
  ↓ N8N → ElevenLabs (gera áudio)
  ↓ N8N → Whaticket API (envia áudio)
  ↓ Cliente recebe áudio de resposta
```

### 📚 **Diferenças:**

| Ferramenta | O que faz | Áudio | Imagem | Texto |
|------------|-----------|-------|--------|-------|
| **N8N** | Automação de workflows | Via APIs | Via APIs | ✅ |
| **Typebot** | Chatbot visual com fluxos | ❌ | ❌ | ✅ |
| **DialogFlow** | IA conversacional (Google) | ❌ | ❌ | ✅ |
| **Flowise** | **NÃO ESTÁ IMPLEMENTADO** | - | - | - |

---

## 📊 Resumo das Ações

| # | Item | Status | Tempo | Prioridade |
|---|------|--------|-------|------------|
| 1 | Templates Meta | ❌ Falta implementar | 2-3h | 🔴 ALTA |
| 2 | Preview iPhone | ❌ Falta implementar | 2-3h | 🟡 MÉDIA |
| 3 | Fix Assistente IA | ❌ Bug de contexto | 1h | 🔴 ALTA |
| 4 | Botões API Oficial | ❌ Falta implementar | 3-4h | 🟡 MÉDIA |
| 5 | N8N (já tem!) | ✅ Implementado | - | - |

**Total:** 8-11 horas de desenvolvimento

---

## 🚀 Prioridade Sugerida

1. **Fix Assistente IA** (1h) → Rápido e importante
2. **Templates Meta** (2-3h) → Essencial para API Oficial
3. **Preview iPhone** (2-3h) → Melhora UX
4. **Botões Interativos** (3-4h) → Diferencial competitivo

---

## 📞 Próximos Passos

Quer que eu implemente alguma dessas melhorias agora?

1. Fix do Assistente IA (mais rápido)
2. Preview de mensagens
3. Integração com templates da Meta
4. Tudo junto (8-11h)

**Me avise qual prefere!** 🚀
