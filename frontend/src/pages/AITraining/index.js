import React, { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
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
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
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
  ToolCallsHistory
} from "../../components/AITraining";

import api from "../../services/api";
import useWhatsApps from "../../hooks/useWhatsApps";
import { getAIAgents } from "../../services/aiAgents";
import usePermissions from "../../hooks/usePermissions";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "auto",
    ...theme.scrollbarStyles
  },
  tabsContainer: {
    marginBottom: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`
  },
  tabPanel: {
    minHeight: "calc(100vh - 280px)"
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
    backgroundColor: theme.mode === "light" ? "#0b1020" : "#05070f",
    color: "#d7e0ff",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    fontSize: 12,
    overflow: "auto"
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
    marginBottom: theme.spacing(0.5)
  },
  contextSelector: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    backgroundColor: theme.mode === "light" ? "#f5f5f5" : "#1a1a2e",
    borderRadius: 8
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
  const [messageText, setMessageText] = useState("");

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
        toast.error("Erro ao carregar agentes");
      }
      setLoadingAgents(false);
    };
    loadAgents();
  }, []);

  useEffect(() => {
    const loadGroups = async () => {
      if (!selectedWhatsappId || simulate) {
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
        toast.error("Erro ao carregar grupos da conexão");
        setGroups([]);
      }
      setLoadingGroups(false);
    };
    loadGroups();
  }, [selectedWhatsappId, simulate, selectedWhatsapp?.channelType]);

  const appendLog = (line) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} ${line}`]);
  };

  const handleClear = () => {
    setMessages([]);
    setLogs([]);
    setToolCalls([]);
    setSessionId("");
    appendLog("[sandbox] conversa limpa");
  };

  const loadStages = async (agentId) => {
    if (!agentId) {
      setStages([]);
      setSelectedStageId("");
      setPromptOverride("");
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
      } else {
        setSelectedStageId("");
        setPromptOverride("");
      }
    } catch (err) {
      toast.error("Erro ao carregar etapas do funil");
      setStages([]);
      setSelectedStageId("");
      setPromptOverride("");
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
      toast.error("Erro ao aplicar prompt no agente");
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
      promptOverride: String(promptOverride || "")
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
    setMessageText("");

    setMessages((prev) => [...prev, { id: `m-${Date.now()}-${Math.random()}`, from: "customer", text }]);
    appendLog(`[input] ${text}`);

    try {
      setSending(true);
      const sId = await ensureSession();

      const { data } = await api.post(`/ai/sandbox/sessions/${sId}/messages`, { text });

      const assistantText = data?.message?.text;
      if (assistantText) {
        setMessages((prev) => [...prev, { id: `m-${Date.now()}-${Math.random()}`, from: "assistant", text: assistantText }]);
      }

      const meta = data?.metadata || {};
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
      appendLog("[error] falha ao executar sandbox");
      toast.error("Erro ao executar sandbox");
    } finally {
      setSending(false);
    }
  };

  if (!hasPermission("ai-training.view")) {
    return <ForbiddenPage />;
  }

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

    const idx = messages.findIndex((m) => String(m.id ?? "") === String(messageId));
    if (idx < 0) return;

    const assistantMsg = messages[idx];
    const customerMsg = idx > 0 ? messages[idx - 1] : null;

    if (rating === "correct") {
      try {
        await api.post("/ai/training/feedback", {
          agentId: Number(selectedAgentId),
          stageId: Number(selectedStageId),
          sandboxSessionId: String(sessionId),
          messageIndex: idx,
          customerText: customerMsg?.from === "customer" ? customerMsg.text : null,
          assistantText: assistantMsg?.text || null,
          rating: "correct"
        });
        setMessageRatings((prev) => ({ ...prev, [String(messageId)]: "correct" }));
        appendLog(`[rating] correto messageId=${messageId}`);
      } catch (err) {
        toast.error("Erro ao salvar avaliação");
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

    const idx = messages.findIndex((m) => String(m.id ?? "") === String(rateTargetMessageId));
    if (idx < 0) return;

    const assistantMsg = messages[idx];
    const customerMsg = idx > 0 ? messages[idx - 1] : null;

    try {
      const feedbackRes = await api.post("/ai/training/feedback", {
        agentId: Number(selectedAgentId),
        stageId: Number(selectedStageId),
        sandboxSessionId: String(sessionId),
        messageIndex: idx,
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
        try {
          const applied = await api.post("/ai/training/improvements/apply", {
            agentId: Number(selectedAgentId),
            stageId: Number(selectedStageId)
          });
          appendLog(`[improvement] aplicado=${applied?.data?.applied || 0}`);
          toast.success("Melhoria aplicada na etapa");
        } catch (e) {
          toast.error("Falha ao aplicar melhoria na etapa");
        }
      }

      closeRateModal();
    } catch (err) {
      toast.error("Erro ao salvar correção");
    }
  };

  const handlePromptChange = (newPrompt) => {
    setPromptOverride(newPrompt);
  };

  const handleRestoreVersion = (restoredPrompt) => {
    setPromptOverride(restoredPrompt);
    toast.success("Versão restaurada no editor");
  };

  const renderContextSelector = () => (
    <Paper className={classes.contextSelector} variant="outlined">
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md={4}>
          <FormControl fullWidth variant="outlined" size="small">
            <InputLabel>Agente</InputLabel>
            <Select
              value={selectedAgentId}
              onChange={async (e) => {
                const next = e.target.value;
                setSelectedAgentId(next);
                setSessionId("");
                setMessages([]);
                setLogs([]);
                setToolCalls([]);
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
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth variant="outlined" size="small">
            <InputLabel>Etapa do funil</InputLabel>
            <Select
              value={selectedStageId}
              onChange={(e) => {
                const stageId = e.target.value;
                setSelectedStageId(stageId);
                setSessionId("");
                const stage = stages.find((s) => String(s.id) === stageId);
                if (stage) {
                  setPromptOverride(stage.systemPrompt || "");
                }
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
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth variant="outlined" size="small">
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
        </Grid>
      </Grid>
    </Paper>
  );

  return (

    <MainContainer>
      <MainHeader>
        <Title>Training / Sandbox (IA)</Title>
        <MainHeaderButtonsWrapper>
          <Button variant="outlined" onClick={handleClear}>Limpar</Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
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
          <Tab icon={<PlayArrowIcon />} label="Sandbox" />
          <Tab icon={<EditIcon />} label="Editor de Prompt" />
          <Tab icon={<BugReportIcon />} label="Testes" />
          <Tab icon={<AccountTreeIcon />} label="Fluxograma" />
          <Tab icon={<HistoryIcon />} label="Versões" />
          <Tab icon={<CompareArrowsIcon />} label="A/B Testing" />
          <Tab icon={<AssessmentIcon />} label="Métricas" />
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
                    <FormControl fullWidth variant="outlined" size="small">
                      <InputLabel>Grupo (destino)</InputLabel>
                      <Select
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        label="Grupo (destino)"
                        disabled={!selectedWhatsappId || loadingGroups}
                      >
                        <MenuItem value=""><em>Selecione</em></MenuItem>
                        {groups.map((g) => (
                          <MenuItem key={g.id} value={String(g.id)}>{g.subject} ({g.participantsCount})</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
              </Grid>
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
              <Paper className={classes.rightPane} variant="outlined">
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                  <Typography variant="subtitle2" style={{ color: "#d7e0ff" }}>Logs & Tool Calls</Typography>
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
              </Paper>
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
              <Button
                color="primary"
                variant="contained"
                onClick={handleApplyToAgentStage}
                disabled={!selectedAgentId || !selectedStageId || !promptOverride.trim()}
              >
                Aplicar no agente (etapa selecionada)
              </Button>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={2} className={classes.tabPanel}>
          <TestScenarios
            agentId={selectedAgentId}
            stageId={selectedStageId}
            currentPrompt={promptOverride}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={3} className={classes.tabPanel}>
          <PromptFlowVisualization prompt={promptOverride} />
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
          <TrainingMetricsDashboard agentId={selectedAgentId} />
        </TabPanel>
      </Paper>

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
          <Button onClick={() => submitWrongFeedback({ applyNow: true })} color="primary" variant="contained">Salvar e aplicar na etapa</Button>
        </DialogActions>
      </Dialog>
    </MainContainer>
  );
};

export default AITraining;
