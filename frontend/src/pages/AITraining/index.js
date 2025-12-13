import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  makeStyles
} from "@material-ui/core";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import ForbiddenPage from "../../components/ForbiddenPage";

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
  leftPane: {
    height: "calc(100vh - 220px)",
    minHeight: 480,
    padding: theme.spacing(2)
  },
  rightPane: {
    height: "calc(100vh - 220px)",
    minHeight: 480,
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
  mockHeader: {
    padding: theme.spacing(1.2, 1.5),
    borderBottom: theme.mode === "light" ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
    backgroundColor: theme.mode === "light" ? "#f7f7f7" : "#111425"
  },
  mockBody: {
    flex: 1,
    padding: theme.spacing(1.5),
    backgroundColor: theme.mode === "light" ? "#eaeef5" : "#0c0f1d",
    overflow: "auto"
  },
  mockComposer: {
    padding: theme.spacing(1),
    borderTop: theme.mode === "light" ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.08)",
    backgroundColor: theme.mode === "light" ? "#f7f7f7" : "#111425"
  },
  bubbleCustomer: {
    alignSelf: "flex-start",
    padding: theme.spacing(1),
    borderRadius: 14,
    backgroundColor: theme.mode === "light" ? "#ffffff" : "#1a2040",
    color: theme.mode === "light" ? "#111" : "#fff",
    maxWidth: "85%",
    marginBottom: theme.spacing(1)
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
  }
}));

const AITraining = () => {
  const classes = useStyles();

  const { hasPermission } = usePermissions();

  const { whatsApps, loading: loadingWhatsApps } = useWhatsApps();

  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [stages, setStages] = useState([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [selectedWhatsappId, setSelectedWhatsappId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");

  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const [promptOverride, setPromptOverride] = useState("");
  const [messageText, setMessageText] = useState("");

  const [sessionId, setSessionId] = useState("");
  const [sending, setSending] = useState(false);

  const [messages, setMessages] = useState([]);
  const [logs, setLogs] = useState([]);

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
      if (!selectedWhatsappId) {
        setGroups([]);
        setSelectedGroupId("");
        return;
      }

      setLoadingGroups(true);
      try {
        const { data } = await api.get(`/wbot/${selectedWhatsappId}/groups`);
        const nextGroups = Array.isArray(data?.groups) ? data.groups : [];
        setGroups(nextGroups);
      } catch (err) {
        toast.error("Erro ao carregar grupos da conexão");
        setGroups([]);
      }
      setLoadingGroups(false);
    };

    loadGroups();
  }, [selectedWhatsappId]);

  const appendLog = (line) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} ${line}`]);
  };

  const handleClear = () => {
    setMessages([]);
    setLogs([]);
    setSessionId("");
    appendLog("[sandbox] conversa limpa");
  };

  const loadStages = async (agentId) => {
    if (!agentId) {
      setStages([]);
      setSelectedStageId("");
      return;
    }

    setLoadingStages(true);
    try {
      const { data } = await api.get(`/ai-agents/${agentId}/funnel-stages`);
      const nextStages = Array.isArray(data?.stages) ? data.stages : [];
      setStages(nextStages);
      setSelectedStageId(nextStages[0]?.id ? String(nextStages[0].id) : "");
    } catch (err) {
      toast.error("Erro ao carregar etapas do funil");
      setStages([]);
      setSelectedStageId("");
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
      whatsappId: Number(selectedWhatsappId),
      groupId: String(selectedGroupId),
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
    if (!selectedWhatsappId) return toast.error("Selecione uma conexão");
    if (!selectedGroupId) return toast.error("Selecione um grupo de destino");
    if (!messageText.trim()) return;

    if (sending) return;

    const text = messageText.trim();
    setMessageText("");

    setMessages((prev) => [...prev, { from: "customer", text }]);
    appendLog(`[input] ${text}`);
    appendLog(`[context] agente=${selectedAgentId} whatsapp=${selectedWhatsappId} grupo=${selectedGroupId}`);
    if (promptOverride.trim()) {
      appendLog(`[prompt-override] ${promptOverride.trim()}`);
    }

    try {
      setSending(true);
      const sId = await ensureSession();

      const { data } = await api.post(`/ai/sandbox/sessions/${sId}/messages`, {
        text
      });

      const assistantText = data?.message?.text;
      if (assistantText) {
        setMessages((prev) => [...prev, { from: "assistant", text: assistantText }]);
      }

      const meta = data?.metadata || {};
      appendLog(
        `[ai] provider=${meta.provider || "?"} model=${meta.model || "?"} time=${meta.processingTime || "?"}ms requestId=${meta.requestId || "?"}`
      );
      if (meta.systemPrompt) {
        appendLog("[systemPrompt]" + "\n" + String(meta.systemPrompt));
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

  return (
    <MainContainer>
      <MainHeader>
        <Title>Training / Sandbox (IA)</Title>
        <MainHeaderButtonsWrapper>
          <Button variant="outlined" onClick={handleClear}>
            Limpar
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth variant="outlined" margin="dense">
                  <InputLabel>Agente</InputLabel>
                  <Select
                    value={selectedAgentId}
                    onChange={async (e) => {
                      const next = e.target.value;
                      setSelectedAgentId(next);
                      setSessionId("");
                      setMessages([]);
                      setLogs([]);
                      await loadStages(next);
                    }}
                    label="Agente"
                    disabled={loadingAgents}
                  >
                    <MenuItem value="">
                      <em>Selecione</em>
                    </MenuItem>
                    {agents.map((a) => (
                      <MenuItem key={a.id} value={String(a.id)}>
                        {a.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth variant="outlined" margin="dense">
                  <InputLabel>Etapa do funil</InputLabel>
                  <Select
                    value={selectedStageId}
                    onChange={(e) => {
                      setSelectedStageId(e.target.value);
                      setSessionId("");
                      appendLog(`[funnel] etapa selecionada: ${e.target.value}`);
                    }}
                    label="Etapa do funil"
                    disabled={!selectedAgentId || loadingStages}
                  >
                    <MenuItem value="">
                      <em>Selecione</em>
                    </MenuItem>
                    {stages.map((s) => (
                      <MenuItem key={s.id} value={String(s.id)}>
                        {s.order} - {s.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth variant="outlined" margin="dense">
                  <InputLabel>Conexão</InputLabel>
                  <Select
                    value={selectedWhatsappId}
                    onChange={(e) => setSelectedWhatsappId(e.target.value)}
                    label="Conexão"
                    disabled={loadingWhatsApps}
                  >
                    <MenuItem value="">
                      <em>Selecione</em>
                    </MenuItem>
                    {whatsApps.map((w) => (
                      <MenuItem key={w.id} value={String(w.id)}>
                        {w.name} ({w.status})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth variant="outlined" margin="dense">
                  <InputLabel>Grupo (destino)</InputLabel>
                  <Select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    label="Grupo (destino)"
                    disabled={!selectedWhatsappId || loadingGroups}
                  >
                    <MenuItem value="">
                      <em>Selecione</em>
                    </MenuItem>
                    {groups.map((g) => (
                      <MenuItem key={g.id} value={String(g.id)}>
                        {g.subject} ({g.participantsCount})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  variant="outlined"
                  margin="dense"
                  label="Prompt (para aplicar na etapa e/ou usar na sessão)"
                  value={promptOverride}
                  onChange={(e) => setPromptOverride(e.target.value)}
                  multiline
                  minRows={2}
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  color="primary"
                  variant="outlined"
                  onClick={handleApplyToAgentStage}
                  disabled={!selectedAgentId || !selectedStageId || !promptOverride.trim()}
                >
                  Aplicar no agente (etapa selecionada)
                </Button>
              </Grid>
            </Grid>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper className={classes.leftPane} variant="outlined">
              <div className={classes.mockPhone}>
                <div className={classes.mockHeader}>
                  <Typography variant="subtitle2">
                    {selectedWhatsapp ? selectedWhatsapp.name : "Selecione a conexão"}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {selectedGroupId
                      ? (groups.find((g) => String(g.id) === String(selectedGroupId))?.subject || "")
                      : "Selecione o grupo destino"}
                  </Typography>
                </div>

                <div className={classes.mockBody}>
                  <Box display="flex" flexDirection="column">
                    {messages.map((m, idx) => (
                      <div
                        key={idx}
                        className={m.from === "customer" ? classes.bubbleCustomer : classes.bubbleAgent}
                      >
                        {m.text}
                      </div>
                    ))}
                    {messages.length === 0 && (
                      <Typography variant="body2" color="textSecondary">
                        Envie uma mensagem para iniciar a simulação.
                      </Typography>
                    )}
                  </Box>
                </div>

                <div className={classes.mockComposer}>
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
                      <Button color="primary" variant="contained" onClick={handleSendLocal}>
                        Enviar
                      </Button>
                    </Grid>
                  </Grid>
                </div>
              </div>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper className={classes.rightPane} variant="outlined">
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography variant="subtitle2" style={{ color: "#d7e0ff" }}>
                  Logs
                </Typography>
                {(loadingAgents || loadingWhatsApps || loadingGroups) && (
                  <CircularProgress size={16} style={{ color: "#d7e0ff" }} />
                )}
              </Box>
              {logs.length === 0 ? (
                <div className={classes.logLine}>Aguardando ações...</div>
              ) : (
                logs.map((l, idx) => (
                  <div key={idx} className={classes.logLine}>
                    {l}
                  </div>
                ))
              )}
            </Paper>
          </Grid>
        </Grid>
      </Paper>
    </MainContainer>
  );
};

export default AITraining;
