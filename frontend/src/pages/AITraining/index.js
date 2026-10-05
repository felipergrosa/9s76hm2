import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  makeStyles
} from "@material-ui/core";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import EditIcon from "@material-ui/icons/Edit";
import AssessmentIcon from "@material-ui/icons/Assessment";
import HistoryIcon from "@material-ui/icons/History";
import CompareArrowsIcon from "@material-ui/icons/CompareArrows";
import AccountTreeIcon from "@material-ui/icons/AccountTree";
import BugReportIcon from "@material-ui/icons/BugReport";
import SchoolIcon from "@material-ui/icons/School";
import { toast } from "react-toastify";
import { Eraser as ClearIcon } from "lucide-react";

import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import ForbiddenPage from "../../components/ForbiddenPage";
import WhatsAppPreview from "../../components/CampaignModal/WhatsAppPreview";

import {
  PromptAssistant,
  TestScenarios,
  PromptVersioning,
  TrainingMetricsDashboard,
  ABTestingComparison,
  PromptFlowVisualization,
  ToolCallsHistory,
  OnboardingTour,
  AgentCapabilities
} from "../../components/AITraining";

import api from "../../services/api";
import useWhatsApps from "../../hooks/useWhatsApps";
import { getAIAgents } from "../../services/aiAgents";
import usePermissions from "../../hooks/usePermissions";

// ===== Estilos no padrão de layout (referência: Connections) =====
const useStyles = makeStyles((theme) => ({
  paper: {
    flex: 1,
    padding: 0,
    overflowX: "hidden",
    overflowY: "auto",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    ...theme.scrollbarStyles
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
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: "0.85rem",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
    padding: theme.spacing(1.5, 2.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    borderBottom: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : "#fafafa",
  },
  selectField: {
    minWidth: 200,
    flex: "1 1 240px",
    maxWidth: 420,
  },
  tabsContainer: {
    marginBottom: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`
  },
  tabPanel: {
    minHeight: "calc(100vh - 280px)",
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.paper
  },
  leftPane: {
    height: "calc(100vh - 320px)",
    minHeight: 400,
    padding: theme.spacing(2)
  },
  rightPane: {
    height: "calc(100vh - 320px)",
    minHeight: 400,
    padding: theme.spacing(2),
    backgroundColor: "#0d1117 !important",
    color: "#e6edf3 !important",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, Consolas, 'Courier New', monospace !important",
    fontSize: 13,
    overflow: "auto",
    border: "1px solid #30363d !important",
    borderRadius: 8,
    boxShadow: "inset 0 0 20px rgba(0,0,0,0.5) !important",
    '& *': {
      color: "#e6edf3 !important",
      backgroundColor: "transparent !important"
    },
    '&.MuiPaper-root': {
      backgroundColor: "#0d1117 !important"
    },
    '&.MuiPaper-outlined': {
      backgroundColor: "#0d1117 !important"
    }
  },
  mockPhone: {
    width: "100%",
    maxWidth: 420,
    height: "100%",
    margin: "0 auto",
    borderRadius: 24,
    border: theme.mode === "light" ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(255,255,255,0.12)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column"
  },
  bubbleAgent: {
    alignSelf: "flex-end",
    padding: theme.spacing(1),
    borderRadius: 14,
    backgroundColor: theme.palette.primary.main,
    color: "#fff",
    maxWidth: "85%",
    marginBottom: theme.spacing(1)
  },
  logLine: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    marginBottom: theme.spacing(0.5),
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, Consolas, monospace !important",
    fontSize: "12px !important",
    lineHeight: "1.5",
    color: "#e6edf3 !important",
    padding: "2px 0",
    borderLeft: "2px solid transparent",
    paddingLeft: theme.spacing(0.5),
    "&:hover": {
      backgroundColor: "rgba(48, 54, 61, 0.5)",
      borderLeftColor: "#58a6ff"
    }
  }
}));

const TabPanel = ({ children, value, index, ...other }) => (
  <div role="tabpanel" hidden={value !== index} {...other}>
    {value === index && <Box p={2}>{children}</Box>}
  </div>
);

const AITraining = () => {
  const classes = useStyles();

  const { hasPermission } = usePermissions();
  const canEditSettings = hasPermission("ai-settings.edit");
  const canEditAgents = hasPermission("ai-agents.edit");
  const canViewContacts = hasPermission("contacts.view");
  const { whatsApps, loading: loadingWhatsApps } = useWhatsApps();

  const [activeTab, setActiveTab] = useState(0);
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [stages, setStages] = useState([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [selectedWhatsappId, setSelectedWhatsappId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [toNumber, setToNumber] = useState("");
  const [simulate, setSimulate] = useState(true);

  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const [promptOverride, setPromptOverride] = useState("");
  // Prompt original salvo na etapa — usado para só enviar override quando o usuário editar
  const originalPromptRef = useRef("");
  const [messageText, setMessageText] = useState("");
  const [pendingImprovements, setPendingImprovements] = useState(0);

  const [sessionId, setSessionId] = useState("");
  const [sending, setSending] = useState(false);

  const [messageRatings, setMessageRatings] = useState({});
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [rateTargetMessageId, setRateTargetMessageId] = useState(null);
  const [rateCorrectedText, setRateCorrectedText] = useState("");
  const [rateExplanation, setRateExplanation] = useState("");

  const [messages, setMessages] = useState([]);
  const [logs, setLogs] = useState([]);
  const [toolCalls, setToolCalls] = useState([]);

  const selectedWhatsapp = useMemo(() => {
    return whatsApps.find((w) => String(w.id) === String(selectedWhatsappId));
  }, [whatsApps, selectedWhatsappId]);

  useEffect(() => {
    const loadAgents = async () => {
      setLoadingAgents(true);
      try {
        const { agents: data } = await getAIAgents();
        setAgents(Array.isArray(data) ? data : []);
      } catch (err) {
        toast.error(err.response?.data?.error || err.response?.data?.message || "Erro ao carregar agentes");
      }
      setLoadingAgents(false);
    };
    loadAgents();
  }, []);

  useEffect(() => {
    const loadGroups = async () => {
      if (!selectedWhatsappId || simulate || !canViewContacts) {
        setGroups([]);
        setSelectedGroupId("");
        return;
      }
      if (String(selectedWhatsapp?.channelType) === "official") {
        setGroups([]);
        setSelectedGroupId("");
        return;
      }
      setLoadingGroups(true);
      try {
        const { data } = await api.get(`/wbot/${selectedWhatsappId}/groups`);
        setGroups(Array.isArray(data?.groups) ? data.groups : []);
      } catch (err) {
        toast.error(err.response?.data?.error || err.response?.data?.message || "Erro ao carregar grupos da conexão");
        setGroups([]);
      }
      setLoadingGroups(false);
    };
    loadGroups();
  }, [selectedWhatsappId, simulate, selectedWhatsapp?.channelType, canViewContacts]);

  // Fila de melhorias pendentes da etapa (viram skills do agente ao aplicar)
  const loadPendingImprovements = async () => {
    if (!selectedAgentId || !selectedStageId) {
      setPendingImprovements(0);
      return;
    }
    try {
      const { data } = await api.get("/ai/training/improvements", {
        params: {
          agentId: Number(selectedAgentId),
          stageId: Number(selectedStageId),
          status: "pending",
          limit: 1
        }
      });
      setPendingImprovements(Number(data?.total) || 0);
    } catch (err) {
      setPendingImprovements(0);
    }
  };

  useEffect(() => {
    loadPendingImprovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgentId, selectedStageId]);

  // Aplica melhorias pendentes: backend converte em skills do agente
  const handleApplyImprovements = async () => {
    if (!selectedAgentId) return toast.error("Selecione um agente");
    if (!selectedStageId) return toast.error("Selecione uma etapa");

    try {
      const { data } = await api.post("/ai/training/improvements/apply", {
        agentId: Number(selectedAgentId),
        stageId: Number(selectedStageId)
      });
      const applied = Number(data?.applied) || 0;
      const skillNames = (Array.isArray(data?.skills) ? data.skills : [])
        .map((s) => s?.name)
        .filter(Boolean);
      appendLog(`[improvement] aplicadas=${applied} skills=${skillNames.join(", ") || "-"}`);
      toast.success(`${applied} melhoria(s) convertida(s) em habilidade(s) do agente`);
      loadPendingImprovements();
    } catch (err) {
      appendLog("[error] falha ao aplicar melhorias");
      toast.error(err.response?.data?.error || err.response?.data?.message || "Falha ao aplicar melhorias no agente");
    }
  };

  // Reseta conversa e avaliações (sessão nova não conhece as mensagens antigas)
  const resetConversationState = () => {
    setSessionId("");
    setMessages([]);
    setLogs([]);
    setToolCalls([]);
    setMessageRatings({});
    setRateModalOpen(false);
    setRateTargetMessageId(null);
    setRateCorrectedText("");
    setRateExplanation("");
  };

  const appendLog = (line) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} ${line}`]);
  };

  const handleClear = () => {
    resetConversationState();
    appendLog("[sandbox] conversa limpa");
  };

  const loadStages = async (agentId) => {
    if (!agentId) {
      setStages([]);
      setSelectedStageId("");
      setPromptOverride("");
      originalPromptRef.current = "";
      return;
    }
    setLoadingStages(true);
    try {
      const { data } = await api.get(`/ai-agents/${agentId}/funnel-stages`);
      const nextStages = Array.isArray(data?.stages) ? data.stages : [];
      setStages(nextStages);
      if (nextStages[0]?.id) {
        setSelectedStageId(String(nextStages[0].id));
        setPromptOverride(nextStages[0].systemPrompt || "");
        originalPromptRef.current = nextStages[0].systemPrompt || "";
      } else {
        setSelectedStageId("");
        setPromptOverride("");
        originalPromptRef.current = "";
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || "Erro ao carregar etapas do funil");
      setStages([]);
      setSelectedStageId("");
      setPromptOverride("");
      originalPromptRef.current = "";
    } finally {
      setLoadingStages(false);
    }
  };

  const handleApplyToAgentStage = async () => {
    if (!selectedAgentId) return toast.error("Selecione um agente");
    if (!selectedStageId) return toast.error("Selecione uma etapa");
    if (!promptOverride.trim()) return toast.error("Informe o prompt para aplicar");

    const stage = stages.find((s) => String(s.id) === String(selectedStageId));
    const stageLabel = stage?.name ? `${stage.name} (ordem ${stage.order})` : selectedStageId;

    const ok = window.confirm(
      `Aplicar o prompt na etapa do funil "${stageLabel}"?\n\nIsso irá sobrescrever o systemPrompt salvo no agente.`
    );
    if (!ok) return;

    try {
      await api.put(
        `/ai-agents/${selectedAgentId}/funnel-stages/${selectedStageId}/system-prompt`,
        { systemPrompt: promptOverride }
      );
      appendLog(`[agent] prompt aplicado na etapa ${stageLabel}`);
      setSessionId("");
      await loadStages(selectedAgentId);
      toast.success("Prompt aplicado no agente");
    } catch (err) {
      appendLog("[error] falha ao aplicar prompt no agente");
      toast.error(err.response?.data?.error || err.response?.data?.message || "Erro ao aplicar prompt no agente");
    }
  };
  const ensureSession = async () => {
    if (sessionId) return sessionId;

    const { data } = await api.post("/ai/sandbox/sessions", {
      agentId: Number(selectedAgentId),
      stageId: Number(selectedStageId),
      whatsappId: simulate ? undefined : Number(selectedWhatsappId),
      groupId:
        !simulate && String(selectedWhatsapp?.channelType) !== "official"
          ? String(selectedGroupId)
          : undefined,
      toNumber: !simulate && String(selectedWhatsapp?.channelType) === "official" ? String(toNumber) : undefined,
      simulate: Boolean(simulate),
      // Só envia override quando o usuário editou o prompt da etapa (backend deduplica, mas evitamos ruído)
      promptOverride:
        String(promptOverride || "") !== String(originalPromptRef.current || "")
          ? String(promptOverride || "")
          : undefined
    });

    const newId = data?.session?.id;
    if (!newId) {
      throw new Error("Falha ao criar sessão de sandbox");
    }
    setSessionId(String(newId));
    appendLog(`[sandbox] sessão criada: ${newId}`);
    return String(newId);
  };

  const handleSendLocal = async () => {
    if (!selectedAgentId) return toast.error("Selecione um agente");
    if (!selectedStageId) return toast.error("Selecione uma etapa");
    if (!simulate && !selectedWhatsappId) return toast.error("Selecione uma conexão");

    const isOfficial = String(selectedWhatsapp?.channelType) === "official";
    if (!simulate && isOfficial && !String(toNumber || "").trim()) {
      return toast.error("Informe o número do destinatário");
    }
    if (!simulate && !isOfficial && !selectedGroupId) {
      return toast.error("Selecione um grupo de destino");
    }
    if (!messageText.trim()) return;

    if (sending) return;


    const text = messageText.trim();
    const customerMsgId = `m-${Date.now()}-${Math.random()}`;

    setMessages((prev) => [...prev, { id: customerMsgId, from: "customer", text }]);
    appendLog(`[input] ${text}`);

    try {
      setSending(true);
      const sId = await ensureSession();

      const { data } = await api.post(`/ai/sandbox/sessions/${sId}/messages`, { text });

      // Limpa o input só depois do sucesso — em erro o texto digitado não se perde
      setMessageText("");

      const meta = data?.metadata || {};
      const assistantText = data?.message?.text;
      if (assistantText) {
        // messageCount conta as mensagens reais da sessão (multi-turno no backend);
        // a resposta do assistente é a última, então o índice é messageCount - 1
        const realIndex = typeof meta.messageCount === "number" ? meta.messageCount - 1 : undefined;
        setMessages((prev) => [...prev, { id: `m-${Date.now()}-${Math.random()}`, from: "assistant", text: assistantText, messageIndex: realIndex }]);
      }
      appendLog(`[ai] provider=${meta.provider || "?"} model=${meta.model || "?"} time=${meta.processingTime || "?"}ms`);

      if (meta.toolCalls && Array.isArray(meta.toolCalls)) {
        const newToolCalls = meta.toolCalls.map((tc, idx) => ({
          id: `tc-${Date.now()}-${idx}`,
          name: tc.name,
          parameters: tc.parameters,
          result: tc.result,
          status: tc.error ? "error" : "success",
          error: tc.error,
          duration: tc.duration,
          timestamp: new Date().toISOString()
        }));
        setToolCalls((prev) => [...prev, ...newToolCalls]);
      }

    } catch (err) {
      // Remove a bolha otimista do cliente — o texto continua no input para reenvio
      setMessages((prev) => prev.filter((m) => m.id !== customerMsgId));
      appendLog("[error] falha ao executar sandbox");
      toast.error(err.response?.data?.error || err.response?.data?.message || "Erro ao executar sandbox");
    } finally {
      setSending(false);
    }
  };

  // Índice da mensagem dentro das mensagens REAIS da sessão:
  // usa o messageIndex carimbado via metadata.messageCount quando disponível,
  // senão conta só customer/assistant (exclui bolhas "improved" inseridas pela UI)
  const getSessionMessageData = (messageId) => {
    const realMessages = messages.filter((m) => !m.improved);
    const idx = realMessages.findIndex((m) => String(m.id ?? "") === String(messageId));
    if (idx < 0) return null;
    const target = realMessages[idx];
    return {
      messageIndex: typeof target.messageIndex === "number" ? target.messageIndex : idx,
      assistantMsg: target,
      customerMsg: idx > 0 ? realMessages[idx - 1] : null
    };
  };

  const closeRateModal = () => {
    setRateModalOpen(false);
    setRateTargetMessageId(null);
    setRateCorrectedText("");
    setRateExplanation("");
  };

  const onRateMessage = async ({ messageId, rating }) => {
    if (!sessionId) {
      toast.error("Sessão não encontrada. Envie uma mensagem antes de avaliar.");
      return;
    }

    if (messageRatings[String(messageId)]) return;

    const msgData = getSessionMessageData(messageId);
    if (!msgData) return;

    if (rating === "correct") {
      try {
        await api.post("/ai/training/feedback", {
          agentId: Number(selectedAgentId),
          stageId: Number(selectedStageId),
          sandboxSessionId: String(sessionId),
          messageIndex: msgData.messageIndex,
          customerText: msgData.customerMsg?.from === "customer" ? msgData.customerMsg.text : null,
          assistantText: msgData.assistantMsg?.text || null,
          rating: "correct"
        });
        setMessageRatings((prev) => ({ ...prev, [String(messageId)]: "correct" }));
        appendLog(`[rating] correto messageId=${messageId}`);
      } catch (err) {
        toast.error(err.response?.data?.error || err.response?.data?.message || "Erro ao salvar avaliação");
      }
      return;
    }

    setRateTargetMessageId(String(messageId));
    setRateModalOpen(true);
  };

  const submitWrongFeedback = async (opts = { applyNow: false }) => {
    if (!rateTargetMessageId) return;
    if (!String(rateCorrectedText || "").trim()) {
      toast.error("Informe a resposta correta");
      return;
    }
    if (!String(rateExplanation || "").trim()) {
      toast.error("Explique o motivo da correção");
      return;
    }

    const msgData = getSessionMessageData(rateTargetMessageId);
    if (!msgData) return;

    const assistantMsg = msgData.assistantMsg;
    const customerMsg = msgData.customerMsg;

    try {
      const feedbackRes = await api.post("/ai/training/feedback", {
        agentId: Number(selectedAgentId),
        stageId: Number(selectedStageId),
        sandboxSessionId: String(sessionId),
        messageIndex: msgData.messageIndex,
        customerText: customerMsg?.from === "customer" ? customerMsg.text : null,
        assistantText: assistantMsg?.text || null,
        rating: "wrong",
        correctedText: String(rateCorrectedText).trim(),
        explanation: String(rateExplanation).trim()
      });
      const feedbackId = feedbackRes?.data?.feedback?.id;

      const improvementText = [
        "Correção de resposta do agente:",
        `Pergunta do cliente: ${customerMsg?.from === "customer" ? String(customerMsg.text || "").trim() : ""}`,
        `Resposta errada: ${String(assistantMsg?.text || "").trim()}`,
        `Resposta correta: ${String(rateCorrectedText).trim()}`,
        `Motivo/explicação: ${String(rateExplanation).trim()}`
      ].join("\n");

      await api.post("/ai/training/improvements", {
        agentId: Number(selectedAgentId),
        stageId: Number(selectedStageId),
        feedbackId: feedbackId || undefined,
        improvementText
      });

      setMessageRatings((prev) => ({ ...prev, [String(rateTargetMessageId)]: "wrong" }));
      setMessages((prev) => [
        ...prev,
        { id: `m-${Date.now()}-${Math.random()}`, from: "assistant", text: String(rateCorrectedText).trim(), improved: true }
      ]);
      appendLog(`[rating] errado messageId=${rateTargetMessageId} -> resposta melhorada inserida`);

      if (opts?.applyNow) {
        await handleApplyImprovements();
      } else {
        loadPendingImprovements();
      }

      closeRateModal();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || "Erro ao salvar correção");
    }
  };

  const handlePromptChange = (newPrompt) => {
    setPromptOverride(newPrompt);
  };

  const handleRestoreVersion = (restoredPrompt) => {
    setPromptOverride(restoredPrompt);
    toast.success("Versão restaurada no editor");
  };

  // Toolbar de contexto no padrão de layout: filtros do sandbox
  // (agente, etapa do funil e conexão) + feedback de carregamento/vazio
  const renderContextSelector = () => (
    <div className={classes.toolbar}>
      <FormControl variant="outlined" size="small" className={classes.selectField}>
        <InputLabel>Agente</InputLabel>
        <Select
          value={selectedAgentId}
          onChange={async (e) => {
            const next = e.target.value;
            setSelectedAgentId(next);
            resetConversationState();
            await loadStages(next);
          }}
          label="Agente"
          disabled={loadingAgents}
        >
          <MenuItem value=""><em>Selecione</em></MenuItem>
          {agents.map((a) => (
            <MenuItem key={a.id} value={String(a.id)}>{a.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl variant="outlined" size="small" className={classes.selectField}>
        <InputLabel>Etapa do funil</InputLabel>
        <Select
          value={selectedStageId}
          onChange={(e) => {
            const stageId = e.target.value;
            setSelectedStageId(stageId);
            resetConversationState();
            const stage = stages.find((s) => String(s.id) === stageId);
            setPromptOverride(stage?.systemPrompt || "");
            originalPromptRef.current = stage?.systemPrompt || "";
          }}
          label="Etapa do funil"
          disabled={!selectedAgentId || loadingStages}
        >
          <MenuItem value=""><em>Selecione</em></MenuItem>
          {stages.map((s) => (
            <MenuItem key={s.id} value={String(s.id)}>{s.order} - {s.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl variant="outlined" size="small" className={classes.selectField}>
        <InputLabel>Conexão</InputLabel>
        <Select
          value={selectedWhatsappId}
          onChange={(e) => {
            setSelectedWhatsappId(e.target.value);
            setSelectedGroupId("");
            setToNumber("");
            setSessionId("");
          }}
          label="Conexão"
          disabled={loadingWhatsApps}
        >
          <MenuItem value=""><em>Selecione</em></MenuItem>
          {whatsApps.map((w) => (
            <MenuItem key={w.id} value={String(w.id)}>{w.name} ({w.status})</MenuItem>
          ))}
        </Select>
      </FormControl>
      {loadingAgents ? (
        // Estado de carregamento da lista de agentes
        <Box display="flex" alignItems="center" style={{ gap: 8 }}>
          <CircularProgress size={16} />
          <span className={classes.subtitle}>Carregando agentes…</span>
        </Box>
      ) : agents.length === 0 ? (
        // Empty state: sem agente de IA não há o que treinar
        <span className={classes.subtitle}>Nenhum agente de IA cadastrado — crie um agente para iniciar o treinamento.</span>
      ) : null}
    </div>
  );

  return (
    <MainContainer>
      {!hasPermission("ai-training.view") ? <ForbiddenPage /> : (
      <Paper className={classes.paper} variant="outlined">
        {/* Cabeçalho no padrão /connections: título + subtítulo + ações */}
        <div className={classes.header}>
          <div className={classes.headerText}>
            <Title>Training / Sandbox (IA)</Title>
            <span className={classes.subtitle}>
              Treine, teste e ajuste os prompts dos agentes de IA em um ambiente seguro antes de aplicar em produção.
            </span>
          </div>
          <div className={classes.headerActions}>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              onClick={handleClear}
              startIcon={<ClearIcon size={16} />}
              style={{ minHeight: 36 }}
            >
              Limpar
            </Button>
          </div>
        </div>

        {/* Toolbar: seletores de contexto do sandbox (agente/etapa/conexão) */}
        {renderContextSelector()}

        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          className={classes.tabsContainer}
          variant="scrollable"
          scrollButtons="auto"
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab icon={<PlayArrowIcon />} label="Sandbox" data-tour="sandbox" />
          <Tab icon={<EditIcon />} label="Editor de Prompt" data-tour="prompt-assistant" />
          <Tab icon={<BugReportIcon />} label="Testes" data-tour="test-scenarios" />
          <Tab icon={<AccountTreeIcon />} label="Fluxograma" data-tour="flow-visualization" />
          <Tab icon={<HistoryIcon />} label="Versões" />
          <Tab icon={<CompareArrowsIcon />} label="A/B Testing" />
          <Tab icon={<AssessmentIcon />} label="Métricas" data-tour="metrics" />
          <Tab icon={<SchoolIcon />} label="Habilidades" />
        </Tabs>

        <TabPanel value={activeTab} index={0} className={classes.tabPanel}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">Ajuda (como usar)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box display="flex" flexDirection="column" width="100%">
                    <Typography variant="body2" color="textSecondary">
                      1) Selecione o Agente e a Etapa do funil que você quer testar.
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      2) (Opcional) Use o Editor de Prompt para ajustar o prompt.
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      3) Envie mensagens para testar. Avalie as respostas com os botões de feedback.
                    </Typography>
                  </Box>
                </AccordionDetails>
              </Accordion>
            </Grid>

            <Grid item xs={12}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Button
                    variant={simulate ? "contained" : "outlined"}
                    color={simulate ? "primary" : "default"}
                    onClick={() => {
                      setSimulate((prev) => !prev);
                      setSessionId("");
                    }}
                  >
                    Simular (não envia)
                  </Button>
                </Grid>

                {!simulate && String(selectedWhatsapp?.channelType) === "official" && (
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      variant="outlined"
                      size="small"
                      label="Número do destinatário (E.164)"
                      value={toNumber}
                      onChange={(e) => setToNumber(e.target.value)}
                      placeholder="5511999999999"
                    />
                  </Grid>
                )}

                {!simulate && String(selectedWhatsapp?.channelType) !== "official" && (
                  <Grid item xs={12} md={4}>
                    <Tooltip title={canViewContacts ? "" : "Requer permissão contacts.view para listar grupos"}>
                      <FormControl fullWidth variant="outlined" size="small">
                        <InputLabel>Grupo (destino)</InputLabel>
                        <Select
                          value={selectedGroupId}
                          onChange={(e) => setSelectedGroupId(e.target.value)}
                          label="Grupo (destino)"
                          disabled={!canViewContacts || !selectedWhatsappId || loadingGroups}
                        >
                          <MenuItem value=""><em>Selecione</em></MenuItem>
                          {groups.map((g) => (
                            <MenuItem key={g.id} value={String(g.id)}>{g.subject} ({g.participantsCount})</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Tooltip>
                  </Grid>
                )}
              </Grid>
            </Grid>

            {/* Fila de melhorias pendentes: viram skills do agente ao aplicar */}
            <Grid item xs={12}>
              <Box display="flex" alignItems="center" style={{ gap: 8, flexWrap: "wrap" }}>
                <Chip
                  size="small"
                  color={pendingImprovements > 0 ? "secondary" : "default"}
                  variant={pendingImprovements > 0 ? "default" : "outlined"}
                  label={`${pendingImprovements} melhoria(s) pendente(s)`}
                />
                <Tooltip
                  title={
                    !canEditAgents
                      ? "Requer permissão ai-agents.edit"
                      : "Converte as melhorias pendentes em habilidades (skills) do agente"
                  }
                >
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      onClick={handleApplyImprovements}
                      disabled={!canEditAgents || pendingImprovements === 0 || !selectedAgentId || !selectedStageId}
                    >
                      Aplicar melhorias no agente
                    </Button>
                  </span>
                </Tooltip>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper className={classes.leftPane} variant="outlined">
                <Box display="flex" flexDirection="column" alignItems="center" height="100%">
                  <WhatsAppPreview
                    messages={messages}
                    onRateMessage={onRateMessage}
                    messageRatings={messageRatings}
                    contactName={
                      selectedGroupId
                        ? (groups.find((g) => String(g.id) === String(selectedGroupId))?.subject || "Cliente")
                        : "Cliente"
                    }
                    companyName={selectedWhatsapp ? selectedWhatsapp.name : "Empresa"}
                  />
                  <Box mt={2} width="100%">
                    <Grid container spacing={1} alignItems="center">
                      <Grid item xs>
                        <TextField
                          fullWidth
                          variant="outlined"
                          size="small"
                          placeholder="Mensagem do cliente..."
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendLocal();
                            }
                          }}
                        />
                      </Grid>
                      <Grid item>
                        <Button color="primary" variant="contained" onClick={handleSendLocal} disabled={sending}>
                          {sending ? <CircularProgress size={20} /> : "Enviar"}
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <div style={{ height: "calc(100vh - 320px)", minHeight: 400, backgroundColor: "#0d1117", borderRadius: 8, border: "1px solid #30363d", overflow: "auto" }}>
                <Box p={2} style={{ backgroundColor: "#0d1117", color: "#e6edf3" }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                    <Typography variant="subtitle2" style={{ color: "#d7e0ff", fontFamily: "'JetBrains Mono', monospace" }}>Logs & Tool Calls</Typography>
                  </Box>
                  {logs.length === 0 ? (
                    <div className={classes.logLine}>Aguardando ações...</div>
                  ) : (
                    logs.map((l, idx) => (
                      <div key={idx} className={classes.logLine}>{l}</div>
                    ))
                  )}
                  {toolCalls.length > 0 && (
                    <Box mt={2}>
                      <ToolCallsHistory toolCalls={toolCalls} />
                    </Box>
                  )}
                </Box>
              </div>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={1} className={classes.tabPanel}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <PromptAssistant
                agentId={selectedAgentId}
                stageId={selectedStageId}
                initialPrompt={promptOverride}
                onPromptChange={handlePromptChange}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <PromptFlowVisualization prompt={promptOverride} />
            </Grid>
            <Grid item xs={12}>
              <Tooltip title={canEditAgents ? "" : "Requer permissão ai-agents.edit para alterar o prompt do agente"}>
                <span>
                  <Button
                    color="primary"
                    variant="contained"
                    onClick={handleApplyToAgentStage}
                    disabled={!canEditAgents || !selectedAgentId || !selectedStageId || !promptOverride.trim()}
                  >
                    Aplicar no agente (etapa selecionada)
                  </Button>
                </span>
              </Tooltip>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={2} className={classes.tabPanel}>
          <TestScenarios
            agentId={selectedAgentId}
            stageId={selectedStageId}
            promptOverride={promptOverride}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={3} className={classes.tabPanel}>
          <Box height="calc(100vh - 300px)" minHeight={500}>
            <PromptFlowVisualization prompt={promptOverride} />
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={4} className={classes.tabPanel}>
          <PromptVersioning
            agentId={selectedAgentId}
            stageId={selectedStageId}
            currentPrompt={promptOverride}
            onRestore={handleRestoreVersion}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={5} className={classes.tabPanel}>
          <ABTestingComparison
            agentId={selectedAgentId}
            stageId={selectedStageId}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={6} className={classes.tabPanel}>
          <Box height="100%" minHeight={500}>
            <TrainingMetricsDashboard 
              agentId={selectedAgentId || null} 
              stageId={selectedStageId || null}
            />
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={7} className={classes.tabPanel}>
          <AgentCapabilities
            agentId={selectedAgentId}
            stageId={selectedStageId}
          />
        </TabPanel>
      </Paper>
      )}

      <OnboardingTour />

      <Dialog open={rateModalOpen} onClose={closeRateModal} fullWidth maxWidth="sm">
        <DialogTitle>Corrigir resposta do agente</DialogTitle>
        <DialogContent>
          <Box mb={2} />
          <TextField
            fullWidth
            label="Resposta correta"
            variant="outlined"
            margin="dense"
            value={rateCorrectedText}
            onChange={(e) => setRateCorrectedText(e.target.value)}
            multiline
            minRows={3}
          />
          <TextField
            fullWidth
            label="Explique a correção (por quê estava errado)"
            variant="outlined"
            margin="dense"
            value={rateExplanation}
            onChange={(e) => setRateExplanation(e.target.value)}
            multiline
            minRows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRateModal}>Cancelar</Button>
          <Button onClick={() => submitWrongFeedback({ applyNow: false })} color="primary" variant="outlined">Salvar correção</Button>
          <Tooltip title={canEditSettings ? "Converte as melhorias pendentes em habilidades (skills) do agente" : "Requer permissão ai-settings.edit"}>
            <span>
              <Button onClick={() => submitWrongFeedback({ applyNow: true })} color="primary" variant="contained" disabled={!canEditSettings}>Salvar e aplicar na etapa</Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>
    </MainContainer>
  );
};

export default AITraining;
