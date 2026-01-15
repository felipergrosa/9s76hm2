import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Paper,
  Typography,
  makeStyles
} from "@material-ui/core";
import ThumbUpIcon from "@material-ui/icons/ThumbUp";
import ThumbDownIcon from "@material-ui/icons/ThumbDown";
import TrendingUpIcon from "@material-ui/icons/TrendingUp";
import AssessmentIcon from "@material-ui/icons/Assessment";
import BuildIcon from "@material-ui/icons/Build";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import { Line, Doughnut, Bar } from "react-chartjs-2";

import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  container: {
    height: "100%",
    overflowY: "auto"
  },
  metricCard: {
    height: "100%",
    display: "flex",
    flexDirection: "column"
  },
  metricValue: {
    fontSize: 32,
    fontWeight: "bold",
    marginTop: theme.spacing(1)
  },
  metricIcon: {
    fontSize: 40,
    opacity: 0.7
  },
  positiveValue: {
    color: theme.palette.success.main
  },
  negativeValue: {
    color: theme.palette.error.main
  },
  chartContainer: {
    height: 250,
    padding: theme.spacing(2)
  },
  sectionTitle: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(2),
    fontWeight: 600
  }
}));

const MetricCard = ({ title, value, icon, color, subtitle }) => {
  const classes = useStyles();

  return (
    <Card className={classes.metricCard} variant="outlined">
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="body2" color="textSecondary">
              {title}
            </Typography>
            <Typography className={classes.metricValue} style={{ color }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="textSecondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box className={classes.metricIcon} style={{ color }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const TrainingMetricsDashboard = ({ agentId }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    loadMetrics();
  }, [agentId]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/ai/training/metrics", {
        params: { agentId }
      });
      setMetrics(data);
    } catch (err) {
      setMetrics({
        totalFeedbacks: 0,
        positiveFeedbacks: 0,
        negativeFeedbacks: 0,
        improvementsSuggested: 0,
        improvementsApplied: 0,
        testsPassed: 0,
        testsTotal: 0,
        avgSimilarity: 0,
        feedbackTrend: [],
        categoryDistribution: {},
        evolutionData: []
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={400}>
        <CircularProgress />
      </Box>
    );
  }

  const feedbackRate = metrics.totalFeedbacks > 0
    ? ((metrics.positiveFeedbacks / metrics.totalFeedbacks) * 100).toFixed(1)
    : 0;

  const testPassRate = metrics.testsTotal > 0
    ? ((metrics.testsPassed / metrics.testsTotal) * 100).toFixed(1)
    : 0;

  const feedbackTrendData = {
    labels: (metrics.feedbackTrend || []).map(d => d.date),
    datasets: [
      {
        label: "Positivos",
        data: (metrics.feedbackTrend || []).map(d => d.positive),
        borderColor: "#4caf50",
        backgroundColor: "rgba(76, 175, 80, 0.1)",
        fill: true
      },
      {
        label: "Negativos",
        data: (metrics.feedbackTrend || []).map(d => d.negative),
        borderColor: "#f44336",
        backgroundColor: "rgba(244, 67, 54, 0.1)",
        fill: true
      }
    ]
  };

  const feedbackDistribution = {
    labels: ["Positivos", "Negativos"],
    datasets: [{
      data: [metrics.positiveFeedbacks, metrics.negativeFeedbacks],
      backgroundColor: ["#4caf50", "#f44336"],
      borderWidth: 0
    }]
  };

  const categoryData = {
    labels: Object.keys(metrics.categoryDistribution || {}),
    datasets: [{
      label: "Feedbacks por Categoria",
      data: Object.values(metrics.categoryDistribution || {}),
      backgroundColor: [
        "#2196f3",
        "#ff9800",
        "#9c27b0",
        "#00bcd4",
        "#ff5722"
      ]
    }]
  };

  return (
    <Box className={classes.container}>
      <Typography variant="h6" gutterBottom>
        <AssessmentIcon style={{ verticalAlign: "middle", marginRight: 8 }} />
        Dashboard de Métricas
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={6} sm={3}>
          <MetricCard
            title="Total de Feedbacks"
            value={metrics.totalFeedbacks}
            icon={<AssessmentIcon />}
            color="#2196f3"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard
            title="Taxa de Satisfação"
            value={`${feedbackRate}%`}
            icon={<ThumbUpIcon />}
            color="#4caf50"
            subtitle={`${metrics.positiveFeedbacks} positivos`}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard
            title="Melhorias Aplicadas"
            value={metrics.improvementsApplied}
            icon={<BuildIcon />}
            color="#ff9800"
            subtitle={`de ${metrics.improvementsSuggested} sugeridas`}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <MetricCard
            title="Taxa de Testes"
            value={`${testPassRate}%`}
            icon={<CheckCircleIcon />}
            color="#9c27b0"
            subtitle={`${metrics.testsPassed}/${metrics.testsTotal} passando`}
          />
        </Grid>
      </Grid>

      <Typography variant="subtitle1" className={classes.sectionTitle}>
        Evolução de Feedbacks
      </Typography>
      <Paper variant="outlined" className={classes.chartContainer}>
        <Line
          data={feedbackTrendData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true
              }
            },
            plugins: {
              legend: {
                position: "bottom"
              }
            }
          }}
        />
      </Paper>

      <Grid container spacing={2} style={{ marginTop: 16 }}>
        <Grid item xs={12} sm={6}>
          <Typography variant="subtitle1" className={classes.sectionTitle}>
            Distribuição de Feedbacks
          </Typography>
          <Paper variant="outlined" className={classes.chartContainer}>
            <Doughnut
              data={feedbackDistribution}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "bottom"
                  }
                }
              }}
            />
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Typography variant="subtitle1" className={classes.sectionTitle}>
            Feedbacks por Categoria
          </Typography>
          <Paper variant="outlined" className={classes.chartContainer}>
            <Bar
              data={categoryData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true
                  }
                }
              }}
            />
          </Paper>
        </Grid>
      </Grid>

      <Typography variant="subtitle1" className={classes.sectionTitle}>
        Métricas de Qualidade
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="textSecondary">
                Similaridade Média dos Testes
              </Typography>
              <Box display="flex" alignItems="center" mt={1}>
                <Box position="relative" display="inline-flex">
                  <CircularProgress
                    variant="determinate"
                    value={metrics.avgSimilarity || 0}
                    size={60}
                    thickness={4}
                    style={{ color: metrics.avgSimilarity >= 80 ? "#4caf50" : "#ff9800" }}
                  />
                  <Box
                    top={0}
                    left={0}
                    bottom={0}
                    right={0}
                    position="absolute"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Typography variant="caption" component="div" color="textSecondary">
                      {`${Math.round(metrics.avgSimilarity || 0)}%`}
                    </Typography>
                  </Box>
                </Box>
                <Box ml={2}>
                  <Typography variant="body2">
                    {metrics.avgSimilarity >= 80
                      ? "Excelente"
                      : metrics.avgSimilarity >= 60
                      ? "Bom"
                      : "Precisa melhorar"}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="textSecondary">
                Feedbacks Negativos Recentes
              </Typography>
              <Typography variant="h4" style={{ marginTop: 8, color: metrics.recentNegatives > 5 ? "#f44336" : "#4caf50" }}>
                {metrics.recentNegatives || 0}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Últimos 7 dias
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="textSecondary">
                Versões do Prompt
              </Typography>
              <Typography variant="h4" style={{ marginTop: 8, color: "#2196f3" }}>
                {metrics.promptVersions || 0}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                Total de iterações
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TrainingMetricsDashboard;
