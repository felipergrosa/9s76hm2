import React, { useState, useEffect, useReducer, useMemo } from "react";
import { useHistory } from "react-router-dom";
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

import AddIcon from "@material-ui/icons/Add";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import PeopleIcon from "@material-ui/icons/People";
import RepeatIcon from "@material-ui/icons/Repeat";
import {
  Repeat as RepeatLucideIcon,
  PlayCircle as ActiveIcon,
  PauseCircle as PausedIcon,
  KanbanSquare as LaneIcon,
} from "lucide-react";

import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";

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
      return action.payload;
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

const STATUS_CHIP_CLASSES = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  inactive: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

const END_ACTION_LABELS = {
  none: "—",
  move_tag: "Mover de lane",
  ticket_status: "Mudar status",
  assign_queue: "Carteira → fila",
  assign_user: "Carteira → atendente",
};

const StatusChip = ({ active }) => (
  <span
    className={`${chipBaseClass} ${
      active ? STATUS_CHIP_CLASSES.active : STATUS_CHIP_CLASSES.inactive
    }`}
  >
    {active ? "Ativa" : "Inativa"}
  </span>
);

const TriggerChip = ({ tag }) => {
  if (!tag) return <>—</>;
  const isLane = Number(tag.kanban) === 1;
  return (
    <span className={`${chipBaseClass} bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200`}>
      {isLane ? `Lane: ${tag.name}` : `Tag: ${tag.name}`}
    </span>
  );
};

const FollowUps = () => {
  const classes = useStyles();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [triggerFilter, setTriggerFilter] = useState("");
  const [records, dispatch] = useReducer(reducer, []);
  const [deleting, setDeleting] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("drip-sequences.create");
  const canEdit = hasPermission("drip-sequences.edit");
  const canDelete = hasPermission("drip-sequences.delete");

  useEffect(() => {
    setLoading(true);
    const fetch = async () => {
      try {
        const { data } = await api.get("/drip-sequences", { params: { searchParam } });
        dispatch({ type: "LOAD", payload: data.records });
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [searchParam]);

  const filteredRecords = records.filter(r => {
    if (statusFilter === "active" && !r.active) return false;
    if (statusFilter === "inactive" && r.active) return false;
    if (triggerFilter === "lane" && Number(r.tag?.kanban) !== 1) return false;
    if (triggerFilter === "tag" && Number(r.tag?.kanban) === 1) return false;
    return true;
  });

  // KPIs do strip bento — derivados da lista já carregada.
  // A listagem não traz contagem de inscritos (enrollments são buscados por
  // sequência sob demanda), então o 4º KPI usa o tipo de gatilho.
  const followUpStats = useMemo(() => ({
    total: records.length,
    active: records.filter(r => r.active).length,
    inactive: records.filter(r => !r.active).length,
    laneTrigger: records.filter(r => Number(r.tag?.kanban) === 1).length,
  }), [records]);

  const reducedMotion = useReducedMotion();
  const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

  const handleDelete = async id => {
    try {
      await api.delete(`/drip-sequences/${id}`);
      dispatch({ type: "DELETE", payload: id });
      toast.success("Follow-up excluído");
    } catch (err) {
      toastError(err);
    }
    setDeleting(null);
  };

  const handleShowEnrollments = async id => {
    try {
      const { data } = await api.get(`/drip-sequences/${id}/enrollments`);
      const active = data.filter(e => e.status === "active").length;
      const completed = data.filter(e => e.status === "completed").length;
      const failed = data.filter(e => e.status === "failed").length;
      // waiting_window: segurados fora da janela de 24h da API Oficial
      const waitingWindow = data.filter(e => e.status === "waiting_window").length;
      toast.info(
        `Inscritos: ${data.length} | Ativos: ${active} | Concluídos: ${completed} | Falharam: ${failed}` +
          (waitingWindow > 0 ? ` | Aguardando janela 24h: ${waitingWindow}` : ""),
        { autoClose: 8000 }
      );
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer useWindowScroll>
      <ConfirmationModal
        title={deleting && `Excluir follow-up "${deleting.name}"?`}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => handleDelete(deleting.id)}
      >
        Etapas e inscrições associadas também serão removidas. Essa ação não pode ser desfeita.
      </ConfirmationModal>

      <motion.div
        variants={bentoContainer}
        initial="hidden"
        animate="show"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 12 }}
      >
        {/* Strip de KPIs bento — derivado da lista carregada */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard label="Sequências" value={followUpStats.total} icon={<RepeatLucideIcon size={20} />} accent="var(--primary-color)" loading={loading} />
          <StatCard label="Ativas" value={followUpStats.active} icon={<ActiveIcon size={20} />} accent="#26c281" loading={loading} />
          <StatCard label="Inativas" value={followUpStats.inactive} icon={<PausedIcon size={20} />} accent="#f39c12" loading={loading} />
          <StatCard label="Gatilho em lane" value={followUpStats.laneTrigger} icon={<LaneIcon size={20} />} accent="#8e44ad" loading={loading} />
        </div>

      <motion.div variants={itemVariant} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <Paper className={`${classes.mainPaper} bento-panel`} variant="outlined">
        {/* Header — padrão do gerenciador de Templates Meta */}
        <Box className={classes.header}>
          <div className={classes.headerText}>
            <Title>Follow-ups ({filteredRecords.length})</Title>
            <span className={classes.subtitle}>
              Sequências automáticas disparadas por tag ou lane do Kanban
            </span>
          </div>
          <div className={classes.headerActions}>
            {canCreate && (
              <Button
                variant="contained"
                color="primary"
                size="small"
                style={{ minHeight: 36 }}
                onClick={() => history.push("/follow-ups/new")}
                startIcon={<AddIcon fontSize="small" />}
              >
                Novo follow-up
              </Button>
            )}
          </div>
        </Box>

        {/* Barra de busca e filtros — mesmo padrão de /meta-templates */}
        <Box className={classes.toolbar}>
          <TextField
            placeholder="Buscar follow-up..."
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
            <InputLabel>Gatilho</InputLabel>
            <Select
              value={triggerFilter}
              onChange={e => setTriggerFilter(e.target.value)}
              label="Gatilho"
            >
              <MenuItem value="">Todos</MenuItem>
              <MenuItem value="lane">Lane do Kanban</MenuItem>
              <MenuItem value="tag">Tag de contato</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {loading ? (
          <Table size="small">
            <TableBody>
              <TableRowSkeleton columns={6} />
            </TableBody>
          </Table>
        ) : filteredRecords.length === 0 ? (
          <Box className={classes.emptyState}>
            <RepeatIcon className={classes.emptyIcon} />
            <Typography variant="subtitle1">
              {searchParam || statusFilter || triggerFilter
                ? "Nenhum follow-up encontrado com esses filtros"
                : "Nenhum follow-up criado ainda"}
            </Typography>
            <Typography variant="body2">
              Crie uma sequência para engajar contatos que entram na lane automaticamente.
            </Typography>
          </Box>
        ) : (
          <>
            {/* Cards — mobile */}
            <div className={classes.mobileList}>
              {filteredRecords.map(record => (
                <div key={record.id} className={classes.card}>
                  <div className={classes.cardHeader}>
                    <div className={classes.cardTitle}>
                      <div className={classes.cardName} title={record.name}>
                        {record.name}
                      </div>
                    </div>
                    <StatusChip active={record.active} />
                  </div>
                  <div className={classes.cardMeta}>
                    <div>
                      <div className={classes.metaLabel}>Gatilho</div>
                      <div className={classes.metaValue}>
                        <TriggerChip tag={record.tag} />
                      </div>
                    </div>
                    <div>
                      <div className={classes.metaLabel}>Conexão</div>
                      <div className={classes.metaValue}>
                        {record.whatsapp?.name || "—"}
                        {record.whatsapp?.channelType === "official" && " (API Oficial)"}
                      </div>
                    </div>
                    <div>
                      <div className={classes.metaLabel}>Janela</div>
                      <div className={classes.metaValue}>
                        {record.sendWindowStart && record.sendWindowEnd
                          ? `${record.sendWindowStart}–${record.sendWindowEnd}`
                          : "Qualquer horário"}
                      </div>
                    </div>
                    <div>
                      <div className={classes.metaLabel}>Ação final</div>
                      <div className={classes.metaValue}>
                        {END_ACTION_LABELS[record.endAction] || "—"}
                      </div>
                    </div>
                  </div>
                  <div className={classes.cardActions}>
                    <Tooltip title="Ver inscritos">
                      <IconButton
                        size="small"
                        className={classes.actionButton}
                        onClick={() => handleShowEnrollments(record.id)}
                      >
                        <PeopleIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canEdit && (
                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          className={classes.actionButton}
                          onClick={() => history.push(`/follow-ups/${record.id}`)}
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
                  </div>
                </div>
              ))}
            </div>

            {/* Tabela — desktop */}
            <div className={classes.desktopTableWrapper}>
              <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell className={classes.headCell}>Nome</TableCell>
              <TableCell className={classes.headCell}>Gatilho</TableCell>
              <TableCell className={classes.headCell}>Conexão</TableCell>
              <TableCell align="center" className={classes.headCell}>Ação final</TableCell>
              <TableCell align="center" className={classes.headCell}>Status</TableCell>
              <TableCell align="center" className={classes.headCell}>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRecords.map(record => (
                <TableRow key={record.id} className={classes.rowHover} hover={false}>
                  <TableCell className={classes.bodyCell}>
                    <Typography className={classes.recordName}>{record.name}</Typography>
                    <Typography className={classes.recordSnippet}>
                      {record.sendWindowStart && record.sendWindowEnd
                        ? `Janela ${record.sendWindowStart}–${record.sendWindowEnd}`
                        : "Envio em qualquer horário"}
                    </Typography>
                  </TableCell>
                  <TableCell className={classes.bodyCell}>
                    <TriggerChip tag={record.tag} />
                  </TableCell>
                  <TableCell className={classes.bodyCell}>
                    <Typography variant="body2">
                      {record.whatsapp?.name || "—"}
                    </Typography>
                    {record.whatsapp?.channelType === "official" && (
                      <Typography className={classes.recordSnippet}>API Oficial</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center" className={classes.bodyCell}>
                    <Typography variant="body2" color="textSecondary">
                      {END_ACTION_LABELS[record.endAction] || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell align="center" className={classes.bodyCell}>
                    <StatusChip active={record.active} />
                  </TableCell>
                  <TableCell align="center" className={classes.bodyCell}>
                    <Tooltip title="Ver inscritos">
                      <IconButton size="small" onClick={() => handleShowEnrollments(record.id)}>
                        <PeopleIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canEdit && (
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => history.push(`/follow-ups/${record.id}`)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canDelete && (
                      <Tooltip title="Excluir">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setDeleting(record);
                            setConfirmOpen(true);
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
              </Table>
            </div>
          </>
        )}
      </Paper>
      </motion.div>
      </motion.div>
    </MainContainer>
  );
};

export default FollowUps;
