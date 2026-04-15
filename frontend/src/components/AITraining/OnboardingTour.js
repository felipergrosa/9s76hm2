import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Fade,
  Tooltip,
  IconButton,
  Stepper,
  Step,
  StepLabel,
  MobileStepper
} from "@material-ui/core";
import {
  makeStyles
} from "@material-ui/core/styles";
import {
  Close as CloseIcon,
  NavigateNext as NextIcon,
  NavigateBefore as BackIcon,
  Help as HelpIcon,
  PlayArrow as StartIcon,
  School as TutorialIcon,
  FlashOn as FlashIcon,
  Settings as ConfigIcon,
  Assessment as MetricsIcon,
  Code as FlowIcon,
  BugReport as TestIcon
} from "@material-ui/icons";

const useStyles = makeStyles((theme) => ({
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    zIndex: 9998,
    backdropFilter: "blur(2px)"
  },
  spotlight: {
    position: "absolute",
    borderRadius: 8,
    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.7), 0 0 20px 4px rgba(25, 118, 210, 0.5)",
    transition: "all 0.4s ease-in-out",
    zIndex: 9999,
    pointerEvents: "none"
  },
  tooltipCard: {
    position: "absolute",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: theme.spacing(3),
    maxWidth: 400,
    minWidth: 320,
    boxShadow: theme.shadows[10],
    zIndex: 10000,
    transition: "all 0.3s ease-in-out"
  },
  tooltipHeader: {
    display: "flex",
    alignItems: "center",
    marginBottom: theme.spacing(2)
  },
  tooltipIcon: {
    fontSize: 32,
    marginRight: theme.spacing(1.5),
    color: theme.palette.primary.main
  },
  tooltipTitle: {
    fontWeight: 600,
    fontSize: "1.1rem"
  },
  tooltipContent: {
    marginBottom: theme.spacing(2),
    color: theme.palette.text.secondary,
    lineHeight: 1.6
  },
  tooltipActions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing(2)
  },
  stepIndicator: {
    display: "flex",
    gap: theme.spacing(0.5)
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: theme.palette.grey[300],
    transition: "all 0.2s",
    cursor: "pointer",
    "&:hover": {
      backgroundColor: theme.palette.grey[400]
    }
  },
  stepDotActive: {
    backgroundColor: theme.palette.primary.main,
    width: 24,
    borderRadius: 4
  },
  floatingButton: {
    position: "fixed",
    bottom: theme.spacing(3),
    right: theme.spacing(3),
    zIndex: 1000,
    backgroundColor: theme.palette.primary.main,
    color: "#fff",
    boxShadow: theme.shadows[6],
    "&:hover": {
      backgroundColor: theme.palette.primary.dark,
      transform: "scale(1.05)"
    },
    transition: "all 0.2s"
  },
  pulse: {
    animation: "$pulse 2s infinite"
  },
  "@keyframes pulse": {
    "0%": {
      boxShadow: "0 0 0 0 rgba(25, 118, 210, 0.7)"
    },
    "70%": {
      boxShadow: "0 0 0 20px rgba(25, 118, 210, 0)"
    },
    "100%": {
      boxShadow: "0 0 0 0 rgba(25, 118, 210, 0)"
    }
  },
  welcomeCard: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: theme.spacing(4),
    maxWidth: 500,
    textAlign: "center",
    boxShadow: theme.shadows[10],
    zIndex: 10001
  },
  welcomeIcon: {
    fontSize: 64,
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(2)
  },
  featureList: {
    textAlign: "left",
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2)
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    marginBottom: theme.spacing(1),
    padding: theme.spacing(1),
    borderRadius: 8,
    backgroundColor: theme.palette.grey[50]
  },
  featureIcon: {
    marginRight: theme.spacing(1),
    color: theme.palette.success.main,
    fontSize: 20
  }
}));

// Configuração dos 6 passos do tour
const TOUR_STEPS = [
  {
    id: "welcome",
    title: "Bem-vindo ao AI Training!",
    description: "Treine seus agentes de IA para atendimento autônomo com feedback em tempo real.",
    icon: TutorialIcon,
    target: null,
    placement: "center"
  },
  {
    id: "sandbox",
    title: "1. Sandbox de Testes",
    description: "Teste seu agente em tempo real. Simule conversas, veja respostas e ajuste o comportamento instantaneamente.",
    icon: FlashIcon,
    target: "[data-tour=\"sandbox\"]",
    placement: "right"
  },
  {
    id: "prompt-assistant",
    title: "2. Assistente de Prompt",
    description: "Otimize seus prompts automaticamente. Nossa IA sugere melhorias baseadas em boas práticas.",
    icon: ConfigIcon,
    target: "[data-tour=\"prompt-assistant\"]",
    placement: "right"
  },
  {
    id: "test-scenarios",
    title: "3. Cenários de Teste",
    description: "Crie e execute testes automatizados. Valide se o agente responde corretamente a diferentes situações.",
    icon: TestIcon,
    target: "[data-tour=\"test-scenarios\"]",
    placement: "right"
  },
  {
    id: "flow-visualization",
    title: "4. Visualização de Fluxo",
    description: "Veja o fluxo de decisão do agente em um diagrama interativo. Entenda como as diretrizes são aplicadas.",
    icon: FlowIcon,
    target: "[data-tour=\"flow-visualization\"]",
    placement: "right"
  },
  {
    id: "metrics",
    title: "5. Métricas e Analytics",
    description: "Acompanhe performance, custos, qualidade das respostas e feedback dos usuários em tempo real.",
    icon: MetricsIcon,
    target: "[data-tour=\"metrics\"]",
    placement: "right"
  }
];

const STORAGE_KEY = "ai-training-tour-completed";
const STORAGE_KEY_FIRST_VISIT = "ai-training-first-visit";

const OnboardingTour = ({ onComplete, onSkip }) => {
  const classes = useStyles();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showFloatingButton, setShowFloatingButton] = useState(false);

  // Verificar primeira visita
  useEffect(() => {
    const hasCompleted = localStorage.getItem(STORAGE_KEY);
    const hasVisited = localStorage.getItem(STORAGE_KEY_FIRST_VISIT);
    
    if (!hasVisited) {
      // Primeira vez no sistema
      localStorage.setItem(STORAGE_KEY_FIRST_VISIT, "true");
      setTimeout(() => setShowWelcome(true), 1000);
    } else if (!hasCompleted) {
      // Já visitou mas não completou o tour
      setShowFloatingButton(true);
    } else {
      // Já completou, mostrar botão minimizado
      setShowFloatingButton(true);
    }
  }, []);

  // Atualizar posição do spotlight
  useEffect(() => {
    if (!isOpen || currentStep === 0) {
      setTargetRect(null);
      return;
    }

    const step = TOUR_STEPS[currentStep];
    if (step.target) {
      const element = document.querySelector(step.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect({
          top: rect.top - 8,
          left: rect.left - 8,
          width: rect.width + 16,
          height: rect.height + 16
        });
      }
    }
  }, [isOpen, currentStep]);

  const startTour = () => {
    setShowWelcome(false);
    setIsOpen(true);
    setCurrentStep(0);
  };

  const nextStep = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const goToStep = (index) => {
    setCurrentStep(index);
  };

  const completeTour = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsOpen(false);
    setShowFloatingButton(true);
    if (onComplete) onComplete();
  };

  const skipTour = () => {
    setIsOpen(false);
    setShowWelcome(false);
    setShowFloatingButton(true);
    if (onSkip) onSkip();
  };

  const restartTour = () => {
    setCurrentStep(0);
    setIsOpen(true);
  };

  const renderWelcomeCard = () => (
    <Fade in={showWelcome}>
      <Paper className={classes.welcomeCard} elevation={10}>
        <TutorialIcon className={classes.welcomeIcon} />
        <Typography variant="h4" gutterBottom style={{ fontWeight: 600 }}>
          Bem-vindo ao AI Training!
        </Typography>
        <Typography variant="body1" color="textSecondary" paragraph>
          Aprenda a criar agentes de IA poderosos em apenas 5 passos.
        </Typography>
        
        <Box className={classes.featureList}>
          <Box className={classes.featureItem}>
            <FlashIcon className={classes.featureIcon} />
            <Typography variant="body2">Teste em tempo real</Typography>
          </Box>
          <Box className={classes.featureItem}>
            <ConfigIcon className={classes.featureIcon} />
            <Typography variant="body2">Otimize prompts com IA</Typography>
          </Box>
          <Box className={classes.featureItem}>
            <TestIcon className={classes.featureIcon} />
            <Typography variant="body2">Valide com cenários automatizados</Typography>
          </Box>
          <Box className={classes.featureItem}>
            <MetricsIcon className={classes.featureIcon} />
            <Typography variant="body2">Acompanhe métricas de performance</Typography>
          </Box>
        </Box>

        <Box display="flex" gap={2} justifyContent="center" mt={3}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<StartIcon />}
            onClick={startTour}
          >
            Iniciar Tour
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={skipTour}
          >
            Pular
          </Button>
        </Box>
        <Box mt={2}>
          <Typography variant="caption" color="textSecondary">
            Você pode reiniciar o tour a qualquer momento pelo botão de ajuda
          </Typography>
        </Box>
      </Paper>
    </Fade>
  );

  const renderSpotlight = () => {
    if (!isOpen || currentStep === 0 || !targetRect) return null;

    return (
      <Box
        className={classes.spotlight}
        style={{
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height
        }}
      />
    );
  };

  const renderTooltip = () => {
    if (!isOpen) return null;

    const step = TOUR_STEPS[currentStep];
    const StepIcon = step.icon;

    // Calcular posição do tooltip
    let tooltipStyle = {};
    if (currentStep === 0) {
      // Centralizado para welcome
      tooltipStyle = {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)"
      };
    } else if (targetRect) {
      // Posicionado próximo ao target
      const placement = step.placement;
      const spacing = 20;
      
      switch (placement) {
        case "right":
          tooltipStyle = {
            top: targetRect.top,
            left: targetRect.left + targetRect.width + spacing
          };
          break;
        case "left":
          tooltipStyle = {
            top: targetRect.top,
            left: targetRect.left - 420 - spacing
          };
          break;
        case "bottom":
          tooltipStyle = {
            top: targetRect.top + targetRect.height + spacing,
            left: targetRect.left
          };
          break;
        case "top":
          tooltipStyle = {
            top: targetRect.top - 300 - spacing,
            left: targetRect.left
          };
          break;
        default:
          tooltipStyle = {
            top: targetRect.top,
            left: targetRect.left + targetRect.width + spacing
          };
      }
    }

    return (
      <Fade in={isOpen}>
        <Paper
          className={classes.tooltipCard}
          style={tooltipStyle}
          elevation={10}
        >
          <Box className={classes.tooltipHeader}>
            <StepIcon className={classes.tooltipIcon} />
            <Typography className={classes.tooltipTitle}>
              {step.title}
            </Typography>
          </Box>
          
          <Typography className={classes.tooltipContent}>
            {step.description}
          </Typography>

          <Box className={classes.stepIndicator}>
            {TOUR_STEPS.map((_, index) => (
              <Box
                key={index}
                className={`${classes.stepDot} ${index === currentStep ? classes.stepDotActive : ""}`}
                onClick={() => goToStep(index)}
              />
            ))}
          </Box>

          <Box className={classes.tooltipActions}>
            <Button
              size="small"
              onClick={skipTour}
              color="inherit"
            >
              Sair
            </Button>
            
            <Box display="flex" gap={1}>
              {currentStep > 0 && (
                <Button
                  size="small"
                  startIcon={<BackIcon />}
                  onClick={prevStep}
                >
                  Voltar
                </Button>
              )}
              <Button
                variant="contained"
                size="small"
                color="primary"
                endIcon={currentStep === TOUR_STEPS.length - 1 ? null : <NextIcon />}
                onClick={nextStep}
              >
                {currentStep === TOUR_STEPS.length - 1 ? "Concluir" : "Próximo"}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Fade>
    );
  };

  return (
    <>
      {/* Welcome Card */}
      {showWelcome && renderWelcomeCard()}

      {/* Tour Overlay */}
      {isOpen && (
        <>
          <Box className={classes.overlay} onClick={skipTour} />
          {renderSpotlight()}
          {renderTooltip()}
        </>
      )}

      {/* Floating Help Button */}
      {showFloatingButton && (
        <Tooltip title="Ajuda - Reiniciar Tour" placement="left">
          <IconButton
            className={`${classes.floatingButton} ${!localStorage.getItem(STORAGE_KEY) ? classes.pulse : ""}`}
            onClick={restartTour}
            size="medium"
          >
            <HelpIcon />
          </IconButton>
        </Tooltip>
      )}
    </>
  );
};

export default OnboardingTour;
