import React, { useEffect, useMemo, useState } from "react";
import {
  Paper,
  TextField,
  MenuItem,
  CircularProgress,
  IconButton,
  Tooltip,
  ClickAwayListener,
  makeStyles,
  Popover,
  Typography,
  Chip,
  Box,
} from "@material-ui/core";
import AutorenewIcon from "@material-ui/icons/Autorenew";
import CheckIcon from "@material-ui/icons/Check";
import CloseIcon from "@material-ui/icons/Close";
import TranslateIcon from "@material-ui/icons/Translate";
import SpellcheckIcon from "@material-ui/icons/Spellcheck";
import TrendingUpIcon from "@material-ui/icons/TrendingUp";
import { Bot as BotIcon } from "lucide-react";
import api from "../../services/api";
import OpenAIService from "../../services/openaiService";
import { showAIErrorToast } from "../../utils/aiErrorHandler";

const LANGS = [
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

const useStyles = makeStyles((theme) => ({
  root: ({ dialogMode, bottom, bottomMobile }) => ({
    position: dialogMode ? 'relative' : 'absolute',
    left: dialogMode ? 'auto' : 16,
    right: dialogMode ? 'auto' : 16,
    bottom: dialogMode ? 'auto' : (bottom || 72),
    zIndex: 200,
    minWidth: dialogMode ? 0 : 320,
    width: dialogMode ? '100%' : 'auto',
    borderRadius: 12,
    background: '#ffffff',
    boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
    display: 'flex',
    flexDirection: 'column',
    padding: dialogMode ? 16 : 8,
    margin: 0,
    height: dialogMode ? 'auto' : 'auto',
    maxHeight: dialogMode ? '80vh' : 320,
    overflow: dialogMode ? 'visible' : 'hidden',
    [theme.breakpoints.down('sm')]: {
      left: dialogMode ? 'auto' : 8,
      right: dialogMode ? 'auto' : 8,
      bottom: dialogMode ? 'auto' : (bottomMobile || bottom || 96),
      maxWidth: '100%',
      maxHeight: dialogMode ? '100%' : 320,
      padding: dialogMode ? 12 : 8,
    },
  }),
  dialogHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 600,
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
  providerMenu: {
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  contextInfo: {
    marginBottom: 8,
    padding: '6px 10px',
    borderRadius: 8,
    background: theme.mode === 'light' ? '#f5f5f5' : '#1e2a30',
    border: theme.mode === 'light' ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.12)',
    fontSize: 12,
    lineHeight: 1.45,
  },
  presetsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  presetChip: {
    fontSize: 11,
    height: 24,
  },
  providerChip: {
    padding: '4px 8px',
    borderRadius: 16,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 11,
    userSelect: 'none',
    color: theme.palette.text.secondary,
    '&:hover': { backgroundColor: ((theme.palette.mode || theme.palette.type) === 'light') ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)' }
  },
  providerChipActive: {
    backgroundColor: ((theme.palette.mode || theme.palette.type) === 'light') ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.20)',
    color: theme.palette.primary.main,
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
  campaignActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
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
  queueId,
  whatsappId,
  assistantContext = "ticket",
  targetField,
  onApply,
  actions = ["apply"],
  contextSummary,
  presets = [],
  dialogMode = false,
  disableClickAway = false,
  title,
  bottom,
  bottomMobile,
}) => {
  const classes = useStyles({ dialogMode, bottom, bottomMobile });
  const [tab, setTab] = useState(1); // 0=Corretor 1=Aprimorar 2=Tradutor 3=Criar
  const [targetLang, setTargetLang] = useState("pt-BR");
  const [provider, setProvider] = useState(() => {
    try { return localStorage.getItem('ai_provider') || 'openai'; } catch { return 'openai'; }
  }); // 'openai' | 'gemini'
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [initializing, setInitializing] = useState(false);
  const [providerAnchor, setProviderAnchor] = useState(null);
  const providerLabel = provider === 'gemini' ? 'Gemini' : 'OpenAI';
  const [lockedProvider, setLockedProvider] = useState(false);
  const [integrationConfig, setIntegrationConfig] = useState(null);

  const transformMode = useMemo(() => {
    if (tab === 3) return "create";
    if (tab === 2) return "translate";
    if (tab === 0) return "spellcheck";
    return "enhance";
  }, [tab]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const loadConfig = async () => {
      try {
        console.log('[ChatAssistant] Carregando configuração IA...');
        const config = await OpenAIService.getActiveConfig();
        console.log('[ChatAssistant] Configuração carregada:', config);
        if (!active) return;
        if (config) {
          if (config?.type) {
            console.log('[ChatAssistant] Definindo provedor:', config.type);
            setProvider(config.type);
            setLockedProvider(true);
          }
          setIntegrationConfig(config);
        } else {
          console.log('[ChatAssistant] Nenhuma configuração encontrada');
          setLockedProvider(false);
        }
      } catch (error) {
        console.error('[ChatAssistant] Erro ao carregar configuração:', error);
        setLockedProvider(false);

        // Toast informativo sobre problema de configuração
        if (window.toast && error?.response?.status) {
          const status = error.response.status;
          if (status === 401) {
            window.toast.warning("🔐 Sem permissão para acessar configurações de IA.");
          } else if (status === 404) {
            window.toast.info("⚙️ Nenhuma configuração de IA encontrada. Configure OpenAI ou Gemini.");
          } else if (status >= 500) {
            window.toast.error("🔧 Erro no servidor ao carregar configurações de IA.");
          }
        }
      }
    };
    loadConfig();
    return () => { active = false; };
  }, [open, queueId]);

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

      // Validação para modo Criar
      if (transformMode === "create" && !inputMessage.trim()) {
        setError("💡 Digite uma instrução para criar a mensagem");
        setLoading(false);
        return;
      }

      const payload = {
        mode: transformMode,
        text: inputMessage,
        integrationType: provider,
        queueId,
        whatsappId,
        context: {
          panelMode: transformMode,
          targetField,
          summary: contextSummary,
          presets: presets?.map(p => p.label) || [],
          assistantContext,
          // Mapeia contexto para módulo
          module: assistantContext === 'ticket' ? 'ticket' :
            assistantContext === 'campaign' ? 'campaign' :
              assistantContext === 'prompt' ? 'prompt' : 'general'
        }
      };
      if (transformMode === "translate") payload.targetLang = targetLang;

      console.log('[ChatAssistant] Enviando payload:', payload);
      console.log('[ChatAssistant] Configuração atual:', integrationConfig);

      const { data } = await api.post("/ai/transform", payload);
      console.log('[ChatAssistant] Resposta recebida:', data);
      setResult(data?.result || "");
    } catch (err) {
      console.error('[ChatAssistant] Erro na requisição:', err);

      // Usa utilitário para tratamento padronizado de erros
      const errorInfo = showAIErrorToast(err, window.toast || console);
      setError(errorInfo.message);
    } finally {
      setLoading(false);
    }
  };

  // Executa automaticamente quando o texto do editor mudar (debounce)
  useEffect(() => {
    if (!open) return;
    if (!initializing) setInitializing(true);

    // Precisa de texto no input para todos os modos
    const txt = (inputMessage || "").trim();
    if (!txt) return;
    const t = setTimeout(() => {
      if (!loading) run();
      setTimeout(() => setInitializing(false), 150);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMessage, tab, targetLang, provider, open]);

  // Persistir provedor preferido
  useEffect(() => {
    try { localStorage.setItem('ai_provider', provider); } catch { }
  }, [provider]);

  // No contexto de campanha, ignoramos bloqueio para permitir troca de provedor
  const isCampaign = assistantContext === 'campaign';
  const effectiveLocked = isCampaign ? false : lockedProvider;

  const openProviderMenu = (e) => setProviderAnchor(e.currentTarget);
  const closeProviderMenu = () => setProviderAnchor(null);
  const handlePickProvider = (p) => { setProvider(p); closeProviderMenu(); };


  const applyToEditor = (action) => {
    if (!result) return;
    if (typeof onApply === "function") {
      onApply(action, result);
    } else if (typeof setInputMessage === "function") {
      if (action === "append") {
        setInputMessage(prev => {
          const base = typeof prev === "string" ? prev : "";
          return base ? `${base}\n\n${result}` : result;
        });
      } else {
        setInputMessage(result);
      }
    }
    onClose?.();
  };

  if (!open) return null;

  const content = (
    <Paper className={classes.root} elevation={6}>
      {dialogMode && (
        <div className={classes.dialogHeader}>
          <Typography className={classes.dialogTitle} variant="subtitle1">
            {title || "Assistente de chat"}
          </Typography>
          <div className={classes.dialogHeaderActions}>
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </div>
        </div>
      )}
      <div className={classes.body}>
        {contextSummary && (
          <Typography className={classes.contextInfo} variant="caption">
            {contextSummary}
          </Typography>
        )}

        {presets && presets.length > 0 && (
          <Box className={classes.presetsRow}>
            {presets.map((preset) => (
              <Chip
                key={preset.label}
                label={preset.label}
                size="small"
                className={classes.presetChip}
                clickable
                onClick={() => {
                  if (typeof setInputMessage === "function") {
                    setInputMessage(preset.prompt);
                  }
                }}
              />
            ))}
          </Box>
        )}


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

        {/* Dica para modo Criar */}
        {tab === 3 && (
          <div style={{ marginBottom: 8, padding: '8px 12px', background: 'rgba(37, 211, 102, 0.1)', borderRadius: 8, fontSize: 12 }}>
            💡 <strong>Modo Criar:</strong> Digite uma instrução no campo de mensagem (ex: "mensagem de agradecimento pela parceria")
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
              <Tooltip title="Criar do zero">
                <IconButton size="small" onClick={() => setTab(3)} className={tab === 3 ? classes.modeButtonActive : classes.modeButton}>
                  <BotIcon size={18} />
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
              {/* Seletor de provedor (sempre visível) */}
              <Tooltip title={`Selecionar provedor de IA (atual: ${providerLabel})`} placement="top">
                <span>
                  <IconButton onClick={openProviderMenu} className={classes.smallIconButton} size="small">
                    <BotIcon size={16} />
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
                  <IconButton onClick={() => applyToEditor('apply')} disabled={!result || loading} className={classes.smallIconButton} size="small">
                    <CheckIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Popover de seleção de provedor */}
        <Popover
          open={Boolean(providerAnchor)}
          anchorEl={providerAnchor}
          onClose={closeProviderMenu}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <div className={classes.providerMenu}>
            <div
              onClick={() => !effectiveLocked && handlePickProvider('openai')}
              className={`${classes.providerChip} ${provider === 'openai' ? classes.providerChipActive : ''}`}
              style={{ pointerEvents: effectiveLocked ? 'none' : 'auto', opacity: effectiveLocked && provider !== 'openai' ? 0.4 : 1 }}
            >
              OA
            </div>
            <div
              onClick={() => !effectiveLocked && handlePickProvider('gemini')}
              className={`${classes.providerChip} ${provider === 'gemini' ? classes.providerChipActive : ''}`}
              style={{ pointerEvents: effectiveLocked ? 'none' : 'auto', opacity: effectiveLocked && provider !== 'gemini' ? 0.4 : 1 }}
            >
              GE
            </div>
          </div>
        </Popover>
      </div>
    </Paper>
  );

  if (dialogMode || disableClickAway) {
    return content;
  }

  return (
    <ClickAwayListener onClickAway={onClose}>
      {content}
    </ClickAwayListener>
  );
};
export default ChatAssistantPanel;
