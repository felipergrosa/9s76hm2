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
    AccordionDetails
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
                                {/* Tipo de Voz */}
                                <Grid item xs={12} sm={6}>
                                    <FormControl fullWidth>
                                        <InputLabel>Tipo de Voz</InputLabel>
                                        <Select name="voiceType" value={values.voiceType} onChange={handleChange}>
                                            <MenuItem value="text">Texto (DEBUG - liberado)</MenuItem>
                                            <MenuItem value="generated">Voz Gerada (TTS)</MenuItem>
                                            <MenuItem value="enabled">Voz Habilitada (Azure)</MenuItem>
                                        </Select>
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
                                                        <TextField
                                                            fullWidth
                                                            label="Prompt do Sistema"
                                                            name={`funnelStages[${index}].systemPrompt`}
                                                            value={stage.systemPrompt}
                                                            onChange={handleChange}
                                                            multiline
                                                            rows={3}
                                                            error={touched.funnelStages?.[index]?.systemPrompt && Boolean(errors.funnelStages?.[index]?.systemPrompt)}
                                                        />
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
            </Formik >
        </Dialog >
    );
};

export default AIAgentModal;
