import React, { useEffect, useState, useContext, useMemo } from "react";
import { useParams, useHistory } from "react-router-dom";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import {
  Paper,
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
  LinearProgress,
  useMediaQuery
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
import MessageIcon from "@material-ui/icons/Message";
import PhoneAndroidIcon from "@material-ui/icons/PhoneAndroid";
import InfoIcon from "@material-ui/icons/Info";
import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import { toast } from "react-toastify";
import Accordion from "@material-ui/core/Accordion";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import AccordionDetails from "@material-ui/core/AccordionDetails";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { useDate } from "../../hooks/useDate";
import { AuthContext } from "../../context/Auth/AuthContext";
import TableRowSkeleton from "../../components/TableRowSkeleton";

const useStyles = makeStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.palette.background.default,
    minHeight: "100%",
    padding: theme.spacing(2),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },
  container: {
    width: "100%",
    padding: theme.spacing(2),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },
  mainPaper: {
    flex: 1,
    width: "100%",
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHead: {
    backgroundColor: theme.palette.grey[100],
    "& th": {
      padding: theme.spacing(1.5),
      textAlign: "left",
      fontSize: "0.75rem",
      fontWeight: 600,
      textTransform: "uppercase",
      color: theme.palette.text.secondary,
      borderBottom: `2px solid ${theme.palette.divider}`,
    },
  },
  tableBody: {
    "& tr": {
      borderBottom: `1px solid ${theme.palette.divider}`,
      transition: "background-color 0.2s",
      "&:hover": {
        backgroundColor: theme.palette.action.hover,
      },
      "&:last-child": {
        borderBottom: "none",
      },
    },
    "& td": {
      padding: theme.spacing(1.5),
      fontSize: "0.875rem",
      color: theme.palette.text.primary,
    },
  },
  emptyState: {
    padding: theme.spacing(4),
    textAlign: "center",
    color: theme.palette.text.secondary,
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
  messageBox: {
    backgroundColor: theme.palette.background.default,
    padding: theme.spacing(2),
    borderRadius: theme.spacing(1),
    marginBottom: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
  },
  messageText: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontFamily: "monospace",
    fontSize: "0.9rem",
  },
  infoCard: {
    padding: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  messageCell: {
    maxWidth: 220,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: "block",
  },
  whatsappUsageCard: {
    padding: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  whatsappUsageRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(1.5),
    borderRadius: theme.spacing(1),
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(1),
    flexWrap: "wrap",
    gap: theme.spacing(1),
  },
  whatsappUsageInfo: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  whatsappUsageStats: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
}));

const CampaignDetailedReport = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up(1200));
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

  const { campaign, summary, records, count, hasMore, whatsappUsage = [] } = report;

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

  // Coleta todas as mensagens configuradas
  const messages = [
    campaign.message1,
    campaign.message2,
    campaign.message3,
    campaign.message4,
    campaign.message5,
  ].filter(msg => msg && msg.trim() !== "");

  const confirmationMessages = campaign.confirmation ? [
    campaign.confirmationMessage1,
    campaign.confirmationMessage2,
    campaign.confirmationMessage3,
    campaign.confirmationMessage4,
    campaign.confirmationMessage5,
  ].filter(msg => msg && msg.trim() !== "") : [];

  // Parse dos números WhatsApp permitidos
  const getWhatsappNumbers = () => {
    if (campaign.dispatchStrategy === "single" && campaign.whatsapp) {
      return [campaign.whatsapp];
    }
    
    if (campaign.dispatchStrategy === "round_robin" && campaign.allowedWhatsappIds) {
      try {
        const ids = JSON.parse(campaign.allowedWhatsappIds);
        // Aqui retornamos apenas os IDs, pois não temos os nomes no momento
        return ids.map(id => ({ id, name: `WhatsApp #${id}` }));
      } catch (e) {
        return [];
      }
    }
    
    return campaign.whatsapp ? [campaign.whatsapp] : [];
  };

  const whatsappNumbers = getWhatsappNumbers();

  const getMessagePreview = (message) => {
    if (!message) return "";
    const normalized = message.replace(/\s+/g, " ").trim();
    return normalized.length > 25 ? `${normalized.slice(0, 25)}...` : normalized;
  };

  const getWhatsappLabel = (usage) => {
    if (usage.name) return usage.name;
    const match = whatsappNumbers.find(item => Number(item.id) === Number(usage.whatsappId));
    if (match?.name) return match.name;
    if (usage.whatsappId) return `WhatsApp #${usage.whatsappId}`;
    return "WhatsApp não identificado";
  };

  const getWhatsappSuccessRate = (usage) => {
    if (!usage.total) return "0,0%";
    const rate = (usage.delivered / usage.total) * 100;
    return `${rate.toFixed(1)}%`;
  };

  return (
    <Box className={classes.root}>
      <MainContainer useWindowScroll>
        <Box className={classes.container}>
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

      {/* Resumo Visual por Status */}
      <Grid container spacing={2} style={{ marginTop: 8 }}>
        <Grid item xs={12}>
          <Card className={classes.dashboardCard}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Distribuição por Status
              </Typography>
              <Grid container spacing={2}>
                {pieData.map((item, index) => (
                  <Grid item xs={12} sm={6} md={4} key={index}>
                    <Paper style={{ padding: 16, backgroundColor: item.color, color: "#fff" }}>
                      <Typography variant="h4" style={{ fontWeight: "bold" }}>
                        {item.value}
                      </Typography>
                      <Typography variant="body1">
                        {item.name}
                      </Typography>
                      <Typography variant="caption">
                        {((item.value / summary.total) * 100).toFixed(1)}% do total
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Informações da Campanha */}
      <Grid container spacing={2} style={{ marginTop: 8 }}>
        {whatsappUsage.length > 0 && (
          <Grid item xs={12}>
            <Card className={classes.whatsappUsageCard}>
              <Box display="flex" alignItems="center" mb={2} justifyContent="space-between">
                <Box display="flex" alignItems="center" gap={1}>
                  <PhoneAndroidIcon style={{ color: "#25D366" }} />
                  <Typography variant="h6">Resumo por Número WhatsApp</Typography>
                </Box>
                <Typography variant="body2" color="textSecondary">
                  Total de envios: {summary.total}
                </Typography>
              </Box>

              <Grid container spacing={1}>
                {whatsappUsage.map((usage, index) => (
                  <Grid item xs={12} md={6} key={index}>
                    <Box className={classes.whatsappUsageRow}>
                      <Box className={classes.whatsappUsageInfo}>
                        <PhoneAndroidIcon color="primary" />
                        <Box>
                          <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                            {getWhatsappLabel(usage)}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            ID: {usage.whatsappId ?? "N/A"}
                          </Typography>
                        </Box>
                      </Box>

                      <Box className={classes.whatsappUsageStats}>
                        <Chip label={`Total: ${usage.total}`} color="primary" variant="outlined" />
                        <Chip label={`Entregues: ${usage.delivered}`} color="primary" />
                        <Chip label={`Falharam: ${usage.failed}`} color="secondary" variant="outlined" />
                        <Chip label={`Sucesso: ${getWhatsappSuccessRate(usage)}`} color="default" />
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Card>
          </Grid>
        )}

        {/* Números WhatsApp Utilizados */}
        <Grid item xs={12} md={6}>
          <Card className={classes.infoCard}>
            <Box display="flex" alignItems="center" mb={2}>
              <PhoneAndroidIcon style={{ marginRight: 8, color: "#25D366" }} />
              <Typography variant="h6">
                Números WhatsApp Utilizados
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Estratégia: {campaign.dispatchStrategy === "single" ? "Número Único" : "Rodízio de Números"}
              </Typography>
              {whatsappNumbers.length > 0 ? (
                whatsappNumbers.map((whatsapp, index) => (
                  <Chip
                    key={index}
                    icon={<PhoneAndroidIcon />}
                    label={whatsapp.name || `WhatsApp #${whatsapp.id}`}
                    style={{ margin: 4 }}
                    color="primary"
                    variant="outlined"
                  />
                ))
              ) : (
                <Typography variant="body2" color="textSecondary">
                  Nenhum número configurado
                </Typography>
              )}
            </Box>
          </Card>
        </Grid>

        {/* Resumo de Mensagens */}
        <Grid item xs={12} md={6}>
          <Card className={classes.infoCard}>
            <Box display="flex" alignItems="center" mb={2}>
              <InfoIcon style={{ marginRight: 8, color: "#2196f3" }} />
              <Typography variant="h6">
                Resumo da Configuração
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" gutterBottom>
                <strong>Total de Mensagens:</strong> {messages.length}
              </Typography>
              {campaign.confirmation && (
                <Typography variant="body2" gutterBottom>
                  <strong>Mensagens de Confirmação:</strong> {confirmationMessages.length}
                </Typography>
              )}
              <Typography variant="body2" gutterBottom>
                <strong>Lista de Contatos:</strong> {campaign.contactList?.name || "N/A"}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Agendamento:</strong> {datetimeToClient(campaign.scheduledAt)}
              </Typography>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Mensagens Configuradas */}
      <Paper style={{ padding: 16, marginTop: 16 }}>
        <Box display="flex" alignItems="center" mb={2}>
          <MessageIcon style={{ marginRight: 8, color: "#9c27b0" }} />
          <Typography variant="h6">
            Mensagens Configuradas
          </Typography>
        </Box>
        
        {messages.length > 0 ? (
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">
                Mensagens Principais ({messages.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box width="100%">
                {messages.map((message, index) => (
                  <Box key={index} className={classes.messageBox}>
                    <Typography variant="caption" color="textSecondary" gutterBottom>
                      Mensagem {index + 1}
                    </Typography>
                    <Typography className={classes.messageText}>
                      {message}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        ) : (
          <Typography variant="body2" color="textSecondary">
            Nenhuma mensagem configurada
          </Typography>
        )}

        {campaign.confirmation && confirmationMessages.length > 0 && (
          <Accordion style={{ marginTop: 8 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">
                Mensagens de Confirmação ({confirmationMessages.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box width="100%">
                {confirmationMessages.map((message, index) => (
                  <Box key={index} className={classes.messageBox}>
                    <Typography variant="caption" color="textSecondary" gutterBottom>
                      Confirmação {index + 1}
                    </Typography>
                    <Typography className={classes.messageText}>
                      {message}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}
      </Paper>

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
        {isDesktop ? (
          <Box className={classes.tableWrapper} style={{ overflowX: "auto" }}>
            <table className={classes.table}>
              <thead className={classes.tableHead}>
                <tr>
                  <th scope="col">STATUS</th>
                  <th scope="col">CONTATO</th>
                  <th scope="col">NÚMERO</th>
                  <th scope="col">MENSAGEM ENVIADA</th>
                  <th scope="col">TENTATIVAS</th>
                  <th scope="col">DATA DE ENVIO</th>
                  <th scope="col">ÚLTIMO ERRO</th>
                  <th scope="col">DATA DO ERRO</th>
                </tr>
              </thead>
              <tbody className={classes.tableBody}>
                {!loading && records.length === 0 && (
                  <tr>
                    <td colSpan={8} className={classes.emptyState}>
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                )}
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <Tooltip title={getStatusLabel(record.status)}>
                        <Chip
                          icon={getStatusIcon(record.status)}
                          label={getStatusLabel(record.status)}
                          size="small"
                          color={getStatusColor(record.status)}
                        />
                      </Tooltip>
                    </td>
                    <td>{record.contact?.name || "-"}</td>
                    <td>{record.number}</td>
                    <td>
                      {record.message ? (
                        <Tooltip title={record.message.trim()} placement="top-start">
                          <span className={classes.messageCell}>{getMessagePreview(record.message)}</span>
                        </Tooltip>
                      ) : record.messageIndex ? (
                        <Chip
                          size="small"
                          color="default"
                          label={`Mensagem ${record.messageIndex}`}
                        />
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      {record.attempts > 0 ? (
                        <Chip
                          label={record.attempts}
                          size="small"
                          color={record.attempts >= 3 ? "secondary" : "default"}
                        />
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      {record.deliveredAt ? datetimeToClient(record.deliveredAt) : "-"}
                    </td>
                    <td>
                      {record.lastError ? (
                        <Tooltip title={record.lastError}>
                          <span className={classes.errorCell}>{record.lastError}</span>
                        </Tooltip>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      {record.lastErrorAt ? datetimeToClient(record.lastErrorAt) : "-"}
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td colSpan={8}>
                      <TableRowSkeleton columns={8} />
                    </td>
                  </tr>
              )}
              </tbody>
            </table>
          </Box>
        ) : (
          /* Mobile View */
          <div className="flex flex-col gap-1.5 mt-3 w-full max-w-[375px] mx-auto">
            {!loading && records.length === 0 && (
              <div className="text-center text-sm text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                Nenhum registro encontrado.
        </div>
            )}
            {records.map((record) => (
              <div key={record.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-semibold text-sm">{record.contact?.name || record.number}</span>
                    <div className="text-xs text-gray-600 dark:text-gray-400">{record.number}</div>
                  </div>
                  <Chip
                    icon={getStatusIcon(record.status)}
                    label={getStatusLabel(record.status)}
                    size="small"
                    color={getStatusColor(record.status)}
                  />
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  {record.message && (
                    <div>Mensagem: {getMessagePreview(record.message)}</div>
                  )}
                  {record.attempts > 0 && (
                    <div>Tentativas: {record.attempts}</div>
                  )}
                  {record.deliveredAt && (
                    <div>Enviado: {datetimeToClient(record.deliveredAt)}</div>
                  )}
                  {record.lastError && (
                    <div className="text-red-600">Erro: {record.lastError.substring(0, 50)}...</div>
                  )}
                  {record.lastErrorAt && (
                    <div>Data do Erro: {datetimeToClient(record.lastErrorAt)}</div>
                  )}
                </div>
              </div>
            ))}
            {loading && <TableRowSkeleton columns={8} />}
          </div>
        )}

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
        </Box>
    </MainContainer>
    </Box>
  );
};

export default CampaignDetailedReport;
