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
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
    position: "relative",
    "&:hover": {
      transform: "translateY(-5px)",
      boxShadow: theme.shadows[8],
    },
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(2),
    },
  },
  planCardFeatured: {
    border: `3px solid ${theme.palette.primary.main}`,
    transform: "scale(1.05)",
    [theme.breakpoints.down("md")]: {
      transform: "scale(1)",
    },
  },
  featuredBadge: {
    position: "absolute",
    top: theme.spacing(2),
    right: theme.spacing(2),
  },
  planName: {
    fontWeight: 700,
    fontSize: "1.8rem",
    marginBottom: theme.spacing(1),
    [theme.breakpoints.down("xs")]: {
      fontSize: "1.5rem",
    },
  },
  planPrice: {
    fontSize: "2.5rem",
    fontWeight: 700,
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(0.5),
    [theme.breakpoints.down("xs")]: {
      fontSize: "2rem",
    },
  },
  planRecurrence: {
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(3),
  },
  planFeatures: {
    listStyle: "none",
    padding: 0,
    margin: theme.spacing(2, 0),
    flexGrow: 1,
  },
  planFeatureItem: {
    padding: theme.spacing(1, 0),
    display: "flex",
    alignItems: "center",
    color: theme.palette.text.secondary,
  },
  planFeatureIcon: {
    color: theme.palette.success.main,
    marginRight: theme.spacing(1),
    fontSize: "1.2rem",
  },
  planButton: {
    marginTop: theme.spacing(3),
    padding: theme.spacing(1.5),
    fontSize: "1rem",
    fontWeight: 600,
    textTransform: "none",
  },
  trialBadge: {
    marginTop: theme.spacing(1),
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
      useWhatsapp: "WhatsApp",
      useCampaigns: "Campanhas",
      useKanban: "Kanban",
      useOpenAi: "Inteligência Artificial",
      useSchedules: "Agendamentos",
      useInternalChat: "Chat Interno",
      useExternalApi: "API Externa",
      useIntegrations: "Integrações",
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
    <Box>
      <Typography variant="h2" className={classes.sectionTitle}>
        Planos de Assinatura
      </Typography>
      <Typography variant="h6" className={classes.sectionSubtitle}>
        Escolha o plano ideal para sua empresa
      </Typography>
      <Grid container spacing={4} justifyContent="center">
        {plans.map((plan, index) => {
          const isFeatured = index === Math.floor(plans.length / 2);
          // Extrair features diretamente do objeto plan
          const enabledFeatures = [];
          if (plan.useWhatsapp) enabledFeatures.push("useWhatsapp");
          if (plan.useCampaigns) enabledFeatures.push("useCampaigns");
          if (plan.useKanban) enabledFeatures.push("useKanban");
          if (plan.useOpenAi) enabledFeatures.push("useOpenAi");
          if (plan.useSchedules) enabledFeatures.push("useSchedules");
          if (plan.useInternalChat) enabledFeatures.push("useInternalChat");
          if (plan.useExternalApi) enabledFeatures.push("useExternalApi");
          if (plan.useIntegrations) enabledFeatures.push("useIntegrations");

          return (
            <Grid item xs={12} sm={6} md={4} key={plan.id || index}>
              <Card
                className={`${classes.planCard} ${isFeatured ? classes.planCardFeatured : ""}`}
                variant="outlined"
              >
                {isFeatured && (
                  <Chip
                    icon={<StarIcon />}
                    label="Mais Popular"
                    color="primary"
                    className={classes.featuredBadge}
                  />
                )}
                <CardContent>
                  <Typography variant="h4" className={classes.planName}>
                    {plan.name}
                  </Typography>
                  <Typography variant="h3" className={classes.planPrice}>
                    {formatPrice(plan.amount)}
                  </Typography>
                  <Typography variant="body2" className={classes.planRecurrence}>
                    /{plan.recurrence || "mês"}
                  </Typography>
                  <ul className={classes.planFeatures}>
                    <li className={classes.planFeatureItem}>
                      <CheckIcon className={classes.planFeatureIcon} />
                      <span>{plan.users} Usuários</span>
                    </li>
                    <li className={classes.planFeatureItem}>
                      <CheckIcon className={classes.planFeatureIcon} />
                      <span>{plan.connections} Conexões WhatsApp</span>
                    </li>
                    <li className={classes.planFeatureItem}>
                      <CheckIcon className={classes.planFeatureIcon} />
                      <span>{plan.queues} Filas de Atendimento</span>
                    </li>
                    {enabledFeatures.map((feature, featureIndex) => (
                      <li key={featureIndex} className={classes.planFeatureItem}>
                        <CheckIcon className={classes.planFeatureIcon} />
                        <span>{getFeatureLabel(feature)}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.trial && (
                    <Chip
                      label={`${plan.trialDays || 14} dias grátis`}
                      color="secondary"
                      size="small"
                      className={classes.trialBadge}
                    />
                  )}
                  <Button
                    variant={isFeatured ? "contained" : "outlined"}
                    color="primary"
                    fullWidth
                    className={classes.planButton}
                    onClick={scrollToForm}
                  >
                    Assinar Agora
                  </Button>
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

