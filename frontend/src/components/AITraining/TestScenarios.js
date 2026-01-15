import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  makeStyles
} from "@material-ui/core";
import AddIcon from "@material-ui/icons/Add";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import DeleteIcon from "@material-ui/icons/Delete";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import CancelIcon from "@material-ui/icons/Cancel";
import HistoryIcon from "@material-ui/icons/History";
import { toast } from "react-toastify";

import {
  createTestScenario,
  listTestScenarios,
  runTestScenario,
  deleteTestScenario,
  getTestHistory
} from "../../services/aiTraining";

const useStyles = makeStyles((theme) => ({
  container: {
    height: "100%",
    display: "flex",
    flexDirection: "column"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing(2)
  },
  scenarioCard: {
    marginBottom: theme.spacing(1.5),
    cursor: "pointer",
    transition: "all 0.2s",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: theme.shadows[4]
    }
  },
  selectedCard: {
    borderColor: theme.palette.primary.main,
    borderWidth: 2
  },
  scoreDisplay: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1)
  },
  scoreCircle: {
    width: 50,
    height: 50,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: 16,
    color: "#fff"
  },
  passRate: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5)
  },
  resultItem: {
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    borderRadius: 8,
    backgroundColor: theme.mode === "light" ? "#f5f5f5" : "#1a1a2e"
  },
  passedItem: {
    borderLeft: `4px solid ${theme.palette.success.main}`
  },
  failedItem: {
    borderLeft: `4px solid ${theme.palette.error.main}`
  },
  conversationEditor: {
    marginTop: theme.spacing(2)
  },
  conversationRow: {
    display: "flex",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
    alignItems: "flex-start"
  },
  historyList: {
    maxHeight: 400,
    overflow: "auto"
  },
  toolCallChip: {
    margin: theme.spacing(0.25),
    fontSize: 10
  }
}));

const TestScenarios = ({ agentId, stageId, promptOverride }) => {
  const classes = useStyles();
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState(0);

  const [newScenario, setNewScenario] = useState({
    name: "",
    description: "",
    conversations: [{ customer: "", expectedResponse: "" }]
  });

  useEffect(() => {
    if (agentId && stageId) {
      loadScenarios();
    }
  }, [agentId, stageId]);

  const loadScenarios = async () => {
    setLoading(true);
    try {
      const data = await listTestScenarios({ agentId, stageId });
      setScenarios(data.scenarios || []);
    } catch (err) {
      toast.error("Erro ao carregar cenários");
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await getTestHistory({ agentId, stageId, limit: 20 });
      setHistory(data.results || []);
      setShowHistory(true);
    } catch (err) {
      toast.error("Erro ao carregar histórico");
    }
  };

  const handleCreateScenario = async () => {
    if (!newScenario.name.trim()) {
      toast.warning("Informe o nome do cenário");
      return;
    }

    const validConversations = newScenario.conversations.filter(
      (c) => c.customer.trim() && c.expectedResponse.trim()
    );

    if (validConversations.length === 0) {
      toast.warning("Adicione pelo menos uma conversa válida");
      return;
    }

    setLoading(true);
    try {
      await createTestScenario({
        agentId,
        stageId,
        name: newScenario.name.trim(),
        description: newScenario.description.trim(),
        conversations: validConversations
      });

      toast.success("Cenário criado!");
      setShowCreate(false);
      setNewScenario({
        name: "",
        description: "",
        conversations: [{ customer: "", expectedResponse: "" }]
      });
      loadScenarios();
    } catch (err) {
      toast.error("Erro ao criar cenário");
    } finally {
      setLoading(false);
    }
  };

  const handleRunScenario = async (scenario) => {
    setRunning(true);
    setSelectedScenario(scenario);
    setTestResults(null);

    try {
      const data = await runTestScenario(scenario.id, { promptOverride });
      setTestResults(data.testResult);
      toast.success(`Teste concluído: ${data.testResult.passRate}% de acerto`);
    } catch (err) {
      toast.error("Erro ao executar teste");
    } finally {
      setRunning(false);
    }
  };

  const handleDeleteScenario = async (scenario, e) => {
    e.stopPropagation();
    if (!window.confirm(`Excluir cenário "${scenario.name}"?`)) return;

    try {
      await deleteTestScenario(scenario.id);
      toast.success("Cenário excluído");
      loadScenarios();
      if (selectedScenario?.id === scenario.id) {
        setSelectedScenario(null);
        setTestResults(null);
      }
    } catch (err) {
      toast.error("Erro ao excluir cenário");
    }
  };

  const addConversation = () => {
    setNewScenario((prev) => ({
      ...prev,
      conversations: [...prev.conversations, { customer: "", expectedResponse: "" }]
    }));
  };

  const updateConversation = (index, field, value) => {
    setNewScenario((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c, i) =>
        i === index ? { ...c, [field]: value } : c
      )
    }));
  };

  const removeConversation = (index) => {
    setNewScenario((prev) => ({
      ...prev,
      conversations: prev.conversations.filter((_, i) => i !== index)
    }));
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "#4caf50";
    if (score >= 60) return "#ff9800";
    return "#f44336";
  };

  return (
    <Box className={classes.container}>
      <Box className={classes.header}>
        <Typography variant="h6">Testes Unitários</Typography>
        <Box display="flex" gap={1}>
          <Button
            startIcon={<HistoryIcon />}
            onClick={loadHistory}
            variant="outlined"
            size="small"
          >
            Histórico
          </Button>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setShowCreate(true)}
            variant="contained"
            color="primary"
            size="small"
            disabled={!agentId || !stageId}
          >
            Novo Cenário
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" gutterBottom>
              Cenários ({scenarios.length})
            </Typography>
            {scenarios.length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                Nenhum cenário criado ainda.
              </Typography>
            ) : (
              scenarios.map((scenario) => (
                <Card
                  key={scenario.id}
                  className={`${classes.scenarioCard} ${selectedScenario?.id === scenario.id ? classes.selectedCard : ""
                    }`}
                  variant="outlined"
                  onClick={() => setSelectedScenario(scenario)}
                >
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2">{scenario.name}</Typography>
                      <Box>
                        <Tooltip title="Executar teste">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRunScenario(scenario);
                            }}
                            disabled={running}
                          >
                            {running && selectedScenario?.id === scenario.id ? (
                              <CircularProgress size={18} />
                            ) : (
                              <PlayArrowIcon />
                            )}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Excluir">
                          <IconButton
                            size="small"
                            onClick={(e) => handleDeleteScenario(scenario, e)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                    {scenario.description && (
                      <Typography variant="caption" color="textSecondary">
                        {scenario.description}
                      </Typography>
                    )}
                    <Typography variant="caption" display="block">
                      {JSON.parse(scenario.conversations || "[]").length} mensagens
                    </Typography>
                  </CardContent>
                </Card>
              ))
            )}
          </Grid>

          <Grid item xs={12} md={8}>
            {testResults ? (
              <Paper variant="outlined" style={{ padding: 16 }}>
                <Box className={classes.scoreDisplay} mb={2}>
                  <Box
                    className={classes.scoreCircle}
                    style={{ backgroundColor: getScoreColor(testResults.overallScore) }}
                  >
                    {testResults.overallScore}%
                  </Box>
                  <Box>
                    <Typography variant="h6">Score Geral</Typography>
                    <Box className={classes.passRate}>
                      <CheckCircleIcon
                        style={{ color: "#4caf50", fontSize: 16 }}
                      />
                      <Typography variant="body2">
                        {testResults.passedTests}/{testResults.totalTests} passaram
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <LinearProgress
                  variant="determinate"
                  value={testResults.passRate}
                  style={{
                    height: 8,
                    borderRadius: 4,
                    marginBottom: 16,
                    backgroundColor: "#e0e0e0"
                  }}
                />

                <Typography variant="subtitle2" gutterBottom>
                  Resultados Detalhados
                </Typography>

                {testResults.results?.map((result, idx) => (
                  <Box
                    key={idx}
                    className={`${classes.resultItem} ${result.passed ? classes.passedItem : classes.failedItem
                      }`}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2">
                        Mensagem #{idx + 1}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Chip
                          size="small"
                          label={`${result.similarity}%`}
                          color={result.passed ? "primary" : "default"}
                        />
                        {result.passed ? (
                          <CheckCircleIcon style={{ color: "#4caf50" }} />
                        ) : (
                          <CancelIcon style={{ color: "#f44336" }} />
                        )}
                      </Box>
                    </Box>

                    <Box mt={1}>
                      <Typography variant="caption" color="textSecondary">
                        Cliente:
                      </Typography>
                      <Typography variant="body2">{result.customerMessage}</Typography>
                    </Box>

                    <Box mt={1}>
                      <Typography variant="caption" color="textSecondary">
                        Esperado:
                      </Typography>
                      <Typography variant="body2" style={{ color: "#4caf50" }}>
                        {result.expectedResponse}
                      </Typography>
                    </Box>

                    <Box mt={1}>
                      <Typography variant="caption" color="textSecondary">
                        Resposta da IA:
                      </Typography>
                      <Typography
                        variant="body2"
                        style={{ color: result.passed ? "inherit" : "#f44336" }}
                      >
                        {result.actualResponse}
                      </Typography>
                    </Box>

                    {result.toolCalls?.length > 0 && (
                      <Box mt={1}>
                        <Typography variant="caption" color="textSecondary">
                          Tool Calls:
                        </Typography>
                        <Box>
                          {result.toolCalls.map((tc, i) => (
                            <Chip
                              key={i}
                              className={classes.toolCallChip}
                              size="small"
                              label={tc}
                              color="secondary"
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                ))}
              </Paper>
            ) : selectedScenario ? (
              <Paper variant="outlined" style={{ padding: 16 }}>
                <Typography variant="subtitle1">{selectedScenario.name}</Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {selectedScenario.description || "Sem descrição"}
                </Typography>
                <Divider style={{ margin: "16px 0" }} />
                <Typography variant="subtitle2" gutterBottom>
                  Conversas do cenário:
                </Typography>
                {JSON.parse(selectedScenario.conversations || "[]").map((conv, idx) => (
                  <Box key={idx} mb={2}>
                    <Typography variant="caption" color="textSecondary">
                      #{idx + 1} Cliente:
                    </Typography>
                    <Typography variant="body2">{conv.customer}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Resposta esperada:
                    </Typography>
                    <Typography variant="body2" style={{ color: "#4caf50" }}>
                      {conv.expectedResponse}
                    </Typography>
                  </Box>
                ))}
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => handleRunScenario(selectedScenario)}
                  disabled={running}
                >
                  {running ? "Executando..." : "Executar Teste"}
                </Button>
              </Paper>
            ) : (
              <Paper variant="outlined" style={{ padding: 32, textAlign: "center" }}>
                <Typography color="textSecondary">
                  Selecione um cenário ou crie um novo para começar os testes
                </Typography>
              </Paper>
            )}
          </Grid>
        </Grid>
      )}

      {/* Dialog para criar novo cenário */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} maxWidth="md" fullWidth>
        <DialogTitle>Criar Cenário de Teste</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nome do cenário"
            variant="outlined"
            margin="dense"
            value={newScenario.name}
            onChange={(e) => setNewScenario({ ...newScenario, name: e.target.value })}
          />
          <TextField
            fullWidth
            label="Descrição (opcional)"
            variant="outlined"
            margin="dense"
            value={newScenario.description}
            onChange={(e) => setNewScenario({ ...newScenario, description: e.target.value })}
          />

          <Box className={classes.conversationEditor}>
            <Typography variant="subtitle2" gutterBottom>
              Conversas (Script de teste)
            </Typography>
            <Typography variant="caption" color="textSecondary" gutterBottom>
              Defina as mensagens do cliente e as respostas esperadas da IA
            </Typography>

            {newScenario.conversations.map((conv, idx) => (
              <Box key={idx} className={classes.conversationRow}>
                <Box flex={1}>
                  <TextField
                    fullWidth
                    size="small"
                    label={`Cliente #${idx + 1}`}
                    variant="outlined"
                    value={conv.customer}
                    onChange={(e) => updateConversation(idx, "customer", e.target.value)}
                    multiline
                    minRows={2}
                  />
                </Box>
                <Box flex={1}>
                  <TextField
                    fullWidth
                    size="small"
                    label={`Resposta esperada #${idx + 1}`}
                    variant="outlined"
                    value={conv.expectedResponse}
                    onChange={(e) => updateConversation(idx, "expectedResponse", e.target.value)}
                    multiline
                    minRows={2}
                  />
                </Box>
                <IconButton
                  size="small"
                  onClick={() => removeConversation(idx)}
                  disabled={newScenario.conversations.length <= 1}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}

            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={addConversation}
            >
              Adicionar mensagem
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreate(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateScenario}
            disabled={loading}
          >
            {loading ? "Criando..." : "Criar Cenário"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para histórico */}
      <Dialog open={showHistory} onClose={() => setShowHistory(false)} maxWidth="md" fullWidth>
        <DialogTitle>Histórico de Testes</DialogTitle>
        <DialogContent>
          <List className={classes.historyList}>
            {history.length === 0 ? (
              <Typography color="textSecondary">Nenhum teste executado ainda.</Typography>
            ) : (
              history.map((result) => (
                <ListItem key={result.id} divider>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="subtitle2">
                          Score: {result.overallScore}%
                        </Typography>
                        <Chip
                          size="small"
                          label={`${result.passedTests}/${result.totalTests} passaram`}
                          color={result.passRate >= 70 ? "primary" : "default"}
                        />
                      </Box>
                    }
                    secondary={new Date(result.createdAt).toLocaleString()}
                  />
                </ListItem>
              ))
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHistory(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TestScenarios;
