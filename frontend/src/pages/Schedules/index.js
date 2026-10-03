import React, { useState, useEffect, useReducer, useCallback, useContext } from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import { format } from "date-fns";
import moment from "moment";
import { Calendar, momentLocalizer } from "react-big-calendar";
import "moment/locale/pt-br";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./Schedules.css";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import {
  Button,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
  Box,
} from "@material-ui/core";
import {
  Search as SearchIcon,
  Pencil as EditIcon,
  Trash2 as DeleteIcon,
  Plus as AddIcon,
  CalendarClock as ScheduleIcon,
  Calendar as CalendarViewIcon,
  List as ListViewIcon,
} from "lucide-react";

import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ForbiddenPage from "../../components/ForbiddenPage";
import ScheduleModal from "../../components/ScheduleModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePlans from "../../hooks/usePlans";
import usePermissions from "../../hooks/usePermissions";

// Lê um query param da URL (ex.: ?contactId=123 abre o modal de agendamento)
function getUrlParam(paramName) {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get(paramName);
}

// ===== Calendário (react-big-calendar) =====
const localizer = momentLocalizer(moment);

const calendarMessages = {
  date: "Data",
  time: "Hora",
  event: "Evento",
  allDay: "Dia Todo",
  week: "Semana",
  work_week: "Agendamentos",
  day: "Dia",
  month: "Mês",
  previous: "Anterior",
  next: "Próximo",
  yesterday: "Ontem",
  tomorrow: "Amanhã",
  today: "Hoje",
  agenda: "Agenda",
  noEventsInRange: "Não há agendamentos no período.",
  showMore: (total) => `+${total} mais`,
};

const eventTitleStyle = {
  fontSize: "14px",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
};

// Status → chip tailwind (valores definidos no backend: PENDENTE/ENVIADA/ERRO — ver queues.ts)
const scheduleStatusInfo = (status) => {
  switch ((status || "").toUpperCase()) {
    case "PENDENTE":
      return {
        label: "Pendente",
        cls: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      };
    case "ENVIADA":
      return {
        label: "Enviada",
        cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
      };
    case "ERRO":
      return {
        label: "Erro de envio",
        cls: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      };
    default:
      return {
        label: status || "—",
        cls: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
      };
  }
};

const ScheduleStatusChip = ({ status }) => {
  const st = scheduleStatusInfo(status);
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
      {st.label}
    </span>
  );
};

// Formata datas serializadas (ISO string) no padrão pt-BR curto
const formatScheduleDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : format(d, "dd/MM/yy HH:mm");
};

const reducer = (state, action) => {
  if (action.type === "LOAD_SCHEDULES") {
    const schedules = action.payload;
    const newSchedules = [];

    schedules.forEach((schedule) => {
      const scheduleIndex = state.findIndex((s) => s.id === schedule.id);
      if (scheduleIndex !== -1) {
        state[scheduleIndex] = schedule;
      } else {
        newSchedules.push(schedule);
      }
    });

    return [...state, ...newSchedules];
  }

  if (action.type === "UPDATE_SCHEDULES") {
    const schedule = action.payload;
    const scheduleIndex = state.findIndex((s) => s.id === schedule.id);

    if (scheduleIndex !== -1) {
      state[scheduleIndex] = schedule;
      return [...state];
    } else {
      return [schedule, ...state];
    }
  }

  if (action.type === "DELETE_SCHEDULE") {
    const scheduleId = action.payload;

    const scheduleIndex = state.findIndex((s) => s.id === scheduleId);
    if (scheduleIndex !== -1) {
      state.splice(scheduleIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

// ===== Estilos no padrão do gerenciador de Conexões (SPEC-LAYOUT-PADRAO) =====
const useStyles = makeStyles((theme) => ({
  paper: {
    flex: 1,
    padding: 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
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
  // Área rolável da lista — o infinite scroll (hasMore/pageNumber) dispara aqui,
  // mantendo cabeçalho e toolbar fixos no topo do Paper
  listScroll: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    ...theme.scrollbarStyles,
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
    position: "sticky",
    top: 0,
    zIndex: 1,
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
  loadingMore: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(2),
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
  // Área do calendário dentro do container rolável
  calendarWrapper: {
    padding: theme.spacing(1, 2, 2),
    height: "100%",
    minHeight: 420,
    "& .rbc-calendar": {
      height: "100%",
      minHeight: 420,
    },
  },
  // Cores da toolbar do react-big-calendar conforme o tema (claro/escuro)
  calendarToolbar: {
    "& .rbc-toolbar-label": {
      color: theme.palette.text.primary,
      fontWeight: 600,
    },
    "& .rbc-btn-group button": {
      color: theme.palette.text.secondary,
      "&.rbc-active": {
        color: theme.palette.text.primary,
      },
    },
    "& .rbc-header, & .rbc-date-cell, & .rbc-agenda-date-cell, & .rbc-agenda-time-cell": {
      color: theme.palette.text.secondary,
    },
    "& .rbc-today": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.08)"
          : "rgba(25,118,210,0.08)",
    },
    "& .rbc-off-range-bg": {
      backgroundColor:
        theme.palette.type === "dark"
          ? "rgba(255,255,255,0.02)"
          : "rgba(0,0,0,0.03)",
    },
    "& .rbc-month-view, & .rbc-time-view, & .rbc-agenda-view": {
      borderColor: theme.palette.divider,
    },
    "& .rbc-day-bg, & .rbc-time-slot, & .rbc-timeslot-group": {
      borderColor: theme.palette.divider,
    },
  },
}));

const Schedules = () => {
  const classes = useStyles();
  const theme = useTheme();
  const history = useHistory();

  const { user, socket } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [deletingSchedule, setDeletingSchedule] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  // Visão padrão: calendário (o usuário pode alternar para a lista)
  const [viewMode, setViewMode] = useState("calendar");
  const [schedules, dispatch] = useReducer(reducer, []);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [contactId, setContactId] = useState(+getUrlParam("contactId"));

  const { getPlanCompany } = usePlans();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("schedules.create");
  const canEdit = hasPermission("schedules.edit");
  const canDelete = hasPermission("schedules.delete");

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useSchedules) {
        toast.error("Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando.");
        setTimeout(() => {
          history.push(`/`)
        }, 1000);
      }
    }
    fetchData();
  }, [user, history, getPlanCompany]);

  const fetchSchedules = useCallback(async () => {
    try {
      const { data } = await api.get("/schedules", {
        params: { searchParam, pageNumber },
      });

      dispatch({ type: "LOAD_SCHEDULES", payload: data.schedules });
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (err) {
      // 403 = sem permissão schedules.view (admin)
      // Silencia o erro, lista de agendamentos fica vazia
      if (err?.response?.status !== 403) {
        toastError(err);
      }
      setLoading(false);
    }
  }, [searchParam, pageNumber]);

  const handleOpenScheduleModalFromContactId = useCallback(() => {
    if (contactId) {
      handleOpenScheduleModal();
    }
  }, [contactId]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchSchedules();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [
    searchParam,
    pageNumber,
    contactId,
    fetchSchedules,
    handleOpenScheduleModalFromContactId,
  ]);

  useEffect(() => {
    // Atualização em tempo real via socket (create/update/delete de agendamentos)
    const onCompanySchedule = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_SCHEDULES", payload: data.schedule });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_SCHEDULE", payload: +data.scheduleId });
      }
    }

    socket.on(`company${user.companyId}-schedule`, onCompanySchedule)

    return () => {
      socket.off(`company${user.companyId}-schedule`, onCompanySchedule)
    };
  }, [socket, user.companyId]);

  const cleanContact = () => {
    setContactId("");
  };

  const handleOpenScheduleModal = () => {
    setSelectedSchedule(null);
    setScheduleModalOpen(true);
  };

  const handleCloseScheduleModal = () => {
    setSelectedSchedule(null);
    setScheduleModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditSchedule = (schedule) => {
    setSelectedSchedule(schedule);
    setScheduleModalOpen(true);
  };

  // Abre o modal de confirmação antes de excluir (o modal chama handleDeleteSchedule)
  const handleConfirmDeleteSchedule = (schedule) => {
    setDeletingSchedule(schedule);
    setConfirmModalOpen(true);
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      await api.delete(`/schedules/${scheduleId}`);
      toast.success(i18n.t("schedules.toasts.deleted"));
    } catch (err) {
      // 403 = sem permissão schedules.delete (admin)
      // Silencia o erro
      if (err?.response?.status !== 403) {
        toastError(err);
      }
    }
    setDeletingSchedule(null);
    setSearchParam("");
    setPageNumber(1);

    dispatch({ type: "RESET" });
    setPageNumber(1);
    await fetchSchedules();
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  // Infinite scroll: ao chegar perto do fim da lista rolável, carrega a próxima página
  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  // Trunca texto longo para exibição na coluna "Mensagem" (null-safe)
  const truncate = (str, len) => {
    if (!str) return "";
    if (str.length > len) {
      return str.substring(0, len) + "...";
    }
    return str;
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingSchedule &&
          `${i18n.t("schedules.confirmationModal.deleteTitle")}`
        }
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={() => handleDeleteSchedule(deletingSchedule.id)}
      >
        {i18n.t("schedules.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      {scheduleModalOpen && (
        <ScheduleModal
          open={scheduleModalOpen}
          onClose={handleCloseScheduleModal}
          reload={fetchSchedules}
          scheduleId={
            selectedSchedule ? selectedSchedule.id : null
          }
          contactId={contactId}
          cleanContact={cleanContact}
        />
      )}
      {!hasPermission("schedules.view") ? (
        <ForbiddenPage />
      ) : (
        <Paper className={classes.paper} variant="outlined">
          {/* Cabeçalho: título + subtítulo + ação primária */}
          <div className={classes.header}>
            <div className={classes.headerText}>
              <Title>{i18n.t("schedules.title")} ({schedules.length})</Title>
              <span className={classes.subtitle}>
                Programe o envio de mensagens para os contatos e acompanhe o status de cada agendamento.
              </span>
            </div>
            <div className={classes.headerActions}>
              {canCreate && (
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<AddIcon size={16} />}
                  style={{ minHeight: 36 }}
                  onClick={handleOpenScheduleModal}
                >
                  {i18n.t("schedules.buttons.add")}
                </Button>
              )}
            </div>
          </div>

          {/* Toolbar: busca server-side (mesmo searchParam/handler) + alternância Calendário/Lista */}
          <div className={classes.toolbar}>
            <TextField
              className={classes.searchField}
              size="small"
              variant="outlined"
              placeholder={i18n.t("contacts.searchPlaceholder")}
              value={searchParam}
              onChange={handleSearch}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon size={16} />
                  </InputAdornment>
                ),
              }}
            />
            <Box display="flex" alignItems="center" style={{ gap: 4, marginLeft: "auto" }}>
              <Tooltip title="Calendário">
                <IconButton
                  size="small"
                  color={viewMode === "calendar" ? "primary" : "default"}
                  onClick={() => setViewMode("calendar")}
                >
                  <CalendarViewIcon size={18} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Lista">
                <IconButton
                  size="small"
                  color={viewMode === "list" ? "primary" : "default"}
                  onClick={() => setViewMode("list")}
                >
                  <ListViewIcon size={18} />
                </IconButton>
              </Tooltip>
            </Box>
          </div>

          {/* Conteúdo rolável — o onScroll do infinite scroll fica neste container */}
          <div className={classes.listScroll} onScroll={handleScroll}>
            {viewMode === "calendar" ? (
              loading && schedules.length === 0 ? (
                <Table size="small">
                  <TableBody>
                    <TableRowSkeleton columns={6} />
                  </TableBody>
                </Table>
              ) : (
                <div className={`${classes.calendarWrapper} ${classes.calendarToolbar}`}>
                  <Calendar
                    messages={calendarMessages}
                    culture="pt-br"
                    formats={{
                      agendaDateFormat: "DD/MM ddd",
                      // "ddd" (seg/ter/…) mantém o cabeçalho do mês legível em 375px;
                      // "dddd" ("segunda-feira") era cortado nas colunas de ~46px
                      weekdayFormat: "ddd",
                    }}
                    localizer={localizer}
                    events={schedules.map((schedule) => ({
                      title: (
                        <div key={schedule.id} className="event-container">
                          <div style={eventTitleStyle}>
                            {schedule?.contact?.name}
                          </div>
                          {canDelete && (
                            <DeleteIcon
                              size={14}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmDeleteSchedule(schedule);
                              }}
                              className="delete-icon"
                            />
                          )}
                          {canEdit && (
                            <EditIcon
                              size={14}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditSchedule(schedule);
                              }}
                              className="edit-icon"
                            />
                          )}
                        </div>
                      ),
                      start: new Date(schedule.sendAt),
                      end: new Date(schedule.sendAt),
                    }))}
                    startAccessor="start"
                    endAccessor="end"
                  />
                </div>
              )
            ) : loading && schedules.length === 0 ? (
              <Table size="small">
                <TableBody>
                  <TableRowSkeleton columns={6} />
                </TableBody>
              </Table>
            ) : schedules.length === 0 ? (
              <div className={classes.emptyState}>
                <ScheduleIcon size={44} style={{ color: theme.palette.text.disabled }} />
                <div>Nenhum agendamento encontrado.</div>
              </div>
            ) : (
              <>
                {/* Cards — mobile */}
                <div className={classes.mobileList}>
                  {schedules.map((schedule) => (
                    <div key={schedule.id} className={classes.card}>
                      <div className={classes.cardHeader}>
                        <div className={classes.cardTitle}>
                          <div style={{ minWidth: 0 }}>
                            <div className={classes.cardName} title={schedule.contact?.name}>
                              {schedule.contact?.name || "—"}
                            </div>
                          </div>
                        </div>
                        <ScheduleStatusChip status={schedule.status} />
                      </div>

                      <div className={classes.cardMeta}>
                        <div>
                          <div className={classes.metaLabel}>
                            {i18n.t("schedules.table.body")}
                          </div>
                          <div className={classes.metaValue}>
                            {schedule.body ? truncate(schedule.body, 80) : "—"}
                          </div>
                        </div>
                        <div>
                          <div className={classes.metaLabel}>
                            {i18n.t("schedules.table.sendAt")}
                          </div>
                          <div className={classes.metaValue}>
                            {formatScheduleDate(schedule.sendAt)}
                          </div>
                        </div>
                        <div>
                          <div className={classes.metaLabel}>
                            {i18n.t("schedules.table.sentAt")}
                          </div>
                          <div className={classes.metaValue}>
                            {formatScheduleDate(schedule.sentAt)}
                          </div>
                        </div>
                      </div>

                      <div className={classes.cardActions}>
                        {canEdit && (
                          <Tooltip title={i18n.t("schedules.table.actions")}>
                            <IconButton
                              size="small"
                              className={classes.actionButton}
                              onClick={() => handleEditSchedule(schedule)}
                            >
                              <EditIcon size={18} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canDelete && (
                          <Tooltip title={i18n.t("schedules.confirmationModal.deleteTitle")}>
                            <IconButton
                              size="small"
                              className={classes.actionButton}
                              onClick={() => handleConfirmDeleteSchedule(schedule)}
                            >
                              <DeleteIcon size={18} />
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
                        <TableCell align="center" className={classes.headCell}>
                          {i18n.t("schedules.table.contact")}
                        </TableCell>
                        <TableCell align="center" className={classes.headCell}>
                          {i18n.t("schedules.table.body")}
                        </TableCell>
                        <TableCell align="center" className={classes.headCell}>
                          {i18n.t("schedules.table.sendAt")}
                        </TableCell>
                        <TableCell align="center" className={classes.headCell}>
                          {i18n.t("schedules.table.sentAt")}
                        </TableCell>
                        <TableCell align="center" className={classes.headCell}>
                          {i18n.t("schedules.table.status")}
                        </TableCell>
                        <TableCell align="center" className={classes.headCell}>
                          {i18n.t("schedules.table.actions")}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {schedules.map((schedule) => (
                        <TableRow key={schedule.id} className={classes.rowHover}>
                          <TableCell align="center" className={classes.bodyCell}>
                            {schedule.contact?.name || "—"}
                          </TableCell>
                          <TableCell align="center" className={classes.bodyCell}>
                            <Tooltip title={schedule.body || ""}>
                              <span>{schedule.body ? truncate(schedule.body, 60) : "—"}</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="center" className={classes.bodyCell}>
                            {formatScheduleDate(schedule.sendAt)}
                          </TableCell>
                          <TableCell align="center" className={classes.bodyCell}>
                            {formatScheduleDate(schedule.sentAt)}
                          </TableCell>
                          <TableCell align="center" className={classes.bodyCell}>
                            <ScheduleStatusChip status={schedule.status} />
                          </TableCell>
                          <TableCell
                            align="center"
                            className={`${classes.bodyCell} ${classes.actionsCell}`}
                          >
                            <Box display="flex" alignItems="center" justifyContent="center">
                              {canEdit && (
                                <Tooltip title={i18n.t("schedules.table.actions")}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditSchedule(schedule)}
                                  >
                                    <EditIcon size={18} />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {canDelete && (
                                <Tooltip title={i18n.t("schedules.confirmationModal.deleteTitle")}>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleConfirmDeleteSchedule(schedule)}
                                  >
                                    <DeleteIcon size={18} />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Indicador de "carregando mais" — paginação server-side via scroll */}
                {loading && (
                  <div className={classes.loadingMore}>
                    <CircularProgress size={22} />
                  </div>
                )}
              </>
            )}
          </div>
        </Paper>
      )}
    </MainContainer>
  );
};

export default Schedules;
