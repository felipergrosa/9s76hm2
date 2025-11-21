import React, { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Typography, Grid, Box, Card, CardContent, Button, Chip, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@material-ui/core";
import { ToggleButton, ToggleButtonGroup } from "@material-ui/lab";
import CheckIcon from "@material-ui/icons/Check";
import StarIcon from "@material-ui/icons/Star";
import ViewModuleIcon from "@material-ui/icons/ViewModule";
import ViewListIcon from "@material-ui/icons/ViewList";

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
  viewToggle: {
    display: "flex",
    justifyContent: "center",
    marginBottom: theme.spacing(4),
  },
  comparisonTable: {
    marginTop: theme.spacing(4),
    borderRadius: "8px",
    overflow: "hidden",
  },
  tableHeader: {
    backgroundColor: theme.palette.primary.main,
    color: "#fff",
    fontWeight: 700,
  },
  tableCell: {
    padding: theme.spacing(2),
  },
  tableRowFeatured: {
    backgroundColor: "rgba(25, 118, 210, 0.05)",
  },
  planCard: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    padding: theme.spacing(3),
    borderRadius: "16px",
    transition: "all 0.3s ease, opacity 0.6s ease",
    position: "relative",
    border: "1px solid rgba(0,0,0,0.08)",
    opacity: 0,
    transform: "translateY(20px)",
    "&.visible": {
      opacity: 1,
      transform: "translateY(0)",
    },
    "&:hover": {
      transform: "translateY(-8px)",
      boxShadow: "0 12px 24px rgba(0,0,0,0.1)",
    },
  },
}));

const Plans = ({ plans, loading }) => {
  const classes = useStyles();
  const [viewMode, setViewMode] = useState("cards");

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

  const handleViewChange = (event, newView) => {
    if (newView !== null) {
      setViewMode(newView);
    }
  };

  const allFeatures = [
    { key: "users", label: "Usuários" },
    { key: "connections", label: "Conexões WhatsApp" },
    { key: "queues", label: "Filas de Atendimento" },
    { key: "useWhatsapp", label: "Conexão WhatsApp" },
    { key: "useCampaigns", label: "Campanhas em Massa" },
    { key: "useKanban", label: "Kanban de Atendimento" },
    { key: "useOpenAi", label: "Inteligência Artificial" },
    { key: "useSchedules", label: "Agendamento de Mensagens" },
    { key: "useInternalChat", label: "Chat Interno" },
    { key: "useExternalApi", label: "API para Integrações" },
    { key: "useIntegrations", label: "Webhooks e Integrações" },
  ];

  // Ordenar planos por preço (do mais barato para o mais caro)
  const sortedPlans = [...(plans || [])].sort((a, b) => {
    const priceA = parseFloat(a.amount || 0);
    const priceB = parseFloat(b.amount || 0);
    return priceA - priceB;
  });

  return (
    <Box id="plans">
      <Typography variant="h2" className={classes.sectionTitle}>
        Planos Flexíveis
      </Typography>
      <Typography variant="h6" className={classes.sectionSubtitle}>
        Escale seu atendimento com o plano perfeito para o seu momento
      </Typography>
      
      {sortedPlans && sortedPlans.length > 0 && (
        <Box className={classes.viewToggle}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewChange}
            aria-label="modo de visualização"
          >
            <ToggleButton value="cards" aria-label="visualização em cards">
              <ViewModuleIcon style={{ marginRight: 8 }} />
              Cards
            </ToggleButton>
            <ToggleButton value="table" aria-label="visualização em tabela">
              <ViewListIcon style={{ marginRight: 8 }} />
              Comparar
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      {viewMode === "table" && sortedPlans && sortedPlans.length > 0 ? (
        <TableContainer component={Paper} className={classes.comparisonTable}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell className={`${classes.tableHeader} ${classes.tableCell}`}>Recurso</TableCell>
                {sortedPlans.map((plan, index) => {
                  const isFeatured = plan.name.toLowerCase().includes("premium") || (sortedPlans.length === 3 && index === 1);
                  return (
                    <TableCell 
                      key={plan.id || index}
                      className={`${classes.tableHeader} ${classes.tableCell} ${isFeatured ? classes.tableRowFeatured : ""}`}
                      align="center"
                    >
                      {plan.name}
                      {isFeatured && (
                        <Chip
                          icon={<StarIcon style={{ color: "#fff", fontSize: 14 }} />}
                          label="Recomendado"
                          size="small"
                          style={{ marginTop: 8, backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }}
                        />
                      )}
                      <Typography variant="h6" style={{ marginTop: 8, color: "#fff" }}>
                        {formatPrice(plan.amount)}
                      </Typography>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {allFeatures.map((feature) => (
                <TableRow key={feature.key}>
                  <TableCell className={classes.tableCell} component="th" scope="row">
                    {feature.label}
                  </TableCell>
                  {sortedPlans.map((plan, index) => {
                    const isFeatured = plan.name.toLowerCase().includes("premium") || (sortedPlans.length === 3 && index === 1);
                    let value = "";
                    if (feature.key === "users") value = plan.users;
                    else if (feature.key === "connections") value = plan.connections;
                    else if (feature.key === "queues") value = plan.queues;
                    else value = plan[feature.key] ? "✓" : "—";
                    
                    return (
                      <TableCell 
                        key={plan.id || index}
                        className={`${classes.tableCell} ${isFeatured ? classes.tableRowFeatured : ""}`}
                        align="center"
                      >
                        {typeof value === "boolean" ? (value ? "✓" : "—") : value}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              <TableRow>
                <TableCell className={classes.tableCell} component="th" scope="row">
                  Ação
                </TableCell>
                {sortedPlans.map((plan, index) => {
                  const isFeatured = plan.name.toLowerCase().includes("premium") || (sortedPlans.length === 3 && index === 1);
                  return (
                    <TableCell 
                      key={plan.id || index}
                      className={`${classes.tableCell} ${isFeatured ? classes.tableRowFeatured : ""}`}
                      align="center"
                    >
                      <Button
                        variant={isFeatured ? "contained" : "outlined"}
                        color="primary"
                        size="small"
                        onClick={scrollToForm}
                      >
                        {isFeatured ? "Assinar" : "Escolher"}
                      </Button>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Grid container spacing={4} justifyContent="center" alignItems="stretch">
        {sortedPlans.map((plan, index) => {
          // Lógica melhorada para destaque: destaca o plano do meio ou o que tiver "Premium" no nome
          const isFeatured = plan.name.toLowerCase().includes("premium") || (sortedPlans.length === 3 && index === 1);

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
                className={`${classes.planCard} visible ${isFeatured ? classes.planCardFeatured : ""}`}
                elevation={isFeatured ? 8 : 0}
                style={{ transitionDelay: `${index * 0.1}s` }}
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
      )}
    </Box>
  );
};

export default Plans;

