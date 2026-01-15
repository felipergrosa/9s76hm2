import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  TextField,
  Tooltip,
  Typography,
  Chip,
  makeStyles
} from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import AutoFixHighIcon from "@material-ui/icons/Build";
import SendIcon from "@material-ui/icons/Send";
import LightbulbIcon from "@material-ui/icons/EmojiObjects";
import { toast } from "react-toastify";

import { rewritePrompt, suggestImprovements, getPromptVariables } from "../../services/aiTraining";

const useStyles = makeStyles((theme) => ({
  editorContainer: {
    position: "relative",
    width: "100%"
  },
  promptEditor: {
    width: "100%",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 13,
    lineHeight: 1.6,
    "& .MuiInputBase-root": {
      fontFamily: "inherit",
      fontSize: "inherit"
    }
  },
  assistantBar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
    padding: theme.spacing(1),
    backgroundColor: theme.mode === "light" ? "#f5f5f5" : "#1a1a2e",
    borderRadius: 8
  },
  commandInput: {
    flex: 1
  },
  variableChip: {
    margin: theme.spacing(0.25),
    cursor: "pointer",
    fontSize: 11
  },
  variablesPanel: {
    padding: theme.spacing(1),
    backgroundColor: theme.mode === "light" ? "#fafafa" : "#121225",
    borderRadius: 8,
    marginTop: theme.spacing(1),
    maxHeight: 200,
    overflow: "auto"
  },
  suggestionCard: {
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    backgroundColor: theme.mode === "light" ? "#fff" : "#1e1e30",
    borderRadius: 8,
    border: `1px solid ${theme.mode === "light" ? "#e0e0e0" : "#333"}`
  },
  scoreCircle: {
    width: 60,
    height: 60,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: 18
  },
  quickFixChip: {
    margin: theme.spacing(0.5),
    cursor: "pointer"
  }
}));

const PromptAssistant = ({
  value: valueProp,
  onChange: onChangeProp,
  initialPrompt,
  onPromptChange,
  agentId,
  stageId,
  onApply,
  disabled
}) => {
  const classes = useStyles();
  const [internalValue, setInternalValue] = useState(initialPrompt || valueProp || "");
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [variables, setVariables] = useState(null);
  const [showVariables, setShowVariables] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const textFieldRef = useRef(null);

  const value = valueProp !== undefined ? valueProp : internalValue;
  const onChange = (newValue) => {
    setInternalValue(newValue);
    if (onChangeProp) onChangeProp(newValue);
    if (onPromptChange) onPromptChange(newValue);
  };

  useEffect(() => {
    if (initialPrompt !== undefined && initialPrompt !== internalValue) {
      setInternalValue(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    if (valueProp !== undefined && valueProp !== internalValue) {
      setInternalValue(valueProp);
    }
  }, [valueProp]);

  useEffect(() => {
    if (agentId) {
      loadVariables();
    }
  }, [agentId]);

  const loadVariables = async () => {
    try {
      const data = await getPromptVariables(agentId);
      setVariables(data);
    } catch (err) {
      console.error("Erro ao carregar variáveis:", err);
    }
  };

  const handleRewrite = async () => {
    if (!command.trim()) {
      toast.warning("Digite um comando para modificar o prompt");
      return;
    }

    setLoading(true);
    try {
      const result = await rewritePrompt({
        currentPrompt: value,
        command: command.trim(),
        agentId
      });

      if (result.ok && result.rewrittenPrompt) {
        onChange(result.rewrittenPrompt);
        setCommand("");
        toast.success("Prompt modificado com sucesso!");
      }
    } catch (err) {
      toast.error("Erro ao modificar prompt");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const result = await suggestImprovements({
        currentPrompt: value,
        agentId
      });

      if (result.ok && result.analysis) {
        setAnalysis(result.analysis);
        setShowAnalysis(true);
      }
    } catch (err) {
      toast.error("Erro ao analisar prompt");
    } finally {
      setLoading(false);
    }
  };

  const insertVariable = (varKey) => {
    const input = textFieldRef.current?.querySelector("textarea");
    if (!input) {
      onChange((value || "") + " " + varKey);
      return;
    }

    const start = input.selectionStart;
    const end = input.selectionEnd;
    const newValue = value.substring(0, start) + varKey + value.substring(end);
    onChange(newValue);

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + varKey.length, start + varKey.length);
    }, 0);
  };

  const applyQuickFix = (fix) => {
    setCommand(fix);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "#4caf50";
    if (score >= 60) return "#ff9800";
    return "#f44336";
  };

  return (
    <Box className={classes.editorContainer}>
      <TextField
        ref={textFieldRef}
        className={classes.promptEditor}
        fullWidth
        multiline
        minRows={8}
        maxRows={20}
        variant="outlined"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Digite o prompt do agente aqui..."
      />

      <Box className={classes.assistantBar}>
        <TextField
          className={classes.commandInput}
          size="small"
          variant="outlined"
          placeholder="Ex: deixe o tom mais humanizado, adicione emojis, seja mais direto..."
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleRewrite();
            }
          }}
          disabled={loading || disabled}
        />

        <Tooltip title="Reescrever prompt com IA">
          <IconButton
            color="primary"
            onClick={handleRewrite}
            disabled={loading || disabled || !command.trim()}
          >
            {loading ? <CircularProgress size={20} /> : <AutoFixHighIcon />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Analisar e sugerir melhorias">
          <IconButton
            color="secondary"
            onClick={handleAnalyze}
            disabled={loading || disabled || !value?.trim()}
          >
            <LightbulbIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Mostrar variáveis disponíveis">
          <Button
            size="small"
            variant="outlined"
            onClick={() => setShowVariables(!showVariables)}
          >
            {"{{ }}"}
          </Button>
        </Tooltip>
      </Box>

      {showVariables && variables && (
        <Box className={classes.variablesPanel}>
          <Typography variant="caption" color="textSecondary">
            Clique para inserir variáveis:
          </Typography>
          
          {Object.entries(variables.variables || {}).map(([category, vars]) => (
            <Box key={category} mt={1}>
              <Typography variant="caption" style={{ fontWeight: "bold" }}>
                {category.toUpperCase()}
              </Typography>
              <Box display="flex" flexWrap="wrap">
                {vars.map((v) => (
                  <Tooltip key={v.key} title={v.description}>
                    <Chip
                      className={classes.variableChip}
                      size="small"
                      label={v.key}
                      onClick={() => insertVariable(v.key)}
                    />
                  </Tooltip>
                ))}
              </Box>
            </Box>
          ))}

          {variables.tools?.length > 0 && (
            <Box mt={1}>
              <Typography variant="caption" style={{ fontWeight: "bold" }}>
                FERRAMENTAS
              </Typography>
              <Box display="flex" flexWrap="wrap">
                {variables.tools.map((t) => (
                  <Tooltip key={t.key} title={`${t.description} - ${t.example}`}>
                    <Chip
                      className={classes.variableChip}
                      size="small"
                      label={t.key}
                      color="primary"
                      variant="outlined"
                      onClick={() => insertVariable(t.key)}
                    />
                  </Tooltip>
                ))}
              </Box>
            </Box>
          )}

          {variables.agents?.length > 0 && (
            <Box mt={1}>
              <Typography variant="caption" style={{ fontWeight: "bold" }}>
                AGENTES (Multi-agente)
              </Typography>
              <Box display="flex" flexWrap="wrap">
                {variables.agents.map((a) => (
                  <Tooltip key={a.key} title={a.description}>
                    <Chip
                      className={classes.variableChip}
                      size="small"
                      label={a.key}
                      color="secondary"
                      variant="outlined"
                      onClick={() => insertVariable(a.key)}
                    />
                  </Tooltip>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}

      <Dialog
        open={showAnalysis}
        onClose={() => setShowAnalysis(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Análise do Prompt</DialogTitle>
        <DialogContent>
          {analysis && (
            <Box>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Box
                  className={classes.scoreCircle}
                  style={{
                    backgroundColor: getScoreColor(analysis.score),
                    color: "#fff"
                  }}
                >
                  {analysis.score}
                </Box>
                <Box>
                  <Typography variant="h6">Score Geral</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {analysis.score >= 80
                      ? "Excelente!"
                      : analysis.score >= 60
                      ? "Bom, mas pode melhorar"
                      : "Precisa de ajustes"}
                  </Typography>
                </Box>
              </Box>

              <Divider style={{ margin: "16px 0" }} />

              {analysis.strengths?.length > 0 && (
                <Box mb={2}>
                  <Typography variant="subtitle2" style={{ color: "#4caf50" }}>
                    Pontos Fortes
                  </Typography>
                  {analysis.strengths.map((s, i) => (
                    <Typography key={i} variant="body2">
                      • {s}
                    </Typography>
                  ))}
                </Box>
              )}

              {analysis.weaknesses?.length > 0 && (
                <Box mb={2}>
                  <Typography variant="subtitle2" style={{ color: "#f44336" }}>
                    Pontos a Melhorar
                  </Typography>
                  {analysis.weaknesses.map((w, i) => (
                    <Typography key={i} variant="body2">
                      • {w}
                    </Typography>
                  ))}
                </Box>
              )}

              {analysis.suggestions?.length > 0 && (
                <Box mb={2}>
                  <Typography variant="subtitle2" color="primary">
                    Sugestões Detalhadas
                  </Typography>
                  {analysis.suggestions.map((s, i) => (
                    <Paper key={i} className={classes.suggestionCard}>
                      <Chip
                        size="small"
                        label={s.type}
                        color="primary"
                        style={{ marginBottom: 8 }}
                      />
                      <Typography variant="body2">{s.description}</Typography>
                      {s.example && (
                        <Typography
                          variant="caption"
                          color="textSecondary"
                          style={{ fontStyle: "italic" }}
                        >
                          Exemplo: {s.example}
                        </Typography>
                      )}
                    </Paper>
                  ))}
                </Box>
              )}

              {analysis.quickFixes?.length > 0 && (
                <Box>
                  <Typography variant="subtitle2">
                    Correções Rápidas (clique para aplicar)
                  </Typography>
                  <Box display="flex" flexWrap="wrap">
                    {analysis.quickFixes.map((fix, i) => (
                      <Chip
                        key={i}
                        className={classes.quickFixChip}
                        label={fix}
                        onClick={() => {
                          applyQuickFix(fix);
                          setShowAnalysis(false);
                        }}
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAnalysis(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PromptAssistant;
