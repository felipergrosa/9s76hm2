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
  useTheme,
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
    position: 'relative',
    width: '100%',
    minWidth: 0,
    zIndex: 0,
    borderTop: `1px solid ${theme.palette.divider}`,
    borderRadius: 0,
    background: theme.mode === 'light' ? '#fff' : '#202c33',
    boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column',
    padding: 0,
    margin: 0,
    marginTop: 6,
    marginBottom: 56,
    // Altura automática para não sobrepor o campo de mensagens
    height: 'auto',
    maxHeight: 220,
    overflowY: 'auto',
    [theme.breakpoints.down('sm')]: {
      marginBottom: 80,
      maxHeight: 260,
    },
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    height: 38,
    padding: '0 8px',
    borderBottom: `1px solid ${theme.palette.divider}`,
    fontWeight: 600,
    fontSize: 14,
    background: 'transparent',
  },
  body: {
    padding: 6,
  },
  tabsContainer: {
    minHeight: 30,
    '& .MuiTab-root': {
      minHeight: 30,
      minWidth: 70,
      padding: '2px 8px',
      fontSize: 12,
      fontWeight: 600,
      color: theme.palette.text.secondary,
      opacity: 1,
      textTransform: 'none',
    },
    '& .Mui-selected': {
      color: theme.palette.primary.main,
    },
    '& .MuiTab-wrapper': {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      '& > *:first-child': {
        marginBottom: 0,
        marginRight: 0,
        fontSize: 18,
      },
    },
    [theme.breakpoints.down('sm')]: {
      '& .MuiTab-root': {
        minWidth: 64,
        padding: '2px 6px',
        fontSize: 12,
      },
      '& .MuiTab-wrapper': {
        gap: 4,
        '& > *:first-child': {
          fontSize: 16,
        },
      },
    },
  },
  resultContainer: {
    position: 'relative',
    marginTop: 2,
    display: 'flex',
    alignItems: 'flex-start',
    width: '100%',
  },
  actionButtons: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 6,
    marginTop: 4,
    height: 28,
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
      padding: '4px 8px',
      background: theme.mode === 'light' ? '#f8f8f8' : '#1f2c34',
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: 6,
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
  const theme = useTheme();
  const [tab, setTab] = useState(0); // 0=Traduzir 1=Corrigir 2=Aprimorar
  const [targetLang, setTargetLang] = useState("pt-BR");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const history = useHistory();

  const mode = useMemo(() => (tab === 2 ? "translate" : tab === 0 ? "spellcheck" : "enhance"), [tab]);

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
          <Tabs 
            value={tab} 
            onChange={(_, v) => setTab(v)} 
            TabIndicatorProps={{ style: { background: theme.palette.primary.main, height: 3, borderRadius: 2 } }}
            className={classes.tabsContainer}
          >
            <Tab icon={<SpellcheckIcon style={{ color: 'inherit' }} />} label={"CORRETOR"} />
            <Tab icon={<TrendingUpIcon style={{ color: 'inherit' }} />} label={"APRIMORAR"} />
            <Tab icon={<TranslateIcon style={{ color: 'inherit' }} />} label={"TRADUTOR"} />
          </Tabs>
          <span style={{ flex: 1 }} />
          <Tooltip title="Fechar">
            <IconButton size="small" onClick={onClose} className={classes.smallIconButton}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
        <div className={classes.body}>


          {tab === 2 && (
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
          <div className={classes.actionButtons}>
            <Tooltip title="Copiar" placement="top">
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
            <Tooltip title="Recarregar" placement="top">
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
            <Tooltip title="Inserir no editor" placement="top">
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
