import React, { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Alert,
  AlertTitle,
  Grid,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Divider,
  LinearProgress,
  IconButton,
  Tooltip
} from "@material-ui/core";
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  CloudUpload as UploadIcon,
  School as SchoolIcon,
  Star as StarIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Close as CloseIcon,
  PlayArrow as PlayIcon
} from "@material-ui/icons";
import {
  Brain as AIIcon,
  BarChart3 as AnalyticsIcon,
  Lightbulb as TipIcon
} from "lucide-react";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(3)
  },
  practiceCard: {
    borderRadius: 12,
    marginBottom: theme.spacing(2),
    transition: "all 0.3s ease",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: theme.shadows[4]
    }
  },
  categoryHeader: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    borderRadius: "12px 12px 0 0"
  },
  tipCard: {
    background: "linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)",
    borderLeft: `4px solid ${theme.palette.warning.main}`,
    marginBottom: theme.spacing(2)
  },
  successCard: {
    background: "linear-gradient(135deg, #E8F5E8 0%, #C8E6C9 100%)",
    borderLeft: `4px solid ${theme.palette.success.main}`,
    marginBottom: theme.spacing(2)
  },
  errorCard: {
    background: "linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%)",
    borderLeft: `4px solid ${theme.palette.error.main}`,
    marginBottom: theme.spacing(2)
  },
  checklistItem: {
    background: "#f5f5f5",
    borderRadius: 8,
    marginBottom: theme.spacing(1),
    "&:hover": {
      background: "#e0e0e0"
    }
  },
  scoreCard: {
    textAlign: "center",
    padding: theme.spacing(3),
    background: "linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%)",
    color: "white",
    borderRadius: 12
  },
  metricCard: {
    textAlign: "center",
    padding: theme.spacing(2),
    borderRadius: 8,
    background: "#f8f9fa"
  }
}));

const SmartFilesBestPractices = ({ open, onClose }) => {
  const classes = useStyles();
  const [activeCategory, setActiveCategory] = useState(0);
  const [checkedItems, setCheckedItems] = useState({});
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [currentScore, setCurrentScore] = useState(0);

  const categories = [
    {
      id: "setup",
      title: "🚀 Configuração Inicial",
      icon: <SpeedIcon />,
      color: "#2196F3",
      practices: [
        {
          title: "Planejamento de Filas",
          level: "Essencial",
          description: "Como estruturar suas filas para máxima eficiência",
          tips: [
            "Comece com 2-3 filas principais (Vendas, Suporte, Geral)",
            "Use nomes claros e intuitivos para as filas",
            "Defina objetivos específicos para cada fila",
            "Considere o volume de atendimento esperado"
          ],
          doAndDont: {
            do: [
              "Teste com uma fila primeiro",
              "Monitore métricas desde o início",
              "Treine a equipe antes do lançamento"
            ],
            dont: [
              "Criar muitas filas de uma vez",
              "Usar nomes genéricos como 'Fila 1'",
              "Ignorar feedback inicial dos usuários"
            ]
          }
        },
        {
          title: "Estratégias de Envio",
          level: "Importante",
          description: "Escolha a estratégia certa para cada situação",
          tips: [
            "Automático: Para catálogos e materiais promocionais",
            "Sob Demanda: Para suporte técnico e dúvidas",
            "Manual: Para documentos sensíveis e contratos",
            "Teste diferentes estratégias e compare resultados"
          ],
          examples: [
            {
              scenario: "E-commerce",
              strategy: "Automático",
              reason: "Cliente quer ver produtos imediatamente"
            },
            {
              scenario: "Suporte Técnico", 
              strategy: "Sob Demanda",
              reason: "Precisa analisar o problema específico"
            },
            {
              scenario: "Financeiro",
              strategy: "Manual",
              reason: "Documentos requerem aprovação"
            }
          ]
        }
      ]
    },
    {
      id: "files",
      title: "📁 Gestão de Arquivos",
      icon: <UploadIcon />,
      color: "#FF9800",
      practices: [
        {
          title: "Organização de Arquivos",
          level: "Essencial",
          description: "Estruture seus arquivos para fácil localização",
          tips: [
            "Use nomes descritivos e padronizados",
            "Organize por categoria (produtos, manuais, contratos)",
            "Mantenha versões atualizadas",
            "Configure palavras-chave relevantes"
          ],
          fileNaming: {
            good: [
              "Catalogo_Verao_2024.pdf",
              "Manual_Instalacao_v2.1.pdf",
              "Tabela_Precos_Janeiro_2024.xlsx"
            ],
            bad: [
              "arquivo1.pdf",
              "documento.doc",
              "img_20240101.jpg"
            ]
          }
        },
        {
          title: "Palavras-chave Efetivas",
          level: "Importante",
          description: "Configure palavras-chave que seus clientes realmente usam",
          tips: [
            "Use sinônimos e variações",
            "Inclua termos técnicos e populares",
            "Teste com mensagens reais de clientes",
            "Atualize baseado em análises de IA"
          ],
          examples: [
            {
              file: "Manual de Instalação",
              keywords: "instalação, instalar, setup, configurar, como instalar, tutorial instalação"
            },
            {
              file: "Catálogo de Produtos",
              keywords: "catálogo, produtos, preços, comprar, loja, itens, mercadoria"
            }
          ]
        }
      ]
    },
    {
      id: "ai",
      title: "🤖 Inteligência Artificial",
      icon: <AIIcon />,
      color: "#9C27B0",
      practices: [
        {
          title: "Configuração de IA",
          level: "Avançado",
          description: "Maximize o potencial da análise semântica",
          tips: [
            "Configure API Key do OpenAI nas configurações",
            "Escolha o modelo adequado (GPT-3.5 vs GPT-4)",
            "Monitore custos e usage da API",
            "Teste diferentes temperaturas para criatividade"
          ],
          models: [
            {
              model: "GPT-3.5 Turbo",
              use: "Análise rápida e econômica",
              cost: "Baixo",
              accuracy: "85%"
            },
            {
              model: "GPT-4",
              use: "Análise complexa e precisa",
              cost: "Alto",
              accuracy: "95%"
            }
          ]
        },
        {
          title: "Otimização de Prompts",
          level: "Avançado",
          description: "Melhore a precisão da IA com prompts bem estruturados",
          tips: [
            "Seja específico sobre o contexto do negócio",
            "Inclua exemplos de mensagens típicas",
            "Defina claramente os tipos de arquivos disponíveis",
            "Teste e refine baseado nos resultados"
          ]
        }
      ]
    },
    {
      id: "metrics",
      title: "📊 Métricas e Otimização",
      icon: <AnalyticsIcon />,
      color: "#4CAF50",
      practices: [
        {
          title: "KPIs Essenciais",
          level: "Importante",
          description: "Monitore as métricas que realmente importam",
          kpis: [
            {
              metric: "Taxa de Aceitação",
              target: "> 70%",
              description: "Porcentagem de clientes que aceitam receber arquivos"
            },
            {
              metric: "Tempo de Resposta",
              target: "< 30s",
              description: "Tempo entre solicitação e envio do arquivo"
            },
            {
              metric: "Arquivos por Sessão",
              target: "2-3",
              description: "Número médio de arquivos enviados por conversa"
            },
            {
              metric: "Taxa de Conversão",
              target: "> 15%",
              description: "Clientes que fazem ação após receber arquivo"
            }
          ]
        },
        {
          title: "Análise de Performance",
          level: "Avançado",
          description: "Use dados para melhorar continuamente",
          tips: [
            "Analise horários de pico para ajustar equipe",
            "Identifique arquivos mais populares",
            "Monitore taxa de rejeição por fila",
            "A/B teste diferentes templates de confirmação"
          ]
        }
      ]
    },
    {
      id: "security",
      title: "🔒 Segurança e Compliance",
      icon: <SecurityIcon />,
      color: "#F44336",
      practices: [
        {
          title: "Controle de Acesso",
          level: "Essencial",
          description: "Proteja informações sensíveis",
          tips: [
            "Use estratégia 'Manual' para documentos confidenciais",
            "Configure permissões por usuário/fila",
            "Mantenha logs detalhados de todos os envios",
            "Revise acessos periodicamente"
          ],
          securityLevels: [
            {
              level: "Público",
              files: "Catálogos, materiais promocionais",
              strategy: "Automático"
            },
            {
              level: "Interno",
              files: "Manuais técnicos, procedimentos",
              strategy: "Sob Demanda"
            },
            {
              level: "Confidencial",
              files: "Contratos, dados pessoais",
              strategy: "Manual"
            }
          ]
        },
        {
          title: "LGPD e Privacidade",
          level: "Essencial",
          description: "Mantenha conformidade com regulamentações",
          tips: [
            "Não inclua dados pessoais em nomes de arquivo",
            "Configure retenção automática de logs",
            "Implemente consentimento explícito quando necessário",
            "Documente todos os processos de tratamento de dados"
          ]
        }
      ]
    }
  ];

  const checklistItems = [
    { id: 1, text: "Configurei pelo menos 2 filas com estratégias diferentes", category: "setup" },
    { id: 2, text: "Defini palavras-chave relevantes para todos os arquivos", category: "files" },
    { id: 3, text: "Configurei API Key do OpenAI para análise semântica", category: "ai" },
    { id: 4, text: "Estabeleci metas para taxa de aceitação (>70%)", category: "metrics" },
    { id: 5, text: "Implementei controles de segurança para docs sensíveis", category: "security" },
    { id: 6, text: "Testei o sistema com mensagens reais de clientes", category: "setup" },
    { id: 7, text: "Organizei arquivos com nomes padronizados", category: "files" },
    { id: 8, text: "Monitoro métricas diariamente", category: "metrics" },
    { id: 9, text: "Treinei a equipe para usar o sistema", category: "setup" },
    { id: 10, text: "Configurei logs e auditoria adequados", category: "security" }
  ];

  const handleCheckItem = (itemId) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const calculateScore = () => {
    const checkedCount = Object.values(checkedItems).filter(Boolean).length;
    return Math.round((checkedCount / checklistItems.length) * 100);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "#4CAF50";
    if (score >= 60) return "#FF9800";
    return "#F44336";
  };

  const getScoreLabel = (score) => {
    if (score >= 90) return "Excelente! 🏆";
    if (score >= 80) return "Muito Bom! 🎉";
    if (score >= 60) return "Bom! 👍";
    if (score >= 40) return "Regular 📈";
    return "Precisa Melhorar 🔧";
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        style: { borderRadius: 16, maxHeight: "90vh" }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <SchoolIcon style={{ marginRight: 8, color: "#2196F3" }} />
            <Typography variant="h5" style={{ fontWeight: "bold" }}>
              Guia de Melhores Práticas - Smart Files
            </Typography>
          </Box>
          <Box display="flex" alignItems="center">
            <Button
              variant="outlined"
              startIcon={<AssessmentIcon />}
              onClick={() => setAssessmentOpen(true)}
              style={{ marginRight: 8 }}
            >
              Auto-Avaliação
            </Button>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Grid container spacing={3}>
          {/* Sidebar com categorias */}
          <Grid item xs={12} md={3}>
            <Paper style={{ padding: 16, borderRadius: 12 }}>
              <Typography variant="h6" gutterBottom>
                📚 Categorias
              </Typography>
              {categories.map((category, index) => (
                <Box
                  key={category.id}
                  onClick={() => setActiveCategory(index)}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    cursor: "pointer",
                    marginBottom: 8,
                    background: activeCategory === index ? category.color : "transparent",
                    color: activeCategory === index ? "white" : "inherit",
                    transition: "all 0.3s ease"
                  }}
                >
                  <Box display="flex" alignItems="center">
                    {category.icon}
                    <Typography variant="body2" style={{ marginLeft: 8 }}>
                      {category.title}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Paper>
          </Grid>

          {/* Conteúdo principal */}
          <Grid item xs={12} md={9}>
            <Box>
              <Typography variant="h4" gutterBottom style={{ color: categories[activeCategory].color }}>
                {categories[activeCategory].title}
              </Typography>

              {categories[activeCategory].practices.map((practice, index) => (
                <Card key={index} className={classes.practiceCard}>
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                      <Typography variant="h6" style={{ fontWeight: "bold" }}>
                        {practice.title}
                      </Typography>
                      <Chip
                        label={practice.level}
                        color={practice.level === "Essencial" ? "secondary" : practice.level === "Importante" ? "primary" : "default"}
                        size="small"
                      />
                    </Box>

                    <Typography variant="body1" gutterBottom style={{ color: "#666" }}>
                      {practice.description}
                    </Typography>

                    {practice.tips && (
                      <Box mt={2}>
                        <Typography variant="subtitle2" gutterBottom>
                          💡 Dicas Práticas:
                        </Typography>
                        <List dense>
                          {practice.tips.map((tip, tipIndex) => (
                            <ListItem key={tipIndex}>
                              <ListItemIcon>
                                <TipIcon color="primary" fontSize="small" />
                              </ListItemIcon>
                              <ListItemText primary={tip} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}

                    {practice.doAndDont && (
                      <Grid container spacing={2} style={{ marginTop: 16 }}>
                        <Grid item xs={12} md={6}>
                          <Card className={classes.successCard}>
                            <CardContent>
                              <Typography variant="subtitle2" gutterBottom>
                                ✅ Faça:
                              </Typography>
                              {practice.doAndDont.do.map((item, i) => (
                                <Typography key={i} variant="body2" style={{ marginBottom: 4 }}>
                                  • {item}
                                </Typography>
                              ))}
                            </CardContent>
                          </Card>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Card className={classes.errorCard}>
                            <CardContent>
                              <Typography variant="subtitle2" gutterBottom>
                                ❌ Não Faça:
                              </Typography>
                              {practice.doAndDont.dont.map((item, i) => (
                                <Typography key={i} variant="body2" style={{ marginBottom: 4 }}>
                                  • {item}
                                </Typography>
                              ))}
                            </CardContent>
                          </Card>
                        </Grid>
                      </Grid>
                    )}

                    {practice.examples && (
                      <Box mt={2}>
                        <Typography variant="subtitle2" gutterBottom>
                          📝 Exemplos:
                        </Typography>
                        {practice.examples.map((example, i) => (
                          <Card key={i} style={{ marginBottom: 8, background: "#f8f9fa" }}>
                            <CardContent style={{ padding: 12 }}>
                              <Typography variant="body2">
                                <strong>{example.scenario}:</strong> {example.strategy} - {example.reason}
                              </Typography>
                            </CardContent>
                          </Card>
                        ))}
                      </Box>
                    )}

                    {practice.kpis && (
                      <Box mt={2}>
                        <Typography variant="subtitle2" gutterBottom>
                          🎯 KPIs Recomendados:
                        </Typography>
                        <Grid container spacing={2}>
                          {practice.kpis.map((kpi, i) => (
                            <Grid item xs={12} sm={6} key={i}>
                              <Card className={classes.metricCard}>
                                <Typography variant="h6" color="primary">
                                  {kpi.target}
                                </Typography>
                                <Typography variant="subtitle2">
                                  {kpi.metric}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  {kpi.description}
                                </Typography>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<PlayIcon />}
          onClick={() => {
            onClose();
            // Aqui você pode redirecionar para configurações
          }}
        >
          Aplicar Práticas
        </Button>
      </DialogActions>

      {/* Dialog de Auto-Avaliação */}
      <Dialog
        open={assessmentOpen}
        onClose={() => setAssessmentOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <AssessmentIcon style={{ marginRight: 8 }} />
            Auto-Avaliação - Smart Files
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Box mb={3}>
            <Card className={classes.scoreCard}>
              <Typography variant="h3" style={{ fontWeight: "bold" }}>
                {calculateScore()}%
              </Typography>
              <Typography variant="h6">
                {getScoreLabel(calculateScore())}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={calculateScore()}
                style={{
                  marginTop: 16,
                  height: 8,
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.3)"
                }}
              />
            </Card>
          </Box>

          <Typography variant="h6" gutterBottom>
            ✅ Checklist de Implementação
          </Typography>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Marque os itens que você já implementou:
          </Typography>

          {checklistItems.map((item) => (
            <Card
              key={item.id}
              className={classes.checklistItem}
              onClick={() => handleCheckItem(item.id)}
              style={{
                background: checkedItems[item.id] ? "#e8f5e8" : "#f5f5f5",
                cursor: "pointer"
              }}
            >
              <CardContent style={{ padding: 12 }}>
                <Box display="flex" alignItems="center">
                  <CheckIcon
                    color={checkedItems[item.id] ? "primary" : "disabled"}
                    style={{ marginRight: 12 }}
                  />
                  <Typography
                    variant="body2"
                    style={{
                      textDecoration: checkedItems[item.id] ? "line-through" : "none",
                      opacity: checkedItems[item.id] ? 0.7 : 1
                    }}
                  >
                    {item.text}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ))}

          <Box mt={3}>
            <Alert severity="info">
              <AlertTitle>Dica</AlertTitle>
              Foque nos itens não marcados para melhorar sua pontuação. 
              Uma implementação completa garante máxima eficiência do sistema!
            </Alert>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setAssessmentOpen(false)}>
            Fechar
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={calculateScore() < 80}
          >
            {calculateScore() >= 80 ? "Parabéns! 🎉" : `Faltam ${Math.ceil((80 - calculateScore()) / 10)} itens`}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default SmartFilesBestPractices;
