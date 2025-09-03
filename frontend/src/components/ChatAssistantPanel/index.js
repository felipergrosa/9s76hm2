import React, { useEffect, useMemo, useState } from "react";
import {
  Paper,
  Button,
  TextField,
  Tabs,
  Tab,
  MenuItem,
  CircularProgress,
  IconButton,
  Tooltip,
  ClickAwayListener,
  makeStyles,
} from "@material-ui/core";
import ContentCopyIcon from "@material-ui/icons/FileCopy";
import AutorenewIcon from "@material-ui/icons/Autorenew";
import CheckIcon from "@material-ui/icons/Check";
import CloseIcon from "@material-ui/icons/Close";
import TranslateIcon from "@material-ui/icons/Translate";
import SpellcheckIcon from "@material-ui/icons/Spellcheck";
import TrendingUpIcon from "@material-ui/icons/TrendingUp";
import api from "../../services/api";
import { useHistory } from "react-router-dom";

const LANGS = [
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

const useStyles = makeStyles((theme) => ({
  root: {
    position: "fixed",
    bottom: 63,
    left: 0,
    right: 0,
    zIndex: 99999,
    borderRadius: 8,
    overflow: "hidden",
    maxWidth: 500,
    margin: "0 auto",
    backgroundColor: theme.palette.background.paper,
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "4px 8px",
    borderBottom: `1px solid ${theme.palette.divider}`,
    fontWeight: 600,
    fontSize: 14,
  },
  body: {
    padding: 8,
  },
  tabsContainer: {
    minHeight: 36,
    '& .MuiTab-root': {
      minHeight: 36,
      minWidth: 60,
      padding: '4px 8px',
      fontSize: 12,
    },
    '& .MuiTab-wrapper': {
      flexDirection: 'row',
      '& > *:first-child': {
        marginBottom: 0,
        marginRight: 4,
        fontSize: 16,
      },
    },
  },
  resultContainer: {
    position: 'relative',
    marginTop: 8,
  },
  actionButtons: {
    position: 'absolute',
    left: -40,
    top: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  smallIconButton: {
    padding: 4,
    '& svg': {
      fontSize: 16,
    },
  },
  compactTextField: {
    '& .MuiInputBase-root': {
      fontSize: 13,
    },
    '& .MuiInputLabel-root': {
      fontSize: 13,
    },
  },
}));

const ChatAssistantPanel = ({
  open,
  onClose,
  inputMessage,
  setInputMessage,
}) => {
  const classes = useStyles();
  const [tab, setTab] = useState(0); // 0=Traduzir 1=Corrigir 2=Aprimorar
  const [targetLang, setTargetLang] = useState("pt-BR");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const history = useHistory();

  const mode = useMemo(() => (tab === 0 ? "translate" : tab === 1 ? "spellcheck" : "enhance"), [tab]);

  useEffect(() => {
    if (tab === 0 && targetLang === "pt-BR") {
      // Se traduzir e idioma igual ao de origem provável, manter
    }
  }, [tab, targetLang]);

  const run = async () => {
    try {
      setLoading(true);
      setError("");
      setResult("");
      const payload = { mode, text: inputMessage };
      if (mode === "translate") payload.targetLang = targetLang;
      const { data } = await api.post("/ai/transform", payload);
      setResult(data?.result || "");
    } catch (err) {
      setError(err?.response?.data?.error || "Falha ao processar texto");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
    } catch (_) {}
  };

  const handleInsert = () => {
    if (!result) return;
    setInputMessage(result);
    onClose?.();
  };

  if (!open) return null;

  return (
    <ClickAwayListener onClickAway={onClose}>
      <Paper className={classes.root} elevation={6}>
        <div className={classes.header}>
          <span>Assistente de Chat</span>
          <Tooltip title="Fechar">
            <IconButton size="small" onClick={onClose} className={classes.smallIconButton}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
        <div className={classes.body}>
          <Tabs 
            value={tab} 
            onChange={(_, v) => setTab(v)} 
            indicatorColor="primary" 
            textColor="primary" 
            variant="fullWidth"
            className={classes.tabsContainer}
          >
            <Tab icon={<TranslateIcon fontSize="small" />} label="Tradutor" />
            <Tab icon={<SpellcheckIcon fontSize="small" />} label="Corretor" />
            <Tab icon={<TrendingUpIcon fontSize="small" />} label="Aprimorar" />
          </Tabs>

          {tab === 0 && (
            <TextField
              select
              fullWidth
              margin="dense"
              size="small"
              label="Idioma destino"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className={classes.compactTextField}
            >
              {LANGS.map((l) => (
                <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>
              ))}
            </TextField>
          )}

          <TextField
            margin="dense"
            label="Texto"
            fullWidth
            multiline
            minRows={2}
            maxRows={3}
            size="small"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            className={classes.compactTextField}
          />

          <div style={{ marginTop: 4, display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
            <Tooltip title="Gerar">
              <span>
                <Button 
                  color="primary" 
                  variant="contained" 
                  onClick={run} 
                  disabled={loading || !inputMessage}
                  size="small"
                >
                  {loading ? <CircularProgress size={16} /> : "Gerar"}
                </Button>
              </span>
            </Tooltip>
            {!!error && <span style={{ color: "#f44336", fontSize: 12 }}>{error}</span>}
            {error?.toLowerCase()?.includes("nenhuma integração de ia disponível") && (
              <Tooltip title="Ir para Configurações de IA">
                <span>
                  <Button
                    color="secondary"
                    variant="outlined"
                    size="small"
                    onClick={() => { onClose?.(); history.push("/queue-integration"); }}
                  >
                    Configurar IA
                  </Button>
                </span>
              </Tooltip>
            )}
          </div>

          <div className={classes.resultContainer}>
            {result && (
              <div className={classes.actionButtons}>
                <Tooltip title="Copiar" placement="left">
                  <span>
                    <IconButton 
                      onClick={handleCopy} 
                      disabled={!result} 
                      className={classes.smallIconButton}
                      size="small"
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Recarregar" placement="left">
                  <span>
                    <IconButton 
                      onClick={run} 
                      disabled={loading || !inputMessage} 
                      className={classes.smallIconButton}
                      size="small"
                    >
                      <AutorenewIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Inserir no editor" placement="left">
                  <span>
                    <IconButton 
                      onClick={handleInsert} 
                      disabled={!result} 
                      className={classes.smallIconButton}
                      size="small"
                    >
                      <CheckIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </div>
            )}
            <TextField
              label="Resultado"
              fullWidth
              multiline
              minRows={2}
              maxRows={3}
              size="small"
              value={result}
              InputProps={{ readOnly: true }}
              className={classes.compactTextField}
            />
          </div>
        </div>
      </Paper>
    </ClickAwayListener>
  );
};

export default ChatAssistantPanel;
