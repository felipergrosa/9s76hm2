import React, { useState, useEffect, useReducer, useContext, useMemo } from "react";
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
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Tooltip from "@material-ui/core/Tooltip";

import {
  Search as SearchIcon,
  Trash2 as DeleteOutlineIcon,
  Edit as EditIcon,
  Send as SendIcon,
  XCircle as CancelIcon,
  BarChart3 as AssessmentIcon,
  Plus as AddIcon,
  Mail as MailIcon,
  CalendarClock as ScheduledIcon,
  CheckCircle2 as DoneIcon,
} from "lucide-react";

import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import EmailCampaignModal from "../../components/EmailCampaignModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
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

// Chip de status no padrão tailwind dark-mode das páginas novas
const StatusChip = ({ status }) => {
  const map = {
    INATIVA: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    PROGRAMADA: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    EM_ANDAMENTO:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    CANCELADA: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    FINALIZADA:
      "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  };
  const label = {
    INATIVA: "Inativa",
    PROGRAMADA: "Programada",
    EM_ANDAMENTO: "Em andamento",
    CANCELADA: "Cancelada",
    FINALIZADA: "Finalizada",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        map[status] || map.INATIVA
      }`}
    >
      {label[status] || status}
    </span>
  );
};

// ===== Estilos no padrão do gerenciador de Templates Meta =====
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
    minWidth: 260,
    flex: "1 1 320px",
    maxWidth: 420,
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
    verticalAlign: "top",
  },
  rowHover: {
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    transition: "background-color 120ms ease",
  },
  nameCell: {
    fontWeight: 600,
    fontSize: "0.9rem",
    lineHeight: 1.35,
  },
  mutedText: {
    color: theme.palette.text.secondary,
    fontSize: "0.78rem",
    marginTop: 2,
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
  emptyIcon: {
    fontSize: 44,
    opacity: 0.35,
    marginBottom: theme.spacing(1),
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

const EmailCampaigns = () => {
  const classes = useStyles();
  const { socket, user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [records, dispatch] = useReducer(reducer, []);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("email-campaigns.create");
  const canEdit = hasPermission("email-campaigns.edit");
  const canDelete = hasPermission("email-campaigns.delete");

  useEffect(() => {
    setLoading(true);
    const fetch = async () => {
      try {
        const { data } = await api.get("/email-campaigns", { params: { searchParam } });
        dispatch({ type: "LOAD", payload: data.records });
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [searchParam]);

  useEffect(() => {
    const onEvent = data => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE", payload: data.record });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE", payload: +data.id });
      }
    };
    socket.on(`company-${user.companyId}-email-campaign`, onEvent);
    return () => socket.off(`company-${user.companyId}-email-campaign`, onEvent);
  }, [socket, user.companyId]);

  const handleOpenModal = () => {
    setSelectedId(null);
    setModalOpen(true);
  };

  const handleEdit = record => {
    setSelectedId(record.id);
    setModalOpen(true);
  };

  const handleDelete = async id => {
    try {
      await api.delete(`/email-campaigns/${id}`);
      toast.success("Campanha excluída");
    } catch (err) {
      toastError(err);
    }
    setDeleting(null);
  };

  const handleSendNow = async id => {
    try {
      await api.post(`/email-campaigns/${id}/send-now`);
      toast.success("Campanha enviada para a fila de disparo");
    } catch (err) {
      toastError(err);
    }
  };

  const handleCancel = async id => {
    try {
      await api.post(`/email-campaigns/${id}/cancel`);
      toast.success("Campanha cancelada");
    } catch (err) {
      toastError(err);
    }
  };

  // KPIs do strip bento — derivados da lista já carregada
  // (socket company-<id>-email-campaign atualiza em tempo real)
  const emailStats = useMemo(() => ({
    total: records.length,
    running: records.filter(r => r.status === "EM_ANDAMENTO").length,
    scheduled: records.filter(r => r.status === "PROGRAMADA").length,
    finished: records.filter(r => r.status === "FINALIZADA").length,
  }), [records]);

  const reducedMotion = useReducedMotion();
  const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

  const handleShowReport = async id => {
    try {
      const { data } = await api.get(`/email-campaigns/${id}/report`);
      toast.info(
        `Total: ${data.total} | Pendentes: ${data.pending} | Em processamento: ${data.processing} | Entregues: ${data.delivered} | Falharam: ${data.failed}`,
        { autoClose: 8000 }
      );
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer useWindowScroll>
      <ConfirmationModal
        title={deleting && "Excluir campanha de e-mail?"}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => handleDelete(deleting.id)}
      >
        Essa ação não pode ser desfeita.
      </ConfirmationModal>
      <EmailCampaignModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        emailCampaignId={selectedId}
      />
      <motion.div
        variants={bentoContainer}
        initial="hidden"
        animate="show"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 12 }}
      >
        {/* Strip de KPIs bento — espelha os status da lista em tempo real */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard label="Campanhas" value={emailStats.total} icon={<MailIcon size={20} />} accent="var(--primary-color)" loading={loading} />
          <StatCard label="Em andamento" value={emailStats.running} icon={<SendIcon size={20} />} accent="#26c281" loading={loading} />
          <StatCard label="Programadas" value={emailStats.scheduled} icon={<ScheduledIcon size={20} />} accent="#3598dc" loading={loading} />
          <StatCard label="Finalizadas" value={emailStats.finished} icon={<DoneIcon size={20} />} accent="#8e44ad" loading={loading} />
        </div>

      <motion.div variants={itemVariant} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <Paper className={`${classes.paper} bento-panel`} variant="outlined">
        {/* Header — padrão do gerenciador de Templates Meta */}
        <Box className={classes.header}>
          <div className={classes.headerText}>
            <Title>Campanhas de E-mail ({records.length})</Title>
            <span className={classes.subtitle}>
              Disparos de e-mail em massa — acompanhe status e relatórios de
              entrega.
            </span>
          </div>
          {canCreate && (
            <Button
              variant="contained"
              color="primary"
              size="small"
              style={{ minHeight: 36 }}
              startIcon={<AddIcon size={16} />}
              onClick={handleOpenModal}
            >
              Nova campanha
            </Button>
          )}
        </Box>

        {/* Toolbar: busca */}
        <Box className={classes.toolbar}>
          <TextField
            className={classes.searchField}
            variant="outlined"
            size="small"
            placeholder="Buscar por nome ou assunto..."
            type="search"
            value={searchParam}
            onChange={e => setSearchParam(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={18} style={{ color: "gray" }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {loading ? (
          <Table size="small">
            <TableBody>
              <TableRowSkeleton columns={5} />
            </TableBody>
          </Table>
        ) : records.length === 0 ? (
          <Box className={classes.emptyState}>
            <MailIcon className={classes.emptyIcon} />
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {searchParam
                ? "Nenhuma campanha encontrada para a busca."
                : "Nenhuma campanha de e-mail criada ainda."}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {!searchParam && "Crie sua primeira campanha de e-mail em massa."}
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
                      <div className={classes.cardName} title={record.name}>
                        {record.name}
                      </div>
                    </div>
                    <StatusChip status={record.status} />
                  </div>
                  <div className={classes.cardMeta}>
                    <div>
                      <div className={classes.metaLabel}>ID</div>
                      <div className={classes.metaValue}>#{record.id}</div>
                    </div>
                    <div>
                      <div className={classes.metaLabel}>Assunto</div>
                      <div className={classes.metaValue}>{record.subject}</div>
                    </div>
                  </div>
                  <div className={classes.cardActions}>
                    <Tooltip title="Ver relatório">
                      <IconButton
                        size="small"
                        className={classes.actionButton}
                        onClick={() => handleShowReport(record.id)}
                      >
                        <AssessmentIcon size={18} />
                      </IconButton>
                    </Tooltip>
                    {canEdit && ["INATIVA", "PROGRAMADA"].includes(record.status) && (
                      <Tooltip title="Enviar agora">
                        <IconButton
                          size="small"
                          className={classes.actionButton}
                          onClick={() => handleSendNow(record.id)}
                        >
                          <SendIcon size={18} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canEdit && ["PROGRAMADA", "EM_ANDAMENTO"].includes(record.status) && (
                      <Tooltip title="Cancelar">
                        <IconButton
                          size="small"
                          className={classes.actionButton}
                          onClick={() => handleCancel(record.id)}
                        >
                          <CancelIcon size={18} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canEdit && (
                      <Tooltip title="Editar">
                        <span>
                          <IconButton
                            size="small"
                            className={classes.actionButton}
                            onClick={() => handleEdit(record)}
                            disabled={record.status === "EM_ANDAMENTO"}
                          >
                            <EditIcon size={18} />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                    {canDelete && (
                      <Tooltip title="Excluir">
                        <span>
                          <IconButton
                            size="small"
                            className={classes.actionButton}
                            onClick={() => {
                              setDeleting(record);
                              setConfirmOpen(true);
                            }}
                            disabled={record.status === "EM_ANDAMENTO"}
                          >
                            <DeleteOutlineIcon size={18} />
                          </IconButton>
                        </span>
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
              <TableCell className={classes.headCell}>ID</TableCell>
              <TableCell className={classes.headCell}>Nome</TableCell>
              <TableCell className={classes.headCell}>Assunto</TableCell>
              <TableCell align="center" className={classes.headCell}>Status</TableCell>
              <TableCell align="center" className={classes.headCell}>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.map(record => (
              <TableRow key={record.id} className={classes.rowHover} hover={false}>
                <TableCell className={classes.bodyCell} style={{ width: 60 }}>
                  #{record.id}
                </TableCell>
                <TableCell className={classes.bodyCell}>
                  <div className={classes.nameCell}>{record.name}</div>
                </TableCell>
                <TableCell className={classes.bodyCell}>
                  {record.subject}
                </TableCell>
                <TableCell align="center" className={classes.bodyCell}>
                  <StatusChip status={record.status} />
                </TableCell>
                <TableCell align="center" className={`${classes.bodyCell} ${classes.actionsCell}`}>
                  <Tooltip title="Ver relatório">
                    <IconButton size="small" onClick={() => handleShowReport(record.id)}>
                      <AssessmentIcon size={18} />
                    </IconButton>
                  </Tooltip>
                  {canEdit && ["INATIVA", "PROGRAMADA"].includes(record.status) && (
                    <Tooltip title="Enviar agora">
                      <IconButton size="small" onClick={() => handleSendNow(record.id)}>
                        <SendIcon size={18} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canEdit && ["PROGRAMADA", "EM_ANDAMENTO"].includes(record.status) && (
                    <Tooltip title="Cancelar">
                      <IconButton size="small" onClick={() => handleCancel(record.id)}>
                        <CancelIcon size={18} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canEdit && (
                    <Tooltip title="Editar">
                      <span>
                        <IconButton size="small" onClick={() => handleEdit(record)} disabled={record.status === "EM_ANDAMENTO"}>
                          <EditIcon size={18} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip title="Excluir">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setDeleting(record);
                            setConfirmOpen(true);
                          }}
                          disabled={record.status === "EM_ANDAMENTO"}
                        >
                          <DeleteOutlineIcon size={18} />
                        </IconButton>
                      </span>
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

export default EmailCampaigns;
