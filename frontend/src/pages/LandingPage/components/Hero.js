import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Container, Typography, Button, Box, Grid } from "@material-ui/core";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import ArrowDownwardIcon from "@material-ui/icons/ArrowDownward";
import PeopleIcon from "@material-ui/icons/People";
import StarIcon from "@material-ui/icons/Star";

const useStyles = makeStyles((theme) => ({
  hero: {
    minHeight: "90vh",
    display: "flex",
    alignItems: "center",
    background: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #3B82F6 100%)", // Azul escuro do logo
    color: "#ffffff",
    position: "relative",
    overflow: "hidden",
    [theme.breakpoints.down("sm")]: {
      minHeight: "85vh",
      paddingTop: theme.spacing(8),
    },
  },
  heroContent: {
    position: "relative",
    zIndex: 2,
    padding: theme.spacing(4, 0),
  },
  logoContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: theme.spacing(3),
    [theme.breakpoints.down("md")]: {
      marginTop: theme.spacing(4),
      marginBottom: theme.spacing(2),
    },
  },
  logo: {
    maxWidth: "420px",
    height: "auto",
    width: "100%",
    filter: "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.2))",
    [theme.breakpoints.down("md")]: {
      maxWidth: "360px",
    },
    [theme.breakpoints.down("sm")]: {
      maxWidth: "300px",
    },
  },
  title: {
    fontWeight: 800,
    marginBottom: theme.spacing(3),
    fontSize: "4rem",
    lineHeight: 1.1,
    background: "linear-gradient(45deg, #25D366 30%, #20BA5A 90%)", // Verde vibrante do logo
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    [theme.breakpoints.down("md")]: {
      fontSize: "3.2rem",
    },
    [theme.breakpoints.down("sm")]: {
      fontSize: "2.5rem",
      textAlign: "center",
    },
  },
  subtitle: {
    fontSize: "1.5rem",
    marginBottom: theme.spacing(3),
    opacity: 0.9,
    maxWidth: "600px",
    lineHeight: 1.6,
    [theme.breakpoints.down("sm")]: {
      fontSize: "1.2rem",
      textAlign: "center",
      margin: "0 auto",
      marginBottom: theme.spacing(2),
    },
  },
  tagline: {
    fontSize: "1.1rem",
    textAlign: "center",
    opacity: 0.85,
    fontStyle: "italic",
    fontWeight: 500,
    color: "#ffffff",
    letterSpacing: "0.5px",
    [theme.breakpoints.down("sm")]: {
      fontSize: "1rem",
    },
  },
  ctaContainer: {
    display: "flex",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    [theme.breakpoints.down("sm")]: {
      justifyContent: "center",
    },
  },
  ctaButton: {
    padding: theme.spacing(1.5, 5),
    fontSize: "1.1rem",
    borderRadius: "50px",
    textTransform: "none",
    fontWeight: 700,
    boxShadow: "0 4px 14px 0 rgba(0,0,0,0.39)",
    transition: "transform 0.2s ease-in-out",
    "&:hover": {
      transform: "scale(1.05)",
    },
  },
  ctaPrimary: {
    background: "linear-gradient(45deg, #25D366 30%, #128C7E 90%)",
    color: "#ffffff",
  },
  ctaSecondary: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "#ffffff",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    backdropFilter: "blur(10px)",
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
  },
  scrollIndicator: {
    position: "absolute",
    bottom: theme.spacing(4),
    left: "50%",
    transform: "translateX(-50%)",
    animation: "$bounce 2s infinite",
    cursor: "pointer",
    opacity: 0.7,
    transition: "opacity 0.3s",
    "&:hover": {
      opacity: 1,
    },
  },
  "@keyframes bounce": {
    "0%, 100%": {
      transform: "translateX(-50%) translateY(0)",
    },
    "50%": {
      transform: "translateX(-50%) translateY(-10px)",
    },
  },
  shape: {
    position: "absolute",
    borderRadius: "50%",
    filter: "blur(80px)",
    zIndex: 1,
    opacity: 0.4,
  },
  shape1: {
    top: "-10%",
    right: "-10%",
    width: "500px",
    height: "500px",
    background: "#25D366", // Verde vibrante do logo
    opacity: 0.3,
  },
  shape2: {
    bottom: "-10%",
    left: "-10%",
    width: "400px",
    height: "400px",
    background: "#1E3A8A", // Azul escuro do logo
    opacity: 0.3,
  },
  socialProof: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    marginTop: theme.spacing(4),
    flexWrap: "wrap",
    [theme.breakpoints.down("sm")]: {
      justifyContent: "center",
      marginTop: theme.spacing(3),
    },
  },
  socialProofBadge: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: "50px",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    fontSize: "0.95rem",
    fontWeight: 600,
    color: "#ffffff",
    [theme.breakpoints.down("xs")]: {
      fontSize: "0.85rem",
      padding: theme.spacing(0.75, 1.5),
    },
  },
  socialProofIcon: {
    fontSize: "1.2rem",
  },
  ctaButtonEnhanced: {
    animation: "$pulse 2s infinite",
    boxShadow: "0 4px 20px rgba(37, 211, 102, 0.4), 0 0 0 0 rgba(37, 211, 102, 0.7)",
  },
  "@keyframes pulse": {
    "0%": {
      boxShadow: "0 4px 20px rgba(37, 211, 102, 0.4), 0 0 0 0 rgba(37, 211, 102, 0.7)",
    },
    "70%": {
      boxShadow: "0 4px 20px rgba(37, 211, 102, 0.4), 0 0 0 10px rgba(37, 211, 102, 0)",
    },
    "100%": {
      boxShadow: "0 4px 20px rgba(37, 211, 102, 0.4), 0 0 0 0 rgba(37, 211, 102, 0)",
    },
  },
}));

const Hero = () => {
  const classes = useStyles();

  const scrollToForm = () => {
    const formElement = document.getElementById("lead-form");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <Box className={classes.hero}>
      <div className={`${classes.shape} ${classes.shape1}`} />
      <div className={`${classes.shape} ${classes.shape2}`} />

      <Container className={classes.heroContent}>
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={7}>
            <Typography variant="h1" className={classes.title}>
              Revolucione seu Atendimento no WhatsApp
            </Typography>
            <Typography variant="h2" className={classes.subtitle}>
              Centralize conversas, automatize com IA e escale suas vendas com a plataforma mais completa do mercado.
            </Typography>
            <Box className={classes.ctaContainer}>
              <Button
                className={`${classes.ctaButton} ${classes.ctaPrimary} ${classes.ctaButtonEnhanced}`}
                startIcon={<WhatsAppIcon />}
                onClick={scrollToForm}
                size="large"
                aria-label="Começar agora - Ir para formulário de cadastro"
              >
                Começar Agora
              </Button>
              <Button
                className={`${classes.ctaButton} ${classes.ctaSecondary}`}
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                size="large"
                aria-label="Saiba mais - Ver funcionalidades"
              >
                Saiba Mais
              </Button>
            </Box>
            <Box className={classes.socialProof} role="region" aria-label="Prova social">
              <Box className={classes.socialProofBadge} role="status" aria-label="Mais de 500 empresas confiam no TaktChat">
                <PeopleIcon className={classes.socialProofIcon} aria-hidden="true" />
                <span>Mais de 500 empresas confiam</span>
              </Box>
              <Box className={classes.socialProofBadge} role="status" aria-label="Avaliação média de 4.8 de 5 estrelas">
                <StarIcon className={classes.socialProofIcon} aria-hidden="true" />
                <span>4.8/5 avaliação média</span>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={5}>
            <Box className={classes.logoContainer}>
              <img 
                src="/logo_quadrado.png" 
                alt="TaktChat Logo" 
                className={classes.logo}
              />
            </Box>
            <Typography variant="body1" className={classes.tagline}>
              Conectando pessoas, acelerando negócios!
            </Typography>            
          </Grid>
        </Grid>
      </Container>

      <Box className={classes.scrollIndicator} onClick={scrollToForm}>
        <ArrowDownwardIcon style={{ fontSize: "2.5rem" }} />
      </Box>
    </Box>
  );
};

export default Hero;

