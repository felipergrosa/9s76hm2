import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Typography, Grid, Box, Card, CardContent, Button, Chip, CircularProgress } from "@material-ui/core";
import CheckIcon from "@material-ui/icons/Check";
import StarIcon from "@material-ui/icons/Star";

const useStyles = makeStyles((theme) => ({
  sectionTitle: {
    fontWeight: 700,
    marginBottom: theme.spacing(1),
    textAlign: "center",
  },
  sectionSubtitle: {
    textAlign: "center",
    marginBottom: theme.spacing(6),
    color: theme.palette.text.secondary,
  },
  planCard: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    padding: theme.spacing(3),
    borderRadius: "16px",
    transition: "all 0.3s ease",
    position: "relative",
    border: "1px solid rgba(0,0,0,0.08)",
    "&:hover": {
      transform: "translateY(-8px)",
      boxShadow: "0 12px 24px rgba(0,0,0,0.1)",
    },
  },
  planCardFeatured: {
    border: `2px solid ${theme.palette.primary.main}`,
    transform: "scale(1.05)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
    zIndex: 2,
    [theme.breakpoints.down("md")]: {
      transform: "scale(1)",
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2),
    },
    "&:hover": {
      transform: "scale(1.05) translateY(-8px)",
      boxShadow: "0 16px 32px rgba(0,0,0,0.15)",
    },
  },
  featuredBadge: {
    position: "absolute",
    top: theme.spacing(2),
    right: theme.spacing(2),
    backgroundColor: theme.palette.primary.main,
    color: "#fff",
    fontWeight: 600,
  },
  planName: {
    fontWeight: 800,
    fontSize: "1.5rem",
    marginBottom: theme.spacing(1),
    color: theme.palette.text.primary,
  },
  planPrice: {
    fontSize: "3rem",
    fontWeight: 800,
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(0.5),
    lineHeight: 1,
  },
  planRecurrence: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(4),
    fontSize: "1rem",
    fontWeight: 500,
  },
  planFeatures: {
    listStyle: "none",
    padding: 0,
    margin: theme.spacing(0, 0, 4, 0),
    flexGrow: 1,
  },
  planFeatureItem: {
    padding: theme.spacing(1.2, 0),
    display: "flex",
    alignItems: "center",
    color: theme.palette.text.secondary,
    fontSize: "0.95rem",
    borderBottom: "1px dashed rgba(0,0,0,0.05)",
    "&:last-child": {
      borderBottom: "none",
    },
  },
  planFeatureIcon: {
    color: theme.palette.success.main,
    marginRight: theme.spacing(1.5),
    fontSize: "1.1rem",
  },
  planButton: {
    padding: theme.spacing(1.5),
    fontSize: "1rem",
    fontWeight: 700,
    textTransform: "none",
    borderRadius: "8px",
    boxShadow: "none",
    "&:hover": {
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    },
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "400px",
  },
}));

const Plans = ({ plans, loading }) => {
  const classes = useStyles();

  const formatPrice = (amount) => {
    if (!amount) return "R$ 0,00";
    const numAmount = parseFloat(amount);
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(numAmount);
  };

  const getFeatureLabel = (feature) => {
    const labels = {
      useWhatsapp: "Conexão WhatsApp",
      useCampaigns: "Campanhas em Massa",
      useKanban: "Kanban de Atendimento",
      useOpenAi: "Inteligência Artificial (ChatGPT)",
      useSchedules: "Agendamento de Mensagens",
      useInternalChat: "Chat Interno da Equipe",
      useExternalApi: "API para Integrações",
      useIntegrations: "Webhooks e Integrações",
    };
    return labels[feature] || feature;
  };

  const scrollToForm = () => {
    const formElement = document.getElementById("lead-form");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (loading) {
    return (
      <Box className={classes.loadingContainer}>
        <CircularProgress />
      </Box>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <Box>
        <Typography variant="h2" className={classes.sectionTitle}>
          Planos de Assinatura
        </Typography>
        <Typography variant="h6" className={classes.sectionSubtitle}>
          Escolha o plano ideal para sua empresa
        </Typography>
        <Typography variant="body1" align="center" color="textSecondary">
          Carregando planos...
        </Typography>
      </Box>
    );
  }

  return (
    <Box id="plans">
      <Typography variant="h2" className={classes.sectionTitle}>
        Planos Flexíveis
      </Typography>
      <Typography variant="h6" className={classes.sectionSubtitle}>
        Escale seu atendimento com o plano perfeito para o seu momento
      </Typography>
      <Grid container spacing={4} justifyContent="center" alignItems="stretch">
        {plans.map((plan, index) => {
          // Lógica melhorada para destaque: destaca o plano do meio ou o que tiver "Premium" no nome
          const isFeatured = plan.name.toLowerCase().includes("premium") || (plans.length === 3 && index === 1);

          const enabledFeatures = [
            plan.useWhatsapp && "useWhatsapp",
            plan.useCampaigns && "useCampaigns",
            plan.useKanban && "useKanban",
            plan.useOpenAi && "useOpenAi",
            plan.useSchedules && "useSchedules",
            plan.useInternalChat && "useInternalChat",
            plan.useExternalApi && "useExternalApi",
            plan.useIntegrations && "useIntegrations",
          ].filter(Boolean);

          return (
            <Grid item xs={12} sm={6} md={4} key={plan.id || index}>
              <Card
                className={`${classes.planCard} ${isFeatured ? classes.planCardFeatured : ""}`}
                elevation={isFeatured ? 8 : 0}
              >
                {isFeatured && (
                  <Chip
                    icon={<StarIcon style={{ color: "#fff", fontSize: 16 }} />}
                    label="Recomendado"
                    className={classes.featuredBadge}
                    size="small"
                  />
                )}
                <CardContent style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <Typography variant="h4" className={classes.planName}>
                    {plan.name}
                  </Typography>
                  <Box display="flex" alignItems="baseline">
                    <Typography variant="h3" className={classes.planPrice}>
                      {formatPrice(plan.amount)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" className={classes.planRecurrence}>
                    por {plan.recurrence === "MENSAL" ? "mês" : plan.recurrence || "mês"}
                  </Typography>

                  <ul className={classes.planFeatures}>
                    <li className={classes.planFeatureItem}>
                      <CheckIcon className={classes.planFeatureIcon} />
                      <span style={{ fontWeight: 600 }}>{plan.users} Usuários</span>
                    </li>
                    <li className={classes.planFeatureItem}>
                      <CheckIcon className={classes.planFeatureIcon} />
                      <span style={{ fontWeight: 600 }}>{plan.connections} Conexões WhatsApp</span>
                    </li>
                    <li className={classes.planFeatureItem}>
                      <CheckIcon className={classes.planFeatureIcon} />
                      <span style={{ fontWeight: 600 }}>{plan.queues} Filas de Atendimento</span>
                    </li>
                    {enabledFeatures.map((feature, featureIndex) => (
                      <li key={featureIndex} className={classes.planFeatureItem}>
                        <CheckIcon className={classes.planFeatureIcon} />
                        <span>{getFeatureLabel(feature)}</span>
                      </li>
                    ))}
                  </ul>

                  <Box mt="auto">
                    {plan.trial && (
                      <Box mb={2} display="flex" justifyContent="center">
                        <Chip
                          label={`Teste Grátis por ${plan.trialDays || 14} dias`}
                          color="secondary"
                          variant="outlined"
                          size="small"
                        />
                      </Box>
                    )}
                    <Button
                      variant={isFeatured ? "contained" : "outlined"}
                      color="primary"
                      fullWidth
                      className={classes.planButton}
                      onClick={scrollToForm}
                    >
                      {isFeatured ? "Assinar Agora" : "Escolher este Plano"}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default Plans;

