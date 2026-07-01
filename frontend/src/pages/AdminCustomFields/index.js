import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Paper, Typography, Tabs, Tab, Button, TextField, Dialog,
  DialogTitle, DialogContent, DialogActions, IconButton, Select,
  MenuItem, FormControl, InputLabel, Chip, Table, TableHead,
  TableRow, TableCell, TableBody, Tooltip, CircularProgress
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import Skeleton from "@material-ui/lab/Skeleton";
import {
  Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon,
  Tune as TuneIcon, CheckCircle as RequiredIcon,
} from "@material-ui/icons";
import { toast } from "react-toastify";
import api from "../../services/api";

const TYPE_META = {
  text:    { label: "Texto",   bg: "#e3f2fd", color: "#1565c0" },
  number:  { label: "Número",  bg: "#f3e5f5", color: "#6a1b9a" },
  date:    { label: "Data",    bg: "#e0f7fa", color: "#006064" },
  boolean: { label: "Booleano",bg: "#fff3e0", color: "#e65100" },
  select:  { label: "Seleção", bg: "#e8f5e9", color: "#2e7d32" },
};

const useStyles = makeStyles(theme => ({
  root: { padding: theme.spacing(3), maxWidth: 960, margin: "0 auto" },

  hero: {
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    borderRadius: 16,
    padding: "24px 28px",
    color: "#fff",
    marginBottom: 24,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroLeft: { display: "flex", alignItems: "center", gap: 14 },
  heroIcon: { fontSize: 40, opacity: 0.9 },
  heroTitle: { fontWeight: 700, fontSize: 20, color: "#fff" },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.72)", marginTop: 3 },
  heroBtn: {
    background: "#fff", color: theme.palette.primary.main,
    textTransform: "none", fontWeight: 600,
    "&:hover": { background: "rgba(255,255,255,0.9)" },
  },

  paper: { borderRadius: 12, overflow: "hidden" },
  tabs: { borderBottom: `1px solid ${theme.palette.divider}` },
  tableWrap: { padding: "0 4px 8px" },

  keyCode: {
    fontFamily: "monospace",
    fontSize: 12,
    background: theme.palette.type === "dark" ? "#333" : "#f5f5f5",
    borderRadius: 4,
    padding: "2px 6px",
    color: theme.palette.type === "dark" ? "#81c784" : "#d32f2f",
  },

  emptyState: {
    textAlign: "center", padding: "48px 24px",
    color: theme.palette.text.secondary,
  },
  emptyIcon: { fontSize: 52, opacity: 0.18, marginBottom: 8 },

  required: { background: "#e8f5e9", color: "#2e7d32", fontWeight: 700, fontSize: 10 },
  optional: { background: "#f5f5f5", color: "#9e9e9e", fontWeight: 600, fontSize: 10 },
}));

const ENTITIES = [
  { value: "lead",    label: "Lead / Contato" },
  { value: "ticket",  label: "Ticket" },
  { value: "company", label: "Empresa" },
  { value: "deal",    label: "Negócio" },
];

const FIELD_TYPES = ["text", "number", "date", "boolean", "select"];

const emptyForm = { entityType: "lead", key: "", label: "", type: "text", options: "", required: false };

function TableSkeleton() {
  return (
    <>
      {[1, 2, 3].map(i => (
        <TableRow key={i}>
          <TableCell><Skeleton width={100} height={20} /></TableCell>
          <TableCell><Skeleton width={120} height={20} /></TableCell>
          <TableCell><Skeleton variant="rect" width={60} height={22} style={{ borderRadius: 12 }} /></TableCell>
          <TableCell><Skeleton width={80} height={20} /></TableCell>
          <TableCell><Skeleton variant="rect" width={50} height={20} style={{ borderRadius: 10 }} /></TableCell>
          <TableCell align="right"><Skeleton width={60} height={32} /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default function AdminCustomFields() {
  const classes = useStyles();
  const [tab, setTab] = useState(0);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const currentEntity = ENTITIES[tab].value;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/custom-field-configs?entityType=${currentEntity}`);
      setConfigs(data);
    } catch {
      toast.error("Erro ao carregar campos");
    } finally {
      setLoading(false);
    }
  }, [currentEntity]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ ...emptyForm, entityType: currentEntity });
    setEditId(null);
    setOpen(true);
  };

  const openEdit = (config) => {
    setForm({
      entityType: config.entityType, key: config.key, label: config.label,
      type: config.type,
      options: Array.isArray(config.options) ? config.options.join(", ") : (config.options || ""),
      required: config.required,
    });
    setEditId(config.id);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.key.trim() || !form.label.trim()) { toast.warning("Chave e Rótulo são obrigatórios"); return; }
    const options = form.type === "select"
      ? form.options.split(",").map(s => s.trim()).filter(Boolean)
      : null;
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/custom-field-configs/${editId}`, { ...form, options });
        toast.success("Campo atualizado");
      } else {
        await api.post("/custom-field-configs", { ...form, options });
        toast.success("Campo criado");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remover este campo customizado?")) return;
    try {
      await api.delete(`/custom-field-configs/${id}`);
      toast.success("Campo removido");
      load();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <Box className={classes.root}>
      {/* ── Hero ── */}
      <Box className={classes.hero}>
        <Box className={classes.heroLeft}>
          <TuneIcon className={classes.heroIcon} />
          <Box>
            <Typography className={classes.heroTitle}>Campos Customizados</Typography>
            <Typography className={classes.heroSub}>
              Configure campos extras para Leads, Tickets, Empresas e Negócios
            </Typography>
          </Box>
        </Box>
        <Button className={classes.heroBtn} variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Novo Campo
        </Button>
      </Box>

      {/* ── Table ── */}
      <Paper className={classes.paper} elevation={0} variant="outlined">
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          className={classes.tabs}
          indicatorColor="primary"
          textColor="primary"
        >
          {ENTITIES.map(e => (
            <Tab key={e.value} label={e.label} />
          ))}
        </Tabs>

        <Box className={classes.tableWrap}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell style={{ fontWeight: 700, fontSize: 11 }}>CHAVE</TableCell>
                <TableCell style={{ fontWeight: 700, fontSize: 11 }}>RÓTULO</TableCell>
                <TableCell style={{ fontWeight: 700, fontSize: 11 }}>TIPO</TableCell>
                <TableCell style={{ fontWeight: 700, fontSize: 11 }}>OPÇÕES</TableCell>
                <TableCell style={{ fontWeight: 700, fontSize: 11 }}>OBRIG.</TableCell>
                <TableCell align="right" style={{ fontWeight: 700, fontSize: 11 }}>AÇÕES</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableSkeleton />
              ) : configs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Box className={classes.emptyState}>
                      <TuneIcon className={classes.emptyIcon} />
                      <Typography variant="subtitle1">Nenhum campo para {ENTITIES[tab].label}</Typography>
                      <Typography variant="body2" color="textSecondary" style={{ marginBottom: 12 }}>
                        Campos customizados permitem armazenar informações específicas do seu negócio.
                      </Typography>
                      <Button variant="outlined" color="primary" startIcon={<AddIcon />} onClick={openCreate}>
                        Criar primeiro campo
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : configs.map(c => {
                const tm = TYPE_META[c.type] || TYPE_META.text;
                return (
                  <TableRow key={c.id} hover>
                    <TableCell>
                      <span className={classes.keyCode}>{c.key}</span>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" style={{ fontWeight: 500 }}>{c.label}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={tm.label}
                        size="small"
                        style={{ background: tm.bg, color: tm.color, fontWeight: 700, fontSize: 11 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="textSecondary">
                        {Array.isArray(c.options) && c.options.length
                          ? c.options.slice(0, 3).join(", ") + (c.options.length > 3 ? "…" : "")
                          : "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={c.required ? "Sim" : "Opt"}
                        size="small"
                        icon={c.required ? <RequiredIcon style={{ fontSize: 12 }} /> : undefined}
                        className={c.required ? classes.required : classes.optional}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(c)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remover">
                        <IconButton size="small" onClick={() => handleDelete(c.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      {/* ── Dialog ── */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? "Editar Campo" : "Novo Campo Customizado"}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" style={{ gap: 16, marginTop: 8 }}>
            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel>Entidade</InputLabel>
              <Select value={form.entityType} onChange={e => setField("entityType", e.target.value)} label="Entidade">
                {ENTITIES.map(e => <MenuItem key={e.value} value={e.value}>{e.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label="Chave (key)" size="small" variant="outlined" autoFocus
              value={form.key}
              onChange={e => setField("key", e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""))}
              helperText="snake_case, ex: data_nascimento"
              InputProps={{
                startAdornment: <Box component="span" className={classes.keyCode} style={{ marginRight: 8, fontSize: 10 }}>key:</Box>
              }}
            />
            <TextField
              label="Rótulo (label)" size="small" variant="outlined"
              value={form.label} onChange={e => setField("label", e.target.value)}
              helperText="Nome exibido para o usuário"
            />
            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel>Tipo</InputLabel>
              <Select value={form.type} onChange={e => setField("type", e.target.value)} label="Tipo">
                {FIELD_TYPES.map(t => {
                  const m = TYPE_META[t];
                  return (
                    <MenuItem key={t} value={t}>
                      <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                        <Box style={{ width: 8, height: 8, borderRadius: "50%", background: m.color }} />
                        {m.label}
                      </Box>
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            {form.type === "select" && (
              <TextField
                label="Opções (separadas por vírgula)" size="small" variant="outlined"
                value={form.options} onChange={e => setField("options", e.target.value)}
                placeholder="Opção A, Opção B, Opção C"
                helperText={form.options ? `${form.options.split(",").filter(s => s.trim()).length} opções` : ""}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" color="primary" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : null}>
            {editId ? "Salvar" : "Criar Campo"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
