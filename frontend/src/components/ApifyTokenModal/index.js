import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, InputAdornment, IconButton, Typography, Box, CircularProgress,
} from "@material-ui/core";
import { Visibility, VisibilityOff } from "@material-ui/icons";
import { toast } from "react-toastify";
import api from "../../services/api";

// Modal simples p/ configurar o token Apify por empresa (criptografado no
// backend). O token nunca volta em texto puro depois de salvo — só mascarado.
const ApifyTokenModal = ({ open, onClose, onSaved }) => {
  const [status, setStatus] = useState(null); // { configured, masked }
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/lead-scraper/apify-token");
      setStatus(data);
    } catch (err) {
      toast.error("Erro ao consultar status do token Apify");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setToken("");
      setShowToken(false);
      loadStatus();
    }
  }, [open, loadStatus]);

  const handleSave = async () => {
    if (!token.trim()) {
      toast.error("Informe o token antes de salvar");
      return;
    }
    setSaving(true);
    try {
      await api.post("/lead-scraper/apify-token", { token: token.trim() });
      toast.success("Token Apify salvo com sucesso");
      setToken("");
      await loadStatus();
      onSaved && onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao salvar token Apify");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await api.delete("/lead-scraper/apify-token");
      toast.success("Token Apify removido");
      setToken("");
      await loadStatus();
      onSaved && onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Erro ao remover token Apify");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Token Apify</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16 }}>
          Usado para Maps (quando disponível), Seguidores IG e enriquecimento de perfil.
          O token fica salvo criptografado — nunca é exibido em texto puro após salvar.
        </Typography>

        {loading ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            {status?.configured && (
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                style={{
                  background: "#e8f5e9", border: "1px solid #a5d6a7", borderRadius: 8,
                  padding: "8px 12px", marginBottom: 16,
                }}
              >
                <Typography variant="body2" style={{ color: "#2e7d32" }}>
                  Configurado: <strong>{status.masked}</strong>
                </Typography>
                <Button size="small" color="secondary" onClick={handleClear} disabled={saving}>
                  Remover
                </Button>
              </Box>
            )}

            <TextField
              fullWidth
              variant="outlined"
              label={status?.configured ? "Substituir token" : "Token Apify"}
              type={showToken ? "text" : "password"}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="apify_api_..."
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowToken(v => !v)}>
                      {showToken ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={handleSave} color="primary" variant="contained" disabled={saving || loading}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApifyTokenModal;
