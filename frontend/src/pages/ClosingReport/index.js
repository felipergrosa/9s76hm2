import React, { useState, useEffect, useMemo, useCallback } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Pagination from "@material-ui/lab/Pagination";
import {
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import { SaveAlt } from "@material-ui/icons";
import {
  Ticket as TicketIcon,
  CheckCircle2 as DoneIcon,
  Clock as PendingIcon,
  Timer as AvgIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import moment from "moment";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import { i18n } from "../../translate/i18n";
import Title from "../../components/Title";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import StatCard from "../../components/bento/StatCard";
import {
  bentoContainer,
  bentoItem,
  bentoItemReduced,
} from "../../components/bento/motionPresets";
import "../../components/bento/bento.css";

// ===== Estilos no padrão SPEC-LAYOUT-PADRAO (referência: pages/Reports) =====
const useStyles = makeStyles((theme) => ({
  paper: {
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
  mainPaperTable: {
    flex: 1,
  },
  // Tabela tabular: scroll horizontal contido no wrapper
  tableWrapper: {
    overflowX: "auto",
    maxWidth: "100%",
    WebkitOverflowScrolling: "touch",
  },
  mainPaperFilter: {
    padding: theme.spacing(0, 2.5, 2),
  },
  summaryCell: {
    maxWidth: 280,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
}));

// Formata duração em segundos para exibição (ex.: "1d 2h 30m")
const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return "-";
  }
  const total = Math.max(0, Math.round(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatDateTime = (value) =>
  value ? moment(value).format("DD/MM/YYYY HH:mm") : "-";

const ClosingReport = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    closed: 0,
    pending: 0,
    avgDurationSeconds: null,
  });

  // Filtros
  const [startDate, setStartDate] = useState(
    moment().startOf("month").format("YYYY-MM-DD")
  );
  const [endDate, setEndDate] = useState(moment().format("YYYY-MM-DD"));
  const [userId, setUserId] = useState("");
  const [queueId, setQueueId] = useState("");
  const [subject, setSubject] = useState("");

  // Opções dos selects
  const [users, setUsers] = useState([]);
  const [queues, setQueues] = useState([]);

  const reducedMotion = useReducedMotion();
  const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

  // Carrega atendentes e filas uma única vez para os filtros
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const { data } = await api.get("/users/list");
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        // 403 = sem permissão users.view — select fica apenas com "Todos"
        if (err?.response?.status !== 403) toastError(err);
      }
      try {
        const { data } = await api.get("/queue");
        setQueues(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err?.response?.status !== 403) toastError(err);
      }
    };
    fetchOptions();
  }, []);

  const buildParams = useCallback(
    (page, size) => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      userId: userId || undefined,
      queueId: queueId || undefined,
      subject: subject.trim() !== "" ? subject.trim() : undefined,
      page,
      pageSize: size,
    }),
    [startDate, endDate, userId, queueId, subject]
  );

  const fetchReport = useCallback(
    async (page) => {
      setLoading(true);
      try {
        const { data } = await api.get("/closing-report", {
          params: buildParams(page, pageSize),
        });
        setTickets(data.tickets || []);
        setTotalCount(data.count || 0);
        setSummary(
          data.summary || {
            total: 0,
            closed: 0,
            pending: 0,
            avgDurationSeconds: null,
          }
        );
        setPageNumber(page);
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    },
    [buildParams, pageSize]
  );

  // Carga inicial e recarga ao trocar de página
  useEffect(() => {
    fetchReport(pageNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber]);

  const handleFilter = () => {
    if (pageNumber === 1) {
      fetchReport(1);
    } else {
      setPageNumber(1);
    }
  };

  const handleExportCsv = async () => {
    setLoading(true);
    try {
      const response = await api.get("/closing-report/export", {
        params: buildParams(1, undefined),
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `relatorio-fechamento-${Date.now()}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize]
  );

  return (
    <MainContainer useWindowScroll>
      <motion.div
        variants={bentoContainer}
        initial="hidden"
        animate="show"
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          gap: 12,
        }}
      >
        {/* Strip de KPIs — agregados do período filtrado */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard
            label={i18n.t("closingReport.cards.total")}
            value={summary.total}
            icon={<TicketIcon size={20} />}
            accent="var(--primary-color)"
            loading={loading}
          />
          <StatCard
            label={i18n.t("closingReport.cards.closed")}
            value={summary.closed}
            icon={<DoneIcon size={20} />}
            accent="#26c281"
            loading={loading}
          />
          <StatCard
            label={i18n.t("closingReport.cards.pending")}
            value={summary.pending}
            icon={<PendingIcon size={20} />}
            accent="#f39c12"
            loading={loading}
          />
          <StatCard
            label={i18n.t("closingReport.cards.avgTime")}
            value={formatDuration(summary.avgDurationSeconds)}
            icon={<AvgIcon size={20} />}
            accent="#3598dc"
            loading={loading}
          />
        </div>

        <motion.div variants={itemVariant}>
          <Paper className={`${classes.paper} bento-panel`} variant="outlined">
            {/* Cabeçalho: título + contador + ações */}
            <div className={classes.header}>
              <div className={classes.headerText}>
                <Title>{i18n.t("closingReport.title")}</Title>
                <Typography variant="body2" color="textSecondary">
                  {totalCount > 0
                    ? `${totalCount} ${i18n.t("closingReport.foundSuffix")}`
                    : i18n.t("closingReport.subtitle")}
                </Typography>
              </div>
              <div className={classes.headerActions}>
                <Tooltip title={i18n.t("closingReport.buttons.exportCsv")}>
                  <IconButton
                    onClick={handleExportCsv}
                    aria-label={i18n.t("closingReport.buttons.exportCsv")}
                    style={{ minWidth: 44, minHeight: 44 }}
                  >
                    <SaveAlt />
                  </IconButton>
                </Tooltip>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  onClick={handleFilter}
                  style={{ minHeight: 44 }}
                >
                  {i18n.t("closingReport.buttons.filter")}
                </Button>
              </div>
            </div>

            {/* Filtros */}
            <div className={classes.mainPaperFilter}>
              <div style={{ paddingTop: "15px" }} />
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    label={i18n.t("closingReport.filters.startDate")}
                    type="date"
                    value={startDate}
                    variant="outlined"
                    fullWidth
                    size="small"
                    onChange={(e) => setStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={2}>
                  <TextField
                    label={i18n.t("closingReport.filters.endDate")}
                    type="date"
                    value={endDate}
                    variant="outlined"
                    fullWidth
                    size="small"
                    onChange={(e) => setEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl variant="outlined" size="small" fullWidth>
                    <InputLabel id="closing-report-user-label">
                      {i18n.t("closingReport.filters.user")}
                    </InputLabel>
                    <Select
                      labelId="closing-report-user-label"
                      label={i18n.t("closingReport.filters.user")}
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                    >
                      <MenuItem value="">
                        {i18n.t("closingReport.filters.all")}
                      </MenuItem>
                      {users.map((u) => (
                        <MenuItem key={u.id} value={u.id}>
                          {u.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl variant="outlined" size="small" fullWidth>
                    <InputLabel id="closing-report-queue-label">
                      {i18n.t("closingReport.filters.queue")}
                    </InputLabel>
                    <Select
                      labelId="closing-report-queue-label"
                      label={i18n.t("closingReport.filters.queue")}
                      value={queueId}
                      onChange={(e) => setQueueId(e.target.value)}
                    >
                      <MenuItem value="">
                        {i18n.t("closingReport.filters.all")}
                      </MenuItem>
                      {queues.map((q) => (
                        <MenuItem key={q.id} value={q.id}>
                          {q.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={12} md={2}>
                  <TextField
                    label={i18n.t("closingReport.filters.subject")}
                    value={subject}
                    variant="outlined"
                    fullWidth
                    size="small"
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </Grid>
              </Grid>
            </div>
          </Paper>
        </motion.div>

        <motion.div
          variants={itemVariant}
          style={{ display: "flex", flexDirection: "column" }}
        >
          <Paper
            className={`${classes.mainPaperTable} bento-panel`}
            variant="outlined"
          >
            <div className={classes.tableWrapper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell align="left">
                      {i18n.t("closingReport.table.protocol")}
                    </TableCell>
                    <TableCell align="left">
                      {i18n.t("closingReport.table.contact")}
                    </TableCell>
                    <TableCell align="left">
                      {i18n.t("closingReport.table.user")}
                    </TableCell>
                    <TableCell align="left">
                      {i18n.t("closingReport.table.queue")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("closingReport.table.status")}
                    </TableCell>
                    <TableCell align="left">
                      {i18n.t("closingReport.table.subject")}
                    </TableCell>
                    <TableCell align="left">
                      {i18n.t("closingReport.table.summary")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("closingReport.table.dateOpen")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("closingReport.table.dateClose")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("closingReport.table.duration")}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRowSkeleton columns={10} />
                  ) : (
                    <>
                      {tickets.map((ticket) => (
                        <TableRow key={ticket.id}>
                          <TableCell align="left" style={{ fontFamily: "monospace", fontSize: 12 }}>
                            {ticket.protocol}
                          </TableCell>
                          <TableCell align="left">
                            {ticket.contactName}
                            {ticket.contactNumber
                              ? ` (${ticket.contactNumber})`
                              : ""}
                          </TableCell>
                          <TableCell align="left">
                            {ticket.userName || "-"}
                          </TableCell>
                          <TableCell align="left">
                            {ticket.queueName || "-"}
                          </TableCell>
                          <TableCell align="center">{ticket.status}</TableCell>
                          <TableCell align="left">
                            {ticket.closingSubject || "-"}
                          </TableCell>
                          <TableCell
                            align="left"
                            className={classes.summaryCell}
                            title={ticket.closingSummary || ""}
                          >
                            {ticket.closingSummary || "-"}
                          </TableCell>
                          <TableCell align="center">
                            {formatDateTime(ticket.openedAt)}
                          </TableCell>
                          <TableCell align="center">
                            {formatDateTime(ticket.closedAt)}
                          </TableCell>
                          <TableCell align="center">
                            {formatDuration(ticket.durationSeconds)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!loading && tickets.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} align="center">
                            {i18n.t("closingReport.empty")}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
            {totalCount > pageSize && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: 12,
                }}
              >
                <Pagination
                  count={totalPages}
                  page={pageNumber}
                  onChange={(e, page) => setPageNumber(page)}
                  color="primary"
                  size="small"
                />
              </div>
            )}
          </Paper>
        </motion.div>
      </motion.div>
    </MainContainer>
  );
};

export default ClosingReport;
