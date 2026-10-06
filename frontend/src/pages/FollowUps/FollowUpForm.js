import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useParams, useHistory } from "react-router-dom";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import IconButton from "@material-ui/core/IconButton";
import Stepper from "@material-ui/core/Stepper";
import Step from "@material-ui/core/Step";
import StepLabel from "@material-ui/core/StepLabel";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import CircularProgress from "@material-ui/core/CircularProgress";
import Divider from "@material-ui/core/Divider";
import Chip from "@material-ui/core/Chip";

import AddIcon from "@material-ui/icons/Add";
import DeleteIcon from "@material-ui/icons/Delete";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";
import SettingsIcon from "@material-ui/icons/Settings";
import MessageIcon from "@material-ui/icons/Message";
import FlagIcon from "@material-ui/icons/Flag";
import Tooltip from "@material-ui/core/Tooltip";
import { Sparkles, Zap } from "lucide-react";

import api from "../../services/api";
import TemplateVariableMapper from "../../components/TemplateVariableMapper";
import QuickMessagePicker from "../../components/QuickMessagePicker";
import toastError from "../../errors/toastError";
import useWhatsApps from "../../hooks/useWhatsApps";
import usePermissions from "../../hooks/usePermissions";
import MetaTemplateModal from "../../components/MetaTemplateModal";
import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";

// Bento — molde de página padrão (painel + entrada spring)
import { motion, useReducedMotion } from "framer-motion";
import { bentoContainer, bentoItem, bentoItemReduced } from "../../components/bento/motionPresets";
import "../../components/bento/bento.css";

const ChatAssistantPanel = lazy(() => import("../../components/ChatAssistantPanel"));
const WhatsAppPopover = lazy(() => import("../../components/WhatsAppPopover"));

const STEP_LABELS = ["Configuração", "Etapas", "Ação final"];

const useStyles = makeStyles(theme => ({
  // Painel externo no padrão canônico — cabeçalho vive dentro do Paper
  paper: {
    flex: 1,
    padding: 0,
    overflow: "hidden",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    padding: theme.spacing(2, 2.5),
  },
  headerText: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  // Touch target >= 44px no botão de voltar do cabeçalho
  headerActionBtn: {
    minWidth: 44,
    minHeight: 44,
  },
  // Área interna do painel — stepper + grade de cards (o bento-panel não tem padding)
  content: {
    padding: theme.spacing(0, 2.5, 2.5),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(0, 2, 2),
    },
  },
  stepperBar: {
    backgroundColor: "transparent",
    marginBottom: theme.spacing(3),
    "& .MuiStepIcon-root.MuiStepIcon-active": { color: "#991b1b" },
    "& .MuiStepIcon-root.MuiStepIcon-completed": { color: "#991b1b" },
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "1fr 360px",
    gap: theme.spacing(3),
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "1fr",
    },
  },
  card: {
    padding: theme.spacing(3),
    borderRadius: 12,
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(2),
    },
  },
  // Touch target mínimo 44px em mobile (regra 2 do checklist mobile)
  actionBtn: {
    [theme.breakpoints.down("sm")]: {
      minWidth: 44,
      minHeight: 44,
    },
  },
  cardTitle: {
    fontSize: "1.15rem",
    fontWeight: 700,
    marginBottom: theme.spacing(0.5),
  },
  cardSubtitle: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(2),
  },
  stepCard: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1.5),
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
  },
  guideCard: {
    padding: theme.spacing(2.5),
    borderRadius: 12,
    position: "sticky",
    top: theme.spacing(2),
    height: "fit-content",
  },
  guideItem: {
    marginTop: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    borderRadius: 8,
    backgroundColor:
      theme.palette.type === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
  },
  footerBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginTop: theme.spacing(3),
  },
  primaryBtn: {
    backgroundColor: "#991b1b",
    color: "#fff",
    textTransform: "none",
    fontWeight: 600,
    "&:hover": { backgroundColor: "#7f1d1d" },
    "&:disabled": { backgroundColor: theme.palette.action.disabledBackground },
  },
  secondaryBtn: {
    textTransform: "none",
  },
  createTplBtn: {
    marginTop: theme.spacing(1),
    textTransform: "none",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0),
    borderBottom: `1px dashed ${theme.palette.divider}`,
  },
  summaryValue: {
    textAlign: "right",
    minWidth: 0,
    wordBreak: "break-word",
  },
}));

const emptyStep = () => ({
  delayValue: 0,
  delayUnit: "days",
  message: "",
  metaTemplateName: "",
  metaTemplateLanguage: "pt_BR",
  metaTemplateVariables: {},
});

// Normaliza metaTemplateVariables que pode vir como string JSON do backend
const parseStepVariables = v => {
  if (!v) return {};
  if (typeof v === "object") return v;
  try { return JSON.parse(v); } catch { return {}; }
};

const delayToStep = s => {
  const days = Number(s.delayDays) || 0;
  const minutes = Number(s.delayMinutes) || 0;
  if (minutes > 0 && minutes % 60 === 0 && days === 0)
    return { delayUnit: "hours", delayValue: minutes / 60 };
  if (minutes > 0 && days === 0)
    return { delayUnit: "minutes", delayValue: minutes };
  return { delayUnit: "days", delayValue: days };
};

const stepToDelay = step => {
  const value = Number(step.delayValue) || 0;
  if (step.delayUnit === "minutes") return { delayDays: 0, delayMinutes: value };
  if (step.delayUnit === "hours") return { delayDays: 0, delayMinutes: value * 60 };
  return { delayDays: value, delayMinutes: 0 };
};

const END_ACTION_OPTIONS = [
  { value: "none", label: "Nenhuma — apenas concluir" },
  { value: "move_tag", label: "Mover de lane/tag" },
  { value: "ticket_status", label: "Mudar status do ticket" },
  { value: "assign_queue", label: "Mover carteira → fila" },
  { value: "assign_user", label: "Mover carteira → atendente" },
];

const FollowUpForm = () => {
  const classes = useStyles();
  const history = useHistory();
  const { followUpId } = useParams();
  const { whatsApps } = useWhatsApps();

  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    tagId: "",
    whatsappId: "",
    active: true,
    sendWindowStart: "",
    sendWindowEnd: "",
    endAction: "none",
    endActionTagId: "",
    endActionStatus: "",
    endActionQueueId: "",
    endActionUserId: "",
  });
  const [steps, setSteps] = useState([emptyStep()]);

  const [tags, setTags] = useState([]);
  const [queues, setQueues] = useState([]);
  const [users, setUsers] = useState([]);
  const [metaTemplates, setMetaTemplates] = useState([]);
  const [tplModalOpen, setTplModalOpen] = useState(false);
  const [tplStepIndex, setTplStepIndex] = useState(null);
  const [assistantStepIndex, setAssistantStepIndex] = useState(null);
  const [quickPickerStepIndex, setQuickPickerStepIndex] = useState(null);

  const { hasPermission } = usePermissions();
  const canUseAIAssistant = hasPermission("ai-chat-assistant.use");

  const selectedWhatsapp = whatsApps.find(w => w.id === Number(form.whatsappId));
  const isOfficial = selectedWhatsapp?.channelType === "official";

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // Tags normais + lanes do Kanban
  useEffect(() => {
    Promise.all([
      api.get("/tags/", { params: { kanban: 0 } }),
      api.get("/tags/", { params: { kanban: 1 } }),
    ])
      .then(([normal, lanes]) => {
        const nt = (normal.data.tags || normal.data || []).map(t => ({ ...t, isLane: false }));
        const lt = (lanes.data.tags || lanes.data || []).map(t => ({ ...t, isLane: true }));
        setTags([...lt, ...nt]);
      })
      .catch(toastError);

    api.get("/queue").then(({ data }) => setQueues(Array.isArray(data) ? data : data.queues || [])).catch(() => {});
    api.get("/users/available").then(({ data }) => setUsers(data || [])).catch(() => {});
  }, []);

  const fetchTemplates = useCallback(() => {
    if (!form.whatsappId || !isOfficial) {
      setMetaTemplates([]);
      return;
    }
    api
      .get(`/meta-templates/${form.whatsappId}`)
      .then(({ data }) =>
        setMetaTemplates((data.templates || []).filter(t => t.status === "APPROVED"))
      )
      .catch(() => setMetaTemplates([]));
  }, [form.whatsappId, isOfficial]);

  useEffect(fetchTemplates, [fetchTemplates]);

  // Modo edição
  useEffect(() => {
    if (!followUpId) return;
    setLoading(true);
    api
      .get(`/drip-sequences/${followUpId}`)
      .then(({ data }) => {
        setForm({
          name: data.name || "",
          tagId: data.tagId || "",
          whatsappId: data.whatsappId || "",
          active: data.active !== false,
          sendWindowStart: data.sendWindowStart || "",
          sendWindowEnd: data.sendWindowEnd || "",
          endAction: data.endAction || "none",
          endActionTagId: data.endActionTagId || "",
          endActionStatus: data.endActionStatus || "",
          endActionQueueId: data.endActionQueueId || "",
          endActionUserId: data.endActionUserId || "",
        });
        const loaded = (data.steps || []).map(s => ({
          ...emptyStep(),
          ...delayToStep(s),
          message: s.message || "",
          metaTemplateName: s.metaTemplateName || "",
          metaTemplateLanguage: s.metaTemplateLanguage || "pt_BR",
          metaTemplateVariables: parseStepVariables(s.metaTemplateVariables),
        }));
        setSteps(loaded.length ? loaded : [emptyStep()]);
      })
      .catch(toastError)
      .finally(() => setLoading(false));
  }, [followUpId]);

  // ===== Validação por etapa =====
  const validateStep0 = () => {
    if (!form.name.trim()) return "Informe o nome da sequência";
    if (!form.tagId) return "Selecione a tag/lane que dispara a inscrição";
    if (isOfficial && metaTemplates.length === 0)
      return "Conexão oficial sem templates aprovados — crie um template Meta primeiro";
    return null;
  };

  const validateStep1 = () => {
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (isOfficial) {
        if (!s.metaTemplateName)
          return `Etapa ${i + 1}: conexão oficial exige template Meta selecionado`;
      } else if (!s.message.trim() && !s.metaTemplateName) {
        return `Etapa ${i + 1}: informe a mensagem ou um template`;
      }
    }
    return null;
  };

  const validateStep2 = () => {
    if (form.endAction === "move_tag" && !form.endActionTagId)
      return "Selecione a lane/tag de destino";
    if (form.endAction === "ticket_status" && !form.endActionStatus)
      return "Selecione o status do ticket";
    if (form.endAction === "assign_queue" && !form.endActionQueueId)
      return "Selecione a fila de destino";
    if (form.endAction === "assign_user" && !form.endActionUserId)
      return "Selecione o atendente de destino";
    return null;
  };

  const validators = [validateStep0, validateStep1, validateStep2];

  const handleNext = () => {
    const err = validators[activeStep]();
    if (err) {
      toast.warning(err);
      return;
    }
    setActiveStep(prev => prev + 1);
  };

  const handleSave = async () => {
    const err = validateStep2() || validateStep1() || validateStep0();
    if (err) {
      toast.warning(err);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        whatsappId: form.whatsappId || null,
        sendWindowStart: form.sendWindowStart || null,
        sendWindowEnd: form.sendWindowEnd || null,
        endActionTagId: form.endAction === "move_tag" ? form.endActionTagId : null,
        endActionStatus: form.endAction === "ticket_status" ? form.endActionStatus : null,
        endActionQueueId: form.endAction === "assign_queue" ? form.endActionQueueId : null,
        endActionUserId: form.endAction === "assign_user" ? form.endActionUserId : null,
        steps: steps.map((step, index) => ({
          order: index,
          ...stepToDelay(step),
          message: step.message || "",
          metaTemplateName: step.metaTemplateName || null,
          metaTemplateLanguage: step.metaTemplateName
            ? step.metaTemplateLanguage || "pt_BR"
            : null,
          metaTemplateVariables: step.metaTemplateName
            ? step.metaTemplateVariables || {}
            : null,
        })),
      };
      if (followUpId) {
        await api.put(`/drip-sequences/${followUpId}`, payload);
      } else {
        await api.post("/drip-sequences", payload);
      }
      toast.success("Follow-up salvo com sucesso!");
      history.push("/follow-ups");
    } catch (err2) {
      toastError(err2);
    } finally {
      setSaving(false);
    }
  };

  const handleStepChange = (index, field, value) => {
    setSteps(prev => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const insertIntoStepMessage = (index, text) => {
    handleStepChange(index, "message", (steps[index]?.message || "") + text);
  };

  // setInputMessage do assistente aceita valor ou updater fn — normaliza aqui
  const setStepMessageFromAssistant = index => val =>
    handleStepChange(
      index,
      "message",
      typeof val === "function" ? val(steps[index]?.message || "") : val
    );

  // Barra de ferramentas da mensagem: emojis, respostas rápidas e assistente IA.
  // Assistente fica fora quando a conexão é oficial — lá ele vive só no
  // MetaTemplateModal (regra do produto: API oficial trabalha com templates).
  const renderMessageToolbar = index => (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
      <Suspense fallback={null}>
        <WhatsAppPopover
          onSelectEmoji={emoji => insertIntoStepMessage(index, emoji)}
        />
      </Suspense>
      <Tooltip title="Respostas rápidas">
        <IconButton size="small" className={classes.actionBtn} onClick={() => setQuickPickerStepIndex(index)}>
          <Zap size={20} />
        </IconButton>
      </Tooltip>
      {canUseAIAssistant && !isOfficial && (
        <Tooltip title="Assistente de IA — melhorar, corrigir, traduzir ou criar">
          <IconButton
            size="small"
            className={classes.actionBtn}
            color={assistantStepIndex === index ? "primary" : "default"}
            onClick={() =>
              setAssistantStepIndex(prev => (prev === index ? null : index))
            }
          >
            <Sparkles size={20} />
          </IconButton>
        </Tooltip>
      )}
    </div>
  );

  const openTemplateModal = index => {
    setTplStepIndex(index);
    setTplModalOpen(true);
  };

  const triggerTag = tags.find(t => t.id === Number(form.tagId));

  // Respeita prefers-reduced-motion: fade simples no lugar do spring
  const reducedMotion = useReducedMotion();
  const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

  if (loading) {
    return (
      <MainContainer useWindowScroll>
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
          <CircularProgress />
        </div>
      </MainContainer>
    );
  }

  return (
    <MainContainer useWindowScroll>
      <motion.div variants={bentoContainer} initial="hidden" animate="show">
        <motion.div variants={itemVariant}>
          <Paper className={`${classes.paper} bento-panel`} variant="outlined">
            {/* Cabeçalho padrão dentro do Paper — título + ação de voltar */}
            <div className={classes.header}>
              <div className={classes.headerText}>
                <Title>{followUpId ? "Editar Follow-up" : "Novo Follow-up"}</Title>
                <Typography variant="body2" color="textSecondary">
                  Sequência automática de mensagens disparada por tag ou lane do Kanban.
                </Typography>
              </div>
              <div className={classes.headerActions}>
                <Tooltip title="Voltar para a lista">
                  <IconButton
                    size="small"
                    className={classes.headerActionBtn}
                    onClick={() => history.push("/follow-ups")}
                  >
                    <ArrowBackIcon />
                  </IconButton>
                </Tooltip>
              </div>
            </div>

            {/* Conteúdo do formulário — stepper + grade de cards */}
            <div className={classes.content}>
      <Stepper activeStep={activeStep} alternativeLabel className={classes.stepperBar}>
        {STEP_LABELS.map((label, i) => (
          <Step key={label} completed={activeStep > i}>
            <StepLabel
              icon={
                i === 0 ? <SettingsIcon fontSize="small" /> :
                i === 1 ? <MessageIcon fontSize="small" /> :
                <FlagIcon fontSize="small" />
              }
              style={{ cursor: i < activeStep ? "pointer" : "default" }}
              onClick={() => i < activeStep && setActiveStep(i)}
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      <div className={classes.layout}>
        {/* ========== CARD PRINCIPAL ========== */}
        <Paper className={classes.card} variant="outlined">
          {activeStep === 0 && (
            <>
              <Typography className={classes.cardTitle}>Detalhes do Follow-up</Typography>
              <Typography variant="body2" className={classes.cardSubtitle}>
                Defina o gatilho, a conexão e a janela de envio.
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Nome da sequência"
                    value={form.name}
                    onChange={e => set("name", e.target.value)}
                    variant="outlined" size="small" fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl variant="outlined" size="small" fullWidth>
                    <InputLabel>Tag / Lane que dispara a inscrição</InputLabel>
                    <Select
                      value={form.tagId}
                      onChange={e => set("tagId", e.target.value)}
                      label="Tag / Lane que dispara a inscrição"
                    >
                      {tags.map(tag => (
                        <MenuItem key={tag.id} value={tag.id}>
                          {tag.isLane ? `Lane: ${tag.name}` : tag.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl variant="outlined" size="small" fullWidth>
                    <InputLabel>Conexão WhatsApp</InputLabel>
                    <Select
                      value={form.whatsappId}
                      onChange={e => set("whatsappId", e.target.value)}
                      label="Conexão WhatsApp"
                    >
                      <MenuItem value="">Nenhuma</MenuItem>
                      {whatsApps.map(w => (
                        <MenuItem key={w.id} value={w.id}>
                          {w.name}{w.channelType === "official" ? " (API Oficial)" : ""}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Janela de envio — início (opcional)"
                    type="time"
                    value={form.sendWindowStart}
                    onChange={e => set("sendWindowStart", e.target.value)}
                    variant="outlined" size="small" fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Janela de envio — fim (opcional)"
                    type="time"
                    value={form.sendWindowEnd}
                    onChange={e => set("sendWindowEnd", e.target.value)}
                    variant="outlined" size="small" fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.active}
                        onChange={e => set("active", e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Sequência ativa"
                  />
                </Grid>
                {isOfficial && (
                  <Grid item xs={12}>
                    <Chip
                      size="small"
                      color="primary"
                      variant="outlined"
                      label={
                        metaTemplates.length > 0
                          ? `${metaTemplates.length} template(s) Meta aprovado(s) disponíveis`
                          : "Nenhum template aprovado — crie um na próxima etapa"
                      }
                    />
                  </Grid>
                )}
              </Grid>
            </>
          )}

          {activeStep === 1 && (
            <>
              <Typography className={classes.cardTitle}>Etapas do Follow-up</Typography>
              <Typography variant="body2" className={classes.cardSubtitle}>
                Enviadas em sequência enquanto o contato estiver na lane/tag e não interagir.
                {isOfficial && " Conexão oficial: cada etapa exige um template Meta aprovado."}
              </Typography>
              {steps.map((step, index) => (
                <Paper key={index} variant="outlined" className={classes.stepCard}>
                  <Grid container spacing={1} alignItems="flex-start">
                    <Grid item xs={12} sm={4}>
                      <Grid container spacing={1}>
                        <Grid item xs={6}>
                          <TextField
                            label={index === 0 ? "Enviar após" : "Após anterior"}
                            type="number"
                            inputProps={{ min: 0 }}
                            value={step.delayValue}
                            onChange={e => handleStepChange(index, "delayValue", e.target.value)}
                            variant="outlined" size="small" fullWidth
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <FormControl variant="outlined" size="small" fullWidth>
                            <Select
                              value={step.delayUnit}
                              onChange={e => handleStepChange(index, "delayUnit", e.target.value)}
                            >
                              <MenuItem value="minutes">min</MenuItem>
                              <MenuItem value="hours">horas</MenuItem>
                              <MenuItem value="days">dias</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>
                    </Grid>
                    <Grid item xs={12} sm={7}>
                      {isOfficial ? (
                        <>
                          <FormControl variant="outlined" size="small" fullWidth required>
                            <InputLabel>Template Meta (obrigatório)</InputLabel>
                            <Select
                              value={
                                step.metaTemplateName
                                  ? `${step.metaTemplateName}|||${step.metaTemplateLanguage || "pt_BR"}`
                                  : ""
                              }
                              onChange={e => {
                                const [name, lang] = String(e.target.value).split("|||");
                                handleStepChange(index, "metaTemplateName", name || "");
                                handleStepChange(index, "metaTemplateLanguage", lang || "pt_BR");
                              }}
                              label="Template Meta (obrigatório)"
                            >
                              {metaTemplates.map(t => (
                                <MenuItem
                                  key={t.id || `${t.name}-${t.language}`}
                                  value={`${t.name}|||${t.language}`}
                                >
                                  {t.name} ({t.language})
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <Button
                            size="small"
                            color="primary"
                            startIcon={<AddIcon />}
                            className={classes.createTplBtn}
                            onClick={() => openTemplateModal(index)}
                          >
                            Criar novo template
                          </Button>
                          <TextField
                            label="Texto alternativo (fallback — usado apenas dentro da janela de 24h)"
                            value={step.message}
                            onChange={e => handleStepChange(index, "message", e.target.value)}
                            variant="outlined" size="small" multiline rows={2} fullWidth
                            style={{ marginTop: 8 }}
                          />
                          {renderMessageToolbar(index)}
                        </>
                      ) : (
                        <>
                          <TextField
                            label={`Mensagem da etapa ${index + 1} — use {{name}} ou {{firstName}}`}
                            value={step.message}
                            onChange={e => handleStepChange(index, "message", e.target.value)}
                            variant="outlined" size="small" multiline rows={2} fullWidth
                          />
                          {renderMessageToolbar(index)}
                          {metaTemplates.length > 0 && (
                            <FormControl variant="outlined" size="small" fullWidth style={{ marginTop: 8 }}>
                              <InputLabel>Template Meta (opcional)</InputLabel>
                              <Select
                                value={
                                  step.metaTemplateName
                                    ? `${step.metaTemplateName}|||${step.metaTemplateLanguage || "pt_BR"}`
                                    : ""
                                }
                                onChange={e => {
                                  const [name, lang] = String(e.target.value).split("|||");
                                  handleStepChange(index, "metaTemplateName", name || "");
                                  handleStepChange(index, "metaTemplateLanguage", lang || "pt_BR");
                                }}
                                label="Template Meta (opcional)"
                              >
                                <MenuItem value="">Nenhum</MenuItem>
                                {metaTemplates.map(t => (
                                  <MenuItem
                                    key={t.id || `${t.name}-${t.language}`}
                                    value={`${t.name}|||${t.language}`}
                                  >
                                    {t.name} ({t.language})
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          )}
                        </>
                      )}
                    </Grid>
                    {/* xs=2 garante espaço para o touch target de 44px no mobile */}
                    <Grid item xs={2} sm={1}>
                      <IconButton
                        size="small"
                        className={classes.actionBtn}
                        onClick={() => setSteps(prev => prev.filter((_, i) => i !== index))}
                        disabled={steps.length === 1}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Grid>
                    {/* Preview do template + mapeamento de variáveis — igual
                        ao "Compor Conteúdo" de campaigns/new */}
                    {assistantStepIndex === index && (
                      <Grid item xs={12} style={{ marginTop: 8, position: "relative" }}>
                        <Suspense fallback={<CircularProgress size={24} />}>
                          <ChatAssistantPanel
                            open
                            dialogMode
                            title={`Assistente — Etapa ${index + 1}`}
                            assistantContext="campaign"
                            targetField={`step-${index}-message`}
                            inputMessage={step.message || ""}
                            setInputMessage={setStepMessageFromAssistant(index)}
                            whatsappId={form.whatsappId || null}
                            actions={["apply", "append"]}
                            contextSummary={`Follow-up "${form.name || "sem nome"}", etapa ${index + 1} de ${steps.length}. Variáveis disponíveis: {{name}}, {{firstName}}.`}
                            onClose={() => setAssistantStepIndex(null)}
                          />
                        </Suspense>
                      </Grid>
                    )}
                    {step.metaTemplateName && (
                      <Grid item xs={12} style={{ marginTop: 8 }}>
                        <TemplateVariableMapper
                          whatsappId={form.whatsappId}
                          templateName={step.metaTemplateName}
                          languageCode={step.metaTemplateLanguage || "pt_BR"}
                          value={step.metaTemplateVariables}
                          onChange={vars =>
                            handleStepChange(index, "metaTemplateVariables", vars)
                          }
                        />
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              ))}
              <Button startIcon={<AddIcon />} onClick={() => setSteps(prev => [...prev, emptyStep()])} color="primary">
                Adicionar etapa
              </Button>
            </>
          )}

          {activeStep === 2 && (
            <>
              <Typography className={classes.cardTitle}>Ação ao concluir</Typography>
              <Typography variant="body2" className={classes.cardSubtitle}>
                Executada automaticamente quando o contato receber a última etapa.
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl variant="outlined" size="small" fullWidth>
                    <InputLabel>Ação final</InputLabel>
                    <Select
                      value={form.endAction}
                      onChange={e => set("endAction", e.target.value)}
                      label="Ação final"
                    >
                      {END_ACTION_OPTIONS.map(o => (
                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                {form.endAction === "move_tag" && (
                  <Grid item xs={12} sm={6}>
                    <FormControl variant="outlined" size="small" fullWidth required>
                      <InputLabel>Lane/tag de destino</InputLabel>
                      <Select
                        value={form.endActionTagId}
                        onChange={e => set("endActionTagId", e.target.value)}
                        label="Lane/tag de destino"
                      >
                        {tags
                          .filter(t => t.isLane && t.id !== Number(form.tagId))
                          .map(tag => (
                            <MenuItem key={tag.id} value={tag.id}>Lane: {tag.name}</MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                {form.endAction === "ticket_status" && (
                  <Grid item xs={12} sm={6}>
                    <FormControl variant="outlined" size="small" fullWidth required>
                      <InputLabel>Novo status do ticket</InputLabel>
                      <Select
                        value={form.endActionStatus}
                        onChange={e => set("endActionStatus", e.target.value)}
                        label="Novo status do ticket"
                      >
                        <MenuItem value="open">Aberto</MenuItem>
                        <MenuItem value="pending">Pendente</MenuItem>
                        <MenuItem value="closed">Fechado</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                {form.endAction === "assign_queue" && (
                  <Grid item xs={12} sm={6}>
                    <FormControl variant="outlined" size="small" fullWidth required>
                      <InputLabel>Fila de destino</InputLabel>
                      <Select
                        value={form.endActionQueueId}
                        onChange={e => set("endActionQueueId", e.target.value)}
                        label="Fila de destino"
                      >
                        {queues.map(q => (
                          <MenuItem key={q.id} value={q.id}>{q.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                {form.endAction === "assign_user" && (
                  <Grid item xs={12} sm={6}>
                    <FormControl variant="outlined" size="small" fullWidth required>
                      <InputLabel>Atendente de destino</InputLabel>
                      <Select
                        value={form.endActionUserId}
                        onChange={e => set("endActionUserId", e.target.value)}
                        label="Atendente de destino"
                      >
                        {users.map(u => (
                          <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                <Grid item xs={12}>
                  <Divider style={{ margin: "8px 0 16px" }} />
                  <Typography variant="subtitle2" gutterBottom>Resumo</Typography>
                  <div className={classes.summaryRow}>
                    <Typography variant="body2" color="textSecondary">Nome</Typography>
                    <Typography variant="body2" className={classes.summaryValue}>{form.name || "—"}</Typography>
                  </div>
                  <div className={classes.summaryRow}>
                    <Typography variant="body2" color="textSecondary">Gatilho</Typography>
                    <Typography variant="body2" className={classes.summaryValue}>
                      {triggerTag ? `${triggerTag.isLane ? "Lane" : "Tag"}: ${triggerTag.name}` : "—"}
                    </Typography>
                  </div>
                  <div className={classes.summaryRow}>
                    <Typography variant="body2" color="textSecondary">Conexão</Typography>
                    <Typography variant="body2" className={classes.summaryValue}>{selectedWhatsapp?.name || "—"}</Typography>
                  </div>
                  <div className={classes.summaryRow}>
                    <Typography variant="body2" color="textSecondary">Etapas</Typography>
                    <Typography variant="body2" className={classes.summaryValue}>{steps.length}</Typography>
                  </div>
                  <div className={classes.summaryRow}>
                    <Typography variant="body2" color="textSecondary">Janela</Typography>
                    <Typography variant="body2" className={classes.summaryValue}>
                      {form.sendWindowStart && form.sendWindowEnd
                        ? `${form.sendWindowStart}–${form.sendWindowEnd}`
                        : "Qualquer horário"}
                    </Typography>
                  </div>
                  <div className={classes.summaryRow}>
                    <Typography variant="body2" color="textSecondary">Ação final</Typography>
                    <Typography variant="body2" className={classes.summaryValue}>
                      {END_ACTION_OPTIONS.find(o => o.value === form.endAction)?.label}
                    </Typography>
                  </div>
                </Grid>
              </Grid>
            </>
          )}

          <div className={classes.footerBar}>
            <Button
              className={classes.secondaryBtn}
              startIcon={<ChevronLeftIcon />}
              onClick={() => (activeStep === 0 ? history.push("/follow-ups") : setActiveStep(activeStep - 1))}
            >
              {activeStep === 0 ? "Voltar" : "Anterior"}
            </Button>
            {activeStep < 2 ? (
              <Button className={classes.primaryBtn} variant="contained" onClick={handleNext}>
                Próximo passo
              </Button>
            ) : (
              <Button
                className={classes.primaryBtn}
                variant="contained"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Salvando..." : followUpId ? "Salvar follow-up" : "Criar follow-up"}
              </Button>
            )}
          </div>
        </Paper>

        {/* ========== PAINEL GUIA ========== */}
        <Paper className={classes.guideCard} variant="outlined">
          <Typography variant="overline" color="textSecondary">
            {STEP_LABELS[activeStep].toUpperCase()}
          </Typography>
          {activeStep === 0 && (
            <>
              <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
                Configuração do follow-up
              </Typography>
              <div className={classes.guideItem}>
                <Typography variant="subtitle2">Gatilho</Typography>
                <Typography variant="body2" color="textSecondary">
                  O contato entra na sequência quando a tag ou lane do Kanban é aplicada.
                  Ao interagir ou sair da lane, o follow-up é cancelado automaticamente.
                </Typography>
              </div>
              <div className={classes.guideItem}>
                <Typography variant="subtitle2">Conexão</Typography>
                <Typography variant="body2" color="textSecondary">
                  API Oficial envia templates Meta e funciona fora da janela de 24h.
                  Baileys envia texto livre.
                </Typography>
              </div>
              <div className={classes.guideItem}>
                <Typography variant="subtitle2">Janela de envio</Typography>
                <Typography variant="body2" color="textSecondary">
                  Opcional — etapas que caírem fora do horário serão reagendadas para
                  o início da próxima janela.
                </Typography>
              </div>
            </>
          )}
          {activeStep === 1 && (
            <>
              <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
                Etapas
              </Typography>
              <div className={classes.guideItem}>
                <Typography variant="subtitle2">Intervalo</Typography>
                <Typography variant="body2" color="textSecondary">
                  A primeira etapa usa o intervalo a partir da inscrição; as demais
                  contam a partir da etapa anterior.
                </Typography>
              </div>
              <div className={classes.guideItem}>
                <Typography variant="subtitle2">Templates Meta</Typography>
                <Typography variant="body2" color="textSecondary">
                  {isOfficial
                    ? "Obrigatórios na API Oficial — só templates aprovados aparecem. Use o botão para criar novos sem sair do fluxo."
                    : "Opcionais — aparecem quando a conexão é oficial."}
                </Typography>
              </div>
            </>
          )}
          {activeStep === 2 && (
            <>
              <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
                Ação final
              </Typography>
              <div className={classes.guideItem}>
                <Typography variant="subtitle2">Ao concluir</Typography>
                <Typography variant="body2" color="textSecondary">
                  Mova o contato para outra lane, mude o status do ticket ou
                  transfira a carteira para uma fila/atendente — tudo automático.
                </Typography>
              </div>
              <div className={classes.guideItem}>
                <Typography variant="subtitle2">Cancelamentos</Typography>
                <Typography variant="body2" color="textSecondary">
                  Se o contato responder ou sair da lane antes do fim, a ação final
                  não é executada — a sequência é cancelada.
                </Typography>
              </div>
            </>
          )}
        </Paper>
      </div>
            </div>
          </Paper>
        </motion.div>

      {/* Modal de criação de template Meta — reutiliza o componente existente */}
      {isOfficial && (
        <MetaTemplateModal
          open={tplModalOpen}
          onClose={() => {
            setTplModalOpen(false);
            setTplStepIndex(null);
            fetchTemplates();
          }}
          whatsappId={form.whatsappId}
          template={null}
          onSaved={() => {
            setTplModalOpen(false);
            setTplStepIndex(null);
            fetchTemplates();
            toast.success("Template enviado — após aprovação da Meta ele fica disponível aqui");
          }}
        />
      )}

      {/* Seletor de respostas rápidas — insere o texto na etapa aberta */}
      <QuickMessagePicker
        open={quickPickerStepIndex !== null}
        onClose={() => setQuickPickerStepIndex(null)}
        onSelect={text => {
          if (quickPickerStepIndex === null) return;
          const cur = steps[quickPickerStepIndex]?.message || "";
          handleStepChange(
            quickPickerStepIndex,
            "message",
            cur ? `${cur}\n\n${text}` : text
          );
        }}
      />
      </motion.div>
    </MainContainer>
  );
};

export default FollowUpForm;
