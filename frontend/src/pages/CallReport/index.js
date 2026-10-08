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
  Phone as PhoneIcon,
  PhoneCall as AnsweredIcon,
  PhoneMissed as MissedIcon,
  PhoneIncoming as InIcon,
  PhoneOutgoing as OutIcon,
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

// ===== Estilos no padrão SPEC-LAYOUT-PADRAO (referência: pages/ClosingReport) =====
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
  // Pílula de status/direção colorida (sem depender de MuiChip para manter o bento)
  directionCell: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  },
}));

// Formata duração em segundos para exibição (ex.: "1h 5m", "42s")
const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return "-";
  }
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

const formatDateTime = (value) =>
  value ? moment(value).format("DD/MM/YYYY HH:mm") : "-";

// Cor semântica do status da chamada
const STATUS_COLORS = {
  answered: "#26c281",
  missed: "#e7505a",
  rejected: "#f39c12",
  failed: "#8e44ad",
};

const CallReport = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [callLogs, setCallLogs] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    answered: 0,
    missed: 0,
    avgDurationSeconds: null,
  });

  // Filtros
  const [startDate, setStartDate] = useState(
    moment().startOf("month").format("YYYY-MM-DD")
  );
  const [endDate, setEndDate] = useState(moment().format("YYYY-MM-DD"));
  const [userId, setUserId] = useState("");
  const [direction, setDirection] = useState("");
  const [status, setStatus] = useState("");

  // Opções do select de atendentes
  const [users, setUsers] = useState([]);

  const reducedMotion = useReducedMotion();
  const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

  // Carrega atendentes uma única vez para o filtro
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const { data } = await api.get("/users/list");
        setUsers(Array.isArray(data) ? data : []);
      } catch (err) {
        // 403 = sem permissão users.view — select fica apenas com "Todos"
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
      direction: direction || undefined,
      status: status || undefined,
      page,
      pageSize: size,
    }),
    [startDate, endDate, userId, direction, status]
  );

  const fetchReport = useCallback(
    async (page) => {
      setLoading(true);
      try {
        const { data } = await api.get("/call-logs", {
          params: buildParams(page, pageSize),
        });
        setCallLogs(data.callLogs || []);
        setTotalCount(data.count || 0);
        setSummary(
          data.summary || {
            total: 0,
            answered: 0,
            missed: 0,
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
      const response = await api.get("/call-logs/export", {
        params: buildParams(1, undefined),
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `relatorio-chamadas-${Date.now()}.csv`);
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

  const directionLabel = (value) => {
    const key = `callReport.directionLabels.${value}`;
    const translated = i18n.t(key);
    return translated === key ? value : translated;
  };

  const statusLabel = (value) => {
    const key = `callReport.statusLabels.${value}`;
    const translated = i18n.t(key);
    return translated === key ? value : translated;
  };

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
            label={i18n.t("callReport.cards.total")}
            value={summary.total}
            icon={<PhoneIcon size={20} />}
            accent="var(--primary-color)"
            loading={loading}
          />
          <StatCard
            label={i18n.t("callReport.cards.answered")}
            value={summary.answered}
            icon={<AnsweredIcon size={20} />}
            accent="#26c281"
            loading={loading}
          />
          <StatCard
            label={i18n.t("callReport.cards.missed")}
            value={summary.missed}
            icon={<MissedIcon size={20} />}
            accent="#e7505a"
            loading={loading}
          />
          <StatCard
            label={i18n.t("callReport.cards.avgTime")}
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
                <Title>{i18n.t("callReport.title")}</Title>
                <Typography variant="body2" color="textSecondary">
                  {totalCount > 0
                    ? `${totalCount} ${i18n.t("callReport.foundSuffix")}`
                    : i18n.t("callReport.subtitle")}
                </Typography>
              </div>
              <div className={classes.headerActions}>
                <Tooltip title={i18n.t("callReport.buttons.exportCsv")}>
                  <IconButton
                    onClick={handleExportCsv}
                    aria-label={i18n.t("callReport.buttons.exportCsv")}
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
                  {i18n.t("callReport.buttons.filter")}
                </Button>
              </div>
            </div>

            {/* Filtros */}
            <div className={classes.mainPaperFilter}>
              <div style={{ paddingTop: "15px" }} />
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label={i18n.t("callReport.filters.startDate")}
                    type="date"
                    value={startDate}
                    variant="outlined"
                    fullWidth
                    size="small"
                    onChange={(e) => setStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    label={i18n.t("callReport.filters.endDate")}
                    type="date"
                    value={endDate}
                    variant="outlined"
                    fullWidth
                    size="small"
                    onChange={(e) => setEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={4} md={2}>
                  <FormControl variant="outlined" size="small" fullWidth>
                    <InputLabel id="call-report-user-label">
                      {i18n.t("callReport.filters.user")}
                    </InputLabel>
                    <Select
                      labelId="call-report-user-label"
                      label={i18n.t("callReport.filters.user")}
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                    >
                      <MenuItem value="">
                        {i18n.t("callReport.filters.all")}
                      </MenuItem>
                      {users.map((u) => (
                        <MenuItem key={u.id} value={u.id}>
                          {u.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4} md={2}>
                  <FormControl variant="outlined" size="small" fullWidth>
                    <InputLabel id="call-report-direction-label">
                      {i18n.t("callReport.filters.direction")}
                    </InputLabel>
                    <Select
                      labelId="call-report-direction-label"
                      label={i18n.t("callReport.filters.direction")}
                      value={direction}
                      onChange={(e) => setDirection(e.target.value)}
                    >
                      <MenuItem value="">
                        {i18n.t("callReport.filters.all")}
                      </MenuItem>
                      <MenuItem value="in">
                        {i18n.t("callReport.directionLabels.in")}
                      </MenuItem>
                      <MenuItem value="out">
                        {i18n.t("callReport.directionLabels.out")}
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4} md={2}>
                  <FormControl variant="outlined" size="small" fullWidth>
                    <InputLabel id="call-report-status-label">
                      {i18n.t("callReport.filters.status")}
                    </InputLabel>
                    <Select
                      labelId="call-report-status-label"
                      label={i18n.t("callReport.filters.status")}
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <MenuItem value="">
                        {i18n.t("callReport.filters.all")}
                      </MenuItem>
                      <MenuItem value="answered">
                        {i18n.t("callReport.statusLabels.answered")}
                      </MenuItem>
                      <MenuItem value="missed">
                        {i18n.t("callReport.statusLabels.missed")}
                      </MenuItem>
                      <MenuItem value="rejected">
                        {i18n.t("callReport.statusLabels.rejected")}
                      </MenuItem>
                      <MenuItem value="failed">
                        {i18n.t("callReport.statusLabels.failed")}
                      </MenuItem>
                    </Select>
                  </FormControl>
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
                      {i18n.t("callReport.table.number")}
                    </TableCell>
                    <TableCell align="left">
                      {i18n.t("callReport.table.contact")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("callReport.table.direction")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("callReport.table.status")}
                    </TableCell>
                    <TableCell align="left">
                      {i18n.t("callReport.table.user")}
                    </TableCell>
                    <TableCell align="left">
                      {i18n.t("callReport.table.whatsapp")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("callReport.table.start")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("callReport.table.end")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("callReport.table.duration")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("callReport.table.provider")}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRowSkeleton columns={10} />
                  ) : (
                    <>
                      {callLogs.map((call) => (
                        <TableRow key={call.id}>
                          <TableCell
                            align="left"
                            style={{ fontFamily: "monospace", fontSize: 12 }}
                          >
                            {call.number}
                          </TableCell>
                          <TableCell align="left">
                            {call.contactName || "-"}
                          </TableCell>
                          <TableCell align="center">
                            <span className={classes.directionCell}>
                              {call.direction === "in" ? (
                                <InIcon size={14} color="#3598dc" />
                              ) : (
                                <OutIcon size={14} color="#26c281" />
                              )}
                              {directionLabel(call.direction)}
                            </span>
                          </TableCell>
                          <TableCell
                            align="center"
                            style={{
                              color:
                                STATUS_COLORS[call.status] || "inherit",
                              fontWeight: 500,
                            }}
                          >
                            {statusLabel(call.status)}
                          </TableCell>
                          <TableCell align="left">
                            {call.userName || "-"}
                          </TableCell>
                          <TableCell align="left">
                            {call.whatsappName || "-"}
                          </TableCell>
                          <TableCell align="center">
                            {formatDateTime(call.startedAt)}
                          </TableCell>
                          <TableCell align="center">
                            {formatDateTime(call.endedAt)}
                          </TableCell>
                          <TableCell align="center">
                            {formatDuration(call.durationSeconds)}
                          </TableCell>
                          <TableCell align="center">{call.provider}</TableCell>
                        </TableRow>
                      ))}
                      {!loading && callLogs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} align="center">
                            {i18n.t("callReport.empty")}
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

export default CallReport;
