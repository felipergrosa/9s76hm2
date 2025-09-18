import React, { useState, useEffect, useRef } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import OpenAIService from "../../services/openaiService";
import api from "../../services/api";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import { 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Select, 
  Tooltip, 
  Typography, 
  Paper, 
  Popover, 
  ClickAwayListener, 
  Link, 
  Chip, 
  Checkbox, 
  FormControlLabel, 
  List, 
  ListItem, 
  ListItemText, 
  Collapse 
} from "@material-ui/core";
import ExpandLess from "@material-ui/icons/ExpandLess";
import ExpandMore from "@material-ui/icons/ExpandMore";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import { Visibility, VisibilityOff } from "@material-ui/icons";
import { InputAdornment, IconButton } from "@material-ui/core";
import QueueSelectSingle from "../QueueSelectSingle";
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

// Modelos suportados centralizados
const allowedModels = [
  "gpt-3.5-turbo-1106",
  "gpt-4o",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.0-flash",
  "gemini-2.0-pro",
];

const OpenAISchema = Yup.object().shape({
  name: Yup.string()
    .min(5, "Muito curto!")
    .max(100, "Muito longo!")
    .required("Obrigatório"),
  prompt: Yup.string()
    .min(50, "Muito curto!")
    .required("Descreva o treinamento para Inteligência Artificial"),
  model: Yup.string()
    .oneOf(allowedModels, "Modelo inválido")
    .required("Informe o modelo"),
  maxTokens: Yup.number()
    .min(10, "Mínimo 10 tokens")
    .max(4096, "Máximo 4096 tokens")
    .required("Informe o número máximo de tokens"),
  temperature: Yup.number()
    .min(0, "Mínimo 0")
    .max(1, "Máximo 1")
    .required("Informe a temperatura"),
  apiKey: Yup.string().required("Informe a API Key"),
  queueId: Yup.number().when('$isStandalone', {
    is: true,
    then: Yup.number().required("Informe a fila"),
    otherwise: Yup.number().notRequired(),
  }),
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
});

const OpenAIModal = ({ 
  open, 
  onClose, 
  onSave, 
  integrationId, 
  initialData = {},
  isStandalone = true, // true para /prompts, false para flowbuilder
  title = "Configuração OpenAI/Gemini"
}) => {
  const classes = useStyles();
  const [showApiKey, setShowApiKey] = useState(false);
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);

  const handleToggleApiKey = () => {
    setShowApiKey(!showApiKey);
  };

  const initialState = {
    name: "",
    prompt: "",
    model: "gpt-3.5-turbo-1106",
    voice: "texto",
    voiceKey: "",
    voiceRegion: "",
    maxTokens: 100,
    temperature: 1,
    apiKey: "",
    queueId: null,
    maxMessages: 10,
    // RAG
    ragEnabled: false,
    ragTopK: 4,
    ragEmbeddingModel: "text-embedding-3-small",
    ragEmbeddingDims: 1536,
    ...initialData
  };

  const [integration, setIntegration] = useState(initialState);
  const promptInputRef = useRef(null);
  const [tagsAnchorEl, setTagsAnchorEl] = useState(null);
  const [tagsSearch, setTagsSearch] = useState("");
  const [filesSearch, setFilesSearch] = useState("");
  const [fileLists, setFileLists] = useState([]);
  const [expandedFileIds, setExpandedFileIds] = useState({});
  const [selectedOptions, setSelectedOptions] = useState([]);
  // RAG: seleção de arquivo para indexação
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
  const [voiceTipsAnchorEl, setVoiceTipsAnchorEl] = useState(null);

  const openVoiceTips = Boolean(voiceTipsAnchorEl);
  const handleOpenVoiceTips = (event) => setVoiceTipsAnchorEl(event.currentTarget);
  const handleCloseVoiceTips = () => setVoiceTipsAnchorEl(null);

  // Variáveis mustache para prompts
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
      requestAnimationFrame(() => {
        textarea.focus();
        const pos = start + insertion.length;
        textarea.setSelectionRange(pos, pos);
      });
    } else {
      setFieldValue("prompt", values.prompt + insertion);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (open && integrationId) {
        // Carregar dados da integração existente
        setIntegration({ ...initialState, ...initialData });
      } else if (open) {
        // Carregar configurações padrão da integração centralizada
        const defaultSettings = await OpenAIService.getDefaultSettings();
        setIntegration({ ...initialState, ...defaultSettings });
      }
    };
    
    loadData();
  }, [open, integrationId, initialData]);

  // RAG: carregar lista de arquivos ao abrir
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
      toast.error('Falha ao indexar arquivo.');
      setRagIndexMsg('Falha ao indexar arquivo.');
      setTimeout(() => setRagIndexMsg(''), 3000);
    }
  };

  const handleClose = () => {
    setIntegration(initialState);
    onClose();
  };

  const handleSaveIntegration = async (values) => {
    try {
      const integrationData = {
        ...values,
        voice: values.model === "gpt-3.5-turbo-1106" ? values.voice : "texto",
        type: "openai", // Identificador do tipo de integração
        // RAG
        ragEnabled: !!values.ragEnabled,
        ragTopK: Number(values.ragTopK || 4),
        ragEmbeddingModel: values.ragEmbeddingModel || "text-embedding-3-small",
        ragEmbeddingDims: Number(values.ragEmbeddingDims || 1536),
      };

      await onSave(integrationData);
      toast.success("Integração OpenAI salva com sucesso!");
      handleClose();
    } catch (err) {
      toast.error("Erro ao salvar integração OpenAI");
    }
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        scroll="paper"
      >
        <DialogTitle id="form-dialog-title">
          {title}
        </DialogTitle>
        <Formik
          initialValues={integration}
          enableReinitialize={true}
          validationSchema={OpenAISchema}
          validationContext={{ isStandalone }}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveIntegration(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ touched, errors, isSubmitting, values, setFieldValue }) => (
            <Form>
              <DialogContent dividers>
                <div className={classes.multFieldLine}>
                  <Field
                    as={TextField}
                    label="Nome da Integração"
                    name="name"
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </div>

                {/* RAG - Base de Conhecimento */}
                <div style={{ marginTop: 12 }}>
                  <Typography variant="h6">Base de Conhecimento (RAG)</Typography>
                  <div className={classes.multFieldLine}>
                    <FormControlLabel
                      control={<Field as={Checkbox} color="primary" name="ragEnabled" checked={!!values.ragEnabled} />}
                      label="Ativar RAG nas respostas"
                    />
                    <Field
                      as={TextField}
                      label="Top K"
                      name="ragTopK"
                      type="number"
                      variant="outlined"
                      margin="dense"
                      style={{ width: 120 }}
                    />
                    <FormControl variant="outlined" margin="dense" style={{ minWidth: 260 }}>
                      <InputLabel>Modelo de Embedding</InputLabel>
                      <Field as={Select} label="Modelo de Embedding" name="ragEmbeddingModel"
                        onChange={(e) => {
                          setFieldValue('ragEmbeddingModel', e.target.value);
                          if (String(e.target.value).includes('small')) setFieldValue('ragEmbeddingDims', 1536);
                        }}
                      >
                        <MenuItem value="text-embedding-3-small">text-embedding-3-small (1536)</MenuItem>
                      </Field>
                    </FormControl>
                    <Field
                      as={TextField}
                      label="Dimensões"
                      name="ragEmbeddingDims"
                      type="number"
                      variant="outlined"
                      margin="dense"
                      style={{ width: 160 }}
                      disabled
                    />
                  </div>
                  <Typography variant="caption" color="textSecondary">
                    Observação: atualmente otimizamos para 1536 dimensões. Outros modelos podem requerer migração da base.
                  </Typography>
                  {/* Seleção e Indexação de Arquivos */}
                  <div style={{ marginTop: 12 }}>
                    <Typography variant="subtitle1">Indexar Arquivo do Gerenciador</Typography>
                    <div className={classes.multFieldLine}>
                      <FormControl variant="outlined" margin="dense" style={{ minWidth: 240 }}>
                        <InputLabel>Arquivo</InputLabel>
                        <Select label="Arquivo" value={selectedFileId} onChange={(e) => handleSelectFile(e.target.value)} disabled={ragFilesLoading}>
                          <MenuItem value=""><em>Selecione...</em></MenuItem>
                          {(ragFiles || []).map(f => (
                            <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <FormControl variant="outlined" margin="dense" style={{ minWidth: 240 }}>
                        <InputLabel>Opção</InputLabel>
                        <Select label="Opção" value={selectedOptionId} onChange={(e) => setSelectedOptionId(e.target.value)} disabled={!selectedFileId}>
                          <MenuItem value=""><em>Selecione...</em></MenuItem>
                          {(fileOptions || []).map(opt => (
                            <MenuItem key={opt.id} value={opt.id}>{opt.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField label="Título" value={ragIndexTitle} onChange={(e) => setRagIndexTitle(e.target.value)} variant="outlined" margin="dense" />
                    </div>
                    <div className={classes.multFieldLine}>
                      <TextField label="Tags (separe por vírgula)" value={ragIndexTags} onChange={(e) => setRagIndexTags(e.target.value)} variant="outlined" margin="dense" style={{ flex: 1 }} />
                      <TextField type="number" label="Chunk Size" value={ragChunkSize} onChange={(e) => setRagChunkSize(Number(e.target.value))} variant="outlined" margin="dense" style={{ width: 160 }} />
                      <TextField type="number" label="Overlap" value={ragOverlap} onChange={(e) => setRagOverlap(Number(e.target.value))} variant="outlined" margin="dense" style={{ width: 160 }} />
                      <Button variant="outlined" color="primary" onClick={handleIndexSelectedFile} disabled={!selectedOptionId} style={{ marginLeft: 8 }}>Indexar Arquivo</Button>
                    </div>
                    {ragIndexMsg ? <Typography variant="caption" color="textSecondary">{ragIndexMsg}</Typography> : null}
                  </div>
                </div>

                <div className={classes.multFieldLine}>
                  <Field
                    as={TextField}
                    label="API Key"
                    name="apiKey"
                    type={showApiKey ? "text" : "password"}
                    error={touched.apiKey && Boolean(errors.apiKey)}
                    helperText={touched.apiKey && errors.apiKey}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={handleToggleApiKey}>
                            {showApiKey ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </div>

                {isStandalone && (
                  <div className={classes.multFieldLine}>
                    <QueueSelectSingle
                      selectedQueueId={values.queueId}
                      onChange={(queue) => setFieldValue("queueId", queue?.id || null)}
                    />
                  </div>
                )}

                <div className={classes.multFieldLine}>
                  <Field
                    as={TextField}
                    label="Prompt do Sistema"
                    name="prompt"
                    error={touched.prompt && Boolean(errors.prompt)}
                    helperText={touched.prompt && errors.prompt}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    multiline
                    rows={8}
                    inputRef={promptInputRef}
                    placeholder="Descreva como a IA deve se comportar e responder..."
                  />
                  {isStandalone && (
                    <div style={{ marginTop: 8 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleOpenTags}
                        style={{ marginRight: 8 }}
                      >
                        Inserir Variáveis
                      </Button>
                      <Popover
                        open={openTags}
                        anchorEl={tagsAnchorEl}
                        onClose={handleCloseTags}
                        anchorOrigin={{
                          vertical: 'bottom',
                          horizontal: 'left',
                        }}
                      >
                        <ClickAwayListener onClickAway={handleCloseTags}>
                          <Paper style={{ padding: 16, maxWidth: 400, maxHeight: 400, overflow: 'auto' }}>
                            <TextField
                              placeholder="Buscar variável..."
                              value={tagsSearch}
                              onChange={(e) => setTagsSearch(e.target.value)}
                              size="small"
                              fullWidth
                              style={{ marginBottom: 16 }}
                            />
                            {Object.entries(groupedVars).map(([category, vars]) => (
                              <div key={category}>
                                <Typography variant="subtitle2" style={{ fontWeight: 'bold', marginTop: 8 }}>
                                  {category}
                                </Typography>
                                {vars
                                  .filter(v => 
                                    !tagsSearch || 
                                    v.label.toLowerCase().includes(tagsSearch.toLowerCase()) ||
                                    v.desc.toLowerCase().includes(tagsSearch.toLowerCase())
                                  )
                                  .map((variable) => (
                                    <Chip
                                      key={variable.key}
                                      label={`{{${variable.key}}}`}
                                      onClick={() => {
                                        insertAtCursor(variable.key, setFieldValue, values);
                                        handleCloseTags();
                                      }}
                                      size="small"
                                      style={{ margin: 2, cursor: 'pointer' }}
                                      title={variable.desc}
                                    />
                                  ))
                                }
                              </div>
                            ))}
                          </Paper>
                        </ClickAwayListener>
                      </Popover>
                    </div>
                  )}
                </div>

                <div className={classes.multFieldLine}>
                  <FormControl
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    error={touched.model && Boolean(errors.model)}
                  >
                    <InputLabel>Modelo</InputLabel>
                    <Field
                      as={Select}
                      label="Modelo"
                      name="model"
                      onChange={(e) => {
                        setFieldValue("model", e.target.value);
                        if (e.target.value !== "gpt-3.5-turbo-1106") {
                          setFieldValue("voice", "texto");
                        }
                      }}
                    >
                      {allowedModels.map((model) => (
                        <MenuItem key={model} value={model}>
                          {model === "gpt-3.5-turbo-1106" && "GPT 3.5 Turbo"}
                          {model === "gpt-4o" && "GPT 4o"}
                          {model === "gemini-1.5-flash" && "Gemini 1.5 Flash"}
                          {model === "gemini-1.5-pro" && "Gemini 1.5 Pro"}
                          {model === "gemini-2.0-flash" && "Gemini 2.0 Flash"}
                          {model === "gemini-2.0-pro" && "Gemini 2.0 Pro"}
                        </MenuItem>
                      ))}
                    </Field>
                  </FormControl>

                  <FormControl
                    fullWidth
                    margin="dense"
                    variant="outlined"
                    disabled={values.model !== "gpt-3.5-turbo-1106"}
                  >
                    <InputLabel>Voz</InputLabel>
                    <Field
                      as={Select}
                      label="Voz"
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
                  </FormControl>
                </div>

                <div className={classes.multFieldLine}>
                  <Field
                    as={TextField}
                    label="Máximo de Tokens"
                    name="maxTokens"
                    type="number"
                    error={touched.maxTokens && Boolean(errors.maxTokens)}
                    helperText={touched.maxTokens && errors.maxTokens}
                    variant="outlined"
                    margin="dense"
                    style={{ flex: 1 }}
                  />
                  <Field
                    as={TextField}
                    label="Temperatura (0-1)"
                    name="temperature"
                    type="number"
                    step="0.1"
                    error={touched.temperature && Boolean(errors.temperature)}
                    helperText={touched.temperature && errors.temperature}
                    variant="outlined"
                    margin="dense"
                    style={{ flex: 1 }}
                  />
                  <Field
                    as={TextField}
                    label="Máx. Mensagens"
                    name="maxMessages"
                    type="number"
                    error={touched.maxMessages && Boolean(errors.maxMessages)}
                    helperText={touched.maxMessages && errors.maxMessages}
                    variant="outlined"
                    margin="dense"
                    style={{ flex: 1 }}
                  />
                </div>

                {values.model === "gpt-3.5-turbo-1106" && values.voice !== "texto" && (
                  <div className={classes.multFieldLine}>
                    <Field
                      as={TextField}
                      label="Voice Key (Azure)"
                      name="voiceKey"
                      type="password"
                      variant="outlined"
                      margin="dense"
                      style={{ flex: 1 }}
                    />
                    <Field
                      as={TextField}
                      label="Voice Region (Azure)"
                      name="voiceRegion"
                      placeholder="ex: brazilsouth"
                      variant="outlined"
                      margin="dense"
                      style={{ flex: 1 }}
                    />
                  </div>
                )}
              </DialogContent>

              <DialogActions>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {integrationId ? "Atualizar" : "Salvar"}
                  {isSubmitting && (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
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

export default OpenAIModal;
