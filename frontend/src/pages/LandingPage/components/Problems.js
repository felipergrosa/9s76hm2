import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Typography, Grid, Box, Card, CardContent, Button } from "@material-ui/core";
import ErrorOutlineIcon from "@material-ui/icons/ErrorOutline";
import ArrowForwardIcon from "@material-ui/icons/ArrowForward";

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
  problemIcon: {
    fontSize: "3rem",
    color: theme.palette.error.main,
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down("xs")]: {
      fontSize: "2.5rem",
    },
  },
  problemTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
    [theme.breakpoints.down("xs")]: {
      fontSize: "1.1rem",
    },
  },
  problemDescription: {
    color: theme.palette.text.secondary,
    [theme.breakpoints.down("xs")]: {
      fontSize: "0.9rem",
    },
  },
  problemCard: {
    height: "100%",
    padding: theme.spacing(3),
    transition: "transform 0.3s ease, box-shadow 0.3s ease, opacity 0.6s ease",
    opacity: 0,
    transform: "translateY(20px)",
    "&.visible": {
      opacity: 1,
      transform: "translateY(0)",
    },
    "&:hover": {
      transform: "translateY(-5px)",
      boxShadow: theme.shadows[8],
    },
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(2),
    },
  },
  ctaContainer: {
    display: "flex",
    justifyContent: "center",
    marginTop: theme.spacing(6),
    opacity: 0,
    transform: "translateY(20px)",
    transition: "opacity 0.6s ease, transform 0.6s ease",
    "&.visible": {
      opacity: 1,
      transform: "translateY(0)",
    },
  },
  ctaButton: {
    padding: theme.spacing(1.5, 4),
    fontSize: "1.1rem",
    fontWeight: 700,
    textTransform: "none",
    borderRadius: "50px",
  },
}));

const problems = [
  {
    title: "Atendimento Desorganizado",
    description: "Múltiplas conversas espalhadas, sem organização centralizada. Dificuldade em rastrear histórico e contexto das interações.",
  },
  {
    title: "Falta de Automação",
    description: "Respostas manuais consomem tempo da equipe. Sem automação inteligente para triagem e respostas frequentes.",
  },
  {
    title: "Risco de Banimento",
    description: "Envio de mensagens em massa pode resultar em bloqueio permanente da conta WhatsApp. Sem proteção anti-ban.",
  },
  {
    title: "Ausência de Métricas",
    description: "Sem relatórios e dashboards para acompanhar performance, tempo de resposta e satisfação dos clientes.",
  },
  {
    title: "Campanhas Limitadas",
    description: "Dificuldade em criar e gerenciar campanhas segmentadas com controle de cadência e personalização.",
  },
  {
    title: "Multi-Atendente Problemático",
    description: "Conflitos quando múltiplos atendentes trabalham na mesma conversa. Sem sistema de filas e roteamento.",
  },
];

const Problems = () => {
  const classes = useStyles();

  const scrollToForm = () => {
    const formElement = document.getElementById("lead-form");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <Box>
      <Typography variant="h2" className={classes.sectionTitle}>
        Problemas que o TaktChat Resolve
      </Typography>
      <Typography variant="h6" className={classes.sectionSubtitle}>
        Entenda os desafios que sua empresa enfrenta e como podemos ajudar
      </Typography>
      <Grid container spacing={4}>
        {problems.map((problem, index) => {
          return (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card 
                className={`${classes.problemCard} visible`}
                variant="outlined"
                style={{ transitionDelay: `${index * 0.1}s` }}
              >
                <CardContent>
                  <ErrorOutlineIcon className={classes.problemIcon} />
                  <Typography variant="h5" className={classes.problemTitle}>
                    {problem.title}
                  </Typography>
                  <Typography variant="body1" className={classes.problemDescription}>
                    {problem.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      <Box className={`${classes.ctaContainer} visible`}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          className={classes.ctaButton}
          endIcon={<ArrowForwardIcon />}
          onClick={scrollToForm}
        >
          Veja como resolver todos esses problemas
        </Button>
      </Box>
    </Box>
  );
};

export default Problems;

