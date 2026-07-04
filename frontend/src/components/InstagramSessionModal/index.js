import React, { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, Typography, CircularProgress,
  Chip, Divider,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
  field: { marginBottom: theme.spacing(2) },
  status: {
    display: "flex", alignItems: "center", gap: theme.spacing(1),
    padding: "10px 14px", borderRadius: 8, marginBottom: theme.spacing(2),
  },
  statusActive: { background: theme.palette.type === "dark" ? "#1a2e1a" : "#f0fdf4", border: "1px solid #86efac" },
  statusInactive: { background: theme.palette.type === "dark" ? "#2a1a1a" : "#fef2f2", border: "1px solid #fca5a5" },
  note: {
    background: theme.palette.type === "dark" ? "#1e1e2a" : "#eff6ff",
    borderRadius: 8, padding: "10px 14px", fontSize: 12,
    color: theme.palette.type === "dark" ? "#93c5fd" : "#1d4ed8",
    lineHeight: 1.6,
  },
}));

export default function InstagramSessionModal({ open, onClose }) {
  const classes = useStyles();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("idle"); // idle | logging_in | needs_2fa | done
  const [pendingId, setPendingId] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");

  const loadStatus = async () => {
    try {
      const { data } = await api.get("/instagram-session/status");
      setSession(data.status === "none" ? null : data);
    } catch {}
  };

  useEffect(() => { if (open) loadStatus(); }, [open]);

  const handleConnect = async () => {
    if (!username.trim() || !password) { toast.warning("Preencha usuário e senha."); return; }
    setLoading(true);
    setStep("logging_in");
    try {
      const { data } = await api.post("/instagram-session/connect", { username, password });
      if (data.status === "needs_2fa") {
        setPendingId(data.pendingId);
        setStep("needs_2fa");
        toast.info("Código 2FA necessário. Verifique seu app de autenticação.");
      } else {
        setStep("done");
        toast.success("Instagram conectado com sucesso!");
        await loadStatus();
        setPassword("");
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || "Falha ao conectar. Verifique usuário/senha.");
      setStep("idle");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit2fa = async () => {
    if (!twoFaCode.trim()) { toast.warning("Digite o código 2FA."); return; }
    setLoading(true);
    try {
      await api.post("/instagram-session/2fa", { pendingId, code: twoFaCode });
      setStep("done");
      toast.success("Instagram conectado com sucesso!");
      await loadStatus();
      setTwoFaCode("");
      setPassword("");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Código inválido.");
      setStep("idle");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await api.delete("/instagram-session");
      setSession(null);
      setStep("idle");
      toast.success("Sessão do Instagram removida.");
    } catch {
      toast.error("Erro ao desconectar.");
    } finally {
      setLoading(false);
    }
  };

  const isConnected = session?.status === "active";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Conta Instagram para Captação de Leads</DialogTitle>
      <DialogContent>
        {/* Status */}
        <Box className={`${classes.status} ${isConnected ? classes.statusActive : classes.statusInactive}`}>
          <Box style={{ width: 8, height: 8, borderRadius: "50%", background: isConnected ? "#22c55e" : "#ef4444", flexShrink: 0 }} />
          <Box style={{ flex: 1 }}>
            <Typography variant="body2" style={{ fontWeight: 600 }}>
              {isConnected ? `Conectado como @${session.username}` : "Não conectado"}
            </Typography>
            {session?.lastUsedAt && (
              <Typography variant="caption" color="textSecondary">
                Último uso: {new Date(session.lastUsedAt).toLocaleDateString("pt-BR")}
              </Typography>
            )}
            {session?.status === "expired" && (
              <Chip label="Sessão expirada — reconecte" size="small" style={{ background: "#fef3c7", color: "#92400e", marginTop: 4 }} />
            )}
          </Box>
          {isConnected && (
            <Button size="small" onClick={handleDisconnect} disabled={loading} style={{ color: "#ef4444", textTransform: "none" }}>
              Desconectar
            </Button>
          )}
        </Box>

        {/* Note */}
        <Box className={classes.note} mb={2}>
          Use uma <strong>conta dedicada</strong> (não a sua pessoal). A conta precisa ter 2FA desativado ou usar app de autenticação. A sessão dura ~90 dias.
        </Box>

        <Divider style={{ marginBottom: 16 }} />

        {/* Login form */}
        {(step === "idle" || step === "done") && (
          <>
            <TextField
              label="Usuário do Instagram" fullWidth variant="outlined" size="small"
              className={classes.field}
              value={username} onChange={e => setUsername(e.target.value)}
              placeholder="@conta_servico"
              autoComplete="off"
            />
            <TextField
              label="Senha" fullWidth variant="outlined" size="small" type="password"
              className={classes.field}
              value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </>
        )}

        {/* 2FA form */}
        {step === "needs_2fa" && (
          <>
            <Typography variant="body2" color="textSecondary" style={{ marginBottom: 12 }}>
              Instagram solicitou verificação em duas etapas. Digite o código do seu app autenticador:
            </Typography>
            <TextField
              label="Código 2FA (6 dígitos)" fullWidth variant="outlined" size="small"
              className={classes.field}
              value={twoFaCode} onChange={e => setTwoFaCode(e.target.value)}
              inputProps={{ maxLength: 6 }}
              autoFocus
            />
          </>
        )}

        {step === "logging_in" && (
          <Box display="flex" alignItems="center" style={{ gap: 12, padding: "8px 0" }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="textSecondary">Fazendo login no Instagram…</Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions style={{ padding: "8px 16px 16px" }}>
        <Button onClick={onClose} style={{ textTransform: "none" }}>Fechar</Button>
        {step === "needs_2fa" && (
          <Button
            variant="contained" color="primary"
            onClick={handleSubmit2fa} disabled={loading}
            style={{ textTransform: "none" }}
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : "Confirmar código"}
          </Button>
        )}
        {(step === "idle" || step === "done") && (
          <Button
            variant="contained" color="primary"
            onClick={handleConnect} disabled={loading}
            style={{ textTransform: "none" }}
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : isConnected ? "Reconectar" : "Conectar"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
