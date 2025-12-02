import React, { useState, useEffect, useRef } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,

  TextField,
  Typography,
  Paper,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  Collapse,
  FormControlLabel,
  Checkbox,
  Tooltip,
  Link,
  ClickAwayListener,
  Popover,
  Chip,
} from "@material-ui/core";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import ExpandLess from "@material-ui/icons/ExpandLess";
import ExpandMore from "@material-ui/icons/ExpandMore";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import AIIntegrationSelector from "../AIIntegrationSelector";
import AIModelSelector from "../AIModelSelector";
import QueueSelectSingle from "../QueueSelectSingle";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

const FlowBuilderSchema = Yup.object().shape({
  name: Yup.string().min(5, "Muito curto!").max(100, "Muito longo!").required("Obrigatório"),
  prompt: Yup.string().min(50, "Muito curto!").required("Obrigatório"),
  integrationId: Yup.number().when("useGlobalConfig", {
    is: false,
    then: Yup.number().required("Selecione uma integração IA"),
    otherwise: Yup.number().notRequired(),
  }),
  queueId: Yup.number().required("Informe a fila"),
  maxMessages: Yup.number()
    .min(1, "Mínimo 1 mensagem")
    .max(50, "Máximo 50 mensagens")
    .required("Informe o número máximo de mensagens"),
  voice: Yup.string().notRequired(),
  voiceKey: Yup.string().notRequired(),
  voiceRegion: Yup.string().notRequired(),
  temperature: Yup.number().min(0, "Mínimo 0").max(1, "Máximo 1").notRequired(),
});

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

const FlowBuilderOpenAIModal = ({ open, onSave, data, onUpdate, close }) => {
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [useGlobalConfig, setUseGlobalConfig] = useState(false);
  const [fileLists, setFileLists] = useState([]);
  const [filesSearch, setFilesSearch] = useState("");
  const [expandedFileIds, setExpandedFileIds] = useState({});
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [tagsAnchorEl, setTagsAnchorEl] = useState(null);
  const [tagsSearch, setTagsSearch] = useState("");
  const [voiceTipsAnchorEl, setVoiceTipsAnchorEl] = useState(null);
  const promptInputRef = useRef(null);

  // New states for folders
  const [folders, setFolders] = useState([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState([]);

  const initialValues = {
    name: data?.data?.typebotIntegration?.name || "",
    prompt: data?.data?.typebotIntegration?.prompt || "",
    integrationId: data?.data?.typebotIntegration?.integrationId || null,
    queueId: data?.data?.typebotIntegration?.queueId || null,
    maxMessages: data?.data?.typebotIntegration?.maxMessages || 10,
    temperature: data?.data?.typebotIntegration?.temperature ?? 0.7,
    voice: data?.data?.typebotIntegration?.voice || "texto",
    voiceKey: data?.data?.typebotIntegration?.voiceKey || "",
    voiceRegion: data?.data?.typebotIntegration?.voiceRegion || "",
    model: data?.data?.typebotIntegration?.model || "",
    useGlobalConfig: data?.data?.typebotIntegration?.useGlobalConfig || false,
  };

  const openVoiceTips = Boolean(voiceTipsAnchorEl);
  const handleOpenVoiceTips = (event) => setVoiceTipsAnchorEl(event.currentTarget);
  const handleCloseVoiceTips = () => setVoiceTipsAnchorEl(null);

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

  const handleClose = () => {
    close(null);
  };

  const handleSave = async (values, { setSubmitting }) => {
    try {
      const globalFlag = typeof values.useGlobalConfig === "boolean" ? values.useGlobalConfig : useGlobalConfig;

      const integrationData = {
        name: values.name,
        prompt: values.prompt,
        integrationId: globalFlag ? null : values.integrationId,
        queueId: values.queueId,
        maxMessages: values.maxMessages,
        temperature: typeof values.temperature === "number" ? values.temperature : Number(values.temperature),
        model: globalFlag ? "" : (selectedIntegration?.model || values.model || ""),
        voice: values.voice || "texto",
        voiceKey: values.voiceKey || "",
        voiceRegion: values.voiceRegion || "",
        attachments: JSON.stringify(selectedFolderIds || []),
        useGlobalConfig: globalFlag,
      };

      if (open === "edit") {
        onUpdate({
          ...data,
          data: { typebotIntegration: { ...integrationData } },
        });
      } else {
        onSave({
          typebotIntegration: { ...integrationData },
        });
      }
      handleClose();
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Carregar listas simples de arquivos e restaurar anexos ao abrir para edição
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.get(`/files/list`, { params: { searchParam: filesSearch } });
        if (active) setFileLists(Array.isArray(data) ? data : []);
      } catch (_) { }
    })();
    return () => { active = false; };
  }, [filesSearch]);

  // Carregar pastas do File Manager
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/library/folders");
        setFolders(data);
      } catch (err) {
        console.error("Erro ao buscar pastas:", err);
      }
    })();
  }, []);

  useEffect(() => {
    if (open === "edit" && data?.data?.typebotIntegration?.attachments) {
      try {
        const parsed = typeof data.data.typebotIntegration.attachments === 'string'
          ? JSON.parse(data.data.typebotIntegration.attachments)
          : data.data.typebotIntegration.attachments;

        // Se for array de IDs (novo formato), seta selectedFolderIds
        if (Array.isArray(parsed) && (parsed.length === 0 || typeof parsed[0] === 'number' || typeof parsed[0] === 'string')) {
          // Verifica se é formato antigo (objetos) ou novo (IDs)
          if (parsed.length > 0 && typeof parsed[0] === 'object') {
            // Formato antigo (FileLists), ignora ou migra se necessário
            setSelectedOptions(parsed);
          } else {
            setSelectedFolderIds(parsed.map(id => Number(id)));
          }
        }
      } catch (_) {
        setSelectedFolderIds([]);
      }
    } else if (open === "create") {
      setSelectedFolderIds([]);
    }
  }, [open, data]);

  // Inicializa a integração selecionada ao abrir em modo edição/criação (quando já existe um integrationId)
  useEffect(() => {
    const id = data?.data?.typebotIntegration?.integrationId;
    if ((open === "edit" || open === "create") && id && !selectedIntegration) {
      (async () => {
        try {
          const { data: resp } = await api.get(`/queueIntegration/${id}`);
          const integration = resp?.queueIntegration || resp;
          setSelectedIntegration(integration);
        } catch (_) { }
      })();
    }
  }, [open, data, selectedIntegration]);

  // Mantém o campo oculto 'model' sincronizado no Formik para validação condicional
  const formikRef = useRef(null);
  useEffect(() => {
    if (formikRef.current) {
      formikRef.current.setFieldValue('model', selectedIntegration?.model || "");
    }
  }, [selectedIntegration]);

  return (
    <Dialog open={open === "create" || open === "edit"} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {open === "edit" ? "Editar Ação IA" : "Adicionar Ação IA"}
      </DialogTitle>
      <Formik
        initialValues={initialValues}
        validationSchema={FlowBuilderSchema}
        onSubmit={handleSave}
        enableReinitialize
        innerRef={formikRef}
      >
        {({ touched, errors, isSubmitting, values, setFieldValue }) => (
          <Form>
            <DialogContent>
              <Typography variant="body2" style={{ marginBottom: 16, color: '#666' }}>
                Configure uma ação de IA para o FlowBuilder usando uma integração OpenAI/Gemini configurada.
              </Typography>

              <Field
                as={TextField}
                label="Nome da Ação"
                name="name"
                placeholder="Ex: Resposta Inteligente"
                error={touched.name && Boolean(errors.name)}
                helperText={touched.name ? errors.name : "Um nome para identificar esta ação"}
                variant="outlined"
                margin="dense"
                fullWidth
                required
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 12 }}>
                <Typography variant="caption" style={{ opacity: 0.8 }}>
                  Configuração IA
                </Typography>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Typography variant="caption" style={{ fontSize: '0.75rem' }}>
                    Específica
                  </Typography>
                  <input
                    type="checkbox"
                    checked={values.useGlobalConfig ?? useGlobalConfig}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setUseGlobalConfig(checked);
                      setFieldValue('useGlobalConfig', checked);
                      if (checked) {
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

              {
                !useGlobalConfig ? (
                  <>
                    <AIIntegrationSelector
                      value={values.integrationId}
                      onChange={(integrationId, integration) => {
                        setFieldValue('integrationId', integrationId);
                        setSelectedIntegration(integration);
                        setFieldValue('model', integration?.model || "");
                      }}
                      error={touched.integrationId && Boolean(errors.integrationId)}
                      helperText={touched.integrationId ? errors.integrationId : "Selecione uma integração OpenAI/Gemini configurada"}
                    />
                    {selectedIntegration && (
                      <AIModelSelector
                        provider={selectedIntegration.type}
                        integrationId={selectedIntegration.id}
                        apiKey={selectedIntegration.apiKey}
                        value={values.model}
                        onChange={(e) => setFieldValue("model", e.target.value)}
                        error={touched.model && Boolean(errors.model)}
                        helperText={touched.model && errors.model}
                      />
                    )}
                  </>
                ) : (
                  <div style={{
                    padding: 12,
                    backgroundColor: '#f0f8ff',
                    borderRadius: 4,
                    border: '1px solid #2196f3',
                    marginBottom: 12
                  }}>
                    <Typography variant="body2" style={{ color: '#1976d2' }}>
                      🌐 Usando configurações globais de IA
                    </Typography>
                    <Typography variant="caption" style={{ color: '#666' }}>
                      As configurações definidas em "Configurações → IA" serão utilizadas
                    </Typography>
                  </div>
                )
              }

              <FormControl fullWidth margin="dense" variant="outlined">
                <InputLabel id="folder-select-label">Pastas de Arquivos</InputLabel>
                <Select
                  labelId="folder-select-label"
                  multiple
                  value={selectedFolderIds}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Se selecionar "Todas", limpa ou define lógica específica. Aqui assumindo seleção normal.
                    setSelectedFolderIds(typeof val === 'string' ? val.split(',') : val);
                  }}
                  renderValue={(selected) => (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {selected.map((value) => {
                        const folder = folders.find(f => f.id === value);
                        return (
                          <Chip key={value} label={folder ? folder.name : value} size="small" />
                        );
                      })}
                    </div>
                  )}
                  label="Pastas de Arquivos"
                >
                  {folders.map((folder) => (
                    <MenuItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Field
                name="queueId"
                component={({ field, form }) => (
                  <QueueSelectSingle
                    selectedQueueId={field.value}
                    onChange={value => form.setFieldValue("queueId", value)}
                  />
                )}
                placeholder="Descreva como a IA deve responder..."
                error={touched.prompt && Boolean(errors.prompt)}
                helperText={touched.prompt ? errors.prompt : "Instruções para a IA sobre como processar a mensagem"}
                variant="outlined"
                margin="dense"
                multiline
                rows={8}
                fullWidth
                required
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

              <FormControl
                fullWidth
                margin="dense"
                variant="outlined"
                error={touched.voice && Boolean(errors.voice)}
              >
                <InputLabel>Voz</InputLabel>
                <Field as={Select} label="Voz" name="voice">
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

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <Typography variant="subtitle2">Voz (TTS) e Transcrição (STT)</Typography>
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
                      • STT (Transcrição): configure a chave no backend em <b>Setting.apiTranscription</b> usando um provedor suportado (OpenAI Whisper ou Google Gemini).<br />
                      • TTS (Síntese de Voz): preencha abaixo <b>voice</b> (uma voz Azure válida), <b>voiceKey</b> e <b>voiceRegion</b>.
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                      <b>Passos rápidos</b><br />
                      1) Escolha o provedor de STT e gere a API Key:<br />
                      — OpenAI: <Link href="https://platform.openai.com" target="_blank" rel="noopener">https://platform.openai.com</Link><br />
                      — Google Gemini: <Link href="https://ai.google.dev/" target="_blank" rel="noopener">https://ai.google.dev/</Link><br />
                      Salve a chave em <b>Setting.apiTranscription</b> no sistema.
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                      2) Para TTS (Microsoft Azure Speech):<br />
                      — Crie um recurso <i>Speech</i> no Azure Portal.<br />
                      — Copie <b>Key</b> e <b>Region</b> (ex.: brazilsouth, eastus).<br />
                      — Selecione uma voz, por exemplo: <code>pt-BR-AntonioNeural</code> ou <code>pt-BR-FranciscaNeural</code>.<br />
                      Docs: <Link href="https://learn.microsoft.com/azure/ai-services/speech-service/" target="_blank" rel="noopener">Azure Speech Service</Link>
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                      3) Funcionamento:<br />
                      — Ao receber um áudio, o sistema usa a chave de STT para transcrever.<br />
                      — A IA responde usando o <b>model</b> definido neste Prompt.<br />
                      — Se <b>voice</b> = "texto", envia resposta em texto; caso contrário, gera áudio via Azure TTS e envia o MP3.
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Dica: se você não precisa de áudio de retorno, deixe <b>voice = "texto"</b> e não preencha <b>voiceKey/voiceRegion</b>.
                    </Typography>
                  </div>
                </Popover>
              </ClickAwayListener>
              <div style={{ display: 'flex', gap: 8 }}>
                <Field
                  as={TextField}
                  label="Chave TTS (Azure)"
                  name="voiceKey"
                  error={touched.voiceKey && Boolean(errors.voiceKey)}
                  helperText={touched.voiceKey && errors.voiceKey}
                  variant="outlined"
                  margin="dense"
                  fullWidth
                />
                <Field
                  as={TextField}
                  label="Região TTS (Azure)"
                  name="voiceRegion"
                  error={touched.voiceRegion && Boolean(errors.voiceRegion)}
                  helperText={touched.voiceRegion && errors.voiceRegion}
                  variant="outlined"
                  margin="dense"
                  fullWidth
                />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Field
                  as={TextField}
                  label="Temperatura"
                  name="temperature"
                  error={touched.temperature && Boolean(errors.temperature)}
                  helperText={touched.temperature && errors.temperature}
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  type="number"
                  inputProps={{ step: "0.1", min: "0", max: "1" }}
                />
                <Field
                  as={TextField}
                  label="Máx. Mensagens"
                  name="maxMessages"
                  error={touched.maxMessages && Boolean(errors.maxMessages)}
                  helperText={touched.maxMessages && errors.maxMessages}
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  type="number"
                  inputProps={{ min: 1, max: 50 }}
                />
              </div>
            </DialogContent >
            <DialogActions>
              <Button onClick={handleClose} color="secondary" disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" color="primary" variant="contained" disabled={isSubmitting}>
                {isSubmitting ? <CircularProgress size={20} /> : (open === "edit" ? "Atualizar" : "Adicionar")}
              </Button>
            </DialogActions>
          </Form >
        )}
      </Formik >
    </Dialog >
  );
};

export default FlowBuilderOpenAIModal;