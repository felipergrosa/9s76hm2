import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Checkbox,
  FormControlLabel,
  Alert,
  AlertTitle,
  Divider,
  IconButton,
  Tooltip,
  Badge
} from "@material-ui/core";
import {
  ShoppingCart as ShoppingIcon,
  Support as SupportIcon,
  AccountBalance as FinanceIcon,
  Group as HRIcon,
  Campaign as MarketingIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon,
  PlayArrow as PlayIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  Psychology as AIIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  TrendingUp as TrendingIcon,
  Close as CloseIcon
} from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(3)
  },
  templateCard: {
    height: "100%",
    borderRadius: 16,
    transition: "all 0.3s ease",
    cursor: "pointer",
    position: "relative",
    overflow: "hidden",
    "&:hover": {
      transform: "translateY(-8px)",
      boxShadow: theme.shadows[12]
    }
  },
  selectedCard: {
    border: `3px solid ${theme.palette.primary.main}`,
    background: "linear-gradient(135deg, rgba(33, 150, 243, 0.1) 0%, rgba(33, 150, 243, 0.05) 100%)"
  },
  cardHeader: {
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    padding: theme.spacing(2),
    position: "relative",
    "&::after": {
      content: '""',
      position: "absolute",
      top: 0,
      right: 0,
      width: "60px",
      height: "60px",
      background: "rgba(255,255,255,0.1)",
      borderRadius: "50%",
      transform: "translate(20px, -20px)"
    }
  },
  strategyChip: {
    fontWeight: "bold",
    color: "white"
  },
  benefitsList: {
    "& .MuiListItem-root": {
      paddingLeft: 0,
      paddingRight: 0
    }
  },
  setupDialog: {
    "& .MuiDialog-paper": {
      borderRadius: 16,
      maxWidth: 800
    }
  },
  stepContent: {
    padding: theme.spacing(2),
    background: "#f5f5f5",
    borderRadius: 8,
    margin: theme.spacing(1, 0)
  },
  previewCard: {
    background: "linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)",
    borderRadius: 12,
    padding: theme.spacing(2),
    margin: theme.spacing(1, 0)
  },
  successBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    background: "#4CAF50",
    color: "white"
  }
}));

const QueueTemplateGallery = ({ open, onClose, onTemplatesSelected }) => {
  const classes = useStyles();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [setupStep, setSetupStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    try {
      // Dados mockados dos templates
      const mockTemplates = [
        {
          id: 1,
          name: "Vendas - Catálogo Automático",
          icon: <ShoppingIcon />,
          color: "#2196F3",
          strategy: "on_enter",
          strategyLabel: "Automático",
          description: "Envio automático de catálogo quando cliente entra na fila",
          useCase: "E-commerce, Lojas, Varejo",
          benefits: [
            "Aumento de 40% nas vendas",
            "Redução de 60% no tempo de atendimento",
            "Engajamento imediato do cliente"
          ],
          features: ["IA para análise de interesse", "Catálogos personalizados", "Métricas de conversão"],
          confirmationTemplate: "Olá {{name}}! 👋 Bem-vindo à nossa loja!\n\nGostaria de receber nosso catálogo de produtos atualizado?\n\nDigite:\n*1* - SIM, quero o catálogo\n*2* - NÃO, obrigado",
          maxFiles: 3,
          example: {
            customer: "Olá, preciso de ajuda",
            bot: "Bem-vindo! Escolha: 1-Vendas",
            customerResponse: "1",
            botResponse: "Olá João! Gostaria de receber nosso catálogo?",
            result: "📄 [Envia catálogo automaticamente]"
          }
        },
        {
          id: 2,
          name: "Suporte - Sob Demanda",
          icon: <SupportIcon />,
          color: "#FF9800",
          strategy: "on_request",
          strategyLabel: "Inteligente",
          description: "IA analisa mensagens e sugere arquivos relevantes",
          useCase: "Suporte Técnico, Help Desk, FAQ",
          benefits: [
            "Resolução 70% mais rápida",
            "Satisfação 85% maior",
            "Redução de tickets repetitivos"
          ],
          features: ["Análise semântica com GPT", "Detecção de intenção", "Sugestões contextuais"],
          confirmationTemplate: "Encontrei materiais que podem ajudar com sua dúvida! 🔍\n\nGostaria que eu envie?\n\n*1* - SIM, envie os materiais\n*2* - NÃO, prefiro falar com atendente",
          maxFiles: 2,
          example: {
            customer: "Não consigo instalar o software",
            bot: "IA detecta: problema + instalação + software",
            botResponse: "Encontrei o manual de instalação. Envio?",
            result: "📖 [Envia manual específico]"
          }
        },
        {
          id: 3,
          name: "Financeiro - Manual",
          icon: <FinanceIcon />,
          color: "#4CAF50",
          strategy: "manual",
          strategyLabel: "Controlado",
          description: "Controle total - apenas agentes decidem quando enviar",
          useCase: "Financeiro, Contratos, Documentação",
          benefits: [
            "Segurança máxima",
            "Controle total do processo",
            "Conformidade garantida"
          ],
          features: ["Aprovação obrigatória", "Logs detalhados", "Auditoria completa"],
          confirmationTemplate: "Vou enviar os documentos solicitados. 📄\n\nPor favor, aguarde um momento...",
          maxFiles: 5,
          example: {
            customer: "Preciso do contrato",
            agent: "Agente avalia e decide",
            agentAction: "Aprova envio do contrato",
            result: "📋 [Envia documento aprovado]"
          }
        },
        {
          id: 4,
          name: "RH - Políticas",
          icon: <HRIcon />,
          color: "#9C27B0",
          strategy: "on_request",
          strategyLabel: "Inteligente",
          description: "Envio inteligente de políticas e procedimentos",
          useCase: "Recursos Humanos, Onboarding, Políticas",
          benefits: [
            "Acesso rápido a informações",
            "Redução de dúvidas repetitivas",
            "Onboarding mais eficiente"
          ],
          features: ["Busca por palavras-chave", "Políticas atualizadas", "Histórico de consultas"],
          confirmationTemplate: "Olá {{name}}! 👥\n\nEncontrei informações sobre políticas da empresa.\n\nDeseja receber?\n\n*1* - SIM\n*2* - NÃO",
          maxFiles: 4,
          example: {
            employee: "Política de férias",
            bot: "IA identifica: política + férias",
            botResponse: "Encontrei a política de férias. Envio?",
            result: "📑 [Envia política específica]"
          }
        },
        {
          id: 5,
          name: "Marketing - Proativo",
          icon: <MarketingIcon />,
          color: "#E91E63",
          strategy: "on_enter",
          strategyLabel: "Proativo",
          description: "Envio proativo de materiais promocionais",
          useCase: "Marketing, Promoções, Campanhas",
          benefits: [
            "Engajamento imediato",
            "Aumento de conversões",
            "Campanhas automatizadas"
          ],
          features: ["Segmentação automática", "Materiais sazonais", "A/B testing"],
          confirmationTemplate: "🎯 Novidades exclusivas para você!\n\nTemos materiais promocionais incríveis!\n\nQuer receber?\n\n*1* - SIM, quero as novidades!\n*2* - Talvez depois",
          maxFiles: 3,
          example: {
            customer: "Olá",
            bot: "Detecta entrada na fila de marketing",
            botResponse: "Novidades exclusivas! Quer receber?",
            result: "🎁 [Envia materiais promocionais]"
          }
        }
      ];

      setTemplates(mockTemplates);
    } catch (error) {
      toast.error("Erro ao carregar templates");
    }
  };

  const handleTemplateSelect = (template) => {
    const isSelected = selectedTemplates.find(t => t.id === template.id);
    if (isSelected) {
      setSelectedTemplates(selectedTemplates.filter(t => t.id !== template.id));
    } else {
      setSelectedTemplates([...selectedTemplates, template]);
    }
  };

  const handleSetupComplete = async () => {
    setLoading(true);
    try {
      // Simular criação das filas
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success(`${selectedTemplates.length} filas criadas com sucesso!`);
      onTemplatesSelected(selectedTemplates);
      onClose();
    } catch (error) {
      toast.error("Erro ao criar filas");
    } finally {
      setLoading(false);
    }
  };

  const getStrategyColor = (strategy) => {
    const colors = {
      on_enter: "#4CAF50",
      on_request: "#FF9800", 
      manual: "#2196F3"
    };
    return colors[strategy] || "#757575";
  };

  const getStrategyIcon = (strategy) => {
    const icons = {
      on_enter: <SpeedIcon />,
      on_request: <AIIcon />,
      manual: <SecurityIcon />
    };
    return icons[strategy] || <SettingsIcon />;
  };

  const setupSteps = [
    {
      label: "Escolher Templates",
      content: (
        <Box>
          <Typography variant="body1" gutterBottom>
            Selecione os templates que melhor se adequam ao seu negócio:
          </Typography>
          <Grid container spacing={2}>
            {templates.map((template) => (
              <Grid item xs={12} sm={6} md={4} key={template.id}>
                <Card 
                  className={`${classes.templateCard} ${
                    selectedTemplates.find(t => t.id === template.id) ? classes.selectedCard : ''
                  }`}
                  onClick={() => handleTemplateSelect(template)}
                >
                  {selectedTemplates.find(t => t.id === template.id) && (
                    <Badge className={classes.successBadge} overlap="rectangular">
                      <CheckIcon />
                    </Badge>
                  )}
                  
                  <Box className={classes.cardHeader}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Avatar style={{ background: "rgba(255,255,255,0.2)", marginRight: 8 }}>
                        {template.icon}
                      </Avatar>
                      <Typography variant="h6" style={{ fontWeight: "bold" }}>
                        {template.name.split(" - ")[0]}
                      </Typography>
                    </Box>
                    <Chip 
                      label={template.strategyLabel}
                      size="small"
                      style={{ 
                        background: getStrategyColor(template.strategy),
                        color: "white"
                      }}
                      icon={getStrategyIcon(template.strategy)}
                    />
                  </Box>

                  <CardContent>
                    <Typography variant="body2" gutterBottom>
                      {template.description}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
                      💼 {template.useCase}
                    </Typography>
                    
                    <Box mt={2}>
                      <Typography variant="subtitle2" gutterBottom>
                        🎯 Benefícios:
                      </Typography>
                      {template.benefits.slice(0, 2).map((benefit, index) => (
                        <Typography key={index} variant="caption" display="block">
                          • {benefit}
                        </Typography>
                      ))}
                    </Box>
                  </CardContent>

                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<InfoIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewTemplate(template);
                      }}
                    >
                      Ver Detalhes
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )
    },
    {
      label: "Revisar Seleção",
      content: (
        <Box>
          <Typography variant="body1" gutterBottom>
            Você selecionou {selectedTemplates.length} template(s):
          </Typography>
          {selectedTemplates.map((template, index) => (
            <Card key={template.id} className={classes.previewCard} style={{ marginBottom: 16 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center">
                  <Avatar style={{ background: template.color, marginRight: 16 }}>
                    {template.icon}
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{template.name}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {template.description}
                    </Typography>
                    <Chip 
                      label={`Estratégia: ${template.strategyLabel}`}
                      size="small"
                      style={{ marginTop: 8 }}
                    />
                  </Box>
                </Box>
                <IconButton onClick={() => handleTemplateSelect(template)}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </Card>
          ))}
          
          {selectedTemplates.length === 0 && (
            <Alert severity="warning">
              <AlertTitle>Nenhum template selecionado</AlertTitle>
              Volte e selecione pelo menos um template para continuar.
            </Alert>
          )}
        </Box>
      )
    },
    {
      label: "Configuração Final",
      content: (
        <Box>
          <Alert severity="info" style={{ marginBottom: 16 }}>
            <AlertTitle>Pronto para criar!</AlertTitle>
            As filas serão criadas com as configurações padrão. Você pode personalizá-las depois.
          </Alert>
          
          <Typography variant="body1" gutterBottom>
            O que será criado:
          </Typography>
          
          <List>
            {selectedTemplates.map((template, index) => (
              <ListItem key={template.id}>
                <ListItemIcon>
                  <CheckIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={template.name}
                  secondary={`Máx. ${template.maxFiles} arquivos por sessão • Estratégia: ${template.strategyLabel}`}
                />
              </ListItem>
            ))}
          </List>

          <Divider style={{ margin: "16px 0" }} />

          <Typography variant="body2" color="textSecondary">
            💡 Dica: Após a criação, você pode configurar listas de arquivos, 
            personalizar templates de confirmação e ajustar configurações avançadas.
          </Typography>
        </Box>
      )
    }
  ];

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        className={classes.setupDialog}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center">
              <SettingsIcon style={{ marginRight: 8 }} />
              Galeria de Templates - Smart Files
            </Box>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Stepper activeStep={setupStep} orientation="vertical">
            {setupSteps.map((step, index) => (
              <Step key={index}>
                <StepLabel>{step.label}</StepLabel>
                <StepContent>
                  <Box className={classes.stepContent}>
                    {step.content}
                  </Box>
                  <Box mt={2}>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => {
                        if (setupStep === setupSteps.length - 1) {
                          handleSetupComplete();
                        } else {
                          setSetupStep(setupStep + 1);
                        }
                      }}
                      disabled={
                        loading || 
                        (setupStep === 0 && selectedTemplates.length === 0)
                      }
                      style={{ marginRight: 8 }}
                    >
                      {loading ? "Criando..." : setupStep === setupSteps.length - 1 ? "Criar Filas" : "Próximo"}
                    </Button>
                    <Button
                      disabled={setupStep === 0 || loading}
                      onClick={() => setSetupStep(setupStep - 1)}
                    >
                      Voltar
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog
        open={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        maxWidth="md"
        fullWidth
      >
        {previewTemplate && (
          <>
            <DialogTitle>
              <Box display="flex" alignItems="center">
                <Avatar style={{ background: previewTemplate.color, marginRight: 16 }}>
                  {previewTemplate.icon}
                </Avatar>
                <Box>
                  <Typography variant="h6">{previewTemplate.name}</Typography>
                  <Chip 
                    label={previewTemplate.strategyLabel}
                    size="small"
                    style={{ 
                      background: getStrategyColor(previewTemplate.strategy),
                      color: "white"
                    }}
                  />
                </Box>
              </Box>
            </DialogTitle>
            
            <DialogContent>
              <Typography variant="body1" gutterBottom>
                {previewTemplate.description}
              </Typography>
              
              <Box mt={3}>
                <Typography variant="h6" gutterBottom>🎯 Benefícios</Typography>
                <List className={classes.benefitsList}>
                  {previewTemplate.benefits.map((benefit, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <TrendingIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText primary={benefit} />
                    </ListItem>
                  ))}
                </List>
              </Box>

              <Box mt={3}>
                <Typography variant="h6" gutterBottom>⚡ Funcionalidades</Typography>
                <Box>
                  {previewTemplate.features.map((feature, index) => (
                    <Chip
                      key={index}
                      label={feature}
                      variant="outlined"
                      style={{ margin: "4px 8px 4px 0" }}
                    />
                  ))}
                </Box>
              </Box>

              <Box mt={3}>
                <Typography variant="h6" gutterBottom>💬 Exemplo de Uso</Typography>
                <Card style={{ background: "#f5f5f5", padding: 16 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>👤 Cliente:</strong> {previewTemplate.example.customer}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>🤖 Sistema:</strong> {previewTemplate.example.bot || previewTemplate.example.botResponse}
                  </Typography>
                  {previewTemplate.example.customerResponse && (
                    <Typography variant="body2" gutterBottom>
                      <strong>👤 Cliente:</strong> {previewTemplate.example.customerResponse}
                    </Typography>
                  )}
                  <Typography variant="body2" gutterBottom>
                    <strong>✅ Resultado:</strong> {previewTemplate.example.result}
                  </Typography>
                </Card>
              </Box>

              <Box mt={3}>
                <Typography variant="h6" gutterBottom>📝 Template de Confirmação</Typography>
                <Card style={{ background: "#e3f2fd", padding: 16 }}>
                  <Typography variant="body2" style={{ whiteSpace: "pre-line" }}>
                    {previewTemplate.confirmationTemplate}
                  </Typography>
                </Card>
              </Box>
            </DialogContent>
            
            <DialogActions>
              <Button onClick={() => setPreviewTemplate(null)}>
                Fechar
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  handleTemplateSelect(previewTemplate);
                  setPreviewTemplate(null);
                }}
              >
                {selectedTemplates.find(t => t.id === previewTemplate.id) ? "Remover" : "Selecionar"}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
};

export default QueueTemplateGallery;
