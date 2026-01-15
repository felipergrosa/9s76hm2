import React, { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
  makeStyles
} from "@material-ui/core";
import CompareArrowsIcon from "@material-ui/icons/CompareArrows";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import ThumbUpIcon from "@material-ui/icons/ThumbUp";
import ThumbDownIcon from "@material-ui/icons/ThumbDown";
import SwapHorizIcon from "@material-ui/icons/SwapHoriz";
import EmojiEventsIcon from "@material-ui/icons/EmojiEvents";
import { toast } from "react-toastify";

import api from "../../services/api";

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
  promptPane: {
    flex: 1,
    display: "flex",
    flexDirection: "column"
  },
  promptEditor: {
    flex: 1,
    "& textarea": {
      fontFamily: "monospace",
      fontSize: 12
    }
  },
  responsePane: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: theme.mode === "light" ? "#f5f5f5" : "#1a1a2e",
    borderRadius: 8,
    minHeight: 150,
    maxHeight: 300,
    overflow: "auto"
  },
  responseMessage: {
    padding: theme.spacing(1),
    borderRadius: 8,
    marginBottom: theme.spacing(1),
    maxWidth: "85%"
  },
  userMessage: {
    backgroundColor: theme.palette.primary.main,
    color: "#fff",
    marginLeft: "auto"
  },
  assistantMessage: {
    backgroundColor: theme.mode === "light" ? "#e0e0e0" : "#333",
    color: theme.mode === "light" ? "#000" : "#fff"
  },
  statsCard: {
    textAlign: "center",
    padding: theme.spacing(2)
  },
  winnerBadge: {
    position: "absolute",
    top: -10,
    right: -10,
    backgroundColor: "#ffc107",
    borderRadius: "50%",
    padding: 4
  },
  voteButton: {
    margin: theme.spacing(1)
  },
  compareGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 80px 1fr",
    gap: theme.spacing(2),
    flex: 1,
    minHeight: 0
  },
  centerDivider: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center"
  }
}));

const ABTestingComparison = ({ agentId, stageId }) => {
  const classes = useStyles();
  const [promptA, setPromptA] = useState("");
  const [promptB, setPromptB] = useState("");
  const [testInput, setTestInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultsA, setResultsA] = useState(null);
  const [resultsB, setResultsB] = useState(null);
  const [votesA, setVotesA] = useState(0);
  const [votesB, setVotesB] = useState(0);
  const [testHistory, setTestHistory] = useState([]);

  const runComparison = async () => {
    if (!promptA.trim() || !promptB.trim()) {
      toast.warning("Preencha ambos os prompts para comparar");
      return;
    }

    if (!testInput.trim()) {
      toast.warning("Digite uma mensagem de teste");
      return;
    }

    setLoading(true);
    try {
      const [responseA, responseB] = await Promise.all([
        api.post("/ai/sandbox/test", {
          systemPrompt: promptA,
          userMessage: testInput,
          agentId
        }),
        api.post("/ai/sandbox/test", {
          systemPrompt: promptB,
          userMessage: testInput,
          agentId
        })
      ]);

      setResultsA(responseA.data);
      setResultsB(responseB.data);

      setTestHistory(prev => [...prev, {
        input: testInput,
        responseA: responseA.data.response,
        responseB: responseB.data.response,
        timestamp: new Date().toISOString()
      }]);

      setTestInput("");
    } catch (err) {
      toast.error("Erro ao executar comparação");
    } finally {
      setLoading(false);
    }
  };

  const handleVote = (winner) => {
    if (winner === "A") {
      setVotesA(prev => prev + 1);
    } else {
      setVotesB(prev => prev + 1);
    }
    toast.info(`Voto registrado para Prompt ${winner}`);
  };

  const swapPrompts = () => {
    const tempPrompt = promptA;
    const tempResults = resultsA;
    const tempVotes = votesA;

    setPromptA(promptB);
    setPromptB(tempPrompt);
    setResultsA(resultsB);
    setResultsB(tempResults);
    setVotesA(votesB);
    setVotesB(tempVotes);
  };

  const getWinner = () => {
    if (votesA === votesB) return null;
    return votesA > votesB ? "A" : "B";
  };

  const winner = getWinner();

  return (
    <Box className={classes.container}>
      <Box className={classes.header}>
        <Typography variant="h6">
          <CompareArrowsIcon style={{ verticalAlign: "middle", marginRight: 8 }} />
          Teste A/B de Prompts
        </Typography>
        <Box>
          <Button
            startIcon={<SwapHorizIcon />}
            onClick={swapPrompts}
            variant="outlined"
            size="small"
            style={{ marginRight: 8 }}
          >
            Trocar
          </Button>
          <Button
            startIcon={<PlayArrowIcon />}
            onClick={runComparison}
            variant="contained"
            color="primary"
            size="small"
            disabled={loading || !promptA.trim() || !promptB.trim()}
          >
            {loading ? "Testando..." : "Testar Ambos"}
          </Button>
        </Box>
      </Box>

      {/* Input de teste */}
      <Paper variant="outlined" style={{ padding: 16, marginBottom: 16 }}>
        <TextField
          fullWidth
          label="Mensagem de teste"
          variant="outlined"
          size="small"
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          placeholder="Digite a mensagem para testar em ambos os prompts..."
          onKeyPress={(e) => e.key === "Enter" && runComparison()}
        />
      </Paper>

      {/* Grid comparativo */}
      <Box className={classes.compareGrid}>
        {/* Prompt A */}
        <Card variant="outlined" className={classes.promptPane} style={{ position: "relative" }}>
          {winner === "A" && (
            <Box className={classes.winnerBadge}>
              <EmojiEventsIcon style={{ color: "#fff", fontSize: 20 }} />
            </Box>
          )}
          <CardContent style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2">
                Prompt A
                <Chip size="small" label={`${votesA} votos`} style={{ marginLeft: 8 }} />
              </Typography>
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleVote("A")}
                disabled={!resultsA}
              >
                <ThumbUpIcon />
              </IconButton>
            </Box>
            <TextField
              className={classes.promptEditor}
              multiline
              fullWidth
              variant="outlined"
              placeholder="Cole o prompt A aqui..."
              value={promptA}
              onChange={(e) => setPromptA(e.target.value)}
              minRows={6}
              maxRows={12}
            />
            {resultsA && (
              <Box className={classes.responsePane}>
                <Typography variant="caption" color="textSecondary" gutterBottom>
                  Resposta A ({resultsA.responseTime}ms):
                </Typography>
                <Box className={`${classes.responseMessage} ${classes.assistantMessage}`}>
                  <Typography variant="body2">{resultsA.response}</Typography>
                </Box>
                {resultsA.tokensUsed && (
                  <Typography variant="caption" color="textSecondary">
                    Tokens: {resultsA.tokensUsed}
                  </Typography>
                )}
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Divider central */}
        <Box className={classes.centerDivider}>
          <Typography variant="h4" color="textSecondary">VS</Typography>
          {loading && <CircularProgress size={24} style={{ marginTop: 8 }} />}
        </Box>

        {/* Prompt B */}
        <Card variant="outlined" className={classes.promptPane} style={{ position: "relative" }}>
          {winner === "B" && (
            <Box className={classes.winnerBadge}>
              <EmojiEventsIcon style={{ color: "#fff", fontSize: 20 }} />
            </Box>
          )}
          <CardContent style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2">
                Prompt B
                <Chip size="small" label={`${votesB} votos`} style={{ marginLeft: 8 }} />
              </Typography>
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleVote("B")}
                disabled={!resultsB}
              >
                <ThumbUpIcon />
              </IconButton>
            </Box>
            <TextField
              className={classes.promptEditor}
              multiline
              fullWidth
              variant="outlined"
              placeholder="Cole o prompt B aqui..."
              value={promptB}
              onChange={(e) => setPromptB(e.target.value)}
              minRows={6}
              maxRows={12}
            />
            {resultsB && (
              <Box className={classes.responsePane}>
                <Typography variant="caption" color="textSecondary" gutterBottom>
                  Resposta B ({resultsB.responseTime}ms):
                </Typography>
                <Box className={`${classes.responseMessage} ${classes.assistantMessage}`}>
                  <Typography variant="body2">{resultsB.response}</Typography>
                </Box>
                {resultsB.tokensUsed && (
                  <Typography variant="caption" color="textSecondary">
                    Tokens: {resultsB.tokensUsed}
                  </Typography>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Histórico de testes */}
      {testHistory.length > 0 && (
        <Box mt={2}>
          <Typography variant="subtitle2" gutterBottom>
            Histórico de Testes ({testHistory.length})
          </Typography>
          <Paper variant="outlined" style={{ maxHeight: 200, overflow: "auto" }}>
            {testHistory.map((test, idx) => (
              <Box key={idx} p={1} borderBottom="1px solid #eee">
                <Typography variant="caption" color="textSecondary">
                  Input: {test.input}
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="caption" style={{ fontWeight: 600 }}>A:</Typography>
                    <Typography variant="caption" display="block" noWrap>
                      {test.responseA?.substring(0, 100)}...
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" style={{ fontWeight: 600 }}>B:</Typography>
                    <Typography variant="caption" display="block" noWrap>
                      {test.responseB?.substring(0, 100)}...
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            ))}
          </Paper>
        </Box>
      )}

      {/* Estatísticas */}
      {(votesA > 0 || votesB > 0) && (
        <Box mt={2}>
          <Paper variant="outlined" style={{ padding: 16 }}>
            <Typography variant="subtitle2" gutterBottom>
              Resultado Parcial
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Typography variant="body2" color="textSecondary">Prompt A</Typography>
                <Typography variant="h5" style={{ color: winner === "A" ? "#4caf50" : "inherit" }}>
                  {((votesA / (votesA + votesB)) * 100).toFixed(1)}%
                </Typography>
              </Grid>
              <Grid item xs={4} style={{ textAlign: "center" }}>
                <Typography variant="body2" color="textSecondary">Total de Votos</Typography>
                <Typography variant="h5">{votesA + votesB}</Typography>
              </Grid>
              <Grid item xs={4} style={{ textAlign: "right" }}>
                <Typography variant="body2" color="textSecondary">Prompt B</Typography>
                <Typography variant="h5" style={{ color: winner === "B" ? "#4caf50" : "inherit" }}>
                  {((votesB / (votesA + votesB)) * 100).toFixed(1)}%
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default ABTestingComparison;
