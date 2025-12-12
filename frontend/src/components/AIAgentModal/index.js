import React, { useState, useEffect } from "react";
import * as Yup from "yup";
import { Formik, Form, Field, FieldArray } from "formik";
import { toast } from "react-toastify";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    FormHelperText,
    Grid,
    Typography,
    Box,
    IconButton,
    Tooltip,
    Switch,
    FormControlLabel,
    Chip,
    Divider,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Tabs,
    Tab,
    Slider
} from "@material-ui/core";
import {
    HelpOutline as HelpIcon,
    Info as InfoIcon,
    Delete as DeleteIcon,
    Add as AddIcon,
    ExpandMore as ExpandMoreIcon
} from "@material-ui/icons";
import Alert from "@material-ui/lab/Alert";

import api from "../../services/api";
import { createAIAgent, updateAIAgent, getAIAgent } from "../../services/aiAgents";
import AIModelSelector from "../AIModelSelector";

const PROMPT_TEMPLATES = [
    { id: "sales", name: "Vendas", tone: "Persuasivo", description: "Focado em converter leads em clientes.", prompt: "Você é um especialista em vendas..." },
    { id: "support", name: "Suporte", tone: "Empático", description: "Focado em resolver problemas do cliente.", prompt: "Você é um especialista em suporte..." },
];

const AgentSchema = Yup.object().shape({
    name: Yup.string().min(2, "Nome muito curto").required("Nome é obrigatório"),
    profile: Yup.string().required("Perfil é obrigatório"),
    queueIds: Yup.array(),
    voiceEnabled: Yup.boolean(),
    imageRecognitionEnabled: Yup.boolean(),
    sentimentAnalysisEnabled: Yup.boolean(),
    autoSegmentationEnabled: Yup.boolean(),
    status: Yup.string(),
    // AI Model fields - nullable
    aiProvider: Yup.string().nullable(),
    aiModel: Yup.string().nullable(),
    temperature: Yup.number().nullable(),
    maxTokens: Yup.number().nullable(),
    // Advanced Settings - nullable
    creativity: Yup.string().nullable(),
    toneStyle: Yup.string().nullable(),
    emojiUsage: Yup.string().nullable(),
    hashtagUsage: Yup.string().nullable(),
    responseLength: Yup.string().nullable(),
    language: Yup.string().nullable(),
    brandVoice: Yup.string().nullable(),
    allowedVariables: Yup.string().nullable(),
    // Voice/TTS Settings - nullable
    voiceType: Yup.string().nullable(),
    voiceApiKey: Yup.string().nullable(),
    voiceRegion: Yup.string().nullable(),
    voiceTemperature: Yup.number().nullable(),
    voiceName: Yup.string().nullable(),
    // STT Settings
    sttProvider: Yup.string().nullable(),
    // Inactivity Timeout Settings
    inactivityTimeoutMinutes: Yup.number().nullable().min(0, "Deve ser 0 ou maior"),
    inactivityAction: Yup.string().nullable(),
    inactivityMessage: Yup.string().nullable(),
    // Funnel stages
    funnelStages: Yup.array().of(
        Yup.object().shape({
            name: Yup.string().required("Nome da etapa é obrigatório"),
            tone: Yup.string().required("Tom é obrigatório"),
            systemPrompt: Yup.string().required("Prompt é obrigatório"),
            order: Yup.number(),
            objective: Yup.string().nullable(),
            enabledFunctions: Yup.array(),
            autoAdvanceCondition: Yup.string().nullable(),
            sentimentThreshold: Yup.number().nullable()
        })
    )
});

// Helper component for info tooltips
const SectionTitle = ({ icon, title, tooltip }) => (
    <Box display="flex" alignItems="center" mb={1}>
        <Typography variant="h6">
            {icon} {title}
        </Typography>
        <Tooltip title={tooltip} arrow placement="right">
            <IconButton size="small" style={{ marginLeft: 8 }}>
                <HelpIcon fontSize="small" color="action" />
            </IconButton>
        </Tooltip>
    </Box>
);

const AIAgentModal = ({ open, onClose, agentId, onSave }) => {
    const [agent, setAgent] = useState(null);
    const [queues, setQueues] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState("");
    const [useGlobalAISettings, setUseGlobalAISettings] = useState(true);
    const [activeTab, setActiveTab] = useState(0);
    const [openSystemHelp, setOpenSystemHelp] = useState(false);

    const initialValues = {
        name: "",
        profile: "sales",
        queueIds: [],
        voiceEnabled: false,
        imageRecognitionEnabled: false,
        sentimentAnalysisEnabled: true,
        autoSegmentationEnabled: false,
        status: "active",
        // AI Model (null = usa global)
        aiProvider: "",
        aiModel: "",
        temperature: null,
        maxTokens: null,
        // Advanced Settings
        creativity: "medium",
        toneStyle: "professional",
        emojiUsage: "medium",
        hashtagUsage: "none",
        responseLength: "medium",
        language: "pt-BR",
        brandVoice: "",
        allowedVariables: "",
        // Voice/TTS Settings
        voiceType: "text",
        voiceApiKey: "",
        voiceRegion: "",
        voiceTemperature: 0.7,
        voiceName: "",
        // STT Settings
        sttProvider: "disabled",
        // Inactivity Timeout Settings
        inactivityTimeoutMinutes: 0,
        inactivityAction: "close",
        inactivityMessage: "Não recebi sua resposta. Vou encerrar nosso atendimento por enquanto. Se precisar de algo, é só me chamar novamente! 👋",
        // Business Hours Settings
        businessHours: {
            seg: { start: "08:00", end: "18:00" },
            ter: { start: "08:00", end: "18:00" },
            qua: { start: "08:00", end: "18:00" },
            qui: { start: "08:00", end: "18:00" },
            sex: { start: "08:00", end: "18:00" },
            sab: { start: "", end: "" },
            dom: { start: "", end: "" }
        },
        outOfHoursMessage: "Olá! No momento estamos fora do horário de atendimento. Retornaremos no próximo dia útil.",
        // Lead Qualification Settings
        requireLeadQualification: false,
        requiredLeadFields: ["cnpj", "email"],
        leadFieldMapping: {
            cnpj: "cnpj",
            razaoSocial: "name",
            email: "email",
            nomeFantasia: "fantasyName",
            cidade: "city",
            segmento: "segment"
        },
        qualifiedLeadTag: "lead_qualificado",
        leadQualificationMessage: "Para enviar nossa tabela de preços, preciso de algumas informações. Qual o CNPJ da sua empresa?",
        // SDR Settings
        sdrEnabled: false,
        sdrICP: {
            segments: [],
            sizes: [],
            regions: [],
            criteria: ""
        },
        sdrMethodology: "BANT",
        sdrQualificationQuestions: [
            { question: "Qual o volume de compras mensal da sua empresa?", type: "budget", points: 15 },
            { question: "Quem é responsável pelas decisões de compra?", type: "authority", points: 15 },
            { question: "Qual problema você está buscando resolver?", type: "need", points: 20 },
            { question: "Para quando você precisa dessa solução?", type: "timeline", points: 15 }
        ],
        sdrScoringRules: {
            icpMatch: 20,
            hasCnpj: 15,
            hasEmail: 10,
            askedPrice: 25,
            mentionedUrgency: 20,
            requestedHuman: 30,
            answeredQuestion: 10
        },
        sdrMinScoreToTransfer: 70,
        sdrTransferTriggers: ["pediu_orcamento", "score_minimo"],
        sdrSchedulingEnabled: false,
        sdrCalendarLink: "",
        sdrSchedulingMessage: "Que tal agendarmos uma conversa com nosso especialista? Ele pode te ajudar a encontrar a melhor solução para sua necessidade.",
        sdrHandoffMessage: "Vou transferir você para um de nossos especialistas que poderá te ajudar com mais detalhes. Um momento!",
        sdrHotLeadTag: "lead_quente",
        funnelStages: [
            {
                order: 1,
                name: "Qualificação",
                tone: "Consultivo",
                objective: "Entender necessidades do cliente",
                systemPrompt: "Você está na etapa de qualificação. Faça perguntas para entender as necessidades do cliente.",
                enabledFunctions: [],
                autoAdvanceCondition: "",
                sentimentThreshold: null
            }
        ]
    };

    useEffect(() => {
        loadQueues();
    }, []);

    useEffect(() => {
        if (agentId && open) {
            loadAgent();
        }
    }, [agentId, open]);

    const loadQueues = async () => {
        try {
            const { data } = await api.get("/queue");
            setQueues(data);
        } catch (err) {
            toast.error("Erro ao carregar filas");
        }
    };

    const loadAgent = async () => {
        setLoading(true);
        try {
            const data = await getAIAgent(agentId);
            setAgent(data);
        } catch (err) {
            toast.error("Erro ao carregar agente");
        }
        setLoading(false);
    };

    const handleSubmit = async (values) => {
        try {
            // Sanitize numeric fields - convert empty strings to null
            const sanitizedValues = {
                ...values,
                // Se está usando global, força null nos campos de IA
                aiProvider: useGlobalAISettings ? null : (values.aiProvider || null),
                aiModel: useGlobalAISettings ? null : (values.aiModel || null),
                temperature: useGlobalAISettings ? null : (values.temperature === "" || values.temperature === null ? null : Number(values.temperature)),
                maxTokens: useGlobalAISettings ? null : (values.maxTokens === "" || values.maxTokens === null ? null : Number(values.maxTokens)),
                voiceTemperature: values.voiceTemperature === "" || values.voiceTemperature === null ? null : Number(values.voiceTemperature)
            };

            let savedAgent;
            if (agentId) {
                savedAgent = await updateAIAgent(agentId, sanitizedValues);
                toast.success("Agente atualizado com sucesso");
            } else {
                savedAgent = await createAIAgent(sanitizedValues);
                toast.success("Agente criado com sucesso");
            }
            onSave(savedAgent);
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || "Erro ao salvar agente");
        }
    };

    const handleClose = () => {
        setAgent(null);
        setSelectedTemplate("");
        setOpenSystemHelp(false);
        onClose();
    };

    const handleApplyTemplate = (setFieldValue, values) => {
        if (!selectedTemplate) {
            toast.warning("Selecione um template primeiro");
            return;
        }

        const template = PROMPT_TEMPLATES.find(t => t.id === selectedTemplate);
        if (template) {
            // Aplicar template à primeira etapa do funil
            const updatedStages = [...values.funnelStages];
            updatedStages[0] = {
                ...updatedStages[0],
                name: template.name,
                tone: template.tone,
                objective: template.description,
                systemPrompt: template.prompt
            };
            setFieldValue("funnelStages", updatedStages);
            toast.success(`Template "${template.name}" aplicado!`);
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth scroll="paper">
            <DialogTitle>{agentId ? "Editar Agente" : "Novo Agente"}</DialogTitle>

            <Formik
                initialValues={agent || initialValues}
                validationSchema={AgentSchema}
                enableReinitialize={true}
                onSubmit={handleSubmit}
            >
                {({ values, errors, touched, handleChange, setFieldValue }) => (
                    <Form>
                        <DialogContent dividers>
                            {/* Tabs de Navegação */}
                            <Tabs
                                value={activeTab}
                                onChange={(e, newValue) => setActiveTab(newValue)}
                                indicatorColor="primary"
                                textColor="primary"
                                variant="fullWidth"
                                style={{ marginBottom: 16 }}
                            >
                                <Tab label="⚙️ Configurações" />
                                <Tab label="📊 Funil de Vendas" />
                                <Tab label="🎯 SDR" />
                            </Tabs>

                            {/* TAB 0: Configurações Gerais */}
                            {activeTab === 0 && (
                            <>
                            {/* Informações Básicas */}
                            <Typography variant="h6" gutterBottom>
                                Informações Básicas
                            </Typography>

                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={8}>
                                    <TextField
                                        fullWidth
                                        label="Nome do Agente"
                                        name="name"
                                        value={values.name}
                                        onChange={handleChange}
                                        error={touched.name && Boolean(errors.name)}
                                        helperText={touched.name && errors.name}
                                        placeholder="Ex: Sofia - Vendas"
                                    />
                                </Grid>

                                <Grid item xs={12} sm={4}>
                                    <FormControl fullWidth>
                                        <InputLabel>Perfil</InputLabel>
                                        <Select
                                            name="profile"
                                            value={values.profile}
                                            onChange={handleChange}
                                        >
                                            <MenuItem value="sales">Vendas</MenuItem>
                                            <MenuItem value="support">Suporte</MenuItem>
                                            <MenuItem value="service">Atendimento</MenuItem>
                                            <MenuItem value="hybrid">Híbrido</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12}>
                                    <FormControl fullWidth>
                                        <InputLabel>Filas</InputLabel>
                                        <Select
                                            multiple
                                            name="queueIds"
                                            value={values.queueIds}
                                            onChange={handleChange}
                                            renderValue={(selected) => (
                                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                                    {selected.map((value) => {
                                                        const queue = queues.find(q => q.id === value);
                                                        return <Chip key={value} label={queue?.name || value} size="small" />;
                                                    })}
                                                </Box>
                                            )}
                                        >
                                            {queues.map(queue => (
                                                <MenuItem key={queue.id} value={queue.id}>
                                                    {queue.name}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                            </Grid>

                            {/* Informação sobre RAG */}
                            <Box mt={2}>
                                <Alert severity="info" icon={<InfoIcon />}>
                                    <Typography variant="body2">
                                        <strong>📚 Base de Conhecimento (RAG)</strong>
                                    </Typography>
                                    <Typography variant="body2" style={{ marginTop: 4 }}>
                                        Este agente busca em <strong>MÚLTIPLAS fontes</strong> das filas: Arquivos, Tickets anteriores, Sites, Áudios/Vídeos e Imagens.
                                    </Typography>
                                    <Typography variant="body2" style={{ marginTop: 4 }}>
                                        Configure em: <strong>Configurações → RAG/Arquivos</strong> e <strong>Filas</strong>
                                    </Typography>
                                </Alert>
                            </Box>

                            <Box mt={3} mb={2}>
                                <Divider />
                            </Box>

                            {/* Configurações de Modelo de IA */}
                            <SectionTitle
                                icon="🧠"
                                title="Configurações de Modelo de IA"
                                tooltip="Defina se este agente usa as configurações globais de IA ou um modelo específico."
                            />

                            <FormControlLabel
                                control={
                                    <Switch
                                        color="primary"
                                        checked={useGlobalAISettings}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setUseGlobalAISettings(checked);
                                            if (checked) {
                                                setFieldValue("aiProvider", "");
                                                setFieldValue("aiModel", "");
                                                setFieldValue("temperature", null);
                                                setFieldValue("maxTokens", null);
                                            }
                                        }}
                                    />
                                }
                                label="Usar Configurações Globais de IA"
                            />

                            {useGlobalAISettings && (
                                <Box mt={2} mb={2}>
                                    <Alert severity="info" icon={<InfoIcon />}>
                                        <Typography variant="body2">
                                            <strong>ℹ️ Usando configurações globais de IA</strong>
                                        </Typography>
                                        <Typography variant="body2">
                                            As configurações definidas em <strong>"Configurações → IA"</strong> serão utilizadas.
                                        </Typography>
                                        <Typography variant="body2" style={{ marginTop: 8 }}>
                                            💡 Desmarque o switch acima para customizar este agente.
                                        </Typography>
                                    </Alert>
                                </Box>
                            )}

                            {!useGlobalAISettings && (
                                <Grid container spacing={2} style={{ marginTop: 8 }}>
                                    <Grid item xs={12} sm={3}>
                                        <FormControl fullWidth>
                                            <InputLabel>Provider</InputLabel>
                                            <Select
                                                name="aiProvider"
                                                value={values.aiProvider}
                                                onChange={handleChange}
                                            >
                                                <MenuItem value="openai">OpenAI</MenuItem>
                                                <MenuItem value="gemini">Google Gemini</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>

                                    <Grid item xs={12} sm={5}>
                                        <AIModelSelector
                                            provider={values.aiProvider}
                                            value={values.aiModel}
                                            onChange={handleChange}
                                            disabled={!values.aiProvider}
                                            helperText={!values.aiProvider ? "Selecione um provider primeiro" : ""}
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={2}>
                                        <TextField
                                            fullWidth
                                            label="Temperatura"
                                            name="temperature"
                                            value={values.temperature || ""}
                                            onChange={handleChange}
                                            type="number"
                                            inputProps={{ min: 0, max: 1, step: 0.1 }}
                                            placeholder="0.7"
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={2}>
                                        <TextField
                                            fullWidth
                                            label="Max Tokens"
                                            name="maxTokens"
                                            value={values.maxTokens || ""}
                                            onChange={handleChange}
                                            type="number"
                                            inputProps={{ min: 1, step: 100 }}
                                            placeholder="600"
                                        />
                                    </Grid>
                                </Grid>
                            )}

                            <Box mt={3} mb={2}>
                                <Divider />
                            </Box>


                            {/* Configurações Avançadas de Estilo */}
                            <SectionTitle
                                icon="🎨"
                                title="Configurações de Estilo"
                                tooltip="Defina como este agente se comunica: nível de criatividade, tom da conversa, uso de emojis, idioma. Esses ajustes personalizam a 'personalidade' do agente."
                            />

                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={4}>
                                    <FormControl fullWidth>
                                        <InputLabel>Criatividade</InputLabel>
                                        <Select name="creativity" value={values.creativity} onChange={handleChange}>
                                            <MenuItem value="low">Baixa</MenuItem>
                                            <MenuItem value="medium">Média</MenuItem>
                                            <MenuItem value="high">Alta</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} sm={4}>
                                    <FormControl fullWidth>
                                        <InputLabel>Tom</InputLabel>
                                        <Select name="toneStyle" value={values.toneStyle} onChange={handleChange}>
                                            <MenuItem value="professional">Profissional</MenuItem>
                                            <MenuItem value="friendly">Amigável</MenuItem>
                                            <MenuItem value="formal">Formal</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} sm={4}>
                                    <FormControl fullWidth>
                                        <InputLabel>Emojis</InputLabel>
                                        <Select name="emojiUsage" value={values.emojiUsage} onChange={handleChange}>
                                            <MenuItem value="none">Nenhum</MenuItem>
                                            <MenuItem value="low">Baixo</MenuItem>
                                            <MenuItem value="medium">Médio</MenuItem>
                                            <MenuItem value="high">Alto</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} sm={4}>
                                    <FormControl fullWidth>
                                        <InputLabel>Idioma</InputLabel>
                                        <Select name="language" value={values.language} onChange={handleChange}>
                                            <MenuItem value="pt-BR">Português (Brasil)</MenuItem>
                                            <MenuItem value="en-US">English (US)</MenuItem>
                                            <MenuItem value="es-ES">Español</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} sm={8}>
                                    <TextField
                                        fullWidth
                                        label="Variáveis Permitidas"
                                        name="allowedVariables"
                                        value={values.allowedVariables}
                                        onChange={handleChange}
                                        placeholder="Ex: {nome} {email} {telefone}"
                                        helperText="Use chaves para definir variáveis"
                                    />
                                </Grid>

                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Voz da Marca (Brand Voice)"
                                        name="brandVoice"
                                        value={values.brandVoice}
                                        onChange={handleChange}
                                        multiline
                                        rows={2}
                                        placeholder="Ex: Comunicação precisa, clara e adaptável. Especialista em linguística..."
                                    />
                                </Grid>
                            </Grid>

                            <Box mt={3} mb={2}>
                                <Divider />
                            </Box>

                            {/* Configurações de Voz/TTS */}
                            <SectionTitle
                                icon="🎤"
                                title="Voz e Transcrição (TTS/STT)"
                                tooltip="Habilite processamento de áudios: transcrição de voz para texto (STT) e síntese de texto para voz (TTS). Configure voz Azure, temperatura e outras opções. Veja o painel de ajuda abaixo para instruções completas."
                            />

                            <Grid container spacing={2}>
                                {/* Provedor de STT (Transcrição) */}
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth>
                                        <InputLabel>Provedor STT (Transcrição de Áudio)</InputLabel>
                                        <Select name="sttProvider" value={values.sttProvider} onChange={handleChange}>
                                            <MenuItem value="disabled">Desabilitado</MenuItem>
                                            <MenuItem value="openai">OpenAI Whisper</MenuItem>
                                            <MenuItem value="gemini">Google Gemini</MenuItem>
                                        </Select>
                                        <FormHelperText>
                                            Usa a chave configurada em Provedores de IA
                                        </FormHelperText>
                                    </FormControl>
                                </Grid>

                                {/* Tipo de Voz (TTS - Resposta em Áudio) */}
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth>
                                        <InputLabel>Tipo de Voz (TTS - Resposta)</InputLabel>
                                        <Select name="voiceType" value={values.voiceType} onChange={handleChange}>
                                            <MenuItem value="text">Texto (DEBUG - liberado)</MenuItem>
                                            <MenuItem value="generated">Voz Gerada (TTS)</MenuItem>
                                            <MenuItem value="enabled">Voz Habilitada (Azure)</MenuItem>
                                        </Select>
                                        <FormHelperText>
                                            Responder em áudio requer Azure Speech
                                        </FormHelperText>
                                    </FormControl>
                                </Grid>

                                {/* Temperatura de Voz */}
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Temperatura"
                                        name="voiceTemperature"
                                        value={values.voiceTemperature}
                                        onChange={handleChange}
                                        type="number"
                                        inputProps={{ min: 0, max: 1, step: 0.1 }}
                                        placeholder="0.7"
                                        helperText="Controle da variação na síntese de voz"
                                    />
                                </Grid>

                                {/* Chave da API de Voz */}
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Chave da API de Voz"
                                        name="voiceApiKey"
                                        value={values.voiceApiKey}
                                        onChange={handleChange}
                                        type="password"
                                        placeholder="Deixe vazio para usar global"
                                        helperText="Azure Speech API Key (opcional)"
                                    />
                                </Grid>

                                {/* Região de Voz */}
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Região de Voz"
                                        name="voiceRegion"
                                        value={values.voiceRegion}
                                        onChange={handleChange}
                                        placeholder="Ex: brazilsouth, eastus"
                                        helperText="Região do Azure Speech"
                                    />
                                </Grid>

                                {/* Nome da Voz */}
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Nome da Voz (voice)"
                                        name="voiceName"
                                        value={values.voiceName}
                                        onChange={handleChange}
                                        placeholder="Ex: pt-BR-AntonioNeural ou pt-BR-FranciscaNeural"
                                        helperText="Voz Azure para TTS - uma voz Azure válida"
                                        disabled={values.voiceType === "text"}
                                    />
                                </Grid>

                                {/* Painel de Ajuda - Accordion */}
                                <Grid item xs={12}>
                                    <Accordion>
                                        <AccordionSummary
                                            expandIcon={<ExpandMoreIcon />}
                                        >
                                            <Typography variant="body2" paragraph>
                                                • <strong>TTS (Síntese de Voz):</strong> preencha abaixo{" "}
                                                <strong>voice</strong> (uma voz Azure válida), <strong>voiceKey</strong> e{" "}
                                                <strong>voiceRegion</strong>.
                                            </Typography>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <Box>
                                                <Typography variant="subtitle2" style={{ fontWeight: 600, marginTop: 16 }}>
                                                    Passos rápidos
                                                </Typography>

                                                <Typography variant="body2" component="div" style={{ marginTop: 8 }}>
                                                    1) Escolha o provedor de STT e gere a API Key:
                                                    <br />
                                                    <span style={{ marginLeft: 16 }}>
                                                        – OpenAI:{" "}
                                                        <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer">
                                                            https://platform.openai.com
                                                        </a>
                                                    </span>
                                                    <br />
                                                    <span style={{ marginLeft: 16 }}>
                                                        – Google Gemini:{" "}
                                                        <a href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer">
                                                            https://ai.google.dev/
                                                        </a>
                                                    </span>
                                                    <br />
                                                    Salve a chave em <code>Setting.apiTranscription</code> no sistema.
                                                </Typography>

                                                <Typography variant="body2" component="div" style={{ marginTop: 12 }}>
                                                    2) Para TTS (Microsoft Azure Speech):
                                                    <br />
                                                    <span style={{ marginLeft: 16 }}>
                                                        – Crie um recurso <em>Speech</em> no Azure Portal.
                                                    </span>
                                                    <br />
                                                    <span style={{ marginLeft: 16 }}>
                                                        – Copie <strong>Key</strong> e <strong>Region</strong> (ex.: brazilsouth, eastus).
                                                    </span>
                                                    <br />
                                                    <span style={{ marginLeft: 16 }}>
                                                        – Selecione uma voz, por exemplo: <code>pt-BR-AntonioNeural</code> ou{" "}
                                                        <code>pt-BR-FranciscaNeural</code>.
                                                    </span>
                                                    <br />
                                                    <span style={{ marginLeft: 16 }}>
                                                        Docs:{" "}
                                                        <a
                                                            href="https://learn.microsoft.com/azure/ai-services/speech-service/"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            Azure Speech Service
                                                        </a>
                                                    </span>
                                                </Typography>

                                                <Typography variant="body2" component="div" style={{ marginTop: 12 }}>
                                                    3) Funcionamento:
                                                    <br />
                                                    <span style={{ marginLeft: 16 }}>
                                                        – Ao receber um áudio, o sistema usa a chave de STT para transcrever.
                                                    </span>
                                                    <br />
                                                    <span style={{ marginLeft: 16 }}>
                                                        – A IA responde usando o <strong>modelo</strong> definido neste Agente (ou global).
                                                    </span>
                                                    <br />
                                                    <span style={{ marginLeft: 16 }}>
                                                        – Se <strong>voice</strong> = "texto", envia resposta em texto; caso contrário, gera áudio via Azure
                                                        TTS e envia MP3.
                                                    </span>
                                                </Typography>

                                                <Typography variant="body2" style={{ marginTop: 12, fontStyle: "italic", color: "text.secondary" }}>
                                                    💡 <strong>Dica:</strong> Se você não precisa de áudio de retorno, deixe{" "}
                                                    <strong>voice</strong> = "texto" e não preencha voiceKey/voiceRegion.
                                                </Typography>
                                            </Box>
                                        </AccordionDetails>
                                    </Accordion>
                                </Grid>
                            </Grid>

                            {/* Recursos */}
                            <SectionTitle
                                icon="⚙️"
                                title="Recursos"
                                tooltip="Habilite recursos avançados: Voz (áudios), Reconhecimento de Imagem (visão), Análise de Sentimento (detecta emoções) e Segmentação Automática (classifica clientes em perfis). Cada recurso adiciona capacidades específicas ao agente."
                            />

                            <Grid container spacing={1}>
                                <Grid item xs={12} sm={6}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={values.voiceEnabled}
                                                onChange={(e) => setFieldValue("voiceEnabled", e.target.checked)}
                                            />
                                        }
                                        label="🎤 Habilitar Voz"
                                    />
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={values.imageRecognitionEnabled}
                                                onChange={(e) => setFieldValue("imageRecognitionEnabled", e.target.checked)}
                                            />
                                        }
                                        label="🖼️ Reconhecimento de Imagem"
                                    />
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={values.sentimentAnalysisEnabled}
                                                onChange={(e) => setFieldValue("sentimentAnalysisEnabled", e.target.checked)}
                                            />
                                        }
                                        label="😊 Análise de Sentimento"
                                    />
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={values.autoSegmentationEnabled}
                                                onChange={(e) => setFieldValue("autoSegmentationEnabled", e.target.checked)}
                                            />
                                        }
                                        label="🎯 Segmentação Automática"
                                    />
                                </Grid>
                            </Grid>

                            <Box mt={3} mb={2}>
                                <Divider />
                            </Box>

                            {/* Timeout de Inatividade */}
                            <SectionTitle
                                icon="⏰"
                                title="Timeout de Inatividade"
                                tooltip="Configure o tempo máximo de espera por resposta do cliente. Após esse tempo, o agente pode enviar uma mensagem e fechar o atendimento ou transferir para a fila."
                            />

                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={4}>
                                    <Field
                                        as={TextField}
                                        name="inactivityTimeoutMinutes"
                                        label="Tempo (minutos)"
                                        type="number"
                                        fullWidth
                                        variant="outlined"
                                        size="small"
                                        helperText="0 = desabilitado"
                                        InputProps={{ inputProps: { min: 0 } }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <FormControl fullWidth variant="outlined" size="small">
                                        <InputLabel>Ação ao Timeout</InputLabel>
                                        <Field
                                            as={Select}
                                            name="inactivityAction"
                                            label="Ação ao Timeout"
                                        >
                                            <MenuItem value="close">🔒 Fechar Atendimento</MenuItem>
                                            <MenuItem value="transfer">🔄 Transferir para Fila</MenuItem>
                                        </Field>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12}>
                                    <Field
                                        as={TextField}
                                        name="inactivityMessage"
                                        label="Mensagem de Encerramento"
                                        fullWidth
                                        multiline
                                        rows={2}
                                        variant="outlined"
                                        size="small"
                                        helperText="Mensagem enviada ao cliente antes de fechar/transferir"
                                    />
                                </Grid>
                            </Grid>

                            <Box mt={3} mb={2}>
                                <Divider />
                            </Box>

                            {/* Horário de Funcionamento */}
                            <SectionTitle
                                icon="🕐"
                                title="Horário de Funcionamento"
                                tooltip="Configure o horário de atendimento. Fora do horário, o agente informará ao cliente e pode ajustar seu comportamento."
                            />

                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <Typography variant="body2" color="textSecondary" gutterBottom>
                                        Configure o horário de início e fim para cada dia. Deixe vazio para dias sem atendimento.
                                    </Typography>
                                </Grid>
                                {["seg", "ter", "qua", "qui", "sex", "sab", "dom"].map((day) => (
                                    <Grid item xs={12} sm={6} md={4} key={day}>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <Typography variant="body2" style={{ width: 40, fontWeight: 500 }}>
                                                {day.toUpperCase()}
                                            </Typography>
                                            <Field
                                                as={TextField}
                                                name={`businessHours.${day}.start`}
                                                type="time"
                                                size="small"
                                                variant="outlined"
                                                style={{ width: 100 }}
                                                InputLabelProps={{ shrink: true }}
                                            />
                                            <Typography variant="body2">às</Typography>
                                            <Field
                                                as={TextField}
                                                name={`businessHours.${day}.end`}
                                                type="time"
                                                size="small"
                                                variant="outlined"
                                                style={{ width: 100 }}
                                                InputLabelProps={{ shrink: true }}
                                            />
                                        </Box>
                                    </Grid>
                                ))}
                                <Grid item xs={12}>
                                    <Field
                                        as={TextField}
                                        name="outOfHoursMessage"
                                        label="Mensagem Fora do Horário"
                                        fullWidth
                                        multiline
                                        rows={2}
                                        variant="outlined"
                                        size="small"
                                        helperText="Mensagem que o agente usará quando estiver fora do horário de atendimento"
                                    />
                                </Grid>
                            </Grid>

                            <Box mt={3} mb={2}>
                                <Divider />
                            </Box>

                            {/* Qualificação de Lead */}
                            <SectionTitle
                                icon="📋"
                                title="Qualificação de Lead"
                                tooltip="Exija dados cadastrais (CNPJ, Email, etc.) antes de enviar tabelas de preços e materiais restritos."
                            />

                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <FormControlLabel
                                        control={
                                            <Field
                                                as={Switch}
                                                name="requireLeadQualification"
                                                color="primary"
                                                checked={values.requireLeadQualification}
                                            />
                                        }
                                        label="Exigir cadastro completo antes de enviar materiais"
                                    />
                                </Grid>

                                {values.requireLeadQualification && (
                                    <>
                                        <Grid item xs={12} sm={6}>
                                            <FormControl fullWidth variant="outlined" size="small">
                                                <InputLabel>Campos Obrigatórios</InputLabel>
                                                <Field
                                                    as={Select}
                                                    name="requiredLeadFields"
                                                    label="Campos Obrigatórios"
                                                    multiple
                                                    renderValue={(selected) => selected.join(", ")}
                                                >
                                                    <MenuItem value="cnpj">CNPJ</MenuItem>
                                                    <MenuItem value="email">Email</MenuItem>
                                                    <MenuItem value="razaoSocial">Razão Social</MenuItem>
                                                    <MenuItem value="nomeFantasia">Nome Fantasia</MenuItem>
                                                    <MenuItem value="cidade">Cidade</MenuItem>
                                                    <MenuItem value="segmento">Segmento</MenuItem>
                                                </Field>
                                            </FormControl>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <Field
                                                as={TextField}
                                                name="qualifiedLeadTag"
                                                label="Tag ao Qualificar"
                                                fullWidth
                                                variant="outlined"
                                                size="small"
                                                helperText="Tag adicionada ao contato quando qualificado"
                                            />
                                        </Grid>
                                        <Grid item xs={12}>
                                            <Field
                                                as={TextField}
                                                name="leadQualificationMessage"
                                                label="Mensagem de Solicitação de Dados"
                                                fullWidth
                                                multiline
                                                rows={2}
                                                variant="outlined"
                                                size="small"
                                                helperText="Mensagem que o agente usará para solicitar os dados do cliente"
                                            />
                                        </Grid>
                                    </>
                                )}
                            </Grid>
                            </>
                            )}

                            {/* TAB 1: Funil de Vendas */}
                            {activeTab === 1 && (
                            <>
                            {/* Funil de Vendas */}
                            <Box display="flex" alignItems="center" mb={2}>
                                <Typography variant="h6">
                                    📊 Funil de Vendas ({values.funnelStages?.length || 0} etapas)
                                </Typography>
                                <Tooltip
                                    title="Crie uma jornada com múltiplas etapas (Qualificação, Apresentação, Negociação, Fechamento). Cada etapa tem seu próprio prompt, tom e objetivo. O cliente avança automaticamente quando condições são atendidas."
                                    arrow
                                    placement="right"
                                >
                                    <IconButton size="small" style={{ marginLeft: 8 }}>
                                        <HelpIcon fontSize="small" color="action" />
                                    </IconButton>
                                </Tooltip>
                            </Box>

                            <FieldArray name="funnelStages">
                                {({ push, remove }) => (
                                    <>
                                        {values.funnelStages?.map((stage, index) => (
                                            <Box key={index} mb={3} p={2} border={1} borderColor="grey.300" borderRadius={4}>
                                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                                    <Typography variant="subtitle1">
                                                        <strong>Etapa {stage.order}: {stage.name}</strong>
                                                    </Typography>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => remove(index)}
                                                        disabled={values.funnelStages.length === 1}
                                                    >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Box>

                                                <Grid container spacing={2}>
                                                    <Grid item xs={12} sm={6}>
                                                        <TextField
                                                            fullWidth
                                                            label="Nome da Etapa"
                                                            name={`funnelStages[${index}].name`}
                                                            value={stage.name}
                                                            onChange={handleChange}
                                                            error={touched.funnelStages?.[index]?.name && Boolean(errors.funnelStages?.[index]?.name)}
                                                        />
                                                    </Grid>

                                                    <Grid item xs={12} sm={6}>
                                                        <TextField
                                                            fullWidth
                                                            label="Tom"
                                                            name={`funnelStages[${index}].tone`}
                                                            value={stage.tone}
                                                            onChange={handleChange}
                                                            placeholder="Ex: Consultivo, Persuasivo"
                                                        />
                                                    </Grid>

                                                    <Grid item xs={12}>
                                                        <TextField
                                                            fullWidth
                                                            label="Objetivo"
                                                            name={`funnelStages[${index}].objective`}
                                                            value={stage.objective}
                                                            onChange={handleChange}
                                                            multiline
                                                            rows={2}
                                                        />
                                                    </Grid>

                                                    <Grid item xs={12}>
                                                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                                                            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                                                                Prompt do Sistema
                                                            </Typography>
                                                            <Tooltip title="Ver o que o sistema já aplica automaticamente" arrow>
                                                                <IconButton size="small" onClick={() => setOpenSystemHelp(true)}>
                                                                    <InfoIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Box>

                                                        <TextField
                                                            fullWidth
                                                            label=""
                                                            name={`funnelStages[${index}].systemPrompt`}
                                                            value={stage.systemPrompt}
                                                            onChange={handleChange}
                                                            multiline
                                                            rows={15}
                                                            error={touched.funnelStages?.[index]?.systemPrompt && Boolean(errors.funnelStages?.[index]?.systemPrompt)}
                                                        />
                                                    </Grid>

                                                    <Grid item xs={12}>
                                                        <FormControl fullWidth>
                                                            <InputLabel>Funções Habilitadas</InputLabel>
                                                            <Select
                                                                multiple
                                                                name={`funnelStages[${index}].enabledFunctions`}
                                                                value={stage.enabledFunctions || []}
                                                                onChange={handleChange}
                                                                renderValue={(selected) => (
                                                                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                                                                        {selected.map((value) => (
                                                                            <Chip key={value} label={value} size="small" />
                                                                        ))}
                                                                    </Box>
                                                                )}
                                                            >
                                                                <MenuItem value="enviar_catalogo">📄 Enviar Catálogo</MenuItem>
                                                                <MenuItem value="listar_catalogos">📋 Listar Catálogos</MenuItem>
                                                                <MenuItem value="enviar_tabela_precos">💰 Enviar Tabela de Preços</MenuItem>
                                                                <MenuItem value="listar_tabelas_precos">📋 Listar Tabelas de Preços</MenuItem>
                                                                <MenuItem value="enviar_informativo">📑 Enviar Informativo</MenuItem>
                                                                <MenuItem value="listar_informativos">📋 Listar Informativos</MenuItem>
                                                                <MenuItem value="buscar_produto_detalhado">🔍 Buscar Produto Detalhado</MenuItem>
                                                                <MenuItem value="transferir_para_vendedor_responsavel">👤 Transferir para Vendedor Responsável</MenuItem>
                                                                <MenuItem value="transferir_para_atendente">🙋 Transferir para Atendente</MenuItem>
                                                            </Select>
                                                            <Typography variant="caption" color="textSecondary" style={{ marginTop: 4 }}>
                                                                Deixe vazio para permitir todas as funções. Selecione funções específicas para restringir o que a IA pode fazer nesta etapa.
                                                            </Typography>
                                                        </FormControl>
                                                    </Grid>
                                                </Grid>
                                            </Box>
                                        ))}

                                        <Button
                                            fullWidth
                                            variant="outlined"
                                            startIcon={<AddIcon />}
                                            onClick={() =>
                                                push({
                                                    order: values.funnelStages.length + 1,
                                                    name: `Etapa ${values.funnelStages.length + 1}`,
                                                    tone: "",
                                                    objective: "",
                                                    systemPrompt: "",
                                                    enabledFunctions: []
                                                })
                                            }
                                        >
                                            Adicionar Etapa ao Funil
                                        </Button>
                                    </>
                                )}
                            </FieldArray>
                            </>
                            )}

                            {/* TAB 2: SDR */}
                            {activeTab === 2 && (
                            <>
                            <Box display="flex" alignItems="center" mb={2}>
                                <Typography variant="h6">
                                    🎯 SDR - Sales Development Representative
                                </Typography>
                                <Tooltip
                                    title="Configure o agente como SDR para prospectar, qualificar e nutrir leads. O SDR identifica oportunidades quentes e transfere para o time de vendas (Closers)."
                                    arrow
                                    placement="right"
                                >
                                    <IconButton size="small" style={{ marginLeft: 8 }}>
                                        <HelpIcon fontSize="small" color="action" />
                                    </IconButton>
                                </Tooltip>
                            </Box>

                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                name="sdrEnabled"
                                                color="primary"
                                                checked={values.sdrEnabled}
                                                onChange={handleChange}
                                            />
                                        }
                                        label="Habilitar modo SDR"
                                    />
                                </Grid>

                                {values.sdrEnabled && (
                                <>
                                {/* ICP - Perfil do Cliente Ideal */}
                                <Grid item xs={12}>
                                    <Box mt={2} mb={1}>
                                        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                                            📌 Perfil do Cliente Ideal (ICP)
                                        </Typography>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Segmentos-alvo"
                                        placeholder="Ex: loja iluminação, arquiteto, construtora"
                                        value={values.sdrICP?.segments?.join(", ") || ""}
                                        onChange={(e) => {
                                            const segments = e.target.value.split(",").map(s => s.trim()).filter(s => s);
                                            setFieldValue("sdrICP", { ...values.sdrICP, segments });
                                        }}
                                        helperText="Separe por vírgula"
                                        variant="outlined"
                                        size="small"
                                    />
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Regiões"
                                        placeholder="Ex: SP, RJ, MG"
                                        value={values.sdrICP?.regions?.join(", ") || ""}
                                        onChange={(e) => {
                                            const regions = e.target.value.split(",").map(s => s.trim()).filter(s => s);
                                            setFieldValue("sdrICP", { ...values.sdrICP, regions });
                                        }}
                                        helperText="Separe por vírgula"
                                        variant="outlined"
                                        size="small"
                                    />
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth variant="outlined" size="small">
                                        <InputLabel>Porte das Empresas</InputLabel>
                                        <Select
                                            multiple
                                            value={values.sdrICP?.sizes || []}
                                            onChange={(e) => setFieldValue("sdrICP", { ...values.sdrICP, sizes: e.target.value })}
                                            label="Porte das Empresas"
                                            renderValue={(selected) => selected.join(", ")}
                                        >
                                            <MenuItem value="micro">Micro</MenuItem>
                                            <MenuItem value="pequeno">Pequeno</MenuItem>
                                            <MenuItem value="medio">Médio</MenuItem>
                                            <MenuItem value="grande">Grande</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth variant="outlined" size="small">
                                        <InputLabel>Metodologia</InputLabel>
                                        <Select
                                            name="sdrMethodology"
                                            value={values.sdrMethodology}
                                            onChange={handleChange}
                                            label="Metodologia"
                                        >
                                            <MenuItem value="BANT">BANT (Budget, Authority, Need, Timeline)</MenuItem>
                                            <MenuItem value="SPIN">SPIN (Situation, Problem, Implication, Need)</MenuItem>
                                            <MenuItem value="GPCT">GPCT (Goals, Plans, Challenges, Timeline)</MenuItem>
                                            <MenuItem value="custom">Personalizada</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Critérios Adicionais de Qualificação"
                                        name="sdrICP.criteria"
                                        value={values.sdrICP?.criteria || ""}
                                        onChange={(e) => setFieldValue("sdrICP", { ...values.sdrICP, criteria: e.target.value })}
                                        multiline
                                        rows={2}
                                        variant="outlined"
                                        size="small"
                                        placeholder="Ex: Empresas com faturamento acima de R$50k/mês, que já trabalham com iluminação..."
                                    />
                                </Grid>

                                {/* Perguntas de Qualificação */}
                                <Grid item xs={12}>
                                    <Box mt={2} mb={1}>
                                        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                                            📋 Perguntas de Qualificação
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            Perguntas que o SDR fará para qualificar o lead
                                        </Typography>
                                    </Box>
                                </Grid>

                                {values.sdrQualificationQuestions?.map((q, index) => (
                                    <Grid item xs={12} key={index}>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <TextField
                                                fullWidth
                                                label={`Pergunta ${index + 1} (${q.type})`}
                                                value={q.question}
                                                onChange={(e) => {
                                                    const updated = [...values.sdrQualificationQuestions];
                                                    updated[index] = { ...updated[index], question: e.target.value };
                                                    setFieldValue("sdrQualificationQuestions", updated);
                                                }}
                                                variant="outlined"
                                                size="small"
                                            />
                                            <TextField
                                                label="Pts"
                                                type="number"
                                                value={q.points}
                                                onChange={(e) => {
                                                    const updated = [...values.sdrQualificationQuestions];
                                                    updated[index] = { ...updated[index], points: parseInt(e.target.value) || 0 };
                                                    setFieldValue("sdrQualificationQuestions", updated);
                                                }}
                                                variant="outlined"
                                                size="small"
                                                style={{ width: 80 }}
                                            />
                                            <IconButton
                                                size="small"
                                                onClick={() => {
                                                    const updated = values.sdrQualificationQuestions.filter((_, i) => i !== index);
                                                    setFieldValue("sdrQualificationQuestions", updated);
                                                }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    </Grid>
                                ))}

                                <Grid item xs={12}>
                                    <Button
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={() => {
                                            const updated = [...(values.sdrQualificationQuestions || []), {
                                                question: "",
                                                type: "custom",
                                                points: 10
                                            }];
                                            setFieldValue("sdrQualificationQuestions", updated);
                                        }}
                                    >
                                        Adicionar Pergunta
                                    </Button>
                                </Grid>

                                {/* Scoring */}
                                <Grid item xs={12}>
                                    <Box mt={2} mb={1}>
                                        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                                            📊 Scoring de Lead
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary">
                                            Pontuação automática baseada em ações do cliente
                                        </Typography>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} sm={4}>
                                    <TextField
                                        fullWidth
                                        label="Match com ICP"
                                        type="number"
                                        value={values.sdrScoringRules?.icpMatch || 0}
                                        onChange={(e) => setFieldValue("sdrScoringRules", { ...values.sdrScoringRules, icpMatch: parseInt(e.target.value) || 0 })}
                                        variant="outlined"
                                        size="small"
                                        helperText="pts"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <TextField
                                        fullWidth
                                        label="Tem CNPJ"
                                        type="number"
                                        value={values.sdrScoringRules?.hasCnpj || 0}
                                        onChange={(e) => setFieldValue("sdrScoringRules", { ...values.sdrScoringRules, hasCnpj: parseInt(e.target.value) || 0 })}
                                        variant="outlined"
                                        size="small"
                                        helperText="pts"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <TextField
                                        fullWidth
                                        label="Tem Email"
                                        type="number"
                                        value={values.sdrScoringRules?.hasEmail || 0}
                                        onChange={(e) => setFieldValue("sdrScoringRules", { ...values.sdrScoringRules, hasEmail: parseInt(e.target.value) || 0 })}
                                        variant="outlined"
                                        size="small"
                                        helperText="pts"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <TextField
                                        fullWidth
                                        label="Pediu Preço"
                                        type="number"
                                        value={values.sdrScoringRules?.askedPrice || 0}
                                        onChange={(e) => setFieldValue("sdrScoringRules", { ...values.sdrScoringRules, askedPrice: parseInt(e.target.value) || 0 })}
                                        variant="outlined"
                                        size="small"
                                        helperText="pts"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <TextField
                                        fullWidth
                                        label="Mencionou Urgência"
                                        type="number"
                                        value={values.sdrScoringRules?.mentionedUrgency || 0}
                                        onChange={(e) => setFieldValue("sdrScoringRules", { ...values.sdrScoringRules, mentionedUrgency: parseInt(e.target.value) || 0 })}
                                        variant="outlined"
                                        size="small"
                                        helperText="pts"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <TextField
                                        fullWidth
                                        label="Pediu Atendente"
                                        type="number"
                                        value={values.sdrScoringRules?.requestedHuman || 0}
                                        onChange={(e) => setFieldValue("sdrScoringRules", { ...values.sdrScoringRules, requestedHuman: parseInt(e.target.value) || 0 })}
                                        variant="outlined"
                                        size="small"
                                        helperText="pts"
                                    />
                                </Grid>

                                {/* Transferência */}
                                <Grid item xs={12}>
                                    <Box mt={2} mb={1}>
                                        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                                            🔥 Gatilhos de Transferência para Closer
                                        </Typography>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <Typography variant="body2" gutterBottom>
                                        Score mínimo para transferir: <strong>{values.sdrMinScoreToTransfer} pts</strong>
                                    </Typography>
                                    <Slider
                                        value={values.sdrMinScoreToTransfer}
                                        onChange={(e, newValue) => setFieldValue("sdrMinScoreToTransfer", newValue)}
                                        min={0}
                                        max={150}
                                        step={5}
                                        valueLabelDisplay="auto"
                                    />
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth variant="outlined" size="small">
                                        <InputLabel>Gatilhos Automáticos</InputLabel>
                                        <Select
                                            multiple
                                            value={values.sdrTransferTriggers || []}
                                            onChange={(e) => setFieldValue("sdrTransferTriggers", e.target.value)}
                                            label="Gatilhos Automáticos"
                                            renderValue={(selected) => selected.join(", ")}
                                        >
                                            <MenuItem value="pediu_orcamento">Pediu orçamento formal</MenuItem>
                                            <MenuItem value="prazo_urgente">Mencionou prazo urgente</MenuItem>
                                            <MenuItem value="score_minimo">Score atingiu mínimo</MenuItem>
                                            <MenuItem value="pediu_reuniao">Pediu reunião/demonstração</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        fullWidth
                                        label="Tag Lead Quente"
                                        name="sdrHotLeadTag"
                                        value={values.sdrHotLeadTag}
                                        onChange={handleChange}
                                        variant="outlined"
                                        size="small"
                                        helperText="Tag adicionada quando score atinge mínimo"
                                    />
                                </Grid>

                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Mensagem de Handoff"
                                        name="sdrHandoffMessage"
                                        value={values.sdrHandoffMessage}
                                        onChange={handleChange}
                                        multiline
                                        rows={2}
                                        variant="outlined"
                                        size="small"
                                        helperText="Mensagem enviada ao transferir para o closer"
                                    />
                                </Grid>

                                {/* Agendamento */}
                                <Grid item xs={12}>
                                    <Box mt={2} mb={1}>
                                        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                                            📅 Agendamento de Reuniões
                                        </Typography>
                                    </Box>
                                </Grid>

                                <Grid item xs={12}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                name="sdrSchedulingEnabled"
                                                color="primary"
                                                checked={values.sdrSchedulingEnabled}
                                                onChange={handleChange}
                                            />
                                        }
                                        label="Habilitar agendamento de reuniões"
                                    />
                                </Grid>

                                {values.sdrSchedulingEnabled && (
                                <>
                                    <Grid item xs={12}>
                                        <TextField
                                            fullWidth
                                            label="Link do Calendário"
                                            name="sdrCalendarLink"
                                            value={values.sdrCalendarLink}
                                            onChange={handleChange}
                                            variant="outlined"
                                            size="small"
                                            placeholder="https://calendly.com/sua-empresa/reuniao"
                                            helperText="Calendly, Google Calendar, etc."
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <TextField
                                            fullWidth
                                            label="Mensagem de Convite"
                                            name="sdrSchedulingMessage"
                                            value={values.sdrSchedulingMessage}
                                            onChange={handleChange}
                                            multiline
                                            rows={2}
                                            variant="outlined"
                                            size="small"
                                        />
                                    </Grid>
                                </>
                                )}
                                </>
                                )}
                            </Grid>
                            </>
                            )}

                            {/* Status - sempre visível */}
                            <Box mt={3}>
                                <FormControl fullWidth>
                                    <InputLabel>Status</InputLabel>
                                    <Select
                                        name="status"
                                        value={values.status}
                                        onChange={handleChange}
                                    >
                                        <MenuItem value="active">Ativo</MenuItem>
                                        <MenuItem value="inactive">Inativo</MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>
                        </DialogContent>

                        <DialogActions>
                            <Button onClick={handleClose}>Cancelar</Button>
                            <Button type="submit" variant="contained" color="primary">
                                Salvar
                            </Button>
                        </DialogActions>
                    </Form>
                )
                }
            </Formik>

            <Dialog
                open={openSystemHelp}
                onClose={() => setOpenSystemHelp(false)}
                maxWidth="md"
                fullWidth
                scroll="paper"
            >
                <DialogTitle>Como o sistema monta o prompt do agente</DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                        O campo <b>Prompt do Sistema</b> é o texto que você controla. Porém, o Whaticket também aplica automaticamente regras e contexto antes de enviar para a IA.
                        Este resumo te ajuda a entender o que já está parametrizado e o que você precisa escrever no prompt.
                    </Typography>

                    <Box mt={2}>
                        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>1) Contexto automático (CRM)</Typography>
                        <Typography variant="body2" color="textSecondary">
                            O sistema injeta no prompt dados do contato quando existirem (nome, empresa, cidade, segmento, situação, CNPJ e email).
                        </Typography>
                    </Box>

                    <Box mt={2}>
                        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>2) RAG (base de conhecimento)</Typography>
                        <Typography variant="body2" color="textSecondary">
                            A IA pode consultar a base (RAG). Se não houver informação, ela deve evitar inventar e pode oferecer transferência.
                        </Typography>
                    </Box>

                    <Box mt={2}>
                        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>3) Ferramentas (Function Calling)</Typography>
                        <Typography variant="body2" color="textSecondary">
                            As funções ficam disponíveis para a IA executar ações reais (enviar catálogos, listar opções, enviar tabela, buscar produto detalhado, transferir para humano, etc.).
                            Você pode restringir por etapa em <b>Funções Habilitadas</b>.
                        </Typography>
                    </Box>

                    <Box mt={2}>
                        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>4) Regra de qualificação (CNPJ + email)</Typography>
                        <Typography variant="body2" color="textSecondary">
                            Se <b>Qualificação de Lead</b> estiver ativa, o sistema orienta a IA a coletar dados faltantes.
                            Regras atuais:
                        </Typography>
                        <Box mt={1}>
                            <Typography variant="body2">- Catálogos (lite e premium): <b>podem</b> ser enviados sem CNPJ/email</Typography>
                            <Typography variant="body2">- Tabela de preços e condições comerciais: <b>exige</b> CNPJ + email antes de enviar</Typography>
                        </Box>
                    </Box>

                    <Box mt={2}>
                        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>5) Validações ao salvar dados</Typography>
                        <Typography variant="body2" color="textSecondary">
                            Ao salvar dados via função <b>atualizar_contato</b>:
                        </Typography>
                        <Box mt={1}>
                            <Typography variant="body2">- CNPJ é validado (dígitos verificadores). Se inválido, não salva.</Typography>
                            <Typography variant="body2">- Email é validado (formato + MX). Se inválido, não salva.</Typography>
                        </Box>
                    </Box>

                    <Box mt={2}>
                        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>6) Horário de funcionamento e Timeout</Typography>
                        <Typography variant="body2" color="textSecondary">
                            Se configurado, o sistema injeta no prompt a informação se está dentro/fora do horário.
                            E existe job de inatividade que pode fechar/transferir tickets em status bot.
                        </Typography>
                    </Box>

                    <Box mt={3}>
                        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>O que você deve escrever no Prompt do Sistema</Typography>
                        <Typography variant="body2" color="textSecondary">
                            Use o prompt para descrever a personalidade do agente, regras de negócio específicas, scripts de atendimento, como perguntar dados (um de cada vez),
                            e como decidir qual ferramenta usar. Evite repetir regras técnicas (validação, MX, etc.) porque isso já é aplicado no sistema.
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenSystemHelp(false)} color="primary" variant="contained">
                        Entendi
                    </Button>
                </DialogActions>
            </Dialog>
        </Dialog>
    );
};

export default AIAgentModal;
