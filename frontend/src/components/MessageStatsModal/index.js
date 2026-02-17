import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from "@material-ui/core";
import {
  Close as CloseIcon,
  Assessment as StatsIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as TimeIcon,
  Message as MessageIcon,
  Image as ImageIcon,
  VideoLibrary as VideoIcon,
  AudioFile as AudioIcon,
  Description as DocumentIcon
} from "@material-ui/icons";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  dialogContent: {
    minWidth: 800,
  },
  statsCard: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
  },
  statValue: {
    fontSize: "2rem",
    fontWeight: "bold",
    color: theme.palette.primary.main,
  },
  chartContainer: {
    height: 300,
    width: "100%",
  },
  wordChip: {
    margin: theme.spacing(0.5),
  },
  mediaIcon: {
    marginRight: theme.spacing(1),
  },
  summaryBox: {
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.primary.contrastText,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
  },
}));

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const MessageStatsModal = ({ open, onClose, ticketId, contactId, companyId }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState(30);

  const handleClose = () => {
    onClose();
    setStats(null);
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await api.get("/messages/stats", {
        params: {
          ticketId,
          contactId,
          companyId,
          period,
          includeMedia: true
        }
      });

      setStats(response.data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchStats();
    }
  }, [open, period]);

  const formatResponseTime = (minutes) => {
    if (minutes < 1) {
      return `${Math.round(minutes * 60)}s`;
    } else if (minutes < 60) {
      return `${Math.round(minutes)}min`;
    } else {
      return `${Math.round(minutes / 60)}h`;
    }
  };

  const prepareMediaData = () => {
    if (!stats) return [];
    
    const { mediaBreakdown } = stats;
    return [
      { name: 'Imagens', value: mediaBreakdown.images, color: '#4CAF50' },
      { name: 'Vídeos', value: mediaBreakdown.videos, color: '#2196F3' },
      { name: 'Áudios', value: mediaBreakdown.audios, color: '#FF9800' },
      { name: 'Documentos', value: mediaBreakdown.documents, color: '#9C27B0' },
      { name: 'Stickers', value: mediaBreakdown.stickers, color: '#FFEB3B' },
      { name: 'Outros', value: mediaBreakdown.others, color: '#607D8B' }
    ].filter(item => item.value > 0);
  };

  const renderStatsCards = () => {
    if (!stats) return null;

    return (
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <Card className={classes.statsCard}>
            <CardContent>
              <Box display="flex" alignItems="center">
                <MessageIcon color="primary" className={classes.mediaIcon} />
                <Box>
                  <Typography variant="h6">Total de Mensagens</Typography>
                  <Typography className={classes.statValue}>
                    {stats.totalMessages.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className={classes.statsCard}>
            <CardContent>
              <Box display="flex" alignItems="center">
                <TrendingUpIcon color="primary" className={classes.mediaIcon} />
                <Box>
                  <Typography variant="h6">Média por Dia</Typography>
                  <Typography className={classes.statValue}>
                    {stats.averagePerDay}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className={classes.statsCard}>
            <CardContent>
              <Box display="flex" alignItems="center">
                <TimeIcon color="primary" className={classes.mediaIcon} />
                <Box>
                  <Typography variant="h6">Tempo Resposta</Typography>
                  <Typography className={classes.statValue}>
                    {formatResponseTime(stats.responseTimeStats.averageResponseTime)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card className={classes.statsCard}>
            <CardContent>
              <Box display="flex" alignItems="center">
                <StatsIcon color="primary" className={classes.mediaIcon} />
                <Box>
                  <Typography variant="h6">Dia Mais Ativo</Typography>
                  <Typography className={classes.statValue} style={{ fontSize: "1.2rem" }}>
                    {stats.mostActiveDay}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  const renderCharts = () => {
    if (!stats) return null;

    return (
      <Grid container spacing={2} style={{ marginTop: 16 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Atividade Diária
              </Typography>
              <div className={classes.chartContainer}>
                <ResponsiveContainer>
                  <BarChart data={stats.dailyActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="sent" stackId="a" fill="#4CAF50" name="Enviadas" />
                    <Bar dataKey="received" stackId="a" fill="#2196F3" name="Recebidas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Tipos de Mídia
              </Typography>
              <div className={classes.chartContainer}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={prepareMediaData()}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({name, value}) => `${name}: ${value}`}
                    >
                      {prepareMediaData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <StatsIcon style={{ marginRight: 8 }} />
            <Typography variant="h6">Estatísticas de Mensagens</Typography>
          </Box>
          <Box display="flex" alignItems="center">
            <FormControl size="small" style={{ marginRight: 16, minWidth: 120 }}>
              <InputLabel>Período</InputLabel>
              <Select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                label="Período"
              >
                <MenuItem value={7}>7 dias</MenuItem>
                <MenuItem value={30}>30 dias</MenuItem>
                <MenuItem value={90}>90 dias</MenuItem>
                <MenuItem value={365}>1 ano</MenuItem>
              </Select>
            </FormControl>
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent className={classes.dialogContent}>
        {loading && (
          <Box display="flex" alignItems="center" justifyContent="center" p={4}>
            <CircularProgress />
            <Typography style={{ marginLeft: 16 }}>
              Calculando estatísticas...
            </Typography>
          </Box>
        )}

        {!loading && stats && (
          <>
            <Box className={classes.summaryBox}>
              <Typography variant="h6">Resumo do Período</Typography>
              <Typography>
                📊 {stats.totalMessages} mensagens ({stats.sentMessages} enviadas, {stats.receivedMessages} recebidas)
              </Typography>
              <Typography>
                📅 De {new Date(stats.firstMessageDate).toLocaleDateString()} até {new Date(stats.lastMessageDate).toLocaleDateString()}
              </Typography>
              <Typography>
                ⏰ Horário mais ativo: {stats.mostActiveHour}h
              </Typography>
            </Box>

            {renderStatsCards()}
            {renderCharts()}

            {stats.topWords && stats.topWords.length > 0 && (
              <Card style={{ marginTop: 16 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Palavras Mais Frequentes
                  </Typography>
                  <Box>
                    {stats.topWords.map((word, index) => (
                      <Chip
                        key={index}
                        label={`${word.word} (${word.count})`}
                        className={classes.wordChip}
                        color={index < 3 ? "primary" : "default"}
                        variant={index < 3 ? "default" : "outlined"}
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            )}

            <Divider style={{ margin: "16px 0" }} />

            <Box display="flex" justifyContent="flex-end">
              <Button onClick={handleClose} color="primary">
                Fechar
              </Button>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MessageStatsModal;
