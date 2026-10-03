import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-toastify";

import {
  Paper, Button, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton, CircularProgress, Tooltip,
  Tabs, Tab, InputAdornment,
  Table, TableBody, TableRow, TableCell, TableHead,
} from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";

import {
  Plus as AddIcon,
  Trash2 as DeleteIcon,
  RefreshCw as RefreshIcon,
  Search as SearchIcon,
  BookOpen as BookIcon,
  Folder as GeneralIcon,
  Package as ProductIcon,
  Gavel as RulesIcon,
} from "lucide-react";

import api from "../../services/api";
import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ForbiddenPage from "../../components/ForbiddenPage";
import usePermissions from "../../hooks/usePermissions";

// ===== Estilos no padrão de layout das páginas de listagem (ref: Connections) =====
const useStyles = makeStyles(theme => ({
  paper: {
    flex: 1,
    padding: 0,
    // overflowY auto: conteúdo longo rola dentro do Paper (o MainContainer não usa useWindowScroll)
    overflowY: "auto",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    ...theme.scrollbarStyles,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    padding: theme.spacing(2, 2.5),
  },
  headerText: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: "0.85rem",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  tabs: {
    borderTop: `1px solid ${theme.palette.divider}`,
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
    padding: theme.spacing(1.5, 2.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : "#fafafa",
  },
  searchField: {
    minWidth: 220,
    flex: "1 1 280px",
    maxWidth: 380,
  },
  filterSelect: {
    minWidth: 150,
  },
  toolbarNote: {
    marginLeft: "auto",
    color: theme.palette.text.secondary,
    fontSize: "0.8rem",
  },
  headCell: {
    fontWeight: 600,
    fontSize: "0.72rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    borderBottom: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : "#fafafa",
    whiteSpace: "nowrap",
  },
  bodyCell: {
    fontSize: "0.85rem",
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
    borderBottom: `1px solid ${theme.palette.divider}`,
    verticalAlign: "middle",
  },
  rowHover: {
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    transition: "background-color 120ms ease",
  },
  docIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  docTitle: {
    fontWeight: 600,
    fontSize: "0.9rem",
    lineHeight: 1.35,
  },
  actionsCell: {
    whiteSpace: "nowrap",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(8, 2),
    color: theme.palette.text.secondary,
    textAlign: "center",
  },
  // Cards mobile
  mobileList: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    [theme.breakpoints.up("sm")]: {
      display: "none",
    },
  },
  desktopTableWrapper: {
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  card: {
    borderRadius: 12,
    padding: theme.spacing(1.75),
    border: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.25),
    background: theme.palette.background.paper,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
  },
  cardTitle: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
    minWidth: 0,
  },
  cardName: {
    fontWeight: 700,
    fontSize: "1rem",
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 190,
  },
  cardMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: theme.spacing(1),
  },
  metaLabel: {
    fontSize: "0.72rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: theme.palette.text.secondary,
  },
  metaValue: {
    fontSize: "0.9rem",
    fontWeight: 600,
    wordBreak: "break-word",
  },
  cardActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    flexWrap: "wrap",
  },
  actionButton: {
    minWidth: 44,
    minHeight: 44,
  },
}));

// Categorias da base de conhecimento — chip segue o padrão tailwind do spec
const CATEGORIES = [
  {
    value: "general", label: "Geral", icon: GeneralIcon,
    chipCls: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
    iconBg: "#eceff1", iconColor: "#546e7a",
    desc: "Documentos e textos de uso geral pelo agente de IA",
  },
  {
    value: "product", label: "Produtos", icon: ProductIcon,
    chipCls: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    iconBg: "#e3f2fd", iconColor: "#1565c0",
    desc: "Catálogo, preços e especificações de produtos",
  },
  {
    value: "rules", label: "Regras", icon: RulesIcon,
    chipCls: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    iconBg: "#fff3e0", iconColor: "#e65100",
    desc: "Políticas da empresa, procedimentos e respostas padrão",
  },
];

// Chip de categoria no padrão tailwind (mesmo visual dos status em Connections)
const CategoryChip = ({ cat }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.chipCls}`}>
    {cat.label}
  </span>
);

// Formata o tamanho do documento em KB (mesmo critério da versão anterior)
const formatSize = (size) => (size ? `${(size / 1024).toFixed(1)} KB` : "—");

export default function KnowledgeBase() {
  const classes = useStyles();
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  // Busca client-side sobre os documentos da categoria carregada
  const [searchParam, setSearchParam] = useState("");
  const { hasPermission } = usePermissions();
  // Indexar/remover documentos exige ai-settings.edit no backend (ragRoutes)
  const canManageDocs = hasPermission("ai-settings.edit");

  const cat = CATEGORIES[tab];

  // Filtra os documentos pelo termo de busca (client-side)
  const filteredDocs = useMemo(() => {
    const search = searchParam.trim().toLowerCase();
    if (!search) return docs;
    return docs.filter(d => (d.title || "").toLowerCase().includes(search));
  }, [docs, searchParam]);

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
    <MainContainer>
      {/* ── Modal de criação de documento ── */}
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
            startIcon={saving ? <CircularProgress size={16} /> : <BookIcon size={16} />}
          >
            Indexar Documento
          </Button>
        </DialogActions>
      </Dialog>

      {!hasPermission("helps.view") ? <ForbiddenPage /> : (
        <Paper className={classes.paper} variant="outlined">
          {/* Cabeçalho no padrão: título + contagem + subtítulo + ações */}
          <div className={classes.header}>
            <div className={classes.headerText}>
              <Title>Base de Conhecimento IA ({filteredDocs.length})</Title>
              <span className={classes.subtitle}>
                Documentos indexados com PGVector + HNSW para busca semântica nas respostas dos agentes.
              </span>
            </div>
            <div className={classes.headerActions}>
              <Tooltip title="Recarregar">
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  onClick={load}
                  startIcon={<RefreshIcon size={16} />}
                  style={{ minHeight: 36 }}
                >
                  Recarregar
                </Button>
              </Tooltip>
              {canManageDocs && (
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<AddIcon size={16} />}
                  onClick={openDialog}
                  style={{ minHeight: 36 }}
                >
                  Novo Documento
                </Button>
              )}
            </div>
          </div>

          {/* Abas de categoria (filtro principal — carrega docs no backend por categoria) */}
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
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {c.label}
                    {!loading && tab === CATEGORIES.indexOf(c) && (
                      <span className="px-1.5 py-0.5 rounded-full text-[0.65rem] font-bold bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        {docs.length}
                      </span>
                    )}
                  </span>
                }
              />
            ))}
          </Tabs>

          {/* Toolbar: busca por título + descrição da categoria ativa */}
          <div className={classes.toolbar}>
            <TextField
              className={classes.searchField}
              size="small"
              variant="outlined"
              placeholder="Buscar por título…"
              value={searchParam}
              onChange={e => setSearchParam(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon size={16} />
                  </InputAdornment>
                ),
              }}
            />
            <span className={classes.toolbarNote}>{cat.desc}</span>
          </div>

          {/* Conteúdo: skeleton / vazio / lista responsiva */}
          {loading ? (
            <Table>
              <TableBody>
                {[1, 2, 3].map(i => <TableRowSkeleton key={i} columns={5} />)}
              </TableBody>
            </Table>
          ) : filteredDocs.length === 0 ? (
            <div className={classes.emptyState}>
              <BookIcon size={44} style={{ color: theme.palette.text.disabled }} />
              <div>Nenhum documento encontrado em "{cat.label}".</div>
              {canManageDocs && (
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  startIcon={<AddIcon size={16} />}
                  onClick={openDialog}
                  style={{ minHeight: 36, marginTop: 8 }}
                >
                  Adicionar primeiro documento
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Cards — mobile */}
              <div className={classes.mobileList}>
                {filteredDocs.map(doc => {
                  const docCat = CATEGORIES.find(c => c.value === (doc.category || "general")) || CATEGORIES[0];
                  const DocIcon = docCat.icon;
                  return (
                    <div key={doc.id} className={classes.card}>
                      <div className={classes.cardHeader}>
                        <div className={classes.cardTitle}>
                          <span
                            className={classes.docIcon}
                            style={{ background: docCat.iconBg, color: docCat.iconColor }}
                          >
                            <DocIcon size={18} />
                          </span>
                          <div className={classes.cardName} title={doc.title}>
                            {doc.title}
                          </div>
                        </div>
                        <CategoryChip cat={docCat} />
                      </div>

                      <div className={classes.cardMeta}>
                        <div>
                          <div className={classes.metaLabel}>Atualizado</div>
                          <div className={classes.metaValue}>
                            {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString("pt-BR") : "—"}
                          </div>
                        </div>
                        <div>
                          <div className={classes.metaLabel}>Tamanho</div>
                          <div className={classes.metaValue}>{formatSize(doc.size)}</div>
                        </div>
                      </div>

                      {canManageDocs && (
                        <div className={classes.cardActions}>
                          <Tooltip title="Remover documento">
                            <IconButton
                              size="small"
                              className={classes.actionButton}
                              onClick={() => handleDelete(doc.id)}
                            >
                              <DeleteIcon size={18} />
                            </IconButton>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Tabela — desktop */}
              <div className={classes.desktopTableWrapper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell className={classes.headCell}>Documento</TableCell>
                      <TableCell align="center" className={classes.headCell}>Categoria</TableCell>
                      <TableCell align="center" className={classes.headCell}>Tamanho</TableCell>
                      <TableCell align="center" className={classes.headCell}>Atualizado</TableCell>
                      {canManageDocs && (
                        <TableCell align="center" className={classes.headCell}>Ações</TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredDocs.map(doc => {
                      const docCat = CATEGORIES.find(c => c.value === (doc.category || "general")) || CATEGORIES[0];
                      const DocIcon = docCat.icon;
                      return (
                        <TableRow key={doc.id} className={classes.rowHover}>
                          <TableCell className={classes.bodyCell}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <span
                                className={classes.docIcon}
                                style={{ background: docCat.iconBg, color: docCat.iconColor }}
                              >
                                <DocIcon size={18} />
                              </span>
                              <span className={classes.docTitle}>{doc.title}</span>
                            </div>
                          </TableCell>
                          <TableCell align="center" className={classes.bodyCell}>
                            <CategoryChip cat={docCat} />
                          </TableCell>
                          <TableCell align="center" className={classes.bodyCell}>
                            {formatSize(doc.size)}
                          </TableCell>
                          <TableCell align="center" className={classes.bodyCell}>
                            {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString("pt-BR") : "—"}
                          </TableCell>
                          {canManageDocs && (
                            <TableCell align="center" className={`${classes.bodyCell} ${classes.actionsCell}`}>
                              <Tooltip title="Remover documento">
                                <IconButton size="small" onClick={() => handleDelete(doc.id)}>
                                  <DeleteIcon size={18} />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Paper>
      )}
    </MainContainer>
  );
}
