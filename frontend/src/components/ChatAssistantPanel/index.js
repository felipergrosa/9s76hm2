import React, { useEffect, useMemo, useState } from "react";
import {
  Paper,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  IconButton,
  Tooltip,
  ClickAwayListener,
  makeStyles,
  useTheme,
  InputBase,
} from "@material-ui/core";
import ContentCopyIcon from "@material-ui/icons/FileCopy";
import AutorenewIcon from "@material-ui/icons/Autorenew";
import CheckIcon from "@material-ui/icons/Check";
import CloseIcon from "@material-ui/icons/Close";
import TranslateIcon from "@material-ui/icons/Translate";
import SpellcheckIcon from "@material-ui/icons/Spellcheck";
import TrendingUpIcon from "@material-ui/icons/TrendingUp";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import api from "../../services/api";
import { useHistory } from "react-router-dom";

const LANGS = [
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

const useStyles = makeStyles((theme) => ({
  root: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 72,
    zIndex: 200,
    minWidth: 0,
    borderRadius: 10,
    background: '#ffffff',
    boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
    display: 'flex',
    flexDirection: 'column',
    padding: 8,
    margin: 0,
    height: 'auto',
    maxHeight: 280,
    overflowY: 'auto',
    [theme.breakpoints.down('sm')]: {
      left: 8,
      right: 8,
      bottom: 96,
      maxHeight: 300,
    },
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    height: 40,
    padding: '0 8px',
    borderBottom: `1px solid ${theme.palette.divider}`,
    background: 'transparent',
    gap: 6,
  },
  modeIcons: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    '& .MuiIconButton-root': {
      padding: 6,
      borderRadius: 16,
      transition: 'background-color 120ms ease',
    },
  },
  modeButton: {
    color: theme.palette.text.secondary,
    '&:hover': {
      backgroundColor: ((theme.palette.mode || theme.palette.type) === 'light') ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)'
    }
  },
  modeButtonActive: {
    color: theme.palette.primary.main,
    backgroundColor: ((theme.palette.mode || theme.palette.type) === 'light') ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.20)',
    '&:hover': {
      backgroundColor: ((theme.palette.mode || theme.palette.type) === 'light') ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.28)'
    }
  },
  body: {
    padding: 8,
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
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    marginTop: 6,
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
      background: theme.mode === 'light' ? '#ffffff' : '#1f2c34',
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: 6,
    },
    '& .MuiInputLabel-root': {
      fontSize: 13,
    },
  },
  pillBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '2px 8px',
    borderRadius: 40,
    background: theme.mode === 'light' ? '#ffffff' : '#202c33',
    border: theme.mode === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.12)',
    boxShadow: theme.mode === 'light' ? '0 2px 6px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)' : '0 2px 6px rgba(0,0,0,0.5)',
  },
  inputBase: {
    flex: 1,
    fontSize: 14,
  },
  resultBubble: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: 8,
    padding: 8,
    // Verde estilo WhatsApp (recebida)
    background: theme.mode === 'light' ? '#dcf8c6' : '#005c4b',
    color: theme.mode === 'light' ? '#303030' : '#ffffff',
    border: '1px solid rgba(0,0,0,0.06)',
    boxShadow: theme.mode === 'light' ? '0 1px 2px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.5)'
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
  const [tab, setTab] = useState(1); // 0=Corretor 1=Aprimorar 2=Tradutor
  const [targetLang, setTargetLang] = useState("pt-BR");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const history = useHistory();
  const [initializing, setInitializing] = useState(false);

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

  // Executa automaticamente quando o texto do editor mudar (debounce)
  useEffect(() => {
    if (!open) return;
    if (!initializing) setInitializing(true);
    const txt = (inputMessage || "").trim();
    if (!txt) return;
    const t = setTimeout(() => {
      if (!loading) run();
      // esconde placeholder de inicialização após primeira execução
      setTimeout(() => setInitializing(false), 150);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMessage, tab, targetLang, open]);

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
        <div className={classes.body}>


          {/* Seletor de idioma (apenas Tradutor) */}
          {tab === 2 && (
            <div style={{ marginBottom: 6 }}>
              <TextField select size="small" value={targetLang} onChange={(e) => setTargetLang(e.target.value)} style={{ minWidth: 160 }}>
                {LANGS.map((l) => (
                  <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>
                ))}
              </TextField>
            </div>
          )}

          {/* Resultado + ações em linha */}
          {(!!result || loading || initializing) && (
            <div className={classes.resultContainer}>
              <div className={classes.modeIcons}>
                <Tooltip title="Corretor">
                  <IconButton size="small" onClick={() => setTab(0)} className={tab === 0 ? classes.modeButtonActive : classes.modeButton}>
                    <SpellcheckIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Aprimorar">
                  <IconButton size="small" onClick={() => setTab(1)} className={tab === 1 ? classes.modeButtonActive : classes.modeButton}>
                    <TrendingUpIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Tradutor">
                  <IconButton size="small" onClick={() => setTab(2)} className={tab === 2 ? classes.modeButtonActive : classes.modeButton}>
                    <TranslateIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </div>
              <div className={classes.resultBubble} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                {loading || initializing ? (
                  <>
                    <CircularProgress size={16} />
                    <span style={{ fontSize: 13, opacity: 0.8 }}>Gerando...</span>
                  </>
                ) : (
                  result
                )}
              </div>
              <div className={classes.actionButtons}>
                <Tooltip title="Copiar" placement="top">
                  <span>
                    <IconButton onClick={handleCopy} disabled={!result || loading} className={classes.smallIconButton} size="small">
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Recarregar" placement="top">
                  <span>
                    <IconButton onClick={run} disabled={loading || !inputMessage} className={classes.smallIconButton} size="small">
                      {loading ? <CircularProgress size={16} /> : <AutorenewIcon fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Inserir no editor" placement="top">
                  <span>
                    <IconButton onClick={handleInsert} disabled={!result || loading} className={classes.smallIconButton} size="small">
                      <CheckIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </div>
            </div>
          )}
        </div>
      </Paper>
    </ClickAwayListener>
  );
};

export default ChatAssistantPanel;
