import React, { useEffect, useState, useContext } from "react";
import { useParams, useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  Grid,
  Chip,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Tooltip,
  IconButton,
  Card,
  CardContent,
  Box,
  LinearProgress
} from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import RefreshIcon from "@material-ui/icons/Refresh";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import ErrorIcon from "@material-ui/icons/Error";
import HourglassEmptyIcon from "@material-ui/icons/HourglassEmpty";
import BlockIcon from "@material-ui/icons/Block";
import SyncIcon from "@material-ui/icons/Sync";
import TrendingUpIcon from "@material-ui/icons/TrendingUp";
import TrendingDownIcon from "@material-ui/icons/TrendingDown";
import AssessmentIcon from "@material-ui/icons/Assessment";
import PlayCircleOutlineIcon from "@material-ui/icons/PlayCircleOutline";
import PauseCircleOutlineIcon from "@material-ui/icons/PauseCircleOutline";
import StopIcon from "@material-ui/icons/Stop";
import ScheduleIcon from "@material-ui/icons/Schedule";
import SpeedIcon from "@material-ui/icons/Speed";
import { toast } from "react-toastify";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, LineChart, Line } from "recharts";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { useDate } from "../../hooks/useDate";
import { AuthContext } from "../../context/Auth/AuthContext";
import TableRowSkeleton from "../../components/TableRowSkeleton";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    width: "100%",
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  dashboardCard: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    transition: "transform 0.2s, box-shadow 0.2s",
    "&:hover": {
      transform: "translateY(-4px)",
      boxShadow: theme.shadows[8],
    },
  },
  metricCard: {
    padding: theme.spacing(2),
    borderRadius: theme.spacing(1),
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    color: "#fff",
    height: "100%",
  },
  metricValue: {
    fontSize: "2.5rem",
    fontWeight: "bold",
    marginTop: theme.spacing(1),
  },
  metricLabel: {
    fontSize: "0.875rem",
    opacity: 0.9,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  chartCard: {
    padding: theme.spacing(2),
    height: "100%",
  },
  statusChip: {
    margin: theme.spacing(0.5),
  },
  tableWrapper: {
    width: "100%",
    overflowX: "auto",
    marginTop: theme.spacing(2),
  },
  errorCell: {
    maxWidth: 300,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    marginTop: theme.spacing(1),
  },
  sectionTitle: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(2),
    fontWeight: 600,
  },
}));

const CampaignDetailedReport = () => {
  const classes = useStyles();
  const history = useHistory();
  const { campaignId } = useParams();
  const { datetimeToClient } = useDate();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [searchParam, setSearchParam] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pageNumber, setPageNumber] = useState(1);

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, statusFilter, searchParam, pageNumber]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      console.log('[DETAILED REPORT] Buscando relatório da campanha:', campaignId);
      const { data } = await api.get(`/campaigns/${campaignId}/detailed-report`, {
        params: {
          status: statusFilter || undefined,
          search: searchParam || undefined,
          pageNumber
        }
      });
      console.log('[DETAILED REPORT] Dados recebidos:', data);
      setReport(data);
    } catch (err) {
      console.error('[DETAILED REPORT] Erro ao buscar:', err);
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "delivered":
        return <CheckCircleIcon style={{ color: "#4caf50" }} />;
      case "failed":
        return <ErrorIcon style={{ color: "#f44336" }} />;
      case "suppressed":
        return <BlockIcon style={{ color: "#9e9e9e" }} />;
      case "processing":
        return <SyncIcon style={{ color: "#2196f3" }} />;
      default:
        return <HourglassEmptyIcon style={{ color: "#ff9800" }} />;
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: "Pendente",
      processing: "Processando",
      delivered: "Entregue",
      failed: "Falhou",
      suppressed: "Suprimido"
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "default",
      processing: "primary",
      delivered: "primary",
      failed: "secondary",
      suppressed: "default"
    };
    return colors[status] || "default";
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value);
    setPageNumber(1);
  };

  const handleStatusChange = (event) => {
    setStatusFilter(event.target.value);
    setPageNumber(1);
  };

  const handlePageChange = (newPage) => {
    setPageNumber(newPage);
  };

  if (!report) {
    return (
      <MainContainer>
        <MainHeader>
          <Title>Carregando relatório...</Title>
        </MainHeader>
      </MainContainer>
    );
  }

  const { campaign, summary, records, count, hasMore } = report;

  // Dados para gráficos
  const pieData = [
    { name: "Entregues", value: summary.delivered, color: "#4caf50" },
    { name: "Pendentes", value: summary.pending, color: "#ff9800" },
    { name: "Falharam", value: summary.failed, color: "#f44336" },
    { name: "Processando", value: summary.processing, color: "#2196f3" },
    { name: "Suprimidos", value: summary.suppressed, color: "#9e9e9e" },
  ].filter(item => item.value > 0);

  const successRate = summary.total > 0 ? ((summary.delivered / summary.total) * 100).toFixed(1) : 0;
  const failureRate = summary.total > 0 ? ((summary.failed / summary.total) * 100).toFixed(1) : 0;
  const deliveryProgress = summary.total > 0 ? ((summary.delivered / summary.total) * 100) : 0;

  // Cálculos de tempo
  const calculateElapsedTime = () => {
    if (!campaign.scheduledAt) return "N/A";
    const start = new Date(campaign.scheduledAt);
    const end = campaign.completedAt ? new Date(campaign.completedAt) : new Date();
    const diffMs = end - start;
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${minutes}min`;
  };

  const calculateEstimatedTime = () => {
    if (summary.delivered === 0 || !campaign.scheduledAt) return "Calculando...";
    const start = new Date(campaign.scheduledAt);
    const now = new Date();
    const elapsedMs = now - start;
    const rate = summary.delivered / (elapsedMs / 1000); // msgs por segundo
    const remaining = summary.total - summary.delivered;
    const estimatedSeconds = remaining / rate;
    const hours = Math.floor(estimatedSeconds / 3600);
    const minutes = Math.floor((estimatedSeconds % 3600) / 60);
    return `${hours}h ${minutes}min`;
  };

  const calculateSendingRate = () => {
    if (!campaign.scheduledAt || summary.delivered === 0) return "0";
    const start = new Date(campaign.scheduledAt);
    const now = new Date();
    const elapsedMinutes = (now - start) / 60000;
    const rate = summary.delivered / elapsedMinutes;
    return rate.toFixed(1);
  };

  const handleCampaignAction = async (action) => {
    try {
      if (action === "cancel") {
        await api.post(`/campaigns/${campaignId}/cancel`);
        toast.success("Campanha pausada com sucesso!");
      } else if (action === "restart") {
        await api.post(`/campaigns/${campaignId}/restart`);
        toast.success("Campanha retomada com sucesso!");
      }
      fetchReport();
    } catch (err) {
      toastError(err);
    }
  };

  const isActive = campaign.status === "EM_ANDAMENTO";
  const isPaused = campaign.status === "CANCELADA";
  const isFinished = campaign.status === "FINALIZADA";

  const statusData = [
    { status: "Entregues", quantidade: summary.delivered },
    { status: "Pendentes", quantidade: summary.pending },
    { status: "Falharam", quantidade: summary.failed },
    { status: "Processando", quantidade: summary.processing },
    { status: "Suprimidos", quantidade: summary.suppressed },
  ];

  return (
    <MainContainer>
      <MainHeader>
        <Grid style={{ width: "99.6%" }} container>
          <Grid xs={12} item>
            <Title>
              Relatório Detalhado - {campaign.name}
              <IconButton size="small" onClick={fetchReport} style={{ marginLeft: 8 }}>
                <RefreshIcon />
              </IconButton>
            </Title>
          </Grid>
        </Grid>
      </MainHeader>

      {/* Dashboard de Métricas */}
      <Grid container spacing={2}>
        {/* Card: Total de Contatos */}
        <Grid item xs={12} sm={6} md={3}>
          <Card className={classes.dashboardCard} style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography className={classes.metricLabel} style={{ color: "#fff" }}>
                    Total de Contatos
                  </Typography>
                  <Typography className={classes.metricValue} style={{ color: "#fff" }}>
                    {summary.total}
                  </Typography>
                </Box>
                <AssessmentIcon style={{ fontSize: 48, opacity: 0.3, color: "#fff" }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Card: Entregues */}
        <Grid item xs={12} sm={6} md={3}>
          <Card className={classes.dashboardCard} style={{ background: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)" }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography className={classes.metricLabel} style={{ color: "#fff" }}>
                    Entregues
                  </Typography>
                  <Typography className={classes.metricValue} style={{ color: "#fff" }}>
                    {summary.delivered}
                  </Typography>
                  <Box display="flex" alignItems="center" mt={1}>
                    <TrendingUpIcon style={{ fontSize: 16, marginRight: 4, color: "#fff" }} />
                    <Typography variant="body2" style={{ color: "#fff" }}>{successRate}%</Typography>
                  </Box>
                </Box>
                <CheckCircleIcon style={{ fontSize: 48, opacity: 0.3, color: "#fff" }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Card: Pendentes */}
        <Grid item xs={12} sm={6} md={3}>
          <Card className={classes.dashboardCard} style={{ background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography className={classes.metricLabel} style={{ color: "#fff" }}>
                    Pendentes
                  </Typography>
                  <Typography className={classes.metricValue} style={{ color: "#fff" }}>
                    {summary.pending}
                  </Typography>
                </Box>
                <HourglassEmptyIcon style={{ fontSize: 48, opacity: 0.3, color: "#fff" }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Card: Falharam */}
        <Grid item xs={12} sm={6} md={3}>
          <Card className={classes.dashboardCard} style={{ background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)" }}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography className={classes.metricLabel} style={{ color: "#fff" }}>
                    Falharam
                  </Typography>
                  <Typography className={classes.metricValue} style={{ color: "#fff" }}>
                    {summary.failed}
                  </Typography>
                  <Box display="flex" alignItems="center" mt={1}>
                    <TrendingDownIcon style={{ fontSize: 16, marginRight: 4, color: "#fff" }} />
                    <Typography variant="body2" style={{ color: "#fff" }}>{failureRate}%</Typography>
                  </Box>
                </Box>
                <ErrorIcon style={{ fontSize: 48, opacity: 0.3, color: "#fff" }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Progresso de Entrega */}
      <Paper style={{ padding: 20, marginTop: 16 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6">
            Progresso de Entrega
          </Typography>
          {!isFinished && (
            <Box display="flex" gap={1}>
              {isPaused ? (
                <Tooltip title="Retomar Campanha">
                  <IconButton
                    color="primary"
                    onClick={() => handleCampaignAction("restart")}
                    size="small"
                  >
                    <PlayCircleOutlineIcon />
                  </IconButton>
                </Tooltip>
              ) : isActive ? (
                <Tooltip title="Pausar Campanha">
                  <IconButton
                    color="secondary"
                    onClick={() => handleCampaignAction("cancel")}
                    size="small"
                  >
                    <PauseCircleOutlineIcon />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Box>
          )}
        </Box>

        <Grid container spacing={2} style={{ marginBottom: 16 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Box display="flex" alignItems="center" mb={1}>
              <ScheduleIcon style={{ marginRight: 8, color: "#2196f3" }} />
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Tempo Decorrido
                </Typography>
                <Typography variant="body1" style={{ fontWeight: 600 }}>
                  {calculateElapsedTime()}
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box display="flex" alignItems="center" mb={1}>
              <ScheduleIcon style={{ marginRight: 8, color: "#ff9800" }} />
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Tempo Estimado Restante
                </Typography>
                <Typography variant="body1" style={{ fontWeight: 600 }}>
                  {isFinished ? "Finalizado" : calculateEstimatedTime()}
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box display="flex" alignItems="center" mb={1}>
              <SpeedIcon style={{ marginRight: 8, color: "#4caf50" }} />
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Velocidade de Envio
                </Typography>
                <Typography variant="body1" style={{ fontWeight: 600 }}>
                  {calculateSendingRate()} msgs/min
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box display="flex" alignItems="center" mb={1}>
              <AssessmentIcon style={{ marginRight: 8, color: "#9c27b0" }} />
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Taxa de Sucesso
                </Typography>
                <Typography variant="body1" style={{ fontWeight: 600, color: "#4caf50" }}>
                  {successRate}%
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="body2" color="textSecondary">
            {summary.delivered} de {summary.total} mensagens entregues
          </Typography>
          <Typography variant="h6" color="primary">
            {deliveryProgress.toFixed(1)}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={deliveryProgress}
          className={classes.progressBar}
          style={{ backgroundColor: "#e0e0e0" }}
        />
      </Paper>

      {/* Gráficos */}
      <Grid container spacing={2} style={{ marginTop: 8 }}>
        {/* Gráfico de Pizza */}
        <Grid item xs={12} md={6}>
          <Card className={classes.dashboardCard}>
            <CardContent className={classes.chartCard}>
              <Typography variant="h6" gutterBottom>
                Distribuição por Status
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Gráfico de Barras */}
        <Grid item xs={12} md={6}>
          <Card className={classes.dashboardCard}>
            <CardContent className={classes.chartCard}>
              <Typography variant="h6" gutterBottom>
                Quantidade por Status
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="quantidade" fill="#8884d8">
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={pieData[index]?.color || "#8884d8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Chips de Status Adicional */}
      {campaign.confirmation && (
        <Paper style={{ padding: 16, marginTop: 16 }}>
          <Typography variant="h6" gutterBottom>
            Confirmações
          </Typography>
          <Box>
            <Chip
              label={`Confirmações Solicitadas: ${summary.confirmationRequested}`}
              className={classes.statusChip}
              color="primary"
              icon={<CheckCircleIcon />}
            />
            <Chip
              label={`Confirmados: ${summary.confirmed}`}
              className={classes.statusChip}
              color="primary"
              icon={<CheckCircleIcon />}
            />
          </Box>
        </Paper>
      )}

      {/* Seção de Detalhes */}
      <Typography variant="h5" className={classes.sectionTitle}>
        Detalhes dos Envios
      </Typography>
      
      <Paper className={classes.mainPaper} variant="outlined">
        <Grid container spacing={2} style={{ marginBottom: 16 }} alignItems="flex-end">
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              placeholder="Buscar por número ou mensagem"
              type="search"
              value={searchParam}
              onChange={handleSearch}
              variant="outlined"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon style={{ color: "gray" }} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth variant="outlined">
              <InputLabel>Filtrar por Status</InputLabel>
              <Select value={statusFilter} onChange={handleStatusChange} label="Filtrar por Status">
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="pending">Pendente</MenuItem>
                <MenuItem value="processing">Processando</MenuItem>
                <MenuItem value="delivered">Entregue</MenuItem>
                <MenuItem value="failed">Falhou</MenuItem>
                <MenuItem value="suppressed">Suprimido</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Tabela */}
        <div className={classes.tableWrapper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>Contato</TableCell>
                <TableCell>Número</TableCell>
                <TableCell>Tentativas</TableCell>
                <TableCell>Data de Envio</TableCell>
                <TableCell>Último Erro</TableCell>
                <TableCell>Data do Erro</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRowSkeleton columns={7} />
              ) : (
                records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Tooltip title={getStatusLabel(record.status)}>
                        <Chip
                          icon={getStatusIcon(record.status)}
                          label={getStatusLabel(record.status)}
                          size="small"
                          color={getStatusColor(record.status)}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell>{record.contact?.name || "-"}</TableCell>
                    <TableCell>{record.number}</TableCell>
                    <TableCell>
                      {record.attempts > 0 ? (
                        <Chip
                          label={record.attempts}
                          size="small"
                          color={record.attempts >= 3 ? "secondary" : "default"}
                        />
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {record.deliveredAt ? datetimeToClient(record.deliveredAt) : "-"}
                    </TableCell>
                    <TableCell>
                      {record.lastError ? (
                        <Tooltip title={record.lastError}>
                          <span className={classes.errorCell}>{record.lastError}</span>
                        </Tooltip>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {record.lastErrorAt ? datetimeToClient(record.lastErrorAt) : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          <Button
            disabled={pageNumber === 1}
            onClick={() => handlePageChange(pageNumber - 1)}
          >
            Anterior
          </Button>
          <Typography>
            Página {pageNumber} - Mostrando {records.length} de {count} registros
          </Typography>
          <Button
            disabled={!hasMore}
            onClick={() => handlePageChange(pageNumber + 1)}
          >
            Próxima
          </Button>
        </div>
      </Paper>
    </MainContainer>
  );
};

export default CampaignDetailedReport;
