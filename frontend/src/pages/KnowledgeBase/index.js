import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Paper, Typography, Tabs, Tab, Button, TextField, Dialog,
  DialogTitle, DialogContent, DialogActions, IconButton, Chip,
  CircularProgress, Tooltip
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import Skeleton from "@material-ui/lab/Skeleton";
import {
  Add as AddIcon, Delete as DeleteIcon, Refresh as RefreshIcon,
  MenuBook as BookIcon, Category as GeneralIcon,
  LocalOffer as ProductIcon, Gavel as RulesIcon,
} from "@material-ui/icons";
import { toast } from "react-toastify";
import api from "../../services/api";
import MainContainer from "../../components/MainContainer";

const useStyles = makeStyles(theme => ({
  root: { padding: theme.spacing(3) },

  hero: {
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    borderRadius: 16,
    padding: "28px 32px",
    color: "#fff",
    marginBottom: 24,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroLeft: { display: "flex", alignItems: "center", gap: 16 },
  heroIcon: { fontSize: 44, opacity: 0.9 },
  heroTitle: { fontWeight: 700, fontSize: 22, color: "#fff", lineHeight: 1.2 },
  heroSub: { fontSize: 13, color: "rgba(255,255,255,0.78)", marginTop: 4, maxWidth: 400, lineHeight: 1.5 },
  heroActions: { display: "flex", alignItems: "center", gap: 8 },
  heroBtn: {
    background: "rgba(255,255,255,0.15)", color: "#fff",
    border: "1px solid rgba(255,255,255,0.3)",
    textTransform: "none", backdropFilter: "blur(4px)",
    "&:hover": { background: "rgba(255,255,255,0.25)" },
  },
  heroBtnPrimary: {
    background: "#fff", color: theme.palette.primary.main,
    textTransform: "none", fontWeight: 600,
    "&:hover": { background: "rgba(255,255,255,0.92)" },
  },

  paper: { borderRadius: 12, overflow: "hidden" },
  tabs: { borderBottom: `1px solid ${theme.palette.divider}` },
  tabContent: { padding: "20px 24px" },

  docCard: {
    display: "flex", alignItems: "center",
    padding: "14px 16px",
    borderRadius: 10,
    marginBottom: 10,
    border: `1px solid ${theme.palette.divider}`,
    transition: "box-shadow 0.15s, border-color 0.15s",
    "&:hover": {
      boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      borderColor: theme.palette.primary.light,
    },
  },
  docIcon: { width: 40, height: 40, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  docBody: { flex: 1, marginLeft: 14, minWidth: 0 },
  docTitle: { fontWeight: 600, fontSize: 14, lineHeight: 1.3 },
  docMeta: { fontSize: 11, color: theme.palette.text.disabled, marginTop: 3 },
  docActions: { display: "flex", alignItems: "center", gap: 4, marginLeft: 8 },

  catChipGeneral: { background: "#eceff1", color: "#546e7a", fontWeight: 600, fontSize: 10 },
  catChipProduct: { background: "#e3f2fd", color: "#1565c0", fontWeight: 600, fontSize: 10 },
  catChipRules: { background: "#fff3e0", color: "#e65100", fontWeight: 600, fontSize: 10 },

  emptyState: {
    textAlign: "center", padding: "48px 24px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
  },
  emptyIcon: { fontSize: 56, opacity: 0.18 },
}));

const CATEGORIES = [
  {
    value: "general", label: "Geral", chipCls: "catChipGeneral",
    icon: <GeneralIcon />, iconBg: "#eceff1", iconColor: "#546e7a",
    desc: "Documentos e textos de uso geral pelo agente de IA",
  },
  {
    value: "product", label: "Produtos", chipCls: "catChipProduct",
    icon: <ProductIcon />, iconBg: "#e3f2fd", iconColor: "#1565c0",
    desc: "Catálogo, preços e especificações de produtos",
  },
  {
    value: "rules", label: "Regras", chipCls: "catChipRules",
    icon: <RulesIcon />, iconBg: "#fff3e0", iconColor: "#e65100",
    desc: "Políticas da empresa, procedimentos e respostas padrão",
  },
];

function DocSkeleton() {
  return (
    <Box style={{ display: "flex", alignItems: "center", padding: "14px 16px", marginBottom: 10 }}>
      <Skeleton variant="rect" width={40} height={40} style={{ borderRadius: 8, flexShrink: 0 }} />
      <Box style={{ flex: 1, marginLeft: 14 }}>
        <Skeleton variant="text" width="60%" height={18} />
        <Skeleton variant="text" width="35%" height={14} style={{ marginTop: 4 }} />
      </Box>
    </Box>
  );
}

export default function KnowledgeBase() {
  const classes = useStyles();
  const [tab, setTab] = useState(0);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const cat = CATEGORIES[tab];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/helps/rag/documents?category=${cat.value}`);
      setDocs(data.documents || []);
    } catch {
      toast.error("Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  }, [cat.value]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) { toast.warning("Preencha título e conteúdo."); return; }
    setSaving(true);
    try {
      await api.post("/helps/rag/index-text", { title, text: content, category: cat.value });
      toast.success("Documento indexado com sucesso!");
      setOpen(false); setTitle(""); setContent("");
      load();
    } catch {
      toast.error("Erro ao indexar documento");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remover este documento da base de conhecimento?")) return;
    try {
      await api.delete(`/helps/rag/documents/${id}`);
      toast.success("Documento removido");
      load();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const openDialog = () => { setTitle(""); setContent(""); setOpen(true); };

  return (
    <MainContainer useWindowScroll>
    <Box className={classes.root}>
      {/* ── Hero ── */}
      <Box className={classes.hero}>
        <Box className={classes.heroLeft}>
          <BookIcon className={classes.heroIcon} />
          <Box>
            <Typography className={classes.heroTitle}>Base de Conhecimento IA</Typography>
            <Typography className={classes.heroSub}>
              Documentos indexados com PGVector + HNSW para busca semântica nas respostas dos agentes.
            </Typography>
          </Box>
        </Box>
        <Box className={classes.heroActions}>
          <Tooltip title="Recarregar">
            <IconButton onClick={load} style={{ color: "rgba(255,255,255,0.8)" }}><RefreshIcon /></IconButton>
          </Tooltip>
          <Button variant="contained" className={classes.heroBtnPrimary} startIcon={<AddIcon />} onClick={openDialog}>
            Novo Documento
          </Button>
        </Box>
      </Box>

      {/* ── Content ── */}
      <Paper className={classes.paper} elevation={0} variant="outlined">
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          className={classes.tabs}
          indicatorColor="primary"
          textColor="primary"
        >
          {CATEGORIES.map(c => (
            <Tab
              key={c.value}
              label={
                <Box display="flex" alignItems="center" style={{ gap: 6 }}>
                  {c.label}
                  {!loading && tab === CATEGORIES.indexOf(c) && (
                    <Chip size="small" label={docs.length} style={{ height: 18, fontSize: 10, fontWeight: 700 }} />
                  )}
                </Box>
              }
            />
          ))}
        </Tabs>

        <Box className={classes.tabContent}>
          <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16 }}>
            {cat.desc}
          </Typography>

          {loading ? (
            [1, 2, 3].map(i => <DocSkeleton key={i} />)
          ) : docs.length === 0 ? (
            <Box className={classes.emptyState}>
              <BookIcon className={classes.emptyIcon} />
              <Typography variant="h6" color="textSecondary">
                Nenhum documento em "{cat.label}"
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Adicione textos, regras ou catálogos para o agente consultar durante conversas.
              </Typography>
              <Button variant="outlined" color="primary" startIcon={<AddIcon />} onClick={openDialog}>
                Adicionar primeiro documento
              </Button>
            </Box>
          ) : (
            docs.map(doc => {
              const docCat = CATEGORIES.find(c => c.value === (doc.category || "general")) || CATEGORIES[0];
              return (
                <Box key={doc.id} className={classes.docCard}>
                  <Box
                    className={classes.docIcon}
                    style={{ background: docCat.iconBg, color: docCat.iconColor }}
                  >
                    {React.cloneElement(docCat.icon, { fontSize: "small" })}
                  </Box>

                  <Box className={classes.docBody}>
                    <Typography className={classes.docTitle}>{doc.title}</Typography>
                    <Typography className={classes.docMeta}>
                      Atualizado {new Date(doc.updatedAt).toLocaleDateString("pt-BR")}
                      {doc.size ? ` · ${(doc.size / 1024).toFixed(1)}KB` : ""}
                    </Typography>
                  </Box>

                  <Box className={classes.docActions}>
                    <Chip label={docCat.label} size="small" className={classes[docCat.chipCls]} />
                    <Tooltip title="Remover documento">
                      <IconButton size="small" onClick={() => handleDelete(doc.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      </Paper>

      {/* ── Create dialog ── */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Novo Documento — {cat.label}
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Título"
            fullWidth variant="outlined" size="small" autoFocus
            value={title} onChange={e => setTitle(e.target.value)}
            style={{ marginBottom: 16, marginTop: 8 }}
          />
          <TextField
            label="Conteúdo (texto para indexar)"
            fullWidth multiline rows={12} variant="outlined"
            value={content} onChange={e => setContent(e.target.value)}
            placeholder="Cole aqui: regras, FAQs, descrição de produtos, políticas, scripts de vendas..."
            helperText={`${content.length} caracteres · ~${Math.round(content.split(/\s+/).filter(Boolean).length)} palavras`}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            variant="contained" color="primary"
            onClick={handleCreate} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <BookIcon />}
          >
            Indexar Documento
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </MainContainer>
  );
}
