import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box, Paper, Button, TextField, Dialog,
  DialogTitle, DialogContent, DialogActions, IconButton, Select,
  MenuItem, FormControl, InputLabel, Table, TableHead,
  TableRow, TableCell, TableBody, Tooltip, CircularProgress,
  FormControlLabel, Checkbox, InputAdornment
} from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import {
  Search as SearchIcon,
  Pencil as EditIcon,
  Trash2 as DeleteIcon,
  Plus as AddIcon,
  SlidersHorizontal as TuneIcon,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../services/api";
import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ForbiddenPage from "../../components/ForbiddenPage";
import usePermissions from "../../hooks/usePermissions";

// `color` alimenta a bolinha do seletor de tipo no dialog; `cls` é o chip tailwind
// usado na tabela/cards (padrão das telas de listagem)
const TYPE_META = {
  text:    { label: "Texto",    color: "#1565c0", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  number:  { label: "Número",   color: "#6a1b9a", cls: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  date:    { label: "Data",     color: "#006064", cls: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200" },
  boolean: { label: "Booleano", color: "#e65100", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  select:  { label: "Seleção",  color: "#2e7d32", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
};

// Estilos no padrão de listagem (referência: pages/Connections)
const useStyles = makeStyles(theme => ({
  paper: {
    flex: 1,
    padding: 0,
    overflow: "hidden",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
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
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
    padding: theme.spacing(1.5, 2.5),
    borderTop: `1px solid ${theme.palette.divider}`,
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
  keyCode: {
    fontFamily: "monospace",
    fontSize: 12,
    background: theme.palette.type === "dark" ? "#333" : "#f5f5f5",
    borderRadius: 4,
    padding: "2px 6px",
    color: theme.palette.type === "dark" ? "#81c784" : "#d32f2f",
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

// Somente "lead" tem storage/consumo implementado (ContactCustomField + form de contato).
// ticket/company/deal foram removidos da UI para não gerar configs órfãs.
const ENTITIES = [
  { value: "lead",    label: "Lead / Contato" },
];

const FIELD_TYPES = ["text", "number", "date", "boolean", "select"];

const emptyForm = { entityType: "lead", key: "", label: "", type: "text", options: "", required: false };

// Chip de tipo do campo (tailwind, padrão das telas de listagem)
const TypeChip = ({ type }) => {
  const tm = TYPE_META[type] || TYPE_META.text;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tm.cls}`}>
      {tm.label}
    </span>
  );
};

// Chip "obrigatório/opcional" (tailwind)
const RequiredChip = ({ required }) => (
  <span
    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      required
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
    }`}
  >
    {required ? "Obrigatório" : "Opcional"}
  </span>
);

// Resumo das opções (máx. 3 + reticências), igual à exibição anterior
const optionsSummary = (options) =>
  Array.isArray(options) && options.length
    ? options.slice(0, 3).join(", ") + (options.length > 3 ? "…" : "")
    : "—";

export default function AdminCustomFields() {
  const classes = useStyles();
  const theme = useTheme();
  const { hasPermission } = usePermissions();

  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Busca + filtro de tipo (client-side, padrão das telas de listagem)
  const [searchParam, setSearchParam] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Apenas "lead" está ativo no momento (ver ENTITIES)
  const currentEntity = ENTITIES[0].value;

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

  // Lista filtrada por busca (chave/rótulo/tipo) e filtro de tipo
  const filteredConfigs = useMemo(() => {
    const search = searchParam.trim().toLowerCase();
    return (configs || []).filter((c) => {
      if (typeFilter && c.type !== typeFilter) return false;
      if (search) {
        const typeLabel = (TYPE_META[c.type] || {}).label || "";
        const hay = `${c.key || ""} ${c.label || ""} ${typeLabel}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }, [configs, searchParam, typeFilter]);

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
    if (form.type === "select" && (!options || options.length === 0)) {
      toast.warning("Informe ao menos uma opção para o campo Seleção");
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/custom-field-configs/${editId}`, { ...form, options });
        toast.success("Campo atualizado");
      } else {
        await api.post("/custom-field-configs", { ...form, options, position: configs.length });
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
    <MainContainer>
      {/* Dialog de criação/edição — mantido fora do gate de permissão */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? "Editar Campo" : "Novo Campo Customizado"}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" style={{ gap: 16, marginTop: 8 }}>
            <FormControl fullWidth variant="outlined" size="small" disabled={!!editId}>
              <InputLabel>Entidade</InputLabel>
              <Select value={form.entityType} onChange={e => setField("entityType", e.target.value)} label="Entidade">
                {ENTITIES.map(e => <MenuItem key={e.value} value={e.value}>{e.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label="Chave (key)" size="small" variant="outlined" autoFocus
              value={form.key}
              disabled={!!editId}
              onChange={e => setField("key", e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""))}
              helperText={editId ? "A chave não pode ser alterada (valores salvos ficam vinculados a ela)" : "snake_case, ex: data_nascimento"}
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
            <FormControlLabel
              control={
                <Checkbox
                  color="primary"
                  checked={!!form.required}
                  onChange={e => setField("required", e.target.checked)}
                />
              }
              label="Campo obrigatório no formulário de contato"
            />
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

      {/* Gate de permissão: a rota já exige settings.edit (PrivateRoute) e o
          backend valida settings.edit nos endpoints de custom-field-configs */}
      {!hasPermission("settings.edit") ? <ForbiddenPage /> : (
        <Paper className={classes.paper} variant="outlined">
          {/* Cabeçalho: título + contagem + subtítulo + ações */}
          <div className={classes.header}>
            <div className={classes.headerText}>
              <Title>Campos Customizados ({filteredConfigs.length})</Title>
              <span className={classes.subtitle}>
                Configure campos extras exibidos no cadastro do Lead / Contato.
              </span>
            </div>
            <div className={classes.headerActions}>
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<AddIcon size={16} />}
                style={{ minHeight: 36 }}
                onClick={openCreate}
              >
                Novo Campo
              </Button>
            </div>
          </div>

          {/* Toolbar: busca + filtro de tipo */}
          <div className={classes.toolbar}>
            <TextField
              className={classes.searchField}
              size="small"
              variant="outlined"
              placeholder="Buscar por chave, rótulo ou tipo…"
              value={searchParam}
              onChange={(e) => setSearchParam(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon size={16} />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" variant="outlined" className={classes.filterSelect}>
              <Select
                native
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                displayEmpty
              >
                <option value="">Todos os tipos</option>
                {FIELD_TYPES.map(t => (
                  <option key={t} value={t}>{TYPE_META[t].label}</option>
                ))}
              </Select>
            </FormControl>
          </div>

          {loading ? (
            <Table>
              <TableBody>
                <TableRowSkeleton columns={6} />
              </TableBody>
            </Table>
          ) : filteredConfigs.length === 0 ? (
            <div className={classes.emptyState}>
              <TuneIcon size={44} style={{ color: theme.palette.text.disabled }} />
              <div>
                {configs.length === 0
                  ? `Nenhum campo para ${ENTITIES[0].label}`
                  : "Nenhum campo encontrado para a busca/filtro atual."}
              </div>
              {configs.length === 0 && (
                <>
                  <div style={{ fontSize: "0.85rem" }}>
                    Campos customizados permitem armazenar informações específicas do seu negócio.
                  </div>
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    startIcon={<AddIcon size={16} />}
                    onClick={openCreate}
                  >
                    Criar primeiro campo
                  </Button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Cards — mobile */}
              <div className={classes.mobileList}>
                {filteredConfigs.map(c => (
                  <div key={c.id} className={classes.card}>
                    <div className={classes.cardHeader}>
                      <div className={classes.cardTitle}>
                        <div style={{ minWidth: 0 }}>
                          <div className={classes.cardName} title={c.label}>{c.label}</div>
                          <span className={classes.keyCode}>{c.key}</span>
                        </div>
                      </div>
                      <TypeChip type={c.type} />
                    </div>
                    <div className={classes.cardMeta}>
                      <div>
                        <div className={classes.metaLabel}>Opções</div>
                        <div className={classes.metaValue}>{optionsSummary(c.options)}</div>
                      </div>
                      <div>
                        <div className={classes.metaLabel}>Obrigatório</div>
                        <div className={classes.metaValue}>
                          <RequiredChip required={c.required} />
                        </div>
                      </div>
                    </div>
                    <div className={classes.cardActions}>
                      <Tooltip title="Editar">
                        <IconButton size="small" className={classes.actionButton} onClick={() => openEdit(c)}>
                          <EditIcon size={18} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remover">
                        <IconButton size="small" className={classes.actionButton} onClick={() => handleDelete(c.id)}>
                          <DeleteIcon size={18} />
                        </IconButton>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tabela — desktop */}
              <div className={classes.desktopTableWrapper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell className={classes.headCell}>Chave</TableCell>
                      <TableCell className={classes.headCell}>Rótulo</TableCell>
                      <TableCell className={classes.headCell}>Tipo</TableCell>
                      <TableCell className={classes.headCell}>Opções</TableCell>
                      <TableCell className={classes.headCell}>Obrig.</TableCell>
                      <TableCell align="right" className={classes.headCell}>Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredConfigs.map(c => (
                      <TableRow key={c.id} className={classes.rowHover}>
                        <TableCell className={classes.bodyCell}>
                          <span className={classes.keyCode}>{c.key}</span>
                        </TableCell>
                        <TableCell className={classes.bodyCell}>
                          <span style={{ fontWeight: 500 }}>{c.label}</span>
                        </TableCell>
                        <TableCell className={classes.bodyCell}>
                          <TypeChip type={c.type} />
                        </TableCell>
                        <TableCell className={classes.bodyCell}>
                          <span style={{ color: theme.palette.text.secondary, fontSize: "0.78rem" }}>
                            {optionsSummary(c.options)}
                          </span>
                        </TableCell>
                        <TableCell className={classes.bodyCell}>
                          <RequiredChip required={c.required} />
                        </TableCell>
                        <TableCell align="right" className={`${classes.bodyCell} ${classes.actionsCell}`}>
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => openEdit(c)}>
                              <EditIcon size={18} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Remover">
                            <IconButton size="small" onClick={() => handleDelete(c.id)}>
                              <DeleteIcon size={18} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
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
