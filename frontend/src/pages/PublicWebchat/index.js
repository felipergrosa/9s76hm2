import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Box,
  CssBaseline,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Send as SendIcon } from "@material-ui/icons";

import { openApi } from "../../services/api";
import { i18n } from "../../translate/i18n";

// =============================================================================
// Página pública de webchat (rota /webchat/:token — sem login).
// O token identifica empresa+conexão no backend; o visitante é identificado por
// um visitorId opaco gerado pelo backend e persistido em localStorage.
// Mensagens são buscadas por poll a cada 4s (socket.io exige auth — não é público).
// =============================================================================

const POLL_INTERVAL_MS = 4000;

const useStyles = makeStyles((theme) => ({
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f2f5",
    padding: theme.spacing(2),
  },
  chatPaper: {
    width: "100%",
    maxWidth: 480,
    height: "80vh",
    display: "flex",
    flexDirection: "column",
    borderRadius: 16,
    overflow: "hidden",
  },
  header: {
    padding: theme.spacing(2),
    backgroundColor: "var(--primary, #065183)",
    color: "#fff",
  },
  messagesArea: {
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(2),
    backgroundColor: "#e5ddd5",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
  },
  bubble: {
    maxWidth: "75%",
    padding: theme.spacing(1, 1.5),
    borderRadius: 12,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
    fontSize: "0.9rem",
  },
  bubbleVisitor: {
    alignSelf: "flex-end",
    backgroundColor: "#dcf8c6",
  },
  bubbleAgent: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
  },
  bubbleTime: {
    display: "block",
    fontSize: "0.65rem",
    opacity: 0.6,
    marginTop: 2,
    textAlign: "right",
  },
  inputArea: {
    display: "flex",
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    backgroundColor: "#f0f0f0",
  },
  nameForm: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(4),
    gap: theme.spacing(2),
  },
  centerBox: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: theme.spacing(2),
    padding: theme.spacing(3),
  },
}));

const storageKey = (token, key) => `webchat_${token}_${key}`;

const PublicWebchat = () => {
  const classes = useStyles();
  const { token } = useParams();

  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [connectionName, setConnectionName] = useState("");
  const [greeting, setGreeting] = useState(null);

  const [visitorId, setVisitorId] = useState(
    () => localStorage.getItem(storageKey(token, "visitorId")) || null
  );
  const [visitorName, setVisitorName] = useState(
    () => localStorage.getItem(storageKey(token, "name")) || ""
  );
  const [nameInput, setNameInput] = useState("");

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  // Sessão: cria/recupera o visitorId no backend.
  const startSession = useCallback(
    async (name) => {
      try {
        const { data } = await openApi.post(`/public/webchat/${token}/session`, {
          visitorId: localStorage.getItem(storageKey(token, "visitorId")) || undefined,
          name: name || undefined,
        });
        localStorage.setItem(storageKey(token, "visitorId"), data.visitorId);
        setVisitorId(data.visitorId);
        setConnectionName(data.connectionName || "");
        setGreeting(data.greeting || null);
        setInvalid(false);
        return true;
      } catch (err) {
        if (err?.response?.status === 404) {
          setInvalid(true);
        }
        return false;
      }
    },
    [token]
  );

  // Poll de mensagens do ticket do visitante.
  const fetchMessages = useCallback(async () => {
    const vid = localStorage.getItem(storageKey(token, "visitorId"));
    if (!vid) return;
    try {
      const { data } = await openApi.get(`/public/webchat/${token}/messages`, {
        params: { session: vid },
      });
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch (err) {
      // Falha de poll não é fatal — próxima tentativa em POLL_INTERVAL_MS
      if (err?.response?.status === 404) setInvalid(true);
    }
  }, [token]);

  useEffect(() => {
    const boot = async () => {
      await startSession();
      setLoading(false);
    };
    boot();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Inicia o poll somente depois que o visitante se identificou.
  useEffect(() => {
    if (!visitorId || !visitorName) return undefined;
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [visitorId, visitorName, fetchMessages]);

  // Auto-scroll para a última mensagem.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmitName = async (e) => {
    e.preventDefault();
    const name = nameInput.trim();
    if (!name) return;
    const ok = await startSession(name);
    if (ok) {
      localStorage.setItem(storageKey(token, "name"), name);
      setVisitorName(name);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !visitorId || sending) return;
    setSending(true);
    try {
      await openApi.post(`/public/webchat/${token}/messages`, {
        visitorId,
        body,
        name: visitorName || undefined,
      });
      setText("");
      await fetchMessages();
    } catch (err) {
      if (err?.response?.status === 404) setInvalid(true);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className={classes.root}>
        <CssBaseline />
        <CircularProgress />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className={classes.root}>
        <CssBaseline />
        <Paper className={classes.chatPaper} elevation={3}>
          <Box className={classes.centerBox}>
            <Typography variant="h6">
              {i18n.t("publicWebchat.invalidLink")}
            </Typography>
          </Box>
        </Paper>
      </div>
    );
  }

  return (
    <div className={classes.root}>
      <CssBaseline />
      <Paper className={classes.chatPaper} elevation={3}>
        <div className={classes.header}>
          <Typography variant="h6">
            {connectionName || i18n.t("publicWebchat.title")}
          </Typography>
          <Typography variant="caption" style={{ opacity: 0.85 }}>
            {i18n.t("publicWebchat.subtitle")}
          </Typography>
        </div>

        {!visitorName ? (
          <form className={classes.nameForm} onSubmit={handleSubmitName}>
            <Typography variant="body1">
              {i18n.t("publicWebchat.askName")}
            </Typography>
            <TextField
              variant="outlined"
              fullWidth
              size="small"
              label={i18n.t("publicWebchat.nameLabel")}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              inputProps={{ maxLength: 100 }}
              autoFocus
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={!nameInput.trim()}
            >
              {i18n.t("publicWebchat.start")}
            </Button>
          </form>
        ) : (
          <>
            <div className={classes.messagesArea}>
              {greeting && (
                <div className={`${classes.bubble} ${classes.bubbleAgent}`}>
                  {greeting}
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${classes.bubble} ${
                    msg.fromMe ? classes.bubbleAgent : classes.bubbleVisitor
                  }`}
                >
                  {msg.body}
                  <span className={classes.bubbleTime}>
                    {msg.createdAt
                      ? new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form className={classes.inputArea} onSubmit={handleSend}>
              <TextField
                variant="outlined"
                size="small"
                fullWidth
                placeholder={i18n.t("publicWebchat.inputPlaceholder")}
                value={text}
                onChange={(e) => setText(e.target.value)}
                inputProps={{ maxLength: 2000 }}
                disabled={sending}
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={!text.trim() || sending}
                style={{ minWidth: 48 }}
              >
                {sending ? <CircularProgress size={20} /> : <SendIcon />}
              </Button>
            </form>
          </>
        )}
      </Paper>
      <Container maxWidth="sm" />
    </div>
  );
};

export default PublicWebchat;
