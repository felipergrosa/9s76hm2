import React, { useState, useEffect, useRef } from "react";

import * as Yup from "yup";
import { Formik, Form, Field, FormikConsumer } from "formik";
import { toast } from "react-toastify";

import {
  Typography,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
  Select,
  InputLabel,
  MenuItem,
  FormControl,
  TextField,
  Grid,
  Paper,
  Chip,
  IconButton,
  Popover,
  Tooltip,
  Link,
  ClickAwayListener,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Switch,
} from "@material-ui/core";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import HelpOutlineIcon from "@material-ui/icons/HelpOutline";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
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
  btnLeft: {
    display: "flex",
    marginRight: "auto",
    marginLeft: 12,
  },
  colorAdorment: {
    width: 20,
    height: 20,
  },
}));

// HelperText com clamp de 1 linha e "ver mais/menos"
const ClampHelperText = ({ children }) => {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // verifica overflow horizontal (uma linha)
    const check = () => {
      const hasOverflow = el.scrollWidth > el.clientWidth;
      setOverflowing(hasOverflow);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [children]);

  const baseStyle = expanded
    ? { display: 'block', whiteSpace: 'normal' }
    : { display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span ref={ref} style={{ ...baseStyle, flex: 1 }}>{children}</span>
      {!expanded && overflowing && (
        <Link component="button" type="button" onClick={() => setExpanded(true)} style={{ fontSize: 12 }}>ver mais</Link>
      )}
      {expanded && (
        <Link component="button" type="button" onClick={() => setExpanded(false)} style={{ fontSize: 12 }}>ver menos</Link>
      )}
    </span>
  );
};

const DialogflowSchema = Yup.object().shape({
  type: Yup.string().required(),
  name: Yup.string()
    .min(2, "Parâmetros incompletos!")
    .max(50, "Parâmetros acima do esperado!")
    .required("Required"),
  projectName: Yup.string().when('type', {
    is: (t) => t === 'dialogflow',
    then: Yup.string().min(2, "Parâmetros incompletos!").max(100, "Parâmetros acima do esperado!").required("Required"),
    otherwise: Yup.string().nullable(),
  }),
  jsonContent: Yup.string().when('type', {
    is: (t) => t === 'dialogflow',
    then: Yup.string().min(3, "Parâmetros incompletos!").required("Required"),
    otherwise: Yup.string().nullable(),
  }),
  language: Yup.string().when('type', {
    is: (t) => t === 'dialogflow',
    then: Yup.string().min(2, "Parâmetros incompletos!").max(50, "Parâmetros acima do esperado!").required("Required"),
    otherwise: Yup.string().nullable(),
  }),
});



const QueueIntegration = ({ open, onClose, integrationId }) => {
  const classes = useStyles();

  const initialState = {
    type: "typebot",
    name: "",
    projectName: "",
    jsonContent: "",
    language: "",
    urlN8N: "",
    typebotDelayMessage: 1000,
    typebotExpires: 1,
    typebotKeywordFinish: "",
    typebotKeywordRestart: "",
    typebotRestartMessage: "",
    typebotSlug: "",
    typebotUnknownMessage: "",
    // OpenAI fields
    apiKey: "",
    model: "gpt-3.5-turbo-1106",
    temperature: 1,
    maxTokens: 100,
    maxMessages: 10,
    // RAG (Base de Conhecimento)
    ragEnabled: false,
    ragTopK: 4,
    ragEmbeddingModel: "text-embedding-3-small",
    ragEmbeddingDims: 1536,
    // Advanced defaults
    brandVoice: "",
    tone: "amigável",
    emojiLevel: "medium",
    hashtags: "auto",
    customHashtags: "",
    length: "medium",
    outLanguage: "pt-BR",
    // Advanced controls
    creativityLevel: "medium", // low | medium | high
    permittedVariablesText: "", // ex: {nome} {empresa}
    // Advanced overrides
    advancedOverride: false,
    topP: 0.9,
    presencePenalty: 0.2,
  };

  const [integration, setIntegration] = useState(initialState);
  const [modelOptions, setModelOptions] = useState([]);
  const [openAIHelpAnchor, setOpenAIHelpAnchor] = useState(null);
  const [geminiHelpAnchor, setGeminiHelpAnchor] = useState(null);
  const [dialogflowHelpAnchor, setDialogflowHelpAnchor] = useState(null);
  const [tagsAnchorEl, setTagsAnchorEl] = useState(null);
  const [tagsSearch, setTagsSearch] = useState("");
  // RAG: seleção de arquivos do Gerenciador
  const [ragFiles, setRagFiles] = useState([]);
  const [ragFilesLoading, setRagFilesLoading] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState("");
  const [fileOptions, setFileOptions] = useState([]);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [ragIndexTitle, setRagIndexTitle] = useState("");
  const [ragIndexTags, setRagIndexTags] = useState("");
  const [ragChunkSize, setRagChunkSize] = useState(1200);
  const [ragOverlap, setRagOverlap] = useState(200);
  const [ragIndexMsg, setRagIndexMsg] = useState("");

  // Lista de variáveis do sistema (mesma base do PromptModal)
  const mustacheVars = [
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
    { key: "ticket_id", label: "ticket_id", desc: "ID do ticket", category: "Atendimento", alias: "#ticket" },
    { key: "userName", label: "userName", desc: "Nome do atendente", category: "Atendimento", alias: "#atendente" },
    { key: "queue", label: "queue", desc: "Nome da fila", category: "Atendimento", alias: "#fila" },
    { key: "connection", label: "connection", desc: "Nome da conexão/WhatsApp", category: "Atendimento", alias: "#conexao" },
    { key: "protocol", label: "protocol", desc: "Protocolo único da conversa", category: "Atendimento", alias: "#protocolo" },
    { key: "date", label: "date", desc: "Data atual (DD-MM-YYYY)", category: "Data/Hora", alias: "#data" },
    { key: "hour", label: "hour", desc: "Hora atual (HH:MM:SS)", category: "Data/Hora", alias: "#hora" },
    { key: "data_hora", label: "data_hora", desc: "Data e hora juntas", category: "Data/Hora", alias: "#data-hora" },
    { key: "ms", label: "ms", desc: "Saudação contextual", category: "Saudação/Contexto", alias: "#saudacao" },
    { key: "periodo_dia", label: "periodo_dia", desc: "Período do dia", category: "Saudação/Contexto", alias: "#periodo-dia" },
    { key: "name_company", label: "name_company", desc: "Nome da empresa", category: "Empresa", alias: "#empresa" },
  ];
  const groupedVars = mustacheVars.reduce((acc, v) => { const c = v.category || 'Outros'; (acc[c] = acc[c] || []).push(v); return acc; }, {});
  const openTags = Boolean(tagsAnchorEl);
  const handleOpenTags = (event) => setTagsAnchorEl(event.currentTarget);
  const handleCloseTags = () => setTagsAnchorEl(null);
  const insertVarIntoField = (label, setFieldValue, values) => {
    const token = `{${label}}`;
    const current = values.permittedVariablesText || "";
    if (current.split(/\s+/).includes(token)) return;
    const next = (current + (current ? ' ' : '') + token).trim();
    setFieldValue('permittedVariablesText', next);
  };

  useEffect(() => {
    (async () => {
      if (!integrationId) return;
      try {
        const { data } = await api.get(`/queueIntegration/${integrationId}`);
        setIntegration((prevState) => {
          const next = { ...prevState, ...data };
          // Parse jsonContent conforme tipo
          try {
            if ((data?.type === "openai" || data?.type === "gemini") && data?.jsonContent) {
              const parsed = JSON.parse(data.jsonContent);
              const masked = typeof parsed?.apiKey === 'string' && parsed.apiKey.endsWith('********');
              // Mostrar o valor mascarado para o usuário visualizar o prefixo
              next.apiKey = masked ? parsed.apiKey : (parsed?.apiKey || "");
              next.model = parsed?.model || prevState.model;
              next.temperature = parsed?.temperature ?? prevState.temperature;
              next.maxTokens = parsed?.maxTokens ?? prevState.maxTokens;
              next.maxMessages = parsed?.maxMessages ?? prevState.maxMessages;
              next.topP = parsed?.topP ?? prevState.topP;
              next.presencePenalty = parsed?.presencePenalty ?? prevState.presencePenalty;
              // advanced
              next.brandVoice = parsed?.brandVoice || prevState.brandVoice;
              const ed = parsed?.enhanceDefaults || {};
              next.tone = ed?.tone || prevState.tone;
              next.emojiLevel = ed?.emojiLevel || prevState.emojiLevel;
              next.hashtags = ed?.hashtags || prevState.hashtags;
              next.customHashtags = ed?.customHashtags || prevState.customHashtags;
              next.length = ed?.length || prevState.length;
              next.outLanguage = ed?.language || prevState.outLanguage;
              // creativity mapping
              if (parsed?.creativityLevel) {
                next.creativityLevel = parsed.creativityLevel;
              } else {
                const temp = Number(parsed?.temperature ?? 0.7);
                next.creativityLevel = temp <= 0.4 ? 'low' : (temp >= 0.85 ? 'high' : 'medium');
              }
              // permitted variables (dedupe)
              const pv = Array.isArray(parsed?.permittedVariables) ? parsed.permittedVariables : [];
              const uniquePv = Array.from(new Set(pv));
              next.permittedVariablesText = uniquePv.join(' ');
            } else if (data?.type === 'knowledge' && data?.jsonContent) {
              const parsed = JSON.parse(data.jsonContent);
              next.ragEnabled = typeof parsed?.ragEnabled === 'boolean' ? parsed.ragEnabled
                : (typeof parsed?.ragEnabled === 'string' ? ['enabled','true','on','1'].includes(parsed.ragEnabled.toLowerCase()) : prevState.ragEnabled);
              next.ragTopK = parsed?.ragTopK ?? prevState.ragTopK;
              next.ragEmbeddingModel = parsed?.ragEmbeddingModel || prevState.ragEmbeddingModel;
              next.ragEmbeddingDims = parsed?.ragEmbeddingDims ?? (String(next.ragEmbeddingModel).includes('small') ? 1536 : prevState.ragEmbeddingDims);
            }
          } catch (_) {}
          return next;
        });
      } catch (err) {
        toastError(err);
      }
    })();

    return () => {
      setIntegration({
        type: "dialogflow",
        name: "",
        projectName: "",
        jsonContent: "",
        language: "",
        urlN8N: "",
        typebotDelayMessage: 1000
      });
    };

  }, [integrationId, open]);

  // RAG: carregar lista de arquivos ao abrir modal
  useEffect(() => {
    (async () => {
      if (!open) return;
      try {
        setRagFilesLoading(true);
        const { data } = await api.get('/files/list', { params: { searchParam: '' } });
        setRagFiles(Array.isArray(data) ? data : []);
      } catch (_) {
        setRagFiles([]);
      } finally {
        setRagFilesLoading(false);
      }
    })();
  }, [open]);

  const handleSelectFile = async (id) => {
    try {
      setSelectedFileId(id);
      setFileOptions([]);
      setSelectedOptionId("");
      if (!id) return;
      const { data } = await api.get(`/files/${id}`);
      setFileOptions(Array.isArray(data?.options) ? data.options : []);
      if (data?.name && !ragIndexTitle) setRagIndexTitle(data.name);
    } catch (_) {
      setFileOptions([]);
    }
  };

  const handleIndexSelectedFile = async () => {
    try {
      if (!selectedOptionId) {
        setRagIndexMsg('Selecione um arquivo e uma opção.');
        setTimeout(() => setRagIndexMsg(''), 3000);
        return;
      }
      const tags = (ragIndexTags || '').split(',').map(t => t.trim()).filter(Boolean);
      await api.post('/helps/rag/index-file', {
        fileOptionId: Number(selectedOptionId),
        title: ragIndexTitle,
        tags,
        chunkSize: Number(ragChunkSize || 1200),
        overlap: Number(ragOverlap || 200),
      });
      toast.success('Arquivo indexado com sucesso na base RAG.');
      setRagIndexMsg('');
    } catch (err) {
      toastError(err);
      setRagIndexMsg('Falha ao indexar arquivo.');
      setTimeout(() => setRagIndexMsg(''), 3000);
    }
  };

  const handleClose = () => {
    setIntegration({ ...initialState });
    if (typeof onClose === 'function') onClose();
  };

  // Carregar modelos dinamicamente conforme provedor selecionado
  useEffect(() => {
    const provider = integration?.type;
    if (provider !== 'openai' && provider !== 'gemini') return;
    (async () => {
      try {
        const { data } = await api.get('/ai/models', { params: { provider } });
        const list = Array.isArray(data?.models) ? data.models : [];
        setModelOptions(list);
      } catch (_) {
        setModelOptions([]);
      }
    })();
  }, [integration?.type]);

  const handleTestSession = async (event, values) => {
    try {
      const { projectName, jsonContent, language } = values;

      await api.post(`/queueIntegration/testSession`, {
        projectName,
        jsonContent,
        language,
      });

      toast.success(i18n.t("queueIntegrationModal.messages.testSuccess"));
    } catch (err) {
      toastError(err);
    }
  };

  const handleSaveDialogflow = async (values) => {

    try {
      if (values.type === 'n8n' || values.type === 'webhook' || values.type === 'typebot' || values.type === "flowbuilder" || values.type === "openai" || values.type === "gemini") values.projectName = values.name
      const payload = { ...values };

      // Empacotar configurações específicas em jsonContent
      if (values.type === "openai" || values.type === "gemini") {
        // mapear criatividade -> parâmetros
        const level = values.creativityLevel || 'medium';
        const map = {
          low: { temperature: 0.3, topP: 0.8, presencePenalty: 0.0 },
          medium: { temperature: 0.7, topP: 0.9, presencePenalty: 0.2 },
          high: { temperature: 0.9, topP: 1.0, presencePenalty: 0.4 },
        };
        const m = map[level] || map.medium;

        // parse permitted variables
        const pv = (values.permittedVariablesText || '')
          .split(/\s+/)
          .map(s => s.trim())
          .filter(Boolean)
          .filter(s => s.startsWith('{') && s.endsWith('}'));
        const uniquePv = Array.from(new Set(pv));

        const useManual = !!values.advancedOverride;
        const cfg = {
          apiKey: values.apiKey,
          model: values.model,
          temperature: Number(useManual ? values.temperature : m.temperature),
          topP: Number(useManual ? values.topP : m.topP),
          presencePenalty: Number(useManual ? values.presencePenalty : m.presencePenalty),
          maxTokens: Number(values.maxTokens),
          maxMessages: Number(values.maxMessages),
          creativityLevel: level,
          permittedVariables: uniquePv,
          brandVoice: values.brandVoice,
          enhanceDefaults: {
            tone: values.tone,
            emojiLevel: values.emojiLevel,
            hashtags: values.hashtags,
            customHashtags: values.customHashtags,
            length: values.length,
            language: values.outLanguage,
          }
        };

        // Em edição: se apiKey não informada, não sobrescrever jsonContent (preserva a já salva)
        const maskedOrEmpty = !values.apiKey || values.apiKey.endsWith("********");
        if (!(integrationId && maskedOrEmpty)) {
          payload.jsonContent = JSON.stringify(cfg);
        } else {
          // mantém demais campos (brandVoice/enhanceDefaults) sem alterar apiKey
          const cfgNoKey = { ...cfg };
          delete cfgNoKey.apiKey;
          payload.jsonContent = JSON.stringify(cfgNoKey);
        }

        // Remover campos auxiliares do payload raiz
        delete payload.apiKey;
        delete payload.model;
        delete payload.temperature;
        delete payload.maxTokens;
        delete payload.maxMessages;
        delete payload.creativityLevel;
        delete payload.permittedVariablesText;
        delete payload.brandVoice;
        delete payload.tone;
        delete payload.emojiLevel;
        delete payload.hashtags;
        delete payload.customHashtags;
        delete payload.length;
        delete payload.outLanguage;
        // Não persistir campos RAG em openai/gemini
        delete payload.ragEnabled;
        delete payload.ragTopK;
        delete payload.ragEmbeddingModel;
        delete payload.ragEmbeddingDims;
      } else if (values.type === 'knowledge') {
        // Persistir configurações RAG na integração 'knowledge'
        const cfg = {
          ragEnabled: !!values.ragEnabled,
          ragTopK: Number(values.ragTopK || 4),
          ragEmbeddingModel: values.ragEmbeddingModel || 'text-embedding-3-small',
          ragEmbeddingDims: Number(values.ragEmbeddingDims || 1536),
        };
        payload.jsonContent = JSON.stringify(cfg);
        payload.projectName = values.name;
        // limpar campos que não se aplicam
        delete payload.apiKey; delete payload.model; delete payload.temperature; delete payload.maxTokens; delete payload.maxMessages;
        delete payload.creativityLevel; delete payload.permittedVariablesText; delete payload.brandVoice; delete payload.tone; delete payload.emojiLevel;
        delete payload.hashtags; delete payload.customHashtags; delete payload.length; delete payload.outLanguage;
      }

      if (integrationId) {
        await api.put(`/queueIntegration/${integrationId}`, payload);
        toast.success(i18n.t("queueIntegrationModal.messages.editSuccess"));
      } else {
        await api.post("/queueIntegration", payload);
        toast.success(i18n.t("queueIntegrationModal.messages.addSuccess"));
      }
      handleClose();
    } catch (err) {
      toastError(err);
    }


  };

  return (
    <div className={classes.root}>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md" scroll="paper">
        <DialogTitle>
          {integrationId
            ? `${i18n.t("queueIntegrationModal.title.edit")}`
            : `${i18n.t("queueIntegrationModal.title.add")}`}
        </DialogTitle>
        <Formik
          initialValues={integration}
          enableReinitialize={true}
          validationSchema={DialogflowSchema}
          onSubmit={(values, actions, event) => {
            setTimeout(() => {
              handleSaveDialogflow(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ touched, errors, isSubmitting, values }) => (
            <Form>
              <Paper square className={classes.mainPaper} elevation={1}>
                <DialogContent dividers>
                  <Grid container spacing={1}>
                    <Grid item xs={12} md={6} xl={6}>
                      <FormControl
                        variant="outlined"
                        className={classes.formControl}
                        margin="dense"
                        fullWidth
                      >
                        <InputLabel id="type-selection-input-label">
                          {i18n.t("queueIntegrationModal.form.type")}
                        </InputLabel>

                        <Field
                          as={Select}
                          label={i18n.t("queueIntegrationModal.form.type")}
                          name="type"
                          labelId="profile-selection-label"
                          error={touched.type && Boolean(errors.type)}
                          helpertext={touched.type && errors.type}
                          id="type"
                          required
                        >
                          <MenuItem value="openai">OpenAI</MenuItem>
                          <MenuItem value="dialogflow">DialogFlow</MenuItem>
                          <MenuItem value="n8n">N8N</MenuItem>
                          <MenuItem value="webhook">WebHooks</MenuItem>
                          <MenuItem value="typebot">Typebot</MenuItem>
                          <MenuItem value="flowbuilder">Flowbuilder</MenuItem>
                          <MenuItem value="gemini">Google Gemini</MenuItem>
                          <MenuItem value="knowledge">Base de Conhecimento</MenuItem>
                        </Field>
                      </FormControl>
                    </Grid>
                    {values.type === "dialogflow" && (
                      <>
                        <Grid item xs={12} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Tooltip title="Ajuda da integração Dialogflow">
                            <IconButton size="small" onClick={(e) => setDialogflowHelpAnchor(e.currentTarget)}>
                              <HelpOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Popover
                            open={Boolean(dialogflowHelpAnchor)}
                            anchorEl={dialogflowHelpAnchor}
                            onClose={() => setDialogflowHelpAnchor(null)}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                          >
                            <div style={{ padding: 12, maxWidth: 420 }}>
                              <Typography variant="subtitle2" gutterBottom>Dialogflow - Dicas</Typography>
                              <Typography variant="body2" color="textSecondary" component="div">
                                • Projeto: informe o ID do projeto (projectId).<br/>
                                • Chave JSON: cole o conteúdo do arquivo JSON da conta de serviço.<br/>
                                • Idioma: selecione o código de idioma, ex.: pt-BR, en, es.<br/>
                                • Use o botão Testar para validar a sessão.
                              </Typography>
                            </div>
                          </Popover>
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.name")}
                            autoFocus
                            name="name"
                            fullWidth
                            error={touched.name && Boolean(errors.name)}
                            helperText={(touched.name && errors.name) || <ClampHelperText>Um rótulo para identificar esta integração</ClampHelperText>}
                            variant="outlined"
                            margin="dense"
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <FormControl
                            variant="outlined"
                            className={classes.formControl}
                            margin="dense"
                            fullWidth
                          >
                            <InputLabel id="language-selection-input-label">
                              {i18n.t("queueIntegrationModal.form.language")}
                            </InputLabel>

                            <Field
                              as={Select}
                              label={i18n.t("queueIntegrationModal.form.language")}
                              name="language"
                              labelId="profile-selection-label"
                              fullWidth
                              error={touched.language && Boolean(errors.language)}
                              helpertext={touched.language && errors.language}
                              id="language-selection"
                              required
                            >
                              <MenuItem value="pt-BR">Portugues</MenuItem>
                              <MenuItem value="en">Inglês</MenuItem>
                              <MenuItem value="es">Español</MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.projectName")}
                            name="projectName"
                            error={touched.projectName && Boolean(errors.projectName)}
                            helperText={(touched.projectName && errors.projectName) || <ClampHelperText>ID do projeto Dialogflow (projectId)</ClampHelperText>}
                            fullWidth
                            variant="outlined"
                            margin="dense"
                          />
                        </Grid>
                        <Grid item xs={12} md={12} xl={12} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.jsonContent")}
                            type="jsonContent"
                            multiline
                            //inputRef={greetingRef}
                            maxRows={5}
                            minRows={5}
                            fullWidth
                            name="jsonContent"
                            error={touched.jsonContent && Boolean(errors.jsonContent)}
                            helperText={<ClampHelperText>Cole aqui o conteúdo JSON da sua chave de serviço do Dialogflow</ClampHelperText>}
                            variant="outlined"
                            margin="dense"
                          />
                        </Grid>
                      </>
                    )}

                    {values.type === 'knowledge' && (
                      <>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.name")}
                            autoFocus
                            name="name"
                            fullWidth
                            error={touched.name && Boolean(errors.name)}
                            helperText={(touched.name && errors.name) || <ClampHelperText>Um rótulo para identificar esta integração</ClampHelperText>}
                            variant="outlined"
                            margin="dense"
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Paper style={{ padding: 12 }} variant="outlined">
                            <Typography variant="h6">Configurações da Base de Conhecimento</Typography>
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={4}>
                                <FormControlLabel
                                  control={<Field as={Switch} color="primary" name="ragEnabled" checked={!!values.ragEnabled} />}
                                  label="Ativar RAG nas respostas"
                                />
                              </Grid>
                              <Grid item xs={6} md={2}>
                                <Field as={TextField} type="number" label="Top K" name="ragTopK" fullWidth margin="dense" />
                              </Grid>
                              <Grid item xs={12} md={3}>
                                <FormControl fullWidth margin="dense" variant="outlined">
                                  <InputLabel>Modelo de Embedding</InputLabel>
                                  <Field as={Select} label="Modelo de Embedding" name="ragEmbeddingModel">
                                    <MenuItem value="text-embedding-3-small">text-embedding-3-small (1536)</MenuItem>
                                  </Field>
                                </FormControl>
                              </Grid>
                              <Grid item xs={12} md={3}>
                                <Field as={TextField} label="Dimensões" name="ragEmbeddingDims" fullWidth margin="dense" disabled />
                              </Grid>
                            </Grid>
                          </Paper>
                        </Grid>

                        {/* Seção para indexação de arquivos do Gerenciador */}
                        <Grid item xs={12}>
                          <Paper style={{ padding: 12 }} variant="outlined">
                            <Typography variant="subtitle1">Indexar Arquivo do Gerenciador</Typography>
                            <Grid container spacing={2}>
                              <Grid item xs={12} md={5}>
                                <FormControl fullWidth margin="dense" variant="outlined">
                                  <InputLabel>Arquivo</InputLabel>
                                  <Select label="Arquivo" value={selectedFileId} onChange={(e) => handleSelectFile(e.target.value)} disabled={ragFilesLoading}>
                                    <MenuItem value=""><em>Selecione...</em></MenuItem>
                                    {(ragFiles || []).map(f => (
                                      <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <FormControl fullWidth margin="dense" variant="outlined">
                                  <InputLabel>Opção</InputLabel>
                                  <Select label="Opção" value={selectedOptionId} onChange={(e) => setSelectedOptionId(e.target.value)} disabled={!selectedFileId}>
                                    <MenuItem value=""><em>Selecione...</em></MenuItem>
                                    {(fileOptions || []).map(opt => (
                                      <MenuItem key={opt.id} value={opt.id}>{opt.name}</MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={12} md={3}>
                                <TextField label="Título" value={ragIndexTitle} onChange={(e) => setRagIndexTitle(e.target.value)} fullWidth margin="dense" />
                              </Grid>
                              <Grid item xs={12} md={6}>
                                <TextField label="Tags (separe por vírgula)" value={ragIndexTags} onChange={(e) => setRagIndexTags(e.target.value)} fullWidth margin="dense" />
                              </Grid>
                              <Grid item xs={6} md={3}>
                                <TextField type="number" label="Chunk Size" value={ragChunkSize} onChange={(e) => setRagChunkSize(Number(e.target.value))} fullWidth margin="dense" />
                              </Grid>
                              <Grid item xs={6} md={3}>
                                <TextField type="number" label="Overlap" value={ragOverlap} onChange={(e) => setRagOverlap(Number(e.target.value))} fullWidth margin="dense" />
                              </Grid>
                              <Grid item xs={12}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <Button variant="outlined" color="primary" onClick={handleIndexSelectedFile} disabled={!selectedOptionId}>Indexar Arquivo</Button>
                                  {ragIndexMsg ? <Typography variant="caption" color="textSecondary">{ragIndexMsg}</Typography> : null}
                                </div>
                              </Grid>
                            </Grid>
                          </Paper>
                        </Grid>
                      </>
                    )}

                    {(values.type === "n8n" || values.type === "webhook") && (
                      <>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.name")}
                            autoFocus
                            required
                            name="name"
                            error={touched.name && Boolean(errors.name)}
                            helpertext={touched.name && errors.name}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={12} xl={12} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.urlN8N")}
                            name="urlN8N"
                            error={touched.urlN8N && Boolean(errors.urlN8N)}
                            helpertext={touched.urlN8N && errors.urlN8N}
                            variant="outlined"
                            margin="dense"
                            required
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                      </>
                    )}

                    {(values.type === "flowbuilder") && (
                      <Grid item xs={12} md={6} xl={6} >
                        <Field
                          as={TextField}
                          label={i18n.t("queueIntegrationModal.form.name")}
                          autoFocus
                          name="name"
                          fullWidth
                          error={touched.name && Boolean(errors.name)}
                          helpertext={touched.name && errors.name}
                          variant="outlined"
                          margin="dense"
                          className={classes.textField}
                        />
                      </Grid>
                    )}
                    {(values.type === "openai") && (
                      <>
                        <Grid item xs={12} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Tooltip title="Ajuda da integração OpenAI">
                            <IconButton size="small" onClick={(e) => setOpenAIHelpAnchor(e.currentTarget)}>
                              <HelpOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Popover
                            open={Boolean(openAIHelpAnchor)}
                            anchorEl={openAIHelpAnchor}
                            onClose={() => setOpenAIHelpAnchor(null)}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                          >
                            <div style={{ padding: 12, maxWidth: 420 }}>
                              <Typography variant="subtitle2" gutterBottom>OpenAI - Dicas</Typography>
                              <Typography variant="body2" color="textSecondary" component="div">
                                • API Key: cole a chave começando com <code>sk-</code>. Ao salvar, mostramos apenas o prefixo por segurança.<br/>
                                • Modelo: escolha o equilíbrio entre custo e qualidade (ex.: <strong>GPT 4o</strong> = melhor qualidade).<br/>
                                • Criatividade: controla automaticamente temperatura/topP/penalty.<br/>
                                • Máx. Tokens: limite de tamanho da resposta.
                              </Typography>
                            </div>
                          </Popover>
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label="Nome da Integração"
                            autoFocus
                            name="name"
                            placeholder="Ex: OpenAI Empresa"
                            error={touched.name && Boolean(errors.name)}
                            helperText={(touched.name && errors.name) || <ClampHelperText>Um rótulo para identificar esta integração</ClampHelperText>}
                            variant="outlined"
                            margin="dense"
                            required
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label="API Key OpenAI"
                            name="apiKey"
                            type="password"
                            placeholder="sk-..."
                            error={touched.apiKey && Boolean(errors.apiKey)}
                            helperText={(touched.apiKey && errors.apiKey) || <ClampHelperText>Dica: cole a chave completa. Ao editar, mostramos apenas o início seguido de ********</ClampHelperText>}
                            variant="outlined"
                            margin="dense"
                            required={!integrationId}
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        {/* Preferências de aprimoramento */}
                        <Grid item xs={12} md={4} xl={4} >
                          <FormControl
                            fullWidth
                            margin="dense"
                            variant="outlined"
                            error={touched.model && Boolean(errors.model)}
                          >
                            <InputLabel>Modelo Padrão</InputLabel>
                            <Field
                              as={Select}
                              label="Modelo Padrão"
                              name="model"
                            >
                              {(modelOptions && modelOptions.length > 0) ? (
                                modelOptions.map((m) => (
                                  <MenuItem key={m} value={m}>{m}</MenuItem>
                                ))
                              ) : (
                                [
                                  <MenuItem key="gpt-3.5-turbo-1106" value="gpt-3.5-turbo-1106">GPT 3.5 Turbo</MenuItem>,
                                  <MenuItem key="gpt-4o" value="gpt-4o">GPT 4o</MenuItem>
                                ]
                              )}
                            </Field>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <FormControl fullWidth margin="dense" variant="outlined">
                            <InputLabel>Criatividade</InputLabel>
                            <Field as={Select} label="Criatividade" name="creativityLevel">
                              <MenuItem value="low">Baixa</MenuItem>
                              <MenuItem value="medium">Média</MenuItem>
                              <MenuItem value="high">Alta</MenuItem>
                            </Field>
                          </FormControl>
                          <Typography variant="caption" color="textSecondary">
                            Baixa = mais precisa; Alta = mais criativa. Ajusta temperatura/topP/penalty automaticamente.
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={4} xl={4} >
                          <Field
                            as={TextField}
                            label="Temperatura (0-1)"
                            name="temperature"
                            type="number"
                            placeholder="1"
                            inputProps={{ step: "0.1", min: "0", max: "1" }}
                            error={touched.temperature && Boolean(errors.temperature)}
                            helperText={(touched.temperature && errors.temperature) || "Criatividade: 0=preciso, 1=criativo"}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                            disabled={!values.advancedOverride}
                          />
                        </Grid>
                        
                        <Grid item xs={12} md={4} xl={4} >
                          <Field
                            as={TextField}
                            label="Máx. Tokens"
                            name="maxTokens"
                            type="number"
                            placeholder="100"
                            error={touched.maxTokens && Boolean(errors.maxTokens)}
                            helperText={(touched.maxTokens && errors.maxTokens) || "Tamanho máximo da resposta"}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        {/* Variáveis permitidas - mesma linha de Máx. Tokens (OpenAI) */}
                        <Grid item xs={12} md={8}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="textSecondary">Variáveis permitidas</Typography>
                            <Link component="button" type="button" onClick={handleOpenTags} style={{ fontSize: 12 }}>#Tags</Link>
                          </div>
                          <Field
                            as={TextField}
                            name="permittedVariablesText"
                            placeholder="{nome} {empresa} {aniversario}"
                            helperText="Clique em #Tags para inserir variáveis. Use {chaves}."
                            variant="outlined"
                            margin="dense"
                            fullWidth
                          />
                        </Grid>
                        {/* Avançado - OpenAI */}
                        <Grid item xs={12}>
                          <Accordion elevation={0}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                              <Typography variant="subtitle2">Avançado</Typography>
                            </AccordionSummary>
                            <AccordionDetails style={{ display: 'block' }}>
                              <FormikConsumer>{({ setFieldValue, values }) => (
                                <>
                                  <FormControlLabel
                                    control={<Switch color="primary" checked={!!values.advancedOverride} onChange={(e) => setFieldValue('advancedOverride', e.target.checked)} />}
                                    label="Editar manualmente (substitui os valores sugeridos pela Criatividade)"
                                  />
                                  <Grid container spacing={2}>
                                    <Grid item xs={12} md={4}>
                                      <Field as={TextField} label="Top P (0-1)" name="topP" type="number" inputProps={{ step: '0.1', min: '0', max: '1' }} margin="dense" fullWidth variant="outlined" disabled={!values.advancedOverride} />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                      <Field as={TextField} label="Presence Penalty" name="presencePenalty" type="number" inputProps={{ step: '0.1', min: '0', max: '1' }} margin="dense" fullWidth variant="outlined" disabled={!values.advancedOverride} />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                      <Field as={TextField} label="Máx. mensagens (histórico)" name="maxMessages" type="number" inputProps={{ step: '1', min: '1', max: '50' }} margin="dense" fullWidth variant="outlined" />
                                    </Grid>
                                  </Grid>
                                </>
                              )}</FormikConsumer>
                            </AccordionDetails>
                          </Accordion>
                        </Grid>
                        {/* Preferências de aprimoramento (ENHANCE) */}
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" style={{ marginTop: 8 }}>Preferências padrão para Aprimorar</Typography>
                          <Typography variant="body2" color="textSecondary">
                            Dica: essas preferências ajustam o estilo da mensagem aprimorada no WhatsApp.
                          </Typography>
                        </Grid>
                        <Grid item xs={12}>
                          <Field
                            as={TextField}
                            label="Voz da Marca (Brand Voice)"
                            name="brandVoice"
                            placeholder="Ex.: amigável, clara, humana, sem jargões; valoriza proximidade e empatia"
                            helperText={<ClampHelperText>Descreva a personalidade/diretrizes da sua comunicação.</ClampHelperText>}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <FormControl fullWidth margin="dense" variant="outlined">
                            <InputLabel>Tom</InputLabel>
                            <Field as={Select} label="Tom" name="tone">
                              <MenuItem value="amigável">Amigável</MenuItem>
                              <MenuItem value="profissional">Profissional</MenuItem>
                              <MenuItem value="vendedor">Vendedor</MenuItem>
                              <MenuItem value="divertido">Divertido</MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <FormControl fullWidth margin="dense" variant="outlined">
                            <InputLabel>Emojis</InputLabel>
                            <Field as={Select} label="Emojis" name="emojiLevel">
                              <MenuItem value="none">Sem emojis</MenuItem>
                              <MenuItem value="low">Poucos</MenuItem>
                              <MenuItem value="medium">Médio</MenuItem>
                              <MenuItem value="high">Muitos</MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <FormControl fullWidth margin="dense" variant="outlined">
                            <InputLabel>Hashtags</InputLabel>
                            <Field as={Select} label="Hashtags" name="hashtags">
                              <MenuItem value="none">Sem hashtags</MenuItem>
                              <MenuItem value="auto">Automático</MenuItem>
                              <MenuItem value="custom">Personalizado</MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>
                        {values.hashtags === 'custom' && (
                          <Grid item xs={12}>
                            <Field
                              as={TextField}
                              label="Hashtags personalizadas (separadas por espaço)"
                              name="customHashtags"
                              placeholder="#Amizade #Carinho #Gratidão"
                              helperText="Informe sem vírgulas; serão adicionadas ao final do texto."
                              variant="outlined"
                              margin="dense"
                              fullWidth
                            />
                          </Grid>
                        )}
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth margin="dense" variant="outlined">
                            <InputLabel>Comprimento</InputLabel>
                            <Field as={Select} label="Comprimento" name="length">
                              <MenuItem value="short">Curto</MenuItem>
                              <MenuItem value="medium">Médio</MenuItem>
                              <MenuItem value="long">Longo</MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth margin="dense" variant="outlined">
                            <InputLabel>Idioma de saída</InputLabel>
                            <Field as={Select} label="Idioma de saída" name="outLanguage">
                              <MenuItem value="pt-BR">Português (Brasil)</MenuItem>
                              <MenuItem value="en">English</MenuItem>
                              <MenuItem value="es">Español</MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>
                      </>
                    )}
                    {(values.type === "gemini") && (
                      <>
                        <Grid item xs={12} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Tooltip title="Ajuda da integração Gemini">
                            <IconButton size="small" onClick={(e) => setGeminiHelpAnchor(e.currentTarget)}>
                              <HelpOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Popover
                            open={Boolean(geminiHelpAnchor)}
                            anchorEl={geminiHelpAnchor}
                            onClose={() => setGeminiHelpAnchor(null)}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                          >
                            <div style={{ padding: 12, maxWidth: 420 }}>
                              <Typography variant="subtitle2" gutterBottom>Gemini - Dicas</Typography>
                              <Typography variant="body2" color="textSecondary" component="div">
                                • API Key do Google Gemini (começa com AIza).<br/>
                                • Modelo: escolha Flash (rápido) ou Pro (qualidade).<br/>
                                • Criatividade: controla automaticamente temperatura e estilo.
                              </Typography>
                            </div>
                          </Popover>
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label="Nome da Integração"
                            autoFocus
                            name="name"
                            placeholder="Ex: Gemini Empresa"
                            error={touched.name && Boolean(errors.name)}
                            helperText={(touched.name && errors.name) || <ClampHelperText>Um rótulo para identificar esta integração</ClampHelperText>}
                            variant="outlined"
                            margin="dense"
                            required
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label="API Key Google Gemini"
                            name="apiKey"
                            type="password"
                            placeholder="AIza..."
                            error={touched.apiKey && Boolean(errors.apiKey)}
                            helperText={(touched.apiKey && errors.apiKey) || <ClampHelperText>Sua chave da API Google Gemini (começa com AIza)</ClampHelperText>}
                            variant="outlined"
                            margin="dense"
                            required={!integrationId}
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={4} xl={4} >
                          <FormControl
                            fullWidth
                            margin="dense"
                            variant="outlined"
                            error={touched.model && Boolean(errors.model)}
                          >
                            <InputLabel>Modelo Padrão</InputLabel>
                            <Field as={Select} label="Modelo Padrão" name="model">
                              {(modelOptions && modelOptions.length > 0) ? (
                                modelOptions.map((m) => (
                                  <MenuItem key={m} value={m}>{m}</MenuItem>
                                ))
                              ) : (
                                [
                                  <MenuItem key="gemini-2.0-flash" value="gemini-2.0-flash">Gemini 2.0 Flash</MenuItem>,
                                  <MenuItem key="gemini-2.0-pro" value="gemini-2.0-pro">Gemini 2.0 Pro</MenuItem>,
                                  <MenuItem key="gemini-1.5-flash" value="gemini-1.5-flash">Gemini 1.5 Flash</MenuItem>,
                                  <MenuItem key="gemini-1.5-pro" value="gemini-1.5-pro">Gemini 1.5 Pro</MenuItem>
                                ]
                              )}
                            </Field>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <FormControl fullWidth margin="dense" variant="outlined">
                            <InputLabel>Criatividade</InputLabel>
                            <Field as={Select} label="Criatividade" name="creativityLevel">
                              <MenuItem value="low">Baixa</MenuItem>
                              <MenuItem value="medium">Média</MenuItem>
                              <MenuItem value="high">Alta</MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={4} xl={4} >
                          <Field
                            as={TextField}
                            label="Temperatura (0-1)"
                            name="temperature"
                            type="number"
                            placeholder="1"
                            inputProps={{ step: "0.1", min: "0", max: "1" }}
                            error={touched.temperature && Boolean(errors.temperature)}
                            helperText={(touched.temperature && errors.temperature) || "Criatividade: 0=preciso, 1=criativo"}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                            disabled={!values.advancedOverride}
                          />
                        </Grid>
                        
                        <Grid item xs={12} md={4} xl={4} >
                          <Field
                            as={TextField}
                            label="Máx. Tokens"
                            name="maxTokens"
                            type="number"
                            placeholder="100"
                            error={touched.maxTokens && Boolean(errors.maxTokens)}
                            helperText={(touched.maxTokens && errors.maxTokens) || "Tamanho máximo da resposta"}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        {/* Variáveis permitidas - mesma linha de Máx. Tokens (Gemini) */}
                        <Grid item xs={12} md={8}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="textSecondary">Variáveis permitidas</Typography>
                            <Link component="button" type="button" onClick={handleOpenTags} style={{ fontSize: 12 }}>#Tags</Link>
                          </div>
                          <Field
                            as={TextField}
                            name="permittedVariablesText"
                            placeholder="{nome} {empresa} {aniversario}"
                            helperText="Clique em #Tags para inserir variáveis. Use {chaves}."
                            variant="outlined"
                            margin="dense"
                            fullWidth
                          />
                        </Grid>

                        {/* Avançado - Gemini */}
                        <Grid item xs={12}>
                          <Accordion elevation={0}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                              <Typography variant="subtitle2">Avançado</Typography>
                            </AccordionSummary>
                            <AccordionDetails style={{ display: 'block' }}>
                              <FormikConsumer>{({ setFieldValue, values }) => (
                                <>
                                  <FormControlLabel
                                    control={<Switch color="primary" checked={!!values.advancedOverride} onChange={(e) => setFieldValue('advancedOverride', e.target.checked)} />}
                                    label="Editar manualmente (substitui os valores sugeridos pela Criatividade)"
                                  />
                                  <Grid container spacing={2}>
                                    <Grid item xs={12} md={4}>
                                      <Field as={TextField} label="Top P (0-1)" name="topP" type="number" inputProps={{ step: '0.1', min: '0', max: '1' }} margin="dense" fullWidth variant="outlined" disabled={!values.advancedOverride} />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                      <Field as={TextField} label="Presence Penalty" name="presencePenalty" type="number" inputProps={{ step: '0.1', min: '0', max: '1' }} margin="dense" fullWidth variant="outlined" disabled={!values.advancedOverride} />
                                    </Grid>
                                    <Grid item xs={12} md={4}>
                                      <Field as={TextField} label="Máx. mensagens (histórico)" name="maxMessages" type="number" inputProps={{ step: '1', min: '1', max: '50' }} margin="dense" fullWidth variant="outlined" />
                                    </Grid>
                                  </Grid>
                                </>
                              )}</FormikConsumer>
                            </AccordionDetails>
                          </Accordion>
                        </Grid>

                        {/* Preferências de aprimoramento (ENHANCE) para Gemini */}
                        <Grid item xs={12}>
                          <Typography variant="subtitle2" style={{ marginTop: 8 }}>Preferências padrão para Aprimorar</Typography>
                          <Typography variant="body2" color="textSecondary">
                            Dica: essas preferências ajustam o estilo da mensagem aprimorada no WhatsApp.
                          </Typography>
                        </Grid>
                        <Grid item xs={12}>
                          <Field
                            as={TextField}
                            label="Voz da Marca (Brand Voice)"
                            name="brandVoice"
                            placeholder="Ex.: amigável, clara, humana, sem jargões; valoriza proximidade e empatia"
                            helperText="Descreva a personalidade/diretrizes da sua comunicação."
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <FormControl fullWidth margin="dense" variant="outlined">
                            <InputLabel>Tom</InputLabel>
                            <Field as={Select} label="Tom" name="tone">
                              <MenuItem value="amigável">Amigável</MenuItem>
                              <MenuItem value="profissional">Profissional</MenuItem>
                              <MenuItem value="vendedor">Vendedor</MenuItem>
                              <MenuItem value="divertido">Divertido</MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <FormControl fullWidth margin="dense" variant="outlined">
                            <InputLabel>Emojis</InputLabel>
                            <Field as={Select} label="Emojis" name="emojiLevel">
                              <MenuItem value="none">Sem emojis</MenuItem>
                              <MenuItem value="low">Poucos</MenuItem>
                              <MenuItem value="medium">Médio</MenuItem>
                              <MenuItem value="high">Muitos</MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={4}>
                          <FormControl fullWidth margin="dense" variant="outlined">
                            <InputLabel>Hashtags</InputLabel>
                            <Field as={Select} label="Hashtags" name="hashtags">
                              <MenuItem value="none">Sem hashtags</MenuItem>
                              <MenuItem value="auto">Automático</MenuItem>
                              <MenuItem value="custom">Personalizado</MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>
                        {values.hashtags === 'custom' && (
                          <Grid item xs={12}>
                            <Field
                              as={TextField}
                              label="Hashtags personalizadas (separadas por espaço)"
                              name="customHashtags"
                              placeholder="#Amizade #Carinho #Gratidão"
                              helperText="Informe sem vírgulas; serão adicionadas ao final do texto."
                              variant="outlined"
                              margin="dense"
                              fullWidth
                            />
                          </Grid>
                        )}
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth margin="dense" variant="outlined">
                            <InputLabel>Comprimento</InputLabel>
                            <Field as={Select} label="Comprimento" name="length">
                              <MenuItem value="short">Curto</MenuItem>
                              <MenuItem value="medium">Médio</MenuItem>
                              <MenuItem value="long">Longo</MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth margin="dense" variant="outlined">
                            <InputLabel>Idioma de saída</InputLabel>
                            <Field as={Select} label="Idioma de saída" name="outLanguage">
                              <MenuItem value="pt-BR">Português (Brasil)</MenuItem>
                              <MenuItem value="en">English</MenuItem>
                              <MenuItem value="es">Español</MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>
                      </>
                    )}
                    {(values.type === "typebot") && (
                      <>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.name")}
                            autoFocus
                            name="name"
                            error={touched.name && Boolean(errors.name)}
                            helpertext={touched.name && errors.name}
                            variant="outlined"
                            margin="dense"
                            required
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={12} xl={12} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.urlN8N")}
                            name="urlN8N"
                            error={touched.urlN8N && Boolean(errors.urlN8N)}
                            helpertext={touched.urlN8N && errors.urlN8N}
                            variant="outlined"
                            margin="dense"
                            required
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.typebotSlug")}
                            name="typebotSlug"
                            error={touched.typebotSlug && Boolean(errors.typebotSlug)}
                            helpertext={touched.typebotSlug && errors.typebotSlug}
                            required
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.typebotExpires")}
                            name="typebotExpires"
                            error={touched.typebotExpires && Boolean(errors.typebotExpires)}
                            helpertext={touched.typebotExpires && errors.typebotExpires}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.typebotDelayMessage")}
                            name="typebotDelayMessage"
                            error={touched.typebotDelayMessage && Boolean(errors.typebotDelayMessage)}
                            helpertext={touched.typebotDelayMessage && errors.typebotDelayMessage}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.typebotKeywordFinish")}
                            name="typebotKeywordFinish"
                            error={touched.typebotKeywordFinish && Boolean(errors.typebotKeywordFinish)}
                            helpertext={touched.typebotKeywordFinish && errors.typebotKeywordFinish}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.typebotKeywordRestart")}
                            name="typebotKeywordRestart"
                            error={touched.typebotKeywordRestart && Boolean(errors.typebotKeywordRestart)}
                            helpertext={touched.typebotKeywordRestart && errors.typebotKeywordRestart}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={6} xl={6} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.typebotUnknownMessage")}
                            name="typebotUnknownMessage"
                            error={touched.typebotUnknownMessage && Boolean(errors.typebotUnknownMessage)}
                            helpertext={touched.typebotUnknownMessage && errors.typebotUnknownMessage}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>
                        <Grid item xs={12} md={12} xl={12} >
                          <Field
                            as={TextField}
                            label={i18n.t("queueIntegrationModal.form.typebotRestartMessage")}
                            name="typebotRestartMessage"
                            error={touched.typebotRestartMessage && Boolean(errors.typebotRestartMessage)}
                            helpertext={touched.typebotRestartMessage && errors.typebotRestartMessage}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                          />
                        </Grid>

                      </>
                    )}
                  </Grid>
                </DialogContent>
              </Paper>

              <DialogActions>
                {values.type === "dialogflow" && (
                  <Button
                    //type="submit"
                    onClick={(e) => handleTestSession(e, values)}
                    color="inherit"
                    disabled={isSubmitting}
                    name="testSession"
                    variant="outlined"
                    className={classes.btnLeft}
                  >
                    {i18n.t("queueIntegrationModal.buttons.test")}
                  </Button>
                )}
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("queueIntegrationModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {integrationId
                    ? `${i18n.t("queueIntegrationModal.buttons.okEdit")}`
                    : `${i18n.t("queueIntegrationModal.buttons.okAdd")}`}
                  {isSubmitting && (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  )}
                </Button>
              </DialogActions>
              {/* Popover #Tags - inserir variáveis no campo (dentro do Formik) */}
              <ClickAwayListener onClickAway={handleCloseTags}>
                <Popover
                  open={openTags}
                  anchorEl={tagsAnchorEl}
                  onClose={handleCloseTags}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                  disableRestoreFocus
                  keepMounted
                  disablePortal
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
                            <FormikConsumer>{({ setFieldValue, values }) => (
                              <>
                                {list.map(v => (
                                  <div key={v.key} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <Tooltip title={v.desc} placement="top" arrow>
                                      <Button size="small" variant="text" onClick={() => insertVarIntoField(v.label, setFieldValue, values)} style={{ textTransform: 'none' }}>
                                        {v.alias || `#${v.label}`}
                                      </Button>
                                    </Tooltip>
                                  </div>
                                ))}
                              </>
                            )}</FormikConsumer>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Popover>
              </ClickAwayListener>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default QueueIntegration;