import React, { useState, useEffect, useRef } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Switch,
  FormControlLabel,
  Box,
  Chip,
  Tooltip,
  IconButton,
  Divider,
  Card,
  CardContent,
  CardActions,
  Link,
  ClickAwayListener,
  Popover,
  CircularProgress,
} from "@material-ui/core";
import QueueSelectSingle from "../QueueSelectSingle";
import AIIntegrationSelector from "../AIIntegrationSelector";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  multFieldLine: {
    display: "flex",
    "& > *:not(:last-child)": {
      marginRight: theme.spacing(1),
    },
  },
  btnWrapper: {
    position: "relative",
  },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  colorAdorment: {
    width: 20,
    height: 20,
  },
}));


const PromptSchema = Yup.object().shape({
  name: Yup.string()
    .min(5, "Muito curto!")
    .max(100, "Muito longo!")
    .required("Obrigatório"),
  prompt: Yup.string()
    .min(50, "Muito curto!")
    .required("Descreva o treinamento para Inteligência Artificial"),
  integrationId: Yup.number().when('useGlobalConfig', {
    is: false,
    then: Yup.number().required("Selecione uma integração IA"),
    otherwise: Yup.number().notRequired(),
  }),
  queueId: Yup.number().required("Informe a fila"),
  maxMessages: Yup.number()
    .min(1, "Mínimo 1 mensagem")
    .max(50, "Máximo 50 mensagens")
    .required("Informe o número máximo de mensagens"),
  voice: Yup.string().when("model", {
    is: "gpt-3.5-turbo-1106",
    then: Yup.string().required("Informe o modo para Voz"),
    otherwise: Yup.string().notRequired(),
  }),
  voiceKey: Yup.string().notRequired(),
  voiceRegion: Yup.string().notRequired(),
  temperature: Yup.number()
    .min(0, "Mínimo 0")
    .max(2, "Máximo 2")
    .notRequired(),
  maxTokens: Yup.number()
    .min(1, "Mínimo 1 token")
    .max(4000, "Máximo 4000 tokens")
    .notRequired(),
});

const PromptModal = ({ open, onClose, promptId, templateData }) => {
  const classes = useStyles();
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);
  const [useGlobalConfig, setUseGlobalConfig] = useState(false);

  const initialState = {
    name: "",
    prompt: "",
    integrationId: null,
    queueId: null,
    maxMessages: 10,
    voice: "texto",
    voiceKey: "",
    voiceRegion: "",
    temperature: 0.9,
    maxTokens: 300,
    useGlobalConfig: false,
  };

  const [prompt, setPrompt] = useState(initialState);
  const promptInputRef = useRef(null);
  const [tagsAnchorEl, setTagsAnchorEl] = useState(null);
  const [tagsSearch, setTagsSearch] = useState("");
  const [filesSearch] = useState(""); // Usado no useEffect
  const [fileLists, setFileLists] = useState([]); // Usado no useEffect
  const [selectedOptions, setSelectedOptions] = useState([]); // [{fileListId, optionId, name, path, mediaType}]
  const [voiceTipsAnchorEl, setVoiceTipsAnchorEl] = useState(null);

  const openVoiceTips = Boolean(voiceTipsAnchorEl);
  const handleOpenVoiceTips = (event) => setVoiceTipsAnchorEl(event.currentTarget);
  const handleCloseVoiceTips = () => setVoiceTipsAnchorEl(null);

  const mustacheVars = [
    // Contato
    { key: "firstName", label: "firstName", desc: "Primeiro nome do contato", category: "Contato", alias: "#primeiro-nome" },
    { key: "name", label: "name", desc: "Nome completo do contato", category: "Contato", alias: "#nome" },
    { key: "email", label: "email", desc: "Email do contato", category: "Contato", alias: "#email" },
    { key: "cpfCnpj", label: "cpfCnpj", desc: "CPF/CNPJ do contato", category: "Contato", alias: "#cnpj-cpf" },
    { key: "representativeCode", label: "representativeCode", desc: "Código do representante", category: "Contato", alias: "#codigo-representante" },
    { key: "city", label: "city", desc: "Cidade", category: "Contato", alias: "#cidade" },
    { key: "situation", label: "situation", desc: "Situação do cliente", category: "Contato", alias: "#situacao" },
    { key: "fantasyName", label: "fantasyName", desc: "Nome fantasia", category: "Contato", alias: "#fantasia" },
    { key: "foundationDate", label: "foundationDate", desc: "Data de fundação (DD-MM-YYYY)", category: "Contato", alias: "#data-fundacao" },
    { key: "creditLimit", label: "creditLimit", desc: "Limite de crédito", category: "Contato", alias: "#limite-credito" },
    { key: "segment", label: "segment", desc: "Segmento de mercado", category: "Contato", alias: "#segmento" },

    // Atendimento
    { key: "ticket_id", label: "ticket_id", desc: "ID do ticket", category: "Atendimento", alias: "#ticket" },
    { key: "userName", label: "userName", desc: "Nome do atendente", category: "Atendimento", alias: "#atendente" },
    { key: "queue", label: "queue", desc: "Nome da fila", category: "Atendimento", alias: "#fila" },
    { key: "connection", label: "connection", desc: "Nome da conexão/WhatsApp", category: "Atendimento", alias: "#conexao" },
    { key: "protocol", label: "protocol", desc: "Protocolo único da conversa", category: "Atendimento", alias: "#protocolo" },

    // Data/Hora
    { key: "date", label: "date", desc: "Data atual (DD-MM-YYYY)", category: "Data/Hora", alias: "#data" },
    { key: "hour", label: "hour", desc: "Hora atual (HH:MM:SS)", category: "Data/Hora", alias: "#hora" },
    { key: "data_hora", label: "data_hora", desc: "Data e hora juntas (ex.: 01-01-2025 às 10:30:00)", category: "Data/Hora", alias: "#data-hora" },

    // Saudação
    { key: "ms", label: "ms", desc: "Saudação contextual (Bom dia/Boa tarde/Boa noite/Boa madrugada)", category: "Saudação/Contexto", alias: "#saudacao" },
    { key: "saudacao", label: "saudacao", desc: "Alias de ms (saudação contextual)", category: "Saudação/Contexto", alias: "#saudacao" },
    { key: "periodo_dia", label: "periodo_dia", desc: "Período do dia: manhã, tarde, noite ou madrugada", category: "Saudação/Contexto", alias: "#periodo-dia" },

    // Empresa
    { key: "name_company", label: "name_company", desc: "Nome da empresa", category: "Empresa", alias: "#empresa" },
  ];

  const groupedVars = mustacheVars.reduce((acc, v) => {
    const cat = v.category || "Outros";
    acc[cat] = acc[cat] || [];
    acc[cat].push(v);
    return acc;
  }, {});

  const openTags = Boolean(tagsAnchorEl);
  const handleOpenTags = (event) => setTagsAnchorEl(event.currentTarget);
  const handleCloseTags = () => setTagsAnchorEl(null);

  const insertAtCursor = (text, setFieldValue, values) => {
    const textarea = promptInputRef.current;
    const insertion = `{{${text}}}`;
    if (textarea && typeof textarea.selectionStart === "number") {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = values.prompt.slice(0, start);
      const after = values.prompt.slice(end);
      const next = before + insertion + after;
      setFieldValue("prompt", next);
      // reposiciona o cursor após a inserção
      requestAnimationFrame(() => {
        textarea.focus();
        const pos = start + insertion.length;
        textarea.setSelectionRange(pos, pos);
      });
    } else {
      setFieldValue("prompt", (values.prompt || "") + insertion);
    }
  };

  useEffect(() => {
    // status da criptografia
    const loadEncryptionStatus = async () => {
      try {
        const { data } = await api.get('/ai/encryption-status');
        setEncryptionEnabled(Boolean(data?.encryptionEnabled));
      } catch (_) {
        setEncryptionEnabled(true); // assume habilitado se não conseguir verificar
      }
    };
    loadEncryptionStatus();

    const fetchPrompt = async () => {
      if (!promptId) {
        setPrompt(initialState);
        setSelectedIntegration(null);
        return;
      }
      try {
        const { data } = await api.get(`/prompt/${promptId}`);
        // Debug: verificar se integrationId foi carregado
        console.log('Prompt carregado - integrationId:', data.integrationId);
        
        setPrompt({
          ...initialState,
          ...data,
          queueId: data.queueId || null,
          integrationId: data.integrationId || null,
        });
        
        // Buscar dados completos da integração se existir integrationId
        if (data.integrationId) {
          try {
            const { data: integrationData } = await api.get(`/queueIntegration/${data.integrationId}`);
            let integration = integrationData && (integrationData.queueIntegration || integrationData);
            if (integration && integration.jsonContent) {
              try {
                const parsed = JSON.parse(integration.jsonContent);
                const masked = typeof parsed?.apiKey === 'string' && parsed.apiKey.endsWith('********');
                integration = {
                  ...integration,
                  apiKey: masked ? parsed.apiKey : (parsed.apiKey || integration.apiKey),
                  model: parsed.model ?? integration.model,
                  temperature: parsed.temperature ?? integration.temperature,
                  maxTokens: parsed.maxTokens ?? integration.maxTokens,
                  maxMessages: parsed.maxMessages ?? integration.maxMessages,
                  topP: parsed.topP ?? integration.topP,
                  presencePenalty: parsed.presencePenalty ?? integration.presencePenalty,
                  creativity: parsed.creativityLevel ?? integration.creativity,
                };
              } catch (_) {}
            }
            setSelectedIntegration(integration);
          } catch (err) {
            console.error('Erro ao buscar integração:', err);
            setSelectedIntegration(null);
          }
        } else {
          setSelectedIntegration(null);
        }
        
        // Restaurar anexos selecionados, se houver
        try {
          if (data.attachments) {
            const parsed = typeof data.attachments === 'string' ? JSON.parse(data.attachments) : data.attachments;
            if (Array.isArray(parsed)) setSelectedOptions(parsed);
          } else {
            setSelectedOptions([]);
          }
        } catch (_) {
          setSelectedOptions([]);
        }
      } catch (err) {
        toastError(err);
      }
    };

    fetchPrompt();

    // carregar lista simples de arquivos
    const fetchFiles = async () => {
      try {
        const { data } = await api.get(`/files/list`, { params: { searchParam: filesSearch } });
        setFileLists(Array.isArray(data) ? data : []);
      } catch (err) {
        // silencioso
      }
    };
    fetchFiles();
  }, [promptId, open, templateData]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get(`/files/list`, { params: { searchParam: filesSearch } });
        if (active) setFileLists(Array.isArray(data) ? data : []);
      } catch (_) {}
    })();
    return () => { active = false; };
  }, [filesSearch]);
  // useEffect para aplicar template quando modal abrir
  useEffect(() => {
    if (open && !promptId && templateData) {
      console.log('Template detectado no useEffect:', templateData);
      
      // Aplicar dados básicos do template
      const templatePromptData = {
        ...initialState,
        name: templateData.name || "",
        prompt: templateData.prompt || "",
        // Aplicar voz sugerida se disponível
        voice: templateData.suggestedVoices && templateData.suggestedVoices.length > 0 
          ? templateData.suggestedVoices[0] 
          : "texto",
        // Configurações padrão baseadas no template
        maxMessages: 10,
        voiceKey: "",
        voiceRegion: "",
        // Aplicar temperatura se disponível no template
        temperature: templateData.temperature || 0.9,
        maxTokens: templateData.maxTokens || 300,
      };
      
      setPrompt(templatePromptData);
      setSelectedOptions([]);
      
      // Limpar integração selecionada para permitir nova seleção
      setSelectedIntegration(null);
      
      console.log('Template aplicado:', {
        name: templatePromptData.name,
        voice: templatePromptData.voice,
        suggestedVoices: templateData.suggestedVoices,
        integrationType: templateData.integrationType
      });
      
      // Mostrar toast com informações do template aplicado
      if (templateData.suggestedVoices && templateData.suggestedVoices.length > 0) {
        const voiceName = templateData.suggestedVoices[0].replace('pt-BR-', '').replace('Neural', '');
        toast.info(`🎤 Voz "${voiceName}" aplicada automaticamente do template`);
      }
    }
  }, [open, promptId, templateData, initialState]);

  const handleClose = () => {
    setPrompt(initialState);
    setSelectedOptions([]);
    onClose();
  };

  const handleSavePrompt = async (values, { setSubmitting, setErrors }) => {
    try {
      // Debug: verificar dados antes de salvar
      console.log('Salvando prompt com integrationId:', values.integrationId);
      
      const promptData = {
        ...values,
        // IMPORTANTE: Tratar configurações globais vs específicas
        integrationId: useGlobalConfig ? null : values.integrationId,
        voice: (selectedIntegration?.model === "gpt-3.5-turbo-1106") ? values.voice : "texto",
        attachments: JSON.stringify(selectedOptions || []),
        // Usar dados da integração específica OU valores do template/form para configurações globais
        apiKey: useGlobalConfig ? "" : (selectedIntegration?.apiKey || ""),
        model: useGlobalConfig ? "" : (selectedIntegration?.model || "gpt-3.5-turbo-1106"),
        maxTokens: useGlobalConfig ? values.maxTokens : (Number(selectedIntegration?.maxTokens) || values.maxTokens || 300),
        temperature: useGlobalConfig ? values.temperature : (Number(selectedIntegration?.temperature) || values.temperature || 0.9),
        useGlobalConfig: useGlobalConfig,
      };
      
      if (promptId) {
        await api.put(`/prompt/${promptId}`, promptData);
      } else {
        await api.post("/prompt", promptData);
      }
      toast.success(i18n.t("promptModal.success"));
      handleClose();
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Erro ao salvar o prompt";
      toastError(errorMessage);
      try {
        const parsedError = JSON.parse(errorMessage);
        if (parsedError.errors) {
          const fieldErrors = {};
          parsedError.errors.forEach(error => {
            if (error.includes("NAME")) fieldErrors.name = error;
            if (error.includes("PROMPT")) fieldErrors.prompt = error;
            if (error.includes("MODEL")) fieldErrors.model = error;
            if (error.includes("TOKENS")) fieldErrors.maxTokens = error;
            if (error.includes("TEMPERATURE")) fieldErrors.temperature = error;
            if (error.includes("APIKEY")) fieldErrors.apiKey = error;
            if (error.includes("QUEUEID")) fieldErrors.queueId = error;
            if (error.includes("MESSAGES")) fieldErrors.maxMessages = error;
            if (error.includes("VOICE")) fieldErrors.voice = error;
          });
          setErrors(fieldErrors);
        }
      } catch (jsonError) {
        // Se não for um JSON, apenas exibir o erro genérico
      }
      setSubmitting(false);
    }
  };

  return (
    <div className={classes.root}>
      <Dialog 
        open={open} 
        onClose={handleClose} 
        maxWidth="md" 
        scroll="paper" 
        fullWidth
        PaperProps={{
          style: {
            maxHeight: '90vh',
            height: '90vh'
          }
        }}
      >
        <DialogTitle id="form-dialog-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {promptId ? i18n.t("promptModal.title.edit") : i18n.t("promptModal.title.add")}
            <Tooltip
              title={(
                <span>
                  Crie prompts para uso com modelos de IA no WhatsApp e campanhas.<br/>
                  • A API Key é usada somente no servidor e será criptografada se a criptografia estiver habilitada.<br/>
                  • Use variáveis no texto, por exemplo: {"{nome}"} {"{empresa}"}.
                </span>
              )}
              placement="right"
            >
              <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.7 }} />
            </Tooltip>
          </span>
        </DialogTitle>
        <Formik
          initialValues={prompt}
          enableReinitialize={true}
          validationSchema={PromptSchema}
          onSubmit={handleSavePrompt}
        >
          {({ touched, errors, isSubmitting, values, setFieldValue }) => (
            <Form style={{ width: "100%" }}>
              <DialogContent 
                dividers 
                style={{ 
                  overflowY: 'auto', 
                  overflowX: 'hidden',
                  maxHeight: 'calc(90vh - 140px)' 
                }}
              >
                <Typography variant="body2" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.7 }} />
                  Preencha os campos abaixo. Dica: personalize o texto do Prompt usando variáveis como {"{nome}"}, {"{pedido}"}.
                </Typography>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <Field
                      as={TextField}
                      label={i18n.t("promptModal.form.name")}
                      name="name"
                      error={touched.name && Boolean(errors.name)}
                      helperText={touched.name ? errors.name : "Um rótulo para identificar este Prompt (ex.: Boas-vindas)"}
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      required
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Typography variant="caption" style={{ opacity: 0.8 }}>
                        Configuração IA
                      </Typography>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Typography variant="caption" style={{ fontSize: '0.75rem' }}>
                          Específica
                        </Typography>
                        <input
                          type="checkbox"
                          checked={useGlobalConfig}
                          onChange={(e) => {
                            setUseGlobalConfig(e.target.checked);
                            if (e.target.checked) {
                              setFieldValue('integrationId', null);
                              setSelectedIntegration(null);
                            }
                          }}
                          style={{ margin: '0 4px' }}
                        />
                        <Typography variant="caption" style={{ fontSize: '0.75rem' }}>
                          Global
                        </Typography>
                      </div>
                    </div>
                    {!useGlobalConfig ? (
                      <AIIntegrationSelector
                        value={values.integrationId}
                        onChange={(integrationId, integration) => {
                          setFieldValue('integrationId', integrationId);
                          setSelectedIntegration(integration);
                        }}
                        error={touched.integrationId && Boolean(errors.integrationId)}
                        helperText={touched.integrationId ? errors.integrationId : "Selecione uma integração IA"}
                        margin="dense"
                      />
                    ) : (
                      <div style={{ 
                        padding: 12, 
                        backgroundColor: '#f0f8ff', 
                        borderRadius: 4, 
                        border: '1px solid #2196f3' 
                      }}>
                        <Typography variant="body2" style={{ color: '#1976d2' }}>
                          🌐 Usando configurações globais de IA
                        </Typography>
                        <Typography variant="caption" style={{ color: '#666' }}>
                          As configurações definidas em "Configurações → IA" serão utilizadas
                        </Typography>
                      </div>
                    )}
                  </div>
                </div>

                {/* Informações do template aplicado */}
                {templateData && (
                  <div style={{ 
                    marginTop: 16, 
                    marginBottom: 16, 
                    padding: 12, 
                    backgroundColor: '#e3f2fd', 
                    borderRadius: 8, 
                    border: '1px solid #2196f3' 
                  }}>
                    <Typography variant="subtitle2" style={{ color: '#1976d2', marginBottom: 8 }}>
                      📋 Template Aplicado: {templateData.name}
                    </Typography>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      {templateData.difficulty && (
                        <Chip size="small" label={`Dificuldade: ${templateData.difficulty}`} style={{ backgroundColor: '#ff9800', color: 'white' }} />
                      )}
                      {templateData.score && (
                        <Chip size="small" label={`⭐ ${templateData.score}/10`} style={{ backgroundColor: '#4caf50', color: 'white' }} />
                      )}
                      {templateData.integrationType && (
                        <Chip size="small" label={`IA: ${templateData.integrationType === 'universal' ? 'Universal' : templateData.integrationType.toUpperCase()}`} color="primary" variant="outlined" />
                      )}
                      {templateData.temperature && (
                        <Chip size="small" label={`🌡️ Temp: ${templateData.temperature}`} style={{ backgroundColor: '#9c27b0', color: 'white' }} />
                      )}
                      {templateData.maxTokens && (
                        <Chip size="small" label={`🔢 Tokens: ${templateData.maxTokens}`} style={{ backgroundColor: '#607d8b', color: 'white' }} />
                      )}
                    </div>
                    {templateData.suggestedVoices && templateData.suggestedVoices.length > 0 && (
                      <Typography variant="caption" style={{ color: '#1976d2' }}>
                        🎤 Voz aplicada: {templateData.suggestedVoices[0].replace('pt-BR-', '').replace('Neural', '')}
                        {templateData.suggestedVoices.length > 1 && ` (+${templateData.suggestedVoices.length - 1} outras disponíveis)`}
                      </Typography>
                    )}
                    {templateData.ragSuggestions && templateData.ragSuggestions.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <Typography variant="caption" style={{ color: '#1976d2', display: 'block' }}>
                          🧠 RAG sugerido: {templateData.ragSuggestions.join(', ')}
                        </Typography>
                      </div>
                    )}
                    {templateData.variables && templateData.variables.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <Typography variant="caption" style={{ color: '#1976d2', display: 'block', marginBottom: 4 }}>
                          🏷️ Variáveis disponíveis ({templateData.variables.length}):
                        </Typography>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {templateData.variables.slice(0, 6).map((variable) => (
                            <Chip 
                              key={variable} 
                              size="small" 
                              label={`{${variable}}`} 
                              style={{ 
                                backgroundColor: '#2196f3', 
                                color: 'white', 
                                fontSize: '0.7rem',
                                height: 20
                              }} 
                            />
                          ))}
                          {templateData.variables.length > 6 && (
                            <Chip 
                              size="small" 
                              label={`+${templateData.variables.length - 6}`} 
                              variant="outlined"
                              style={{ height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption" style={{ opacity: 0.8 }}>Prompt</Typography>
                  <Link component="button" type="button" onClick={handleOpenTags} onMouseEnter={handleOpenTags} style={{ fontSize: 12 }}>
                    #Tags
                  </Link>
                </div>
                <div style={{ marginTop: 12 }}>
                  <Typography variant="subtitle2" style={{ marginBottom: 4, color: '#666' }}>
                    {useGlobalConfig ? '🌐 Configuração Global de IA' : '🎯 Configuração Específica de IA'}
                  </Typography>
                  <Typography variant="body2" style={{ marginBottom: 8, color: '#888', fontSize: '0.875rem' }}>
                    {useGlobalConfig 
                      ? 'Este prompt utilizará as configurações globais de IA definidas no menu Configurações. Ideal para padronização em toda a empresa.'
                      : 'Este prompt tem configurações específicas de IA. Permite personalização total para casos de uso únicos.'
                    }
                  </Typography>
                </div>
                
                <div style={{ marginTop: 12 }}>
                  <Typography variant="subtitle2" style={{ marginBottom: 4, color: '#666' }}>RAG Global Integrado</Typography>
                  <Typography variant="body2" style={{ marginBottom: 8, color: '#888', fontSize: '0.875rem' }}>
                    O sistema RAG alimenta automaticamente as conversas com conhecimento relevante dos arquivos da empresa.
                  </Typography>
                </div>
                <Field
                  as={TextField}
                  label={i18n.t("promptModal.form.prompt")}
                  name="prompt"
                  error={touched.prompt && Boolean(errors.prompt)}
                  helperText={touched.prompt ? errors.prompt : "Escreva as instruções do atendente IA. Você pode usar variáveis para personalizar a mensagem."}
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  required
                  minRows={10}
                  multiline
                  inputRef={promptInputRef}
                />
                <ClickAwayListener onClickAway={handleCloseTags}>
                  <Popover
                    open={openTags}
                    anchorEl={tagsAnchorEl}
                    onClose={handleCloseTags}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    disableRestoreFocus
                  >
                    <div style={{ padding: 12, maxWidth: 520 }}>
                      <Typography variant="subtitle2" style={{ marginBottom: 8 }}>Tags disponíveis para uso</Typography>
                      <TextField
                        value={tagsSearch}
                        onChange={e => setTagsSearch(e.target.value)}
                        placeholder="Filtrar tags..."
                        variant="outlined"
                        size="small"
                        fullWidth
                        style={{ marginBottom: 12 }}
                      />
                      {Object.keys(groupedVars).map(cat => {
                        const list = groupedVars[cat].filter(v => {
                          const q = (tagsSearch || "").toLowerCase();
                          if (!q) return true;
                          return (
                            v.label.toLowerCase().includes(q) ||
                            (v.desc && v.desc.toLowerCase().includes(q)) ||
                            (v.alias && v.alias.toLowerCase().includes(q))
                          );
                        });
                        if (!list.length) return null;
                        return (
                          <div key={cat} style={{ marginBottom: 12 }}>
                            <Chip label={cat} size="small" color="default" style={{ marginBottom: 8 }} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              {list.map(v => (
                                <div key={v.key} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <Tooltip title={v.desc} placement="top" arrow>
                                    <Button size="small" variant="text" onClick={() => insertAtCursor(v.label, setFieldValue, values)} style={{ textTransform: 'none' }}>
                                      {v.alias || `#${v.label}`}
                                    </Button>
                                  </Tooltip>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Popover>
                </ClickAwayListener>
                <Field
                  name="queueId"
                  component={({ field, form }) => (
                    <QueueSelectSingle
                      selectedQueueId={field.value}
                      onChange={value => form.setFieldValue("queueId", value)}
                    />
                  )}
                />
                
                <Divider style={{ margin: '24px 0 16px 0' }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>

                  <Typography variant="h6" style={{ fontSize: '1.1rem', fontWeight: 500 }}>Voz e Transcrição</Typography>
                  <Link
                    component="button"
                    type="button"
                    onClick={handleOpenVoiceTips}
                    onMouseEnter={handleOpenVoiceTips}
                    style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.7 }} /> Dicas de uso
                  </Link>
                </div>
                <ClickAwayListener onClickAway={handleCloseVoiceTips}>
                  <Popover
                    open={openVoiceTips}
                    anchorEl={voiceTipsAnchorEl}
                    onClose={handleCloseVoiceTips}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    disableRestoreFocus
                  >
                    <div style={{ padding: 12, maxWidth: 560 }}>
                      <Typography variant="subtitle2" style={{ marginBottom: 8 }}>Como configurar áudio para texto (STT) e texto para áudio (TTS)</Typography>
                      <Typography variant="body2" gutterBottom>
                        • STT (Transcrição): configure a chave no backend em <b>Setting.apiTranscription</b> usando um provedor suportado (OpenAI Whisper ou Google Gemini).<br/>
                        • TTS (Síntese de Voz): preencha abaixo <b>voice</b> (uma voz Azure válida), <b>voiceKey</b> e <b>voiceRegion</b>.
                      </Typography>
                      <Typography variant="body2" gutterBottom>
                        <b>Passos rápidos</b><br/>
                        1) Escolha o provedor de STT e gere a API Key:<br/>
                        — OpenAI: <Link href="https://platform.openai.com" target="_blank" rel="noopener">https://platform.openai.com</Link><br/>
                        — Google Gemini: <Link href="https://ai.google.dev/" target="_blank" rel="noopener">https://ai.google.dev/</Link><br/>
                        Salve a chave em <b>Setting.apiTranscription</b> no sistema.
                      </Typography>
                      <Typography variant="body2" gutterBottom>
                        2) Para TTS (Microsoft Azure Speech):<br/>
                        — Crie um recurso <i>Speech</i> no Azure Portal.<br/>
                        — Copie <b>Key</b> e <b>Region</b> (ex.: brazilsouth, eastus).<br/>
                        — Selecione uma voz, por exemplo: <code>pt-BR-AntonioNeural</code> ou <code>pt-BR-FranciscaNeural</code>.<br/>
                        Docs: <Link href="https://learn.microsoft.com/azure/ai-services/speech-service/" target="_blank" rel="noopener">Azure Speech Service</Link>
                      </Typography>
                      <Typography variant="body2" gutterBottom>
                        3) Funcionamento:<br/>
                        — Ao receber um áudio, o sistema usa a chave de STT para transcrever.<br/>
                        — A IA responde usando o <b>model</b> definido neste Prompt.<br/>
                        — Se <b>voice</b> = "texto", envia resposta em texto; caso contrário, gera áudio via Azure TTS e envia o MP3.
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Dica: se você não precisa de áudio de retorno, deixe <b>voice = "texto"</b> e não preencha <b>voiceKey/voiceRegion</b>.
                      </Typography>
                    </div>
                  </Popover>
                </ClickAwayListener>
                
                {/* Voz e Temperatura na mesma linha */}
                <div className={classes.multFieldLine}>
                  <FormControl
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    disabled={selectedIntegration?.model !== "gpt-3.5-turbo-1106"}
                    error={touched.voice && Boolean(errors.voice)}
                  >
                    <InputLabel>{i18n.t("promptModal.form.voice")}</InputLabel>
                    <Field
                      as={Select}
                      label={i18n.t("promptModal.form.voice")}
                      name="voice"
                    >
                      <MenuItem value="texto">Texto</MenuItem>
                      <MenuItem value="pt-BR-FranciscaNeural">Francisca</MenuItem>
                      <MenuItem value="pt-BR-AntonioNeural">Antônio</MenuItem>
                      <MenuItem value="pt-BR-BrendaNeural">Brenda</MenuItem>
                      <MenuItem value="pt-BR-DonatoNeural">Donato</MenuItem>
                      <MenuItem value="pt-BR-ElzaNeural">Elza</MenuItem>
                      <MenuItem value="pt-BR-FabioNeural">Fábio</MenuItem>
                      <MenuItem value="pt-BR-GiovannaNeural">Giovanna</MenuItem>
                      <MenuItem value="pt-BR-HumbertoNeural">Humberto</MenuItem>
                      <MenuItem value="pt-BR-JulioNeural">Julio</MenuItem>
                      <MenuItem value="pt-BR-LeilaNeural">Leila</MenuItem>
                      <MenuItem value="pt-BR-LeticiaNeural">Letícia</MenuItem>
                      <MenuItem value="pt-BR-ManuelaNeural">Manuela</MenuItem>
                      <MenuItem value="pt-BR-NicolauNeural">Nicolau</MenuItem>
                      <MenuItem value="pt-BR-ValerioNeural">Valério</MenuItem>
                      <MenuItem value="pt-BR-YaraNeural">Yara</MenuItem>
                    </Field>
                    {touched.voice && errors.voice && (
                      <div style={{ color: "red", fontSize: "12px" }}>{errors.voice}</div>
                    )}
                  </FormControl>
                  <Field
                    as={TextField}
                    label={i18n.t("promptModal.form.temperature")}
                    name="temperature"
                    error={touched.temperature && Boolean(errors.temperature)}
                    helperText={touched.temperature && errors.temperature}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    type="number"
                    inputProps={{
                      step: "0.1",
                      min: "0",
                      max: "1",
                    }}
                  />
                </div>
                
                {/* VoiceKey e VoiceRegion */}
                <div className={classes.multFieldLine}>
                  <Field
                    as={TextField}
                    label={i18n.t("promptModal.form.voiceKey")}
                    name="voiceKey"
                    error={touched.voiceKey && Boolean(errors.voiceKey)}
                    helperText={touched.voiceKey && errors.voiceKey}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    disabled={selectedIntegration?.model !== "gpt-3.5-turbo-1106"}
                  />
                  <Field
                    as={TextField}
                    label={i18n.t("promptModal.form.voiceRegion")}
                    name="voiceRegion"
                    error={touched.voiceRegion && Boolean(errors.voiceRegion)}
                    helperText={touched.voiceRegion && errors.voiceRegion}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    disabled={selectedIntegration?.model !== "gpt-3.5-turbo-1106"}
                  />
                </div>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("promptModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {promptId ? i18n.t("promptModal.buttons.okEdit") : i18n.t("promptModal.buttons.okAdd")}
                  {isSubmitting && (
                    <CircularProgress size={24} className={classes.buttonProgress} />
                  )}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default PromptModal;
