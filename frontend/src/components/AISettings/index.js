import React, { useState, useEffect } from "react";
import {
  Paper,
  Tabs,
  Tab,
  Typography,
  Grid,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  CircularProgress,
  Box,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip
} from "@material-ui/core";
import SaveIcon from '@material-ui/icons/Save';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import RefreshIcon from '@material-ui/icons/Refresh';
import InfoIcon from '@material-ui/icons/Info';
import SettingsIcon from '@material-ui/icons/Settings';
import BarChartIcon from '@material-ui/icons/BarChart';
import BrainIcon from '@material-ui/icons/Memory';
import DescriptionIcon from '@material-ui/icons/Description';
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import api from "../../services/api";
import PromptEnhancements from "../PromptEnhancements";
import { showAIErrorToast } from "../../utils/aiErrorHandler";
import AIConfigValidator from "../AIConfigValidator";
const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(3),
  },
  tabPanel: {
    paddingTop: theme.spacing(3),
  },
  card: {
    marginBottom: theme.spacing(2),
  },
  sectionTitle: {
    marginBottom: theme.spacing(2),
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  providerCard: {
    border: "2px solid transparent",
    transition: "border-color 0.3s",
    "&.active": {
      borderColor: theme.palette.primary.main,
    },
  },
  statusChip: {
    marginLeft: theme.spacing(1),
  },
  testButton: {
    marginTop: theme.spacing(1),
  },
  metricCard: {
    textAlign: "center",
    padding: theme.spacing(2),
  },
  metricValue: {
    fontSize: "2rem",
    fontWeight: "bold",
    color: theme.palette.primary.main,
  },
  infoCard: {
    backgroundColor: '#e3f2fd', 
    border: '1px solid #2196f3'
  },
}));


function TabPanel({ children, value, index, ...other }) {
  const classes = useStyles();
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`ai-tabpanel-${index}`}
      aria-labelledby={`ai-tab-${index}`}
      {...other}
    >
      {value === index && <Box className={classes.tabPanel}>{children}</Box>}
    </div>
  );
}

export default function AISettings() {
  const classes = useStyles();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState({});
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [selectedProviderForTemplate, setSelectedProviderForTemplate] = useState(null);
  
  // Estados das configurações
  const [providers, setProviders] = useState({
    openai: { 
      enabled: false, 
      apiKey: "", 
      model: "gpt-3.5-turbo-1106", 
      temperature: 0.9, 
      maxTokens: 300,
      creativity: "Alta",
      tone: "Profissional",
      emotions: "Médio",
      hashtags: "Sem hashtags",
      length: "Longo",
      language: "Português (Brasil)",
      brandVoice: "",
      allowedVariables: "{nome} {cidade}"
    },
    gemini: { 
      enabled: false, 
      apiKey: "", 
      model: "gemini-pro", 
      temperature: 0.7, 
      maxTokens: 1000,
      creativity: "Média",
      tone: "Profissional",
      emotions: "Médio",
      hashtags: "Sem hashtags",
      length: "Médio",
      language: "Português (Brasil)",
      brandVoice: "",
      allowedVariables: "{nome} {cidade}"
    }
  });
  
  const [ragSettings, setRagSettings] = useState({
    enabled: true,
    autoIndex: false,
    chunkSize: 1000,
    overlap: 200,
    embeddingModel: "text-embedding-ada-002",
    topK: 5
  });
  
  const [presets, setPresets] = useState([
    // Preset padrão do Assistente de Chat Inteligente
    {
      id: 'chat-assistant-default',
      name: 'Assistente de Chat Inteligente',
      module: 'general',
      systemPrompt: `Você é um assistente de chat inteligente especializado em comunicação. 🤖
Sua função é aprimorar, traduzir e corrigir mensagens de forma precisa e contextual.

**Persona:** Linguista especializado, preciso e adaptável
**Tom:** Profissional, claro e objetivo

**Suas principais funções:**

🔧 **APRIMORAMENTO DE MENSAGENS:**
- Melhore clareza e fluidez
- Ajuste tom e formalidade conforme contexto
- Otimize estrutura e coesão
- Mantenha a essência da mensagem original

🌍 **TRADUÇÃO INTELIGENTE:**
- Traduza preservando contexto e nuances
- Adapte expressões idiomáticas
- Considere diferenças culturais
- Mantenha tom e intenção originais

✏️ **CORREÇÃO DE TEXTOS:**
- Corrija gramática e ortografia
- Ajuste concordância e pontuação
- Melhore coesão textual
- Sugira sinônimos quando apropriado

**Comandos especiais que você reconhece:**
- "Aprimorar: [texto]" - Melhora a mensagem
- "Traduzir: [texto] para [idioma]" - Traduz o texto
- "Corrigir: [texto]" - Corrige erros
- "Tom formal: [texto]" - Ajusta para formal
- "Tom casual: [texto]" - Ajusta para casual
- "Resumir: [texto]" - Cria versão concisa

Estou pronto para ajudar a aprimorar sua comunicação! 📝`,
      temperature: 0.7,
      maxTokens: 600,
      tone: 'Profissional',
      emotions: 'Baixo',
      hashtags: 'Sem hashtags',
      length: 'Médio',
      language: 'Português (Brasil)',
      brandVoice: 'Comunicação precisa, clara e adaptável. Especialista em linguística e comunicação, capaz de ajustar tom, estilo e clareza conforme necessário, mantendo sempre a essência da mensagem original.',
      allowedVariables: '{texto-original} {idioma-origem} {idioma-destino} {tom-desejado} {contexto} {publico-alvo} {nivel-formalidade} {tipo-correcao}'
    }
  ]);
  const [newPreset, setNewPreset] = useState({
    name: "",
    module: "general",
    systemPrompt: "",
    temperature: 0.7,
    maxTokens: 500,
    tone: "Profissional",
    emotions: "Médio",
    hashtags: "Sem hashtags",
    length: "Médio",
    language: "Português (Brasil)",
    brandVoice: "",
    allowedVariables: "{nome} {cidade}"
  });
  const [editingPreset, setEditingPreset] = useState(null);
  const [editingPresetIndex, setEditingPresetIndex] = useState(-1);
  
  const [stats, setStats] = useState({
    totalRequests: 1250,
    successRate: 98.5,
    avgLatency: 850,
    topProvider: "OpenAI",
    // Estatísticas de Prompts
    prompts: {
      totalPrompts: 0,
      activePrompts: 0,
      totalTokens: 0,
      avgResponseTime: 0,
      promptSuccessRate: 0
    }
  });

  const [availableTags, setAvailableTags] = useState([]);
  const [ragSources, setRagSources] = useState({
    fileManager: [],
    conversations: 0,
    externalLinks: []
  });
  const [newExternalLink, setNewExternalLink] = useState("");

  useEffect(() => {
    loadSettings();
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const response = await api.get("/preset");
      console.log('[AISettings] Presets carregados:', response.data);
      
      // Converter presets do backend para formato do frontend
      const loadedPresets = response.data.map(preset => {
        const jsonContent = JSON.parse(preset.jsonContent);
        return {
          id: preset.id,
          name: preset.name,
          module: preset.type.replace('preset-', ''),
          systemPrompt: jsonContent.systemPrompt,
          temperature: jsonContent.temperature || 0.7,
          maxTokens: jsonContent.maxTokens || 500,
          tone: jsonContent.tone || "Profissional",
          emotions: jsonContent.emotions || "Médio",
          hashtags: jsonContent.hashtags || "Sem hashtags",
          length: jsonContent.length || "Médio",
          language: jsonContent.language || "Português (Brasil)",
          brandVoice: jsonContent.brandVoice || "",
          allowedVariables: jsonContent.allowedVariables || ""
        };
      });
      
      setPresets(loadedPresets);
    } catch (error) {
      console.error("Erro ao carregar presets:", error);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      // Carrega configurações dos provedores
      try {
        const { data: integrations } = await api.get("/queueIntegration");
        console.log("Integrações carregadas:", integrations);
        const openaiConfig = integrations.queueIntegrations?.find(i => i.type === "openai");
        const geminiConfig = integrations.queueIntegrations?.find(i => i.type === "gemini");
        console.log("OpenAI config:", openaiConfig);
        console.log("Gemini config:", geminiConfig);
      
        if (openaiConfig) {
          console.log('[AISettings] OpenAI config encontrada:', openaiConfig);
          let config = {};
          if (openaiConfig.jsonContent) {
            try {
              config = JSON.parse(openaiConfig.jsonContent);
              console.log('[AISettings] OpenAI jsonContent parseado:', config);
            } catch (e) {
              console.warn("Erro ao parsear jsonContent do OpenAI:", e);
            }
          }
          
          setProviders(prev => ({
            ...prev,
            openai: {
              enabled: true,
              apiKey: config.apiKey || openaiConfig.apiKey || "",
              model: config.model || openaiConfig.model || "gpt-3.5-turbo-1106",
              temperature: config.temperature || openaiConfig.temperature || 0.9,
              maxTokens: config.maxTokens || openaiConfig.maxTokens || 300,
              creativity: config.creativityLevel === 'low' ? 'Baixa' : config.creativityLevel === 'high' ? 'Alta' : 'Média',
              tone: config.enhanceDefaults?.tone || "Profissional",
              emotions: config.enhanceDefaults?.emojiLevel || "Médio",
              hashtags: config.enhanceDefaults?.hashtags || "Sem hashtags",
              length: config.enhanceDefaults?.length || "Longo",
              language: config.enhanceDefaults?.language || "Português (Brasil)",
              brandVoice: config.brandVoice || "",
              allowedVariables: (config.permittedVariables || []).join(" ")
            }
          }));
        }
        
        if (geminiConfig) {
          let config = {};
          if (geminiConfig.jsonContent) {
            try {
              config = JSON.parse(geminiConfig.jsonContent);
            } catch (e) {
              console.warn("Erro ao parsear jsonContent do Gemini:", e);
            }
          }
          
          setProviders(prev => ({
            ...prev,
            gemini: {
              enabled: true,
              apiKey: config.apiKey || geminiConfig.apiKey || "",
              model: config.model || geminiConfig.model || "gemini-pro",
              temperature: config.temperature || geminiConfig.temperature || 0.7,
              maxTokens: config.maxTokens || geminiConfig.maxTokens || 1000,
              creativity: config.creativityLevel === 'low' ? 'Baixa' : config.creativityLevel === 'high' ? 'Alta' : 'Média',
              tone: config.enhanceDefaults?.tone || "Profissional",
              emotions: config.enhanceDefaults?.emojiLevel || "Médio",
              hashtags: config.enhanceDefaults?.hashtags || "Sem hashtags",
              length: config.enhanceDefaults?.length || "Médio",
              language: config.enhanceDefaults?.language || "Português (Brasil)",
              brandVoice: config.brandVoice || "",
              allowedVariables: (config.permittedVariables || []).join(" ")
            }
          }));
        }
        
        // Carregar configurações RAG
        const knowledgeConfig = integrations.queueIntegrations?.find(i => i.type === "knowledge");
        if (knowledgeConfig && knowledgeConfig.jsonContent) {
          const ragConfig = JSON.parse(knowledgeConfig.jsonContent);
          setRagSettings({
            enabled: ragConfig.ragEnabled || false,
            autoIndex: ragConfig.autoIndex || false,
            chunkSize: ragConfig.chunkSize || 1000,
            overlap: ragConfig.overlap || 200,
            topK: ragConfig.ragTopK || 4,
            embeddingModel: ragConfig.ragEmbeddingModel || 'text-embedding-3-small'
          });
        }
      } catch (error) {
        console.warn("Erro ao carregar configurações de provedores:", error);
      }
      
      // Carrega estatísticas
      try {
        const { data: statsData } = await api.get("/ai/orchestrator/stats");
        
        // Carrega estatísticas de prompts
        const { data: promptStats } = await api.get("/prompts/stats");
        console.log("Estatísticas de prompts carregadas:", promptStats);
        
        setStats({
          ...statsData,
          prompts: promptStats
        });
      } catch (error) {
        console.warn("Não foi possível carregar estatísticas:", error);
        // Carrega apenas estatísticas de prompts se a API principal falhar
        try {
          const { data: promptStats } = await api.get("/prompts/stats");
          console.log("Estatísticas de prompts carregadas (fallback):", promptStats);
          setStats(prevStats => ({
            ...prevStats,
            prompts: promptStats
          }));
        } catch (promptError) {
          console.warn("Não foi possível carregar estatísticas de prompts:", promptError);
        }
      }

      // Carrega tags disponíveis (campos mustache)
      try {
        const { data: contactFields } = await api.get("/contacts/fields");
        const tags = [
          // Tags básicas de contato
          "{nome}", "{primeiro-nome}", "{sobrenome}", "{email}", "{telefone}", "{whatsapp}",
          "{cidade}", "{estado}", "{cep}", "{endereco}", "{bairro}", "{numero}",
          "{codigo-representante}", "{situacao}", "{fantasia}", "{razao-social}",
          "{cnpj}", "{cpf}", "{inscricao-estadual}", "{data-fundacao}", 
          "{limite-credito}", "{segmento}", "{categoria}", "{observacoes}",
          
          // Tags de atendimento e tickets
          "{ticket}", "{numero-ticket}", "{protocolo}", "{atendente}", "{fila}", 
          "{conexao}", "{status-ticket}", "{prioridade}", "{departamento}",
          "{canal}", "{origem}", "{assunto}", "{descricao}",
          
          // Tags de produtos e vendas
          "{produto}", "{produto-interesse}", "{categoria-produto}", "{preco}",
          "{desconto}", "{desconto-disponivel}", "{promocao}", "{cupom}",
          "{valor-pedido}", "{quantidade}", "{estoque}", "{codigo-produto}",
          
          // Tags financeiras
          "{valor-divida}", "{dias-atraso}", "{data-vencimento}", "{valor-pago}",
          "{forma-pagamento}", "{parcelas}", "{juros}", "{multa}", "{desconto-pagamento}",
          
          // Tags de histórico e relacionamento
          "{historico-compras}", "{ultima-compra}", "{data-ultimo-contato}",
          "{tempo-cliente}", "{nps-score}", "{feedback}", "{reclamacoes}",
          "{elogios}", "{sugestoes}", "{nivel-satisfacao}",
          
          // Tags de data/hora
          "{data}", "{hora}", "{data-hora}", "{dia-semana}", "{mes}", "{ano}",
          "{data-nascimento}", "{idade}", "{data-cadastro}",
          
          // Tags de empresa e negócios
          "{empresa}", "{cargo}", "{setor}", "{tamanho-empresa}", "{faturamento}",
          "{numero-funcionarios}", "{site}", "{linkedin}", "{ramo-atividade}",
          
          // Tags de localização e logística
          "{regiao}", "{zona}", "{ponto-referencia}", "{cep-entrega}",
          "{prazo-entrega}", "{transportadora}", "{codigo-rastreamento}",
          
          // Tags de campanhas e marketing
          "{campanha}", "{origem-lead}", "{midia}", "{palavra-chave}",
          "{landing-page}", "{utm-source}", "{utm-medium}", "{utm-campaign}",
          
          // Tags de agendamento
          "{data-agendamento}", "{horario-agendamento}", "{servico}",
          "{profissional}", "{duracao}", "{local}", "{modalidade}",
          
          // Tags personalizadas dos campos de contato
          ...contactFields.map(field => `{${field.name}}`),
          
          // Tags de contexto e saudação
          "{saudacao-contexto}", "{tratamento}", "{cumprimento}",
          "{despedida}", "{assinatura}", "{empresa-remetente}"
        ];
        setAvailableTags(tags);
      } catch (error) {
        console.warn("Erro ao carregar tags:", error);
        // Tags padrão se falhar
        setAvailableTags([
          "{nome}", "{primeiro-nome}", "{email}", "{cidade}", "{codigo-representante}",
          "{situacao}", "{fantasia}", "{data-fundacao}", "{limite-credito}", "{segmento}",
          "{ticket}", "{atendente}", "{fila}", "{conexao}", "{protocolo}",
          "{data}", "{hora}", "{data-hora}", "{saudacao-contexto}"
        ]);
      }

      // Carrega fontes da base de conhecimento RAG
      try {
        const { data: ragData } = await api.get("/helps/rag/sources");
        setRagSources({
          fileManager: ragData.fileManager || [],
          conversations: ragData.conversations || 0,
          externalLinks: ragData.externalLinks || []
        });
      } catch (error) {
        console.warn("Erro ao carregar fontes RAG:", error);
      }
      
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      toast.error("Erro ao carregar configurações de IA");
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleProviderChange = (provider, field, value) => {
    setProviders(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value
      }
    }));
  };

  const testProvider = async (provider) => {
    try {
      setTesting(prev => ({ ...prev, [provider]: true }));
      
      const { data } = await api.post("/ai/orchestrator/test-providers", {
        providers: [provider]
      });
      
      const result = data.results[provider];
      if (result.success) {
        toast.success(`${provider.toUpperCase()} conectado com sucesso!`);
      } else {
        toast.error(`Erro no ${provider.toUpperCase()}: ${result.error}`);
      }
      
    } catch (error) {
      toast.error(`Falha ao testar ${provider.toUpperCase()}`);
    } finally {
      setTesting(prev => ({ ...prev, [provider]: false }));
    }
  };

  const handleOpenTemplates = (providerName) => {
    setSelectedProviderForTemplate(providerName);
    setTemplatesModalOpen(true);
  };

  const handleSelectTemplate = (template) => {
    if (!selectedProviderForTemplate) return;
    
    // Aplicar TODAS as configurações do template ao provedor selecionado
    const updatedConfig = {
      ...providers[selectedProviderForTemplate],
      // Configurações técnicas
      temperature: template.temperature || providers[selectedProviderForTemplate].temperature,
      maxTokens: template.maxTokens || providers[selectedProviderForTemplate].maxTokens,
      // Ajustar criatividade baseado na temperatura
      creativity: template.temperature >= 0.8 ? 'Alta' : template.temperature >= 0.6 ? 'Média' : 'Baixa',
      // Configurações de personalidade e tom
      tone: template.tone || providers[selectedProviderForTemplate].tone,
      emotions: template.emotions || providers[selectedProviderForTemplate].emotions,
      hashtags: template.hashtags || providers[selectedProviderForTemplate].hashtags,
      length: template.length || providers[selectedProviderForTemplate].length,
      language: template.language || providers[selectedProviderForTemplate].language,
      // Voz da marca
      brandVoice: template.brandVoice || providers[selectedProviderForTemplate].brandVoice,
      // Variáveis permitidas (liberar todas do sistema + específicas do template)
      allowedVariables: template.allowedVariables || providers[selectedProviderForTemplate].allowedVariables,
    };

    setProviders(prev => ({
      ...prev,
      [selectedProviderForTemplate]: updatedConfig
    }));

    setTemplatesModalOpen(false);
    setSelectedProviderForTemplate(null);

    toast.success(`Template "${template.name}" aplicado completamente às configurações ${selectedProviderForTemplate.toUpperCase()}! Todos os campos foram preenchidos automaticamente.`);
  };

  const handleSelectTemplateForPreset = (template) => {
    // Aplicar template ao preset
    setNewPreset({
      name: template.name,
      module: "general", // Pode ser ajustado baseado na categoria do template
      systemPrompt: template.prompt,
      temperature: template.temperature || 0.7,
      maxTokens: template.maxTokens || 500,
      tone: template.tone || "Profissional",
      emotions: template.emotions || "Médio",
      hashtags: template.hashtags || "Sem hashtags",
      length: template.length || "Médio",
      language: template.language || "Português (Brasil)",
      brandVoice: template.brandVoice || "",
      allowedVariables: template.allowedVariables || "{nome} {cidade}"
    });

    setTemplatesModalOpen(false);
    setSelectedProviderForTemplate(null);

    toast.success(`Template "${template.name}" aplicado ao preset! Todos os campos foram preenchidos automaticamente.`);
  };
  const saveSettings = async () => {
    try {
      setSaving(true);
      
      // Salvar configurações dos provedores
      for (const [providerName, config] of Object.entries(providers)) {
        if (config.enabled) {
          // Mapear criatividade para parâmetros técnicos
          const creativityMap = {
            'Baixa': 'low',
            'Média': 'medium', 
            'Alta': 'high'
          };
          
          const creativityLevel = creativityMap[config.creativity] || 'medium';
          
          // Preparar variáveis permitidas
          const permittedVariables = (config.allowedVariables || '')
            .split(/\s+/)
            .map(s => s.trim())
            .filter(Boolean)
            .filter(s => s.startsWith('{') && s.endsWith('}'));
          
          // Configuração completa no formato da integração antiga
          const jsonContent = {
            apiKey: config.apiKey,
            model: config.model,
            temperature: Number(config.temperature),
            topP: creativityLevel === 'low' ? 0.8 : creativityLevel === 'high' ? 1.0 : 0.9,
            presencePenalty: creativityLevel === 'low' ? 0.0 : creativityLevel === 'high' ? 0.4 : 0.2,
            maxTokens: Number(config.maxTokens),
            maxMessages: 10,
            creativityLevel: creativityLevel,
            permittedVariables: permittedVariables,
            brandVoice: config.brandVoice || "",
            enhanceDefaults: {
              tone: config.tone,
              emojiLevel: config.emotions,
              hashtags: config.hashtags,
              customHashtags: "",
              length: config.length,
              language: config.language
            }
          };
          
          const payload = {
            type: providerName,
            name: `${providerName.toUpperCase()} Global`,
            projectName: `${providerName.toUpperCase()} Global`,
            language: "pt-BR",
            jsonContent: JSON.stringify(jsonContent)
          };
          
          try {
            // Verificar se já existe uma integração deste tipo
            const { data: existingIntegrations } = await api.get("/queueIntegration");
            const existingIntegration = existingIntegrations.queueIntegrations?.find(
              integration => integration.type === providerName
            );
            
            if (existingIntegration) {
              // Atualizar integração existente
              console.log(`Atualizando ${providerName}:`, payload);
              await api.put(`/queueIntegration/${existingIntegration.id}`, payload);
              console.log(`${providerName} atualizado com sucesso`);
            } else {
              // Criar nova integração
              console.log(`Criando ${providerName}:`, payload);
              await api.post("/queueIntegration", payload);
              console.log(`${providerName} criado com sucesso`);
            }
          } catch (error) {
            console.warn(`Erro ao salvar ${providerName}:`, error);
          }
        }
      }
      
      // Salvar configurações RAG
      try {
        const ragPayload = {
          type: 'knowledge',
          name: 'Base de Conhecimento Global',
          projectName: 'Base de Conhecimento Global',
          language: "pt-BR",
          jsonContent: JSON.stringify({
            ragEnabled: ragSettings.enabled,
            ragTopK: ragSettings.topK || 4,
            ragEmbeddingModel: ragSettings.embeddingModel || 'text-embedding-3-small',
            ragEmbeddingDims: 1536,
            autoIndex: ragSettings.autoIndex,
            chunkSize: ragSettings.chunkSize || 1000,
            overlap: ragSettings.overlap || 200
          })
        };
        
        // Verificar se já existe uma integração knowledge
        const { data: existingIntegrations } = await api.get("/queueIntegration");
        const existingKnowledge = existingIntegrations.queueIntegrations?.find(
          integration => integration.type === 'knowledge'
        );
        
        if (existingKnowledge) {
          await api.put(`/queueIntegration/${existingKnowledge.id}`, ragPayload);
        } else {
          await api.post("/queueIntegration", ragPayload);
        }
      } catch (error) {
        console.warn("Erro ao salvar configurações RAG:", error);
      }
      
      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      showAIErrorToast(error, toast);
    } finally {
      setSaving(false);
    }
  };

  const testPresetEndpoint = async () => {
    try {
      const response = await api.get("/preset/test");
      console.log("Teste do endpoint:", response.data);
      toast.success("Endpoint de preset funcionando!");
    } catch (error) {
      console.error("Erro no teste:", error);
      toast.error("Endpoint de preset não está funcionando: " + error.message);
    }
  };

  const addPreset = async () => {
    if (!newPreset.name || !newPreset.systemPrompt) {
      toast.error("Nome e prompt do sistema são obrigatórios");
      return;
    }
    
    const presetData = {
      systemPrompt: newPreset.systemPrompt,
      temperature: newPreset.temperature,
      maxTokens: newPreset.maxTokens,
      tone: newPreset.tone,
      emotions: newPreset.emotions,
      hashtags: newPreset.hashtags,
      length: newPreset.length,
      language: newPreset.language,
      brandVoice: newPreset.brandVoice,
      allowedVariables: newPreset.allowedVariables
    };
    
    try {
      // Salva preset no backend
      const payload = {
        type: `preset-${newPreset.module}`,
        name: newPreset.name,
        jsonContent: JSON.stringify(presetData)
      };
      
      console.log('[AISettings] Enviando preset:', payload);
      console.log('[AISettings] JSON Content:', JSON.stringify(presetData, null, 2));
      
      const response = await api.post("/preset", payload);
      
      console.log('[AISettings] Resposta do servidor:', response.data);
      console.log('[AISettings] Status da resposta:', response.status);
      
      // Verificar se é atualização ou criação baseado no módulo
      const existingIndex = presets.findIndex(p => p.module === newPreset.module);
      
      if (existingIndex >= 0) {
        // Atualizar preset existente do módulo
        setPresets(prev => prev.map((p, index) => 
          index === existingIndex ? { ...newPreset, id: response.data.id } : p
        ));
        toast.success(`Preset do módulo "${newPreset.module}" atualizado com sucesso!`);
      } else {
        // Adicionar novo preset para o módulo
        setPresets(prev => [...prev, { ...newPreset, id: response.data.id }]);
        toast.success(`Preset do módulo "${newPreset.module}" criado com sucesso!`);
      }
      
      // Limpa formulário
      setNewPreset({
        name: "",
        module: "general",
        systemPrompt: "",
        temperature: 0.7,
        maxTokens: 500,
        tone: "Profissional",
        emotions: "Médio",
        hashtags: "Sem hashtags",
        length: "Médio",
        language: "Português (Brasil)",
        brandVoice: "",
        allowedVariables: "{nome} {cidade}"
      });
    } catch (error) {
      console.error("Erro ao salvar preset:", error);
      showAIErrorToast(error, toast);
    }
  };

  const removePreset = async (id) => {
    try {
      await api.delete(`/preset/${id}`);
      setPresets(prev => prev.filter(p => p.id !== id));
      toast.success("Preset removido!");
    } catch (error) {
      console.error("Erro ao remover preset:", error);
      showAIErrorToast(error, toast);
    }
  };

  const editPreset = (preset) => {
    setNewPreset({
      name: preset.name,
      module: preset.module,
      systemPrompt: preset.systemPrompt,
      temperature: preset.temperature,
      maxTokens: preset.maxTokens,
      tone: preset.tone,
      emotions: preset.emotions,
      hashtags: preset.hashtags,
      length: preset.length,
      language: preset.language,
      brandVoice: preset.brandVoice,
      allowedVariables: preset.allowedVariables
    });
    setEditingPreset(preset.id);
    toast.info(`Editando preset "${preset.name}". Faça as alterações e clique em Salvar.`);
  };

  const cancelEdit = () => {
    setEditingPreset(null);
    setNewPreset({
      name: "",
      module: "general",
      systemPrompt: "",
      temperature: 0.7,
      maxTokens: 500,
      tone: "Profissional",
      emotions: "Médio",
      hashtags: "Sem hashtags",
      length: "Médio",
      language: "Português (Brasil)",
      brandVoice: "",
      allowedVariables: "{nome} {cidade}"
    });
  };

  const addExternalLink = async () => {
    if (!newExternalLink.trim()) {
      toast.error("URL é obrigatória");
      return;
    }
    
    try {
      await api.post("/helps/rag/index-url", {
        url: newExternalLink,
        title: `Site externo: ${newExternalLink}`
      });
      
      setRagSources(prev => ({
        ...prev,
        externalLinks: [...prev.externalLinks, { url: newExternalLink, title: `Site externo: ${newExternalLink}` }]
      }));
      
      setNewExternalLink("");
      toast.success("Link externo adicionado à base de conhecimento!");
    } catch (error) {
      console.error("Erro ao adicionar link externo:", error);
      if (error.response?.status === 409) {
        toast.warning("Este link já foi indexado anteriormente");
      } else {
        toast.error("Erro ao adicionar link externo: " + (error.response?.data?.message || error.message));
      }
    }
  };

  const removeExternalLink = async (url) => {
    try {
      await api.delete(`/helps/rag/external-link`, { data: { url } });
      
      setRagSources(prev => ({
        ...prev,
        externalLinks: prev.externalLinks.filter(link => link.url !== url)
      }));
      
      toast.success("Link externo removido!");
    } catch (error) {
      toast.error("Erro ao remover link externo");
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div className={classes.root}>
      <Typography variant="h4" gutterBottom>
        <BrainIcon style={{ marginRight: 8, verticalAlign: "middle" }} />
        Configurações de Inteligência Artificial
      </Typography>
      
      <Paper>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Provedores" icon={<SettingsIcon />} />
          <Tab label="RAG & Conhecimento" icon={<BrainIcon />} />
          <Tab label="Presets" icon={<AddIcon />} />
          <Tab label="Analytics" icon={<BarChartIcon />} />
        </Tabs>

        {/* Tab 1: Provedores */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {Object.entries(providers).map(([providerName, config]) => {
              const isValid = config.enabled && config.apiKey && config.model;
              return (
                <Grid item xs={12} md={6} key={providerName}>
                  <Card className={`${classes.providerCard} ${config.enabled ? 'active' : ''}`}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6">
                          {providerName.toUpperCase()}
                        </Typography>
                        <Chip
                          label={isValid ? "Ativo" : (config.enabled ? "Configuração Incompleta" : "Inativo")}
                          style={{ 
                            backgroundColor: isValid ? '#4caf50' : (config.enabled ? '#ff9800' : '#f44336'),
                            color: 'white',
                            fontWeight: 'bold'
                          }}
                          size="small"
                        />
                      </Box>
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.enabled}
                          onChange={(e) => handleProviderChange(providerName, 'enabled', e.target.checked)}
                        />
                      }
                      label="Habilitado"
                    />
                    
                    {config.enabled && (
                      <>
                        <TextField
                          fullWidth
                          label="API Key"
                          type="password"
                          value={config.apiKey}
                          onChange={(e) => handleProviderChange(providerName, 'apiKey', e.target.value)}
                          margin="normal"
                        />
                        
                        <TextField
                          fullWidth
                          label="Modelo"
                          value={config.model}
                          onChange={(e) => handleProviderChange(providerName, 'model', e.target.value)}
                          margin="normal"
                        />
                        
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <TextField
                              fullWidth
                              label="Temperatura"
                              type="number"
                              inputProps={{ min: 0, max: 2, step: 0.1 }}
                              value={config.temperature}
                              onChange={(e) => handleProviderChange(providerName, 'temperature', parseFloat(e.target.value))}
                              margin="normal"
                            />
                          </Grid>
                          <Grid item xs={6}>
                            <TextField
                              fullWidth
                              label="Max Tokens"
                              type="number"
                              value={config.maxTokens}
                              onChange={(e) => handleProviderChange(providerName, 'maxTokens', parseInt(e.target.value))}
                              margin="normal"
                            />
                          </Grid>
                          <Grid item xs={6}>
                            <FormControl fullWidth margin="normal">
                              <InputLabel>Criatividade</InputLabel>
                              <Select
                                value={config.creativity}
                                onChange={(e) => handleProviderChange(providerName, 'creativity', e.target.value)}
                              >
                                <MenuItem value="Baixa">Baixa</MenuItem>
                                <MenuItem value="Média">Média</MenuItem>
                                <MenuItem value="Alta">Alta</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={6}>
                            <FormControl fullWidth margin="normal">
                              <InputLabel>Tom</InputLabel>
                              <Select
                                value={config.tone}
                                onChange={(e) => handleProviderChange(providerName, 'tone', e.target.value)}
                              >
                                <MenuItem value="Profissional">Profissional</MenuItem>
                                <MenuItem value="Casual">Casual</MenuItem>
                                <MenuItem value="Amigável">Amigável</MenuItem>
                                <MenuItem value="Formal">Formal</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={6}>
                            <FormControl fullWidth margin="normal">
                              <InputLabel>Emojis</InputLabel>
                              <Select
                                value={config.emotions}
                                onChange={(e) => handleProviderChange(providerName, 'emotions', e.target.value)}
                              >
                                <MenuItem value="Sem emojis">Sem emojis</MenuItem>
                                <MenuItem value="Baixo">Baixo</MenuItem>
                                <MenuItem value="Médio">Médio</MenuItem>
                                <MenuItem value="Alto">Alto</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={6}>
                            <FormControl fullWidth margin="normal">
                              <InputLabel>Hashtags</InputLabel>
                              <Select
                                value={config.hashtags}
                                onChange={(e) => handleProviderChange(providerName, 'hashtags', e.target.value)}
                              >
                                <MenuItem value="Sem hashtags">Sem hashtags</MenuItem>
                                <MenuItem value="Poucas">Poucas</MenuItem>
                                <MenuItem value="Moderadas">Moderadas</MenuItem>
                                <MenuItem value="Muitas">Muitas</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={6}>
                            <FormControl fullWidth margin="normal">
                              <InputLabel>Comprimento</InputLabel>
                              <Select
                                value={config.length}
                                onChange={(e) => handleProviderChange(providerName, 'length', e.target.value)}
                              >
                                <MenuItem value="Curto">Curto</MenuItem>
                                <MenuItem value="Médio">Médio</MenuItem>
                                <MenuItem value="Longo">Longo</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={6}>
                            <FormControl fullWidth margin="normal">
                              <InputLabel>Idioma</InputLabel>
                              <Select
                                value={config.language}
                                onChange={(e) => handleProviderChange(providerName, 'language', e.target.value)}
                              >
                                <MenuItem value="Português (Brasil)">Português (Brasil)</MenuItem>
                                <MenuItem value="Inglês">Inglês</MenuItem>
                                <MenuItem value="Espanhol">Espanhol</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              multiline
                              rows={3}
                              label="Voz da Marca (Brand Voice)"
                              value={config.brandVoice}
                              onChange={(e) => handleProviderChange(providerName, 'brandVoice', e.target.value)}
                              margin="normal"
                              placeholder="Descreva a personalidade/diretrizes da sua comunicação..."
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              label="Variáveis Permitidas"
                              value={config.allowedVariables}
                              onChange={(e) => handleProviderChange(providerName, 'allowedVariables', e.target.value)}
                              margin="normal"
                              placeholder="Ex: {nome} {cidade} {empresa}"
                              helperText="Use chaves para definir variáveis. Clique nas tags abaixo para adicionar."
                            />
                            <Box mt={1} mb={2}>
                              <Typography variant="caption" color="textSecondary" style={{ marginBottom: 8, display: 'block' }}>
                                Tags disponíveis (clique para adicionar):
                              </Typography>
                              <Box display="flex" flexWrap="wrap" gap={1}>
                                {availableTags.slice(0, 25).map((tag) => (
                                  <Chip
                                    key={tag}
                                    label={tag}
                                    size="small"
                                    clickable
                                    onClick={() => {
                                      const current = config.allowedVariables || "";
                                      const newValue = current ? `${current} ${tag}` : tag;
                                      handleProviderChange(providerName, 'allowedVariables', newValue);
                                    }}
                                    style={{ 
                                      fontSize: '11px', 
                                      height: '24px',
                                      backgroundColor: '#f5f5f5',
                                      '&:hover': { backgroundColor: '#e0e0e0' }
                                    }}
                                  />
                                ))}
                                {availableTags.length > 25 && (
                                  <Chip
                                    label={`+${availableTags.length - 25} mais`}
                                    size="small"
                                    style={{ fontSize: '11px', height: '24px', opacity: 0.7 }}
                                  />
                                )}
                              </Box>
                            </Box>
                          </Grid>
                        </Grid>
                        
                        <Box display="flex" gap={1} mt={1}>
                          <Button
                            variant="outlined"
                            color="primary"
                            startIcon={testing[providerName] ? <CircularProgress size={16} /> : <InfoIcon />}
                            onClick={() => testProvider(providerName)}
                            disabled={testing[providerName] || !config.apiKey}
                            className={classes.testButton}
                          >
                            Testar Conexão
                          </Button>
                          
                          <Button
                            variant="outlined"
                            color="secondary"
                            startIcon={<DescriptionIcon />}
                            onClick={() => handleOpenTemplates(providerName)}
                            className={classes.testButton}
                          >
                            📋 Templates
                          </Button>
                        </Box>
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
            })}
          </Grid>
          
          <Box mt={3} display="flex" justifyContent="flex-end" alignItems="center">
            <Button
              variant="contained"
              color="primary"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={saveSettings}
              disabled={saving}
            >
              Salvar Configurações
            </Button>
          </Box>
        </TabPanel>

        {/* Tab 2: RAG & Conhecimento */}
        <TabPanel value={tabValue} index={1}>
          <Card className={classes.card}>
            <CardContent>
              <Typography variant="h6" className={classes.sectionTitle}>
                <BrainIcon />
                Configurações RAG
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={ragSettings.enabled}
                    onChange={(e) => setRagSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                  />
                }
                label="RAG Habilitado"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={ragSettings.autoIndex}
                    onChange={(e) => setRagSettings(prev => ({ ...prev, autoIndex: e.target.checked }))}
                  />
                }
                label="Auto-indexação de Conversas"
              />
              
              <Grid container spacing={2} style={{ marginTop: 16 }}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Tamanho do Chunk"
                    type="number"
                    value={ragSettings.chunkSize}
                    onChange={(e) => setRagSettings(prev => ({ ...prev, chunkSize: parseInt(e.target.value) }))}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Overlap"
                    type="number"
                    value={ragSettings.overlap}
                    onChange={(e) => setRagSettings(prev => ({ ...prev, overlap: parseInt(e.target.value) }))}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Top K Resultados"
                    type="number"
                    value={ragSettings.topK}
                    onChange={(e) => setRagSettings(prev => ({ ...prev, topK: parseInt(e.target.value) }))}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Modelo de Embedding"
                    value={ragSettings.embeddingModel}
                    onChange={(e) => setRagSettings(prev => ({ ...prev, embeddingModel: e.target.value }))}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
          
          <Card className={classes.card}>
            <CardContent>
              <Typography variant="h6" className={classes.sectionTitle}>
                📊 Base de Conhecimento Atual
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Card style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                    <CardContent style={{ padding: '12px' }}>
                      <Typography variant="subtitle2" color="primary" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        📁 FileManager
                        <Tooltip title="Arquivos do módulo 'Lista de arquivos' (menu lateral) que foram indexados automaticamente. Para adicionar: Menu → Lista de arquivos → Adicionar projeto → Faça upload dos arquivos → Eles serão indexados automaticamente para a IA usar como conhecimento.">
                          <InfoIcon fontSize="small" style={{ opacity: 0.6, cursor: 'help' }} />
                        </Tooltip>
                      </Typography>
                      <Typography variant="h4" style={{ color: '#28a745', margin: '8px 0' }}>
                        {ragSources.fileManager.length}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        arquivos indexados
                      </Typography>
                      {ragSources.fileManager.length > 0 && (
                        <Box mt={1}>
                          <Typography variant="caption" style={{ display: 'block' }}>
                            Últimos: {ragSources.fileManager.slice(0, 3).map(f => f.name).join(', ')}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Card style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                    <CardContent style={{ padding: '12px' }}>
                      <Typography variant="subtitle2" color="primary" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        💬 Conversas
                        <Tooltip title="Tickets/conversas históricas que foram indexadas automaticamente. A IA usa esse conhecimento para dar respostas mais contextualizadas baseadas em atendimentos anteriores.">
                          <InfoIcon fontSize="small" style={{ opacity: 0.6, cursor: 'help' }} />
                        </Tooltip>
                      </Typography>
                      <Typography variant="h4" style={{ color: '#17a2b8', margin: '8px 0' }}>
                        {ragSources.conversations}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        tickets indexados
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Card style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                    <CardContent style={{ padding: '12px' }}>
                      <Typography variant="subtitle2" color="primary" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        🌐 Links Externos
                        <Tooltip title="Sites externos que você indexou manualmente. Use o campo abaixo para adicionar novos sites. A IA fará scraping do conteúdo e usará como conhecimento.">
                          <InfoIcon fontSize="small" style={{ opacity: 0.6, cursor: 'help' }} />
                        </Tooltip>
                      </Typography>
                      <Typography variant="h4" style={{ color: '#6f42c1', margin: '8px 0' }}>
                        {ragSources.externalLinks.length}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        sites indexados
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card className={classes.card}>
            <CardContent>
              <Typography variant="h6" className={classes.sectionTitle}>
                🌐 Adicionar Link Externo
              </Typography>
              
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    label="URL do site"
                    value={newExternalLink}
                    onChange={(e) => setNewExternalLink(e.target.value)}
                    placeholder="https://exemplo.com"
                    helperText="A IA irá indexar o conteúdo desta página para usar como conhecimento"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={addExternalLink}
                    disabled={!newExternalLink.trim()}
                    startIcon={<AddIcon />}
                  >
                    Indexar Site
                  </Button>
                </Grid>
              </Grid>
              
              {ragSources.externalLinks.length > 0 && (
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Sites indexados:
                  </Typography>
                  <List dense>
                    {ragSources.externalLinks.map((link, index) => (
                      <ListItem key={index} style={{ padding: '4px 0' }}>
                        <ListItemText
                          primary={link.title}
                          secondary={link.url}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                        <ListItemSecondaryAction>
                          <IconButton 
                            edge="end" 
                            size="small"
                            onClick={() => removeExternalLink(link.url)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </CardContent>
          </Card>
          
          <Card className={classes.infoCard}>
            <CardContent>
              <Typography variant="h6" style={{ color: '#1976d2', marginBottom: 8 }}>
                📚 Tipos de arquivo suportados
              </Typography>
              <Typography variant="body2">
                <strong>Documentos:</strong> PDF, TXT, MD, CSV, JSON<br/>
                <strong>Imagens:</strong> JPG, PNG, GIF, BMP, WebP, TIFF<br/>
                <strong>Conversas:</strong> Auto-indexação de tickets históricos<br/>
                <strong>Sites externos:</strong> Qualquer URL pública
              </Typography>
            </CardContent>
          </Card>
        </TabPanel>

        {/* Tab 3: Presets */}
        <TabPanel value={tabValue} index={2}>
          <Card className={classes.card}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" className={classes.sectionTitle}>
                  <AddIcon />
                  Adicionar Preset
                </Typography>
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<DescriptionIcon />}
                  onClick={() => {
                    setSelectedProviderForTemplate('preset');
                    setTemplatesModalOpen(true);
                  }}
                >
                  📋 Templates
                </Button>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Nome do Preset"
                    value={newPreset.name}
                    onChange={(e) => setNewPreset(prev => ({ ...prev, name: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Módulo</InputLabel>
                    <Select
                      value={newPreset.module}
                      onChange={(e) => setNewPreset(prev => ({ ...prev, module: e.target.value }))}
                    >
                      <MenuItem value="general">Geral</MenuItem>
                      <MenuItem value="campaign">Campanhas</MenuItem>
                      <MenuItem value="ticket">Tickets</MenuItem>
                      <MenuItem value="prompt">Prompts</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Prompt do Sistema"
                    value={newPreset.systemPrompt}
                    onChange={(e) => setNewPreset(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Temperatura"
                    type="number"
                    inputProps={{ min: 0, max: 2, step: 0.1 }}
                    value={newPreset.temperature}
                    onChange={(e) => setNewPreset(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Max Tokens"
                    type="number"
                    value={newPreset.maxTokens}
                    onChange={(e) => setNewPreset(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                  />
                </Grid>
                
                {/* Campos adicionais de personalidade */}
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Tom</InputLabel>
                    <Select
                      value={newPreset.tone}
                      onChange={(e) => setNewPreset(prev => ({ ...prev, tone: e.target.value }))}
                    >
                      <MenuItem value="Profissional">Profissional</MenuItem>
                      <MenuItem value="Casual">Casual</MenuItem>
                      <MenuItem value="Amigável">Amigável</MenuItem>
                      <MenuItem value="Formal">Formal</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Emojis</InputLabel>
                    <Select
                      value={newPreset.emotions}
                      onChange={(e) => setNewPreset(prev => ({ ...prev, emotions: e.target.value }))}
                    >
                      <MenuItem value="Sem emojis">Sem emojis</MenuItem>
                      <MenuItem value="Baixo">Baixo</MenuItem>
                      <MenuItem value="Médio">Médio</MenuItem>
                      <MenuItem value="Alto">Alto</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Hashtags</InputLabel>
                    <Select
                      value={newPreset.hashtags}
                      onChange={(e) => setNewPreset(prev => ({ ...prev, hashtags: e.target.value }))}
                    >
                      <MenuItem value="Sem hashtags">Sem hashtags</MenuItem>
                      <MenuItem value="Poucas">Poucas</MenuItem>
                      <MenuItem value="Moderadas">Moderadas</MenuItem>
                      <MenuItem value="Muitas">Muitas</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Comprimento</InputLabel>
                    <Select
                      value={newPreset.length}
                      onChange={(e) => setNewPreset(prev => ({ ...prev, length: e.target.value }))}
                    >
                      <MenuItem value="Curto">Curto</MenuItem>
                      <MenuItem value="Médio">Médio</MenuItem>
                      <MenuItem value="Longo">Longo</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Voz da Marca (Brand Voice)"
                    value={newPreset.brandVoice}
                    onChange={(e) => setNewPreset(prev => ({ ...prev, brandVoice: e.target.value }))}
                    placeholder="Descreva a personalidade/diretrizes da sua comunicação..."
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Variáveis Permitidas"
                    value={newPreset.allowedVariables}
                    onChange={(e) => setNewPreset(prev => ({ ...prev, allowedVariables: e.target.value }))}
                    placeholder="Ex: {nome} {cidade} {empresa}"
                    helperText="Use chaves para definir variáveis. Clique nas tags abaixo para adicionar."
                  />
                  <Box mt={1} mb={2}>
                    <Typography variant="caption" color="textSecondary" style={{ marginBottom: 8, display: 'block' }}>
                      Tags disponíveis (clique para adicionar):
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {availableTags.slice(0, 20).map((tag) => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          clickable
                          onClick={() => {
                            const current = newPreset.allowedVariables || "";
                            const newValue = current ? `${current} ${tag}` : tag;
                            setNewPreset(prev => ({ ...prev, allowedVariables: newValue }));
                          }}
                          style={{ 
                            fontSize: '11px', 
                            height: '24px',
                            backgroundColor: '#f5f5f5',
                            '&:hover': { backgroundColor: '#e0e0e0' }
                          }}
                        />
                      ))}
                      {availableTags.length > 20 && (
                        <Chip
                          label={`+${availableTags.length - 20} mais`}
                          size="small"
                          style={{ fontSize: '11px', height: '24px', opacity: 0.7 }}
                        />
                      )}
                    </Box>
                  </Box>
                </Grid>
              </Grid>
              
              <Box mt={2}>
                {editingPreset && (
                  <Typography variant="caption" color="primary" gutterBottom style={{ display: 'block', marginBottom: 8 }}>
                    ✏️ <strong>Modo Edição:</strong> Você está editando um preset existente. As alterações sobrescreverão o preset atual.
                  </Typography>
                )}
                
                <Box display="flex" gap={1} mt={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={testPresetEndpoint}
                  >
                    🧪 Testar
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={editingPreset ? <SaveIcon /> : <AddIcon />}
                    onClick={addPreset}
                  >
                    {editingPreset ? "Salvar Alterações" : "Salvar Preset"}
                  </Button>
                  {editingPreset && (
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={cancelEdit}
                    >
                      Cancelar
                    </Button>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
          
          <Typography variant="h6" gutterBottom>
            Presets Salvos
          </Typography>
          
          <List>
            {presets.map((preset) => (
              <ListItem key={preset.id} style={{ border: '1px solid #ddd', borderRadius: 8, marginBottom: 8 }}>
                <ListItemText
                  primary={preset.name}
                  secondary={
                    <div>
                      <div>{`${preset.module} • Temp: ${preset.temperature} • Tokens: ${preset.maxTokens}`}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                        {`Tom: ${preset.tone} • Emojis: ${preset.emotions} • ${preset.length}`}
                      </div>
                    </div>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton 
                    edge="end" 
                    onClick={() => editPreset(preset)}
                    style={{ marginRight: 8 }}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton edge="end" onClick={() => removePreset(preset.id)}>
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
          
          {presets.length === 0 && (
            <Card className={classes.infoCard}>
              <CardContent>
                <Typography variant="body2">
                  ℹ️ Nenhum preset configurado ainda. Crie presets para reutilizar configurações de IA.
                </Typography>
              </CardContent>
            </Card>
          )}
        </TabPanel>

        {/* Tab 4: Analytics */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Card className={classes.metricCard}>
                <CardContent>
                  <Typography variant="h6" color="textSecondary">
                    Total de Requisições
                  </Typography>
                  <Typography className={classes.metricValue}>
                    {stats.totalRequests.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card className={classes.metricCard}>
                <CardContent>
                  <Typography variant="h6" color="textSecondary">
                    Taxa de Sucesso
                  </Typography>
                  <Typography className={classes.metricValue}>
                    {stats.successRate}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card className={classes.metricCard}>
                <CardContent>
                  <Typography variant="h6" color="textSecondary">
                    Latência Média
                  </Typography>
                  <Typography className={classes.metricValue}>
                    {stats.avgLatency}ms
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card className={classes.metricCard}>
                <CardContent>
                  <Typography variant="h6" color="textSecondary">
                    Provedor Principal
                  </Typography>
                  <Typography className={classes.metricValue}>
                    {stats.topProvider}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Seção de Prompts */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, marginBottom: 16 }}>
            <Typography variant="h6" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              🤖 Estatísticas de Prompts
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => window.location.href = '/prompts'}
              style={{ textTransform: 'none' }}
            >
              Gerenciar Prompts
            </Button>
          </div>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Card className={classes.metricCard}>
                <CardContent>
                  <Typography variant="h6" color="textSecondary">
                    Total de Prompts
                  </Typography>
                  <Typography className={classes.metricValue}>
                    {stats.prompts?.totalPrompts || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card className={classes.metricCard}>
                <CardContent>
                  <Typography variant="h6" color="textSecondary">
                    Prompts Ativos
                  </Typography>
                  <Typography className={classes.metricValue} style={{ color: '#4caf50' }}>
                    {stats.prompts?.activePrompts || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card className={classes.metricCard}>
                <CardContent>
                  <Typography variant="h6" color="textSecondary">
                    Tokens Consumidos
                  </Typography>
                  <Typography className={classes.metricValue} style={{ color: '#ff9800' }}>
                    {(stats.prompts?.totalTokens || 0).toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card className={classes.metricCard}>
                <CardContent>
                  <Typography variant="h6" color="textSecondary">
                    Tempo Médio
                  </Typography>
                  <Typography className={classes.metricValue} style={{ color: '#2196f3' }}>
                    {stats.prompts?.avgResponseTime || 0}s
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          
          <Grid container spacing={3} style={{ marginTop: 8 }}>
            <Grid item xs={12} md={3}>
              <Card className={classes.metricCard}>
                <CardContent>
                  <Typography variant="h6" color="textSecondary">
                    Taxa de Sucesso
                  </Typography>
                  <Typography className={classes.metricValue} style={{ color: '#4caf50' }}>
                    {stats.prompts?.successRate || 0}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          
          <Card className={classes.card} style={{ marginTop: 24 }}>
            <CardContent>
              <Typography variant="h6" className={classes.sectionTitle}>
                <BrainIcon />
                Sistema de IA Unificado - Status
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" style={{ marginBottom: 8 }}>
                    ✅ <strong>AIOrchestrator:</strong> Fallback automático ativo<br/>
                    ✅ <strong>RAG Expandido:</strong> PDFs + Imagens + Conversas<br/>
                    ✅ <strong>FileManager:</strong> Integrado ao cérebro IA<br/>
                    ✅ <strong>Auto-indexação:</strong> Conversas históricas
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2">
                    🔄 <strong>Processadores ativos:</strong><br/>
                    • PDF com OCR fallback<br/>
                    • Imagens com Tesseract OCR<br/>
                    • Conversas com detecção de temas<br/>
                    • Chunking inteligente
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
          
        </TabPanel>
      </Paper>

      {/* Modal de Templates */}
      <PromptEnhancements
        open={templatesModalOpen}
        onClose={() => {
          setTemplatesModalOpen(false);
          setSelectedProviderForTemplate(null);
        }}
        onSelectTemplate={selectedProviderForTemplate === 'preset' ? handleSelectTemplateForPreset : handleSelectTemplate}
        filterByProvider={selectedProviderForTemplate === 'preset' ? null : selectedProviderForTemplate}
        isPresetMode={selectedProviderForTemplate === 'preset'}
      />
    </div>
  );
}
