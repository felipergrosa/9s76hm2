import React, { useState, useEffect, useReducer, useMemo } from "react";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import Switch from "@material-ui/core/Switch";

import AddIcon from "@material-ui/icons/Add";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import {
  Zap as AutomationIcon,
  PlayCircle as ActiveIcon,
  PauseCircle as PausedIcon,
  Send as SentIcon,
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
} from "lucide-react";

import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import ForbiddenPage from "../../components/ForbiddenPage";
import MetaAutomationModal from "../../components/MetaAutomationModal";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import usePermissions from "../../hooks/usePermissions";
import { motion, useReducedMotion } from "framer-motion";
import StatCard from "../../components/bento/StatCard";
import { bentoContainer, bentoItem, bentoItemReduced } from "../../components/bento/motionPresets";
import "../../components/bento/bento.css";

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD":
      // Acumula páginas do scroll infinito sem duplicar ids
      return [...state, ...action.payload];
    case "RESET":
      return [];
    case "UPDATE":
      const record = action.payload;
      const index = state.findIndex(s => s.id === record.id);
      if (index !== -1) {
        state[index] = record;
        return [...state];
      }
      return [record, ...state];
    case "DELETE":
      return state.filter(r => r.id !== action.payload);
    default:
      return state;
  }
};

const useStyles = makeStyles(theme => ({
  mainPaper: {
    flex: 1,
    padding: 0,
    overflow: "hidden",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    display: "flex",
    flexDirection: "column",
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
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: "0.85rem",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    flexWrap: "wrap",
  },
  searchField: {
    minWidth: 220,
    flex: "1 1 220px",
    maxWidth: 320,
    [theme.breakpoints.down("sm")]: {
      maxWidth: "none",
      flexBasis: "100%",
    },
  },
  filterSelect: {
    minWidth: 150,
  },
  listScroll: {
    flex: 1,
    overflowY: "auto",
    minHeight: 0,
  },
  headCell: {
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: "0.03em",
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
    borderBottom: `1px solid ${theme.palette.divider}`,
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
  },
  bodyCell: {
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
  },
  recordName: {
    fontWeight: 500,
    fontSize: 14,
    lineHeight: 1.35,
  },
  recordSnippet: {
    color: theme.palette.text.secondary,
    fontSize: 12.5,
    lineHeight: 1.4,
    maxWidth: 360,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rowHover: {
    transition: "background-color 120ms ease",
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  channelIcons: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    color: theme.palette.text.secondary,
  },
  emptyState: {
    padding: theme.spacing(8, 4),
    textAlign: "center",
    color: theme.palette.text.secondary,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(1.5),
  },
  emptyIcon: {
    fontSize: 44,
    opacity: 0.35,
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
    minWidth: 0,
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

const chipBaseClass =
  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium";

const TRIGGER_LABELS = {
  comment_keyword: "Comentário com palavra-chave",
  comment_any: "Qualquer comentário",
  story_mention: "Menção em story",
  referral_ref: "Link m.me com ref",
  dm_keyword: "DM com palavra-chave",
};

const CHANNEL_LABELS = {
  facebook: "Facebook",
  instagram: "Instagram",
  both: "Facebook + Instagram",
};

// Ícone(s) do canal — ambos canais exibem os dois ícones lado a lado
const ChannelIcons = ({ channel }) => {
  const classes = useStyles();
  const showFacebook = channel === "facebook" || channel === "both";
  const showInstagram = channel === "instagram" || channel === "both";
  return (
    <Tooltip title={CHANNEL_LABELS[channel] || channel || "—"}>
      <span className={classes.channelIcons}>
        {showFacebook && <FacebookIcon size={16} />}
        {showInstagram && <InstagramIcon size={16} />}
        {!showFacebook && !showInstagram && "—"}
      </span>
    </Tooltip>
  );
};

// Monta o rótulo da coluna "Ação" combinando DM / resposta pública / fluxo
// (a listagem inclui o nome do fluxo via associação `flow`)
const actionLabel = record => {
  const parts = [];
  if (record.dmText) parts.push("DM");
  if (record.publicReplyText) parts.push("Resposta pública");
  if (record.flowId) parts.push(record.flow?.name ? `Fluxo: ${record.flow.name}` : "Fluxo");
  return parts.length ? parts.join(" + ") : "—";
};

const MetaAutomations = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [records, dispatch] = useReducer(reducer, []);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [deleting, setDeleting] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  // Incrementado após salvar/excluir — força refetch mesmo sem mudar os deps
  const [reloadKey, setReloadKey] = useState(0);

  const { hasPermission } = usePermissions();
  const canView = hasPermission("meta-automations.view");
  const canCreate = hasPermission("meta-automations.create");
  const canEdit = hasPermission("meta-automations.edit");
  const canDelete = hasPermission("meta-automations.delete");

  // Qualquer mudança de busca/filtro reinicia a paginação do scroll infinito
  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam, statusFilter, channelFilter]);

  useEffect(() => {
    if (!canView) return;
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchRecords = async () => {
        try {
          // Filtros de status/canal são server-side (ListService aceita
          // channel e active="true"|"false") para não quebrar a paginação
          const { data } = await api.get("/meta-automations", {
            params: {
              searchParam,
              pageNumber,
              channel: channelFilter || undefined,
              active:
                statusFilter === "active"
                  ? "true"
                  : statusFilter === "inactive"
                  ? "false"
                  : undefined,
            },
          });
          const list = Array.isArray(data?.records) ? data.records : [];
          dispatch({ type: "LOAD", payload: list });
          setTotalCount(typeof data?.count === "number" ? data.count : list.length);
          setHasMore(Boolean(data?.hasMore));
        } catch (err) {
          if (err?.response?.status !== 403) {
            toastError(err);
          }
        } finally {
          setLoading(false);
        }
      };
      fetchRecords();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, statusFilter, channelFilter, pageNumber, canView, reloadKey]);

  // KPIs do strip bento — derivados da lista já carregada
  const stats = useMemo(() => ({
    total: totalCount,
    active: records.filter(r => r.active).length,
    inactive: records.filter(r => !r.active).length,
    sent: records.reduce((acc, r) => acc + (Number(r.sentCount) || 0), 0),
  }), [records, totalCount]);

  const reducedMotion = useReducedMotion();
  const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

  const handleOpenModal = rule => {
    setEditingRuleId(rule ? rule.id : null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingRuleId(null);
    setModalOpen(false);
  };

  // Após salvar no modal, recarrega a listagem do zero
  const handleSaved = () => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
    setReloadKey(k => k + 1);
  };

  const handleToggleActive = async record => {
    try {
      await api.put(`/meta-automations/${record.id}`, { active: !record.active });
      dispatch({ type: "UPDATE", payload: { ...record, active: !record.active } });
      toast.success(record.active ? "Regra desativada" : "Regra ativada");
    } catch (err) {
      toastError(err);
    }
  };

  const handleDelete = async id => {
    try {
      await api.delete(`/meta-automations/${id}`);
      dispatch({ type: "DELETE", payload: id });
      setTotalCount(c => Math.max(0, c - 1));
      toast.success("Regra de automação excluída");
    } catch (err) {
      toastError(err);
    }
    setDeleting(null);
  };

  // Scroll infinito: perto do fim carrega a próxima página
  const handleScroll = e => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      setPageNumber(prev => prev + 1);
    }
  };

  const renderActions = record => (
    <>
      {canEdit && (
        <Tooltip title="Editar">
          <IconButton
            size="small"
            className={classes.actionButton}
            onClick={() => handleOpenModal(record)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {canDelete && (
        <Tooltip title="Excluir">
          <IconButton
            size="small"
            className={classes.actionButton}
            onClick={() => {
              setDeleting(record);
              setConfirmOpen(true);
            }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </>
  );

  if (!canView) {
    return (
      <MainContainer useWindowScroll>
        <ForbiddenPage />
      </MainContainer>
    );
  }

  return (
    <MainContainer useWindowScroll>
      <ConfirmationModal
        title={deleting && `Excluir regra "${deleting.name}"?`}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => handleDelete(deleting.id)}
      >
        Essa ação não pode ser desfeita.
      </ConfirmationModal>

      <MetaAutomationModal
        open={modalOpen}
        onClose={handleCloseModal}
        ruleId={editingRuleId}
        onSaved={handleSaved}
      />

      <motion.div
        variants={bentoContainer}
        initial="hidden"
        animate="show"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 12 }}
      >
        {/* Strip de KPIs bento — derivado da lista carregada */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard label="Regras" value={stats.total} icon={<AutomationIcon size={20} />} accent="var(--primary-color)" loading={loading} />
          <StatCard label="Ativas" value={stats.active} icon={<ActiveIcon size={20} />} accent="#26c281" loading={loading} />
          <StatCard label="Inativas" value={stats.inactive} icon={<PausedIcon size={20} />} accent="#f39c12" loading={loading} />
          <StatCard label="Disparos" value={stats.sent} icon={<SentIcon size={20} />} accent="#3598dc" loading={loading} />
        </div>

        <motion.div variants={itemVariant} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <Paper className={`${classes.mainPaper} bento-panel`} variant="outlined">
            {/* Header interno — mesmo padrão de FollowUps/MetaTemplates */}
            <Box className={classes.header}>
              <div className={classes.headerText}>
                <Title>Automações Meta ({totalCount})</Title>
                <span className={classes.subtitle}>
                  Regras automáticas para comentários, menções e DMs do Facebook/Instagram
                </span>
              </div>
              <div className={classes.headerActions}>
                {canCreate && (
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    style={{ minHeight: 36 }}
                    onClick={() => handleOpenModal(null)}
                    startIcon={<AddIcon fontSize="small" />}
                  >
                    Nova regra
                  </Button>
                )}
              </div>
            </Box>

            {/* Barra de busca e filtros */}
            <Box className={classes.toolbar}>
              <TextField
                placeholder="Buscar regra..."
                type="search"
                variant="outlined"
                size="small"
                className={classes.searchField}
                value={searchParam}
                onChange={e => setSearchParam(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon style={{ color: "gray" }} fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <FormControl variant="outlined" size="small" className={classes.filterSelect}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="active">Ativas</MenuItem>
                  <MenuItem value="inactive">Inativas</MenuItem>
                </Select>
              </FormControl>
              <FormControl variant="outlined" size="small" className={classes.filterSelect}>
                <InputLabel>Canal</InputLabel>
                <Select
                  value={channelFilter}
                  onChange={e => setChannelFilter(e.target.value)}
                  label="Canal"
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="facebook">Facebook</MenuItem>
                  <MenuItem value="instagram">Instagram</MenuItem>
                  <MenuItem value="both">Ambos</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <div className={classes.listScroll} onScroll={handleScroll}>
              {loading && records.length === 0 ? (
                <Table size="small">
                  <TableBody>
                    <TableRowSkeleton columns={8} />
                  </TableBody>
                </Table>
              ) : records.length === 0 ? (
                <Box className={classes.emptyState}>
                  <AutomationIcon size={44} className={classes.emptyIcon} />
                  <Typography variant="subtitle1">
                    {searchParam || statusFilter || channelFilter
                      ? "Nenhuma regra encontrada com esses filtros"
                      : "Nenhuma regra de automação criada ainda"}
                  </Typography>
                  <Typography variant="body2">
                    Crie uma regra para responder comentários e menções automaticamente.
                  </Typography>
                </Box>
              ) : (
                <>
                  {/* Cards — mobile */}
                  <div className={classes.mobileList}>
                    {records.map(record => (
                      <div key={record.id} className={classes.card}>
                        <div className={classes.cardHeader}>
                          <div className={classes.cardTitle}>
                            <ChannelIcons channel={record.channel} />
                            <div className={classes.cardName} title={record.name}>
                              {record.name}
                            </div>
                          </div>
                          <Switch
                            size="small"
                            color="primary"
                            checked={Boolean(record.active)}
                            onChange={() => handleToggleActive(record)}
                            disabled={!canEdit}
                          />
                        </div>
                        <div className={classes.cardMeta}>
                          <div>
                            <div className={classes.metaLabel}>Gatilho</div>
                            <div className={classes.metaValue}>
                              {TRIGGER_LABELS[record.trigger] || record.trigger || "—"}
                            </div>
                          </div>
                          <div>
                            <div className={classes.metaLabel}>Alvo</div>
                            <div className={classes.metaValue}>
                              {record.matchValue || "—"}
                            </div>
                          </div>
                          <div>
                            <div className={classes.metaLabel}>Ação</div>
                            <div className={classes.metaValue}>{actionLabel(record)}</div>
                          </div>
                          <div>
                            <div className={classes.metaLabel}>Disparos</div>
                            <div className={classes.metaValue}>{record.sentCount || 0}</div>
                          </div>
                        </div>
                        <div className={classes.cardActions}>{renderActions(record)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Tabela — desktop */}
                  <div className={classes.desktopTableWrapper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell className={classes.headCell}>Nome</TableCell>
                          <TableCell align="center" className={classes.headCell}>Canal</TableCell>
                          <TableCell className={classes.headCell}>Gatilho</TableCell>
                          <TableCell className={classes.headCell}>Alvo</TableCell>
                          <TableCell className={classes.headCell}>Ação</TableCell>
                          <TableCell align="center" className={classes.headCell}>Disparos</TableCell>
                          <TableCell align="center" className={classes.headCell}>Ativa</TableCell>
                          <TableCell align="center" className={classes.headCell}>Ações</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {records.map(record => (
                          <TableRow key={record.id} className={classes.rowHover} hover={false}>
                            <TableCell className={classes.bodyCell}>
                              <Typography className={classes.recordName}>{record.name}</Typography>
                              <Typography className={classes.recordSnippet}>
                                {record.whatsapp?.name || ""}
                              </Typography>
                            </TableCell>
                            <TableCell align="center" className={classes.bodyCell}>
                              <ChannelIcons channel={record.channel} />
                            </TableCell>
                            <TableCell className={classes.bodyCell}>
                              <span className={`${chipBaseClass} bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200`}>
                                {TRIGGER_LABELS[record.trigger] || record.trigger || "—"}
                              </span>
                            </TableCell>
                            <TableCell className={classes.bodyCell}>
                              <Typography variant="body2">
                                {record.matchValue || "—"}
                              </Typography>
                            </TableCell>
                            <TableCell className={classes.bodyCell}>
                              <Typography variant="body2" color="textSecondary">
                                {actionLabel(record)}
                              </Typography>
                            </TableCell>
                            <TableCell align="center" className={classes.bodyCell}>
                              <Typography variant="body2">{record.sentCount || 0}</Typography>
                            </TableCell>
                            <TableCell align="center" className={classes.bodyCell}>
                              <Switch
                                size="small"
                                color="primary"
                                checked={Boolean(record.active)}
                                onChange={() => handleToggleActive(record)}
                                disabled={!canEdit}
                              />
                            </TableCell>
                            <TableCell align="center" className={classes.bodyCell}>
                              {renderActions(record)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          </Paper>
        </motion.div>
      </motion.div>
    </MainContainer>
  );
};

export default MetaAutomations;
