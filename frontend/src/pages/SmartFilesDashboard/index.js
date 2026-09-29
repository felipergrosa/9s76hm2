import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Avatar,
  LinearProgress,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  Fab,
  Stepper,
  Step,
  StepLabel,
  StepContent
} from "@material-ui/core";
import {
  Dashboard as DashboardIcon,
  CloudUpload as UploadIcon,
  Help as HelpIcon,
  PlayArrow as PlayIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
  School as TutorialIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  Star as StarIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  Group as TeamIcon
} from "@material-ui/icons";
import {
  Bot as AIIcon,
  BarChart3 as AnalyticsIcon,
  Brain as PsychologyIcon,
  Sparkles as MagicIcon,
  Lightbulb as IdeaIcon
} from "lucide-react";
import { makeStyles } from "@material-ui/core/styles";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import QueueTemplateGallery from "../../components/QueueTemplateGallery";
import SmartFilesBestPractices from "../../components/SmartFilesBestPractices";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(3),
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    minHeight: "100vh"
  },
  welcomeCard: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    marginBottom: theme.spacing(3),
    borderRadius: 16,
    position: "relative",
    overflow: "hidden",
    "&::before": {
      content: '""',
      position: "absolute",
      top: 0,
      right: 0,
      width: "200px",
      height: "200px",
      background: "rgba(255,255,255,0.1)",
      borderRadius: "50%",
      transform: "translate(50px, -50px)"
    }
  },
  featureCard: {
    height: "100%",
    borderRadius: 12,
    transition: "all 0.3s ease",
    cursor: "pointer",
    "&:hover": {
      transform: "translateY(-4px)",
      boxShadow: theme.shadows[8]
    }
  },
  statsCard: {
    background: "linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)",
    color: "white",
    borderRadius: 12
  },
  ideaCard: {
    background: "linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)",
    color: "white",
    borderRadius: 12,
    marginBottom: theme.spacing(2)
  },
  tutorialFab: {
    position: "fixed",
    bottom: theme.spacing(2),
    right: theme.spacing(2),
    background: "linear-gradient(45deg, #FF9800 30%, #FFB74D 90%)"
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginTop: theme.spacing(1)
  },
  chipSuccess: {
    background: "#4CAF50",
    color: "white"
  },
  chipWarning: {
    background: "#FF9800",
    color: "white"
  },
  chipInfo: {
    background: "#2196F3",
    color: "white"
  }
}));

const SmartFilesDashboard = () => {
  const classes = useStyles();
  const history = useHistory();
  const [dashboardData, setDashboardData] = useState(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [practicesOpen, setPracticesOpen] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Simular dados do dashboard
      setTimeout(() => {
        setDashboardData({
          stats: {
            totalQueues: 5,
            activeFiles: 23,
            successRate: 87,
            aiAnalyses: 156
          },
          recentActivity: [
            { action: "Arquivo enviado", queue: "Vendas", time: "2 min atrás" },
            { action: "IA analisou mensagem", queue: "Suporte", time: "5 min atrás" },
            { action: "Nova fila criada", queue: "Marketing", time: "1h atrás" }
          ],
          topFiles: [
            { name: "Catálogo Verão 2024", sends: 45, success: 92 },
            { name: "Manual de Instalação", sends: 32, success: 88 },
            { name: "Tabela de Preços", sends: 28, success: 85 }
          ]
        });
        setLoading(false);
      }, 1000);
    } catch (error) {
      toast.error("Erro ao carregar dashboard");
      setLoading(false);
    }
  };

  const features = [
    {
      title: "🤖 IA Inteligente",
      description: "Análise semântica avançada com GPT",
      details: "Entende contexto, intenção e sentimento das mensagens",
      color: "#9C27B0",
      route: "/ai-config",
      tips: [
        "Configure sua API Key do OpenAI",
        "Teste diferentes modelos (GPT-3.5, GPT-4)",
        "Monitore a precisão das análises"
      ]
    },
    {
      title: "📁 Múltiplos Formatos",
      description: "Suporte a 15+ tipos de arquivo",
      details: "Vídeos, áudios, documentos, imagens e mais",
      color: "#2196F3",
      route: "/media-config",
      tips: [
        "Organize arquivos por categoria",
        "Use nomes descritivos",
        "Configure palavras-chave relevantes"
      ]
    },
    {
      title: "📊 Analytics Avançado",
      description: "Métricas em tempo real",
      details: "Taxa de sucesso, arquivos populares, horários de pico",
      color: "#4CAF50",
      route: "/analytics",
      tips: [
        "Monitore taxa de aceitação",
        "Identifique horários de pico",
        "Otimize baseado nos dados"
      ]
    },
    {
      title: "🎯 Templates Prontos",
      description: "5 modelos pré-configurados",
      details: "Vendas, Suporte, Financeiro, RH e Marketing",
      color: "#FF9800",
      route: "/templates",
      tips: [
        "Comece com templates prontos",
        "Personalize conforme sua necessidade",
        "Teste diferentes estratégias"
      ]
    }
  ];

  const useCases = [
    {
      icon: "🛒",
      title: "E-commerce",
      description: "Envio automático de catálogos quando cliente entra na fila de vendas",
      example: "Cliente: 'Olá' → Bot: 'Quer ver nossos produtos?' → Envia catálogo",
      benefits: ["Aumento de 40% nas vendas", "Redução de 60% no tempo de atendimento"]
    },
    {
      icon: "🔧",
      title: "Suporte Técnico",
      description: "IA analisa problema e sugere manual específico",
      example: "Cliente: 'Não consigo instalar' → IA detecta → Envia manual de instalação",
      benefits: ["Resolução 70% mais rápida", "Satisfação 85% maior"]
    },
    {
      icon: "💰",
      title: "Financeiro",
      description: "Envio controlado de documentos sensíveis apenas por agentes",
      example: "Agente decide quando enviar contratos e formulários",
      benefits: ["Segurança garantida", "Controle total do processo"]
    },
    {
      icon: "👥",
      title: "RH",
      description: "Políticas e procedimentos enviados sob demanda",
      example: "Funcionário: 'Política de férias' → Sistema encontra e envia documento",
      benefits: ["Acesso rápido a informações", "Redução de dúvidas repetitivas"]
    }
  ];

  const tutorialSteps = [
    {
      label: "Configuração Inicial",
      content: (
        <Box>
          <Typography variant="body1" gutterBottom>
            Vamos configurar seu primeiro ambiente Smart Files:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon><CheckIcon color="primary" /></ListItemIcon>
              <ListItemText primary="Configure API Key do OpenAI (opcional)" />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckIcon color="primary" /></ListItemIcon>
              <ListItemText primary="Escolha templates de filas" />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckIcon color="primary" /></ListItemIcon>
              <ListItemText primary="Faça upload dos primeiros arquivos" />
            </ListItem>
          </List>
        </Box>
      )
    },
    {
      label: "Criação de Filas",
      content: (
        <Box>
          <Typography variant="body1" gutterBottom>
            Crie filas inteligentes para diferentes propósitos:
          </Typography>
          <Alert severity="info" style={{ marginBottom: 16 }}>
            <AlertTitle>Dica Pro</AlertTitle>
            Comece com 2-3 filas e expanda gradualmente
          </Alert>
          <List>
            <ListItem>
              <ListItemIcon><StarIcon color="primary" /></ListItemIcon>
              <ListItemText 
                primary="Vendas - Automático" 
                secondary="Envia catálogo assim que cliente entra" 
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><StarIcon color="primary" /></ListItemIcon>
              <ListItemText 
                primary="Suporte - Sob Demanda" 
                secondary="IA analisa mensagem e sugere arquivos" 
              />
            </ListItem>
          </List>
        </Box>
      )
    },
    {
      label: "Upload de Arquivos",
      content: (
        <Box>
          <Typography variant="body1" gutterBottom>
            Configure seus arquivos para máxima efetividade:
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6">✅ Boas Práticas</Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText primary="Nomes descritivos" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Palavras-chave relevantes" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Descrições claras" />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6">🎯 Formatos Suportados</Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText primary="PDF, DOC, XLS (até 100MB)" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="MP4, AVI (até 64MB)" />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="MP3, WAV (até 16MB)" />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )
    },
    {
      label: "Teste e Otimização",
      content: (
        <Box>
          <Typography variant="body1" gutterBottom>
            Teste seu sistema e otimize baseado nos resultados:
          </Typography>
          <Alert severity="success" style={{ marginBottom: 16 }}>
            <AlertTitle>Parabéns! 🎉</AlertTitle>
            Seu sistema Smart Files está pronto para usar!
          </Alert>
          <List>
            <ListItem>
              <ListItemIcon><TrendingUpIcon color="primary" /></ListItemIcon>
              <ListItemText 
                primary="Monitore métricas diariamente" 
                secondary="Taxa de aceitação, arquivos populares, horários de pico" 
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><PsychologyIcon color="primary" /></ListItemIcon>
              <ListItemText 
                primary="Ajuste templates baseado no feedback" 
                secondary="Melhore mensagens de confirmação e palavras-chave" 
              />
            </ListItem>
          </List>
        </Box>
      )
    }
  ];

  if (loading) {
    return (
      <Box className={classes.root} display="flex" justifyContent="center" alignItems="center">
        <Box textAlign="center">
          <MagicIcon style={{ fontSize: 64, color: "white", marginBottom: 16 }} />
          <Typography variant="h5" style={{ color: "white", marginBottom: 16 }}>
            Carregando Smart Files Dashboard...
          </Typography>
          <LinearProgress style={{ width: 200 }} />
        </Box>
      </Box>
    );
  }

  return (
    <Box className={classes.root}>
      {/* Welcome Card */}
      <Card className={classes.welcomeCard}>
        <CardContent style={{ padding: 32 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={8}>
              <Typography variant="h3" gutterBottom style={{ fontWeight: "bold" }}>
                🚀 Smart Files Dashboard
              </Typography>
              <Typography variant="h6" style={{ opacity: 0.9, marginBottom: 16 }}>
                Sistema Inteligente de Envio de Arquivos com IA
              </Typography>
              <Typography variant="body1" style={{ opacity: 0.8, marginBottom: 24 }}>
                Automatize o envio de documentos, catálogos e manuais usando inteligência artificial. 
                Aumente a eficiência do seu atendimento em até 70%!
              </Typography>
              <Box>
                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  startIcon={<PlayIcon />}
                  onClick={() => setTutorialOpen(true)}
                  style={{ marginRight: 16 }}
                >
                  Começar Tutorial
                </Button>
                <Button
                  variant="outlined"
                  style={{ color: "white", borderColor: "white", marginRight: 8 }}
                  startIcon={<SettingsIcon />}
                  onClick={() => setTemplatesOpen(true)}
                >
                  Templates
                </Button>
                <Button
                  variant="outlined"
                  style={{ color: "white", borderColor: "white" }}
                  startIcon={<HelpIcon />}
                  onClick={() => setPracticesOpen(true)}
                >
                  Guia
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box textAlign="center">
                <Avatar
                  style={{
                    width: 120,
                    height: 120,
                    margin: "0 auto",
                    background: "rgba(255,255,255,0.2)",
                    fontSize: 48
                  }}
                >
                  🤖
                </Avatar>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <Grid container spacing={3} style={{ marginBottom: 24 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card className={classes.statsCard}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" style={{ fontWeight: "bold" }}>
                    {dashboardData?.stats.totalQueues || 0}
                  </Typography>
                  <Typography variant="body2">Filas Ativas</Typography>
                </Box>
                <DashboardIcon style={{ fontSize: 48, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className={classes.statsCard}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" style={{ fontWeight: "bold" }}>
                    {dashboardData?.stats.activeFiles || 0}
                  </Typography>
                  <Typography variant="body2">Arquivos Ativos</Typography>
                </Box>
                <UploadIcon style={{ fontSize: 48, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className={classes.statsCard}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" style={{ fontWeight: "bold" }}>
                    {dashboardData?.stats.successRate || 0}%
                  </Typography>
                  <Typography variant="body2">Taxa de Sucesso</Typography>
                </Box>
                <TrendingUpIcon style={{ fontSize: 48, opacity: 0.7 }} />
              </Box>
              <LinearProgress
                variant="determinate"
                value={dashboardData?.stats.successRate || 0}
                className={classes.progressBar}
                style={{ background: "rgba(255,255,255,0.3)" }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card className={classes.statsCard}>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" style={{ fontWeight: "bold" }}>
                    {dashboardData?.stats.aiAnalyses || 0}
                  </Typography>
                  <Typography variant="body2">Análises de IA</Typography>
                </Box>
                <AIIcon style={{ fontSize: 48, opacity: 0.7 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Features Grid */}
      <Grid container spacing={3} style={{ marginBottom: 24 }}>
        {features.map((feature, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card 
              className={classes.featureCard}
              onClick={() => history.push(feature.route)}
            >
              <CardContent>
                <Box textAlign="center" mb={2}>
                  <Avatar
                    style={{
                      width: 64,
                      height: 64,
                      margin: "0 auto 16px",
                      background: feature.color,
                      fontSize: 28
                    }}
                  >
                    {feature.title.charAt(0)}
                  </Avatar>
                  <Typography variant="h6" gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {feature.description}
                  </Typography>
                  <Typography variant="caption" display="block" style={{ marginTop: 8 }}>
                    {feature.details}
                  </Typography>
                </Box>
                
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    💡 Dicas Rápidas:
                  </Typography>
                  {feature.tips.map((tip, tipIndex) => (
                    <Chip
                      key={tipIndex}
                      label={tip}
                      size="small"
                      variant="outlined"
                      style={{ 
                        margin: "2px 4px 2px 0",
                        fontSize: "0.7rem"
                      }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Use Cases */}
      <Card style={{ marginBottom: 24 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            💡 Ideias de Uso - Casos Reais de Sucesso
          </Typography>
          <Grid container spacing={3}>
            {useCases.map((useCase, index) => (
              <Grid item xs={12} md={6} key={index}>
                <Card className={classes.ideaCard}>
                  <CardContent>
                    <Box display="flex" alignItems="center" mb={2}>
                      <Typography variant="h4" style={{ marginRight: 16 }}>
                        {useCase.icon}
                      </Typography>
                      <Typography variant="h6" style={{ fontWeight: "bold" }}>
                        {useCase.title}
                      </Typography>
                    </Box>
                    <Typography variant="body1" gutterBottom>
                      {useCase.description}
                    </Typography>
                    <Alert severity="info" style={{ margin: "16px 0", background: "rgba(255,255,255,0.1)" }}>
                      <Typography variant="body2" style={{ fontStyle: "italic" }}>
                        📝 Exemplo: {useCase.example}
                      </Typography>
                    </Alert>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        🎯 Benefícios:
                      </Typography>
                      {useCase.benefits.map((benefit, benefitIndex) => (
                        <Chip
                          key={benefitIndex}
                          label={benefit}
                          className={classes.chipSuccess}
                          size="small"
                          style={{ margin: "2px 4px 2px 0" }}
                        />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card style={{ marginBottom: 24 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            ⚡ Ações Rápidas
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                startIcon={<SettingsIcon />}
                onClick={() => setTemplatesOpen(true)}
                style={{ padding: "16px", borderRadius: 12 }}
              >
                <Box textAlign="center">
                  <Typography variant="h6">Criar Filas</Typography>
                  <Typography variant="caption">Templates prontos</Typography>
                </Box>
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="contained"
                color="secondary"
                startIcon={<UploadIcon />}
                onClick={() => history.push("/files")}
                style={{ padding: "16px", borderRadius: 12 }}
              >
                <Box textAlign="center">
                  <Typography variant="h6">Upload Arquivos</Typography>
                  <Typography variant="caption">Adicionar conteúdo</Typography>
                </Box>
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="contained"
                style={{ background: "#FF9800", color: "white", padding: "16px", borderRadius: 12 }}
                startIcon={<AnalyticsIcon />}
                onClick={() => history.push("/analytics")}
              >
                <Box textAlign="center">
                  <Typography variant="h6">Ver Métricas</Typography>
                  <Typography variant="caption">Dashboard analítico</Typography>
                </Box>
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                fullWidth
                variant="contained"
                style={{ background: "#9C27B0", color: "white", padding: "16px", borderRadius: 12 }}
                startIcon={<HelpIcon />}
                onClick={() => setPracticesOpen(true)}
              >
                <Box textAlign="center">
                  <Typography variant="h6">Guia Completo</Typography>
                  <Typography variant="caption">Melhores práticas</Typography>
                </Box>
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            🚀 Dicas para Maximizar Resultados
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>⚡ Performance</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><SpeedIcon color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Monitore taxa de aceitação"
                        secondary="Meta: acima de 70%"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><TrendingUpIcon color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Otimize horários de pico"
                        secondary="Ajuste equipe conforme demanda"
                      />
                    </ListItem>
                  </List>
                </AccordionDetails>
              </Accordion>
            </Grid>
            <Grid item xs={12} md={4}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>🔒 Segurança</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><SecurityIcon color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Use estratégia 'Manual' para docs sensíveis"
                        secondary="Contratos, dados pessoais, etc."
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><TeamIcon color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Treine sua equipe"
                        secondary="Todos devem conhecer o sistema"
                      />
                    </ListItem>
                  </List>
                </AccordionDetails>
              </Accordion>
            </Grid>
            <Grid item xs={12} md={4}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>🎯 Otimização</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    <ListItem>
                      <ListItemIcon><PsychologyIcon color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Use IA para análise semântica"
                        secondary="Configure OpenAI API Key"
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon><IdeaIcon color="primary" /></ListItemIcon>
                      <ListItemText 
                        primary="Teste diferentes templates"
                        secondary="A/B test suas mensagens"
                      />
                    </ListItem>
                  </List>
                </AccordionDetails>
              </Accordion>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tutorial FAB */}
      <Fab
        className={classes.tutorialFab}
        onClick={() => setTutorialOpen(true)}
      >
        <TutorialIcon />
      </Fab>

      {/* Tutorial Dialog */}
      <Dialog
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <TutorialIcon style={{ marginRight: 8 }} />
            Tutorial Interativo - Smart Files
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            {tutorialSteps.map((step, index) => (
              <Step key={index}>
                <StepLabel>{step.label}</StepLabel>
                <StepContent>
                  {step.content}
                  <Box mt={2}>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => setActiveStep(activeStep + 1)}
                      disabled={activeStep === tutorialSteps.length - 1}
                      style={{ marginRight: 8 }}
                    >
                      {activeStep === tutorialSteps.length - 1 ? "Finalizar" : "Próximo"}
                    </Button>
                    <Button
                      disabled={activeStep === 0}
                      onClick={() => setActiveStep(activeStep - 1)}
                    >
                      Voltar
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTutorialOpen(false)}>
            Fechar
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              setTutorialOpen(false);
              history.push("/queues");
            }}
          >
            Ir para Configurações
          </Button>
        </DialogActions>
      </Dialog>

      {/* Template Gallery */}
      <QueueTemplateGallery
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onTemplatesSelected={(templates) => {
          toast.success(`${templates.length} filas criadas com sucesso!`);
          loadDashboardData(); // Recarregar dados
        }}
      />

      {/* Best Practices Guide */}
      <SmartFilesBestPractices
        open={practicesOpen}
        onClose={() => setPracticesOpen(false)}
      />
    </Box>
  );
};

export default SmartFilesDashboard;
