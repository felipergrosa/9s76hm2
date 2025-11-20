import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Container, Typography, Button, Box, Grid } from "@material-ui/core";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import ArrowDownwardIcon from "@material-ui/icons/ArrowDownward";

const useStyles = makeStyles((theme) => ({
  hero: {
    minHeight: "90vh",
    display: "flex",
    alignItems: "center",
    background: "linear-gradient(135deg, #065183 0%, #0a7ab8 100%)",
    color: "#ffffff",
    position: "relative",
    overflow: "hidden",
    [theme.breakpoints.down("sm")]: {
      minHeight: "80vh",
    },
  },
  heroContent: {
    position: "relative",
    zIndex: 2,
    padding: theme.spacing(4, 0),
  },
  title: {
    fontWeight: 700,
    marginBottom: theme.spacing(2),
    fontSize: "3.5rem",
    [theme.breakpoints.down("md")]: {
      fontSize: "2.8rem",
    },
    [theme.breakpoints.down("sm")]: {
      fontSize: "2.2rem",
    },
    [theme.breakpoints.down("xs")]: {
      fontSize: "1.8rem",
    },
  },
  subtitle: {
    fontSize: "1.5rem",
    marginBottom: theme.spacing(4),
    opacity: 0.95,
    [theme.breakpoints.down("md")]: {
      fontSize: "1.3rem",
    },
    [theme.breakpoints.down("sm")]: {
      fontSize: "1.1rem",
    },
    [theme.breakpoints.down("xs")]: {
      fontSize: "1rem",
    },
  },
  ctaContainer: {
    display: "flex",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    marginTop: theme.spacing(4),
  },
  description: {
    fontSize: "1.2rem",
    marginBottom: theme.spacing(2),
    opacity: 0.9,
    [theme.breakpoints.down("sm")]: {
      fontSize: "1rem",
    },
    [theme.breakpoints.down("xs")]: {
      fontSize: "0.9rem",
    },
  },
  ctaButton: {
    padding: theme.spacing(1.5, 4),
    fontSize: "1.1rem",
    borderRadius: "8px",
    textTransform: "none",
    fontWeight: 600,
    [theme.breakpoints.down("xs")]: {
      fontSize: "0.95rem",
      padding: theme.spacing(1.2, 3),
    },
  },
  ctaPrimary: {
    backgroundColor: "#25D366",
    color: "#ffffff",
    "&:hover": {
      backgroundColor: "#20BA5A",
    },
  },
  ctaSecondary: {
    backgroundColor: "transparent",
    color: "#ffffff",
    border: "2px solid #ffffff",
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.1)",
    },
  },
  scrollIndicator: {
    position: "absolute",
    bottom: theme.spacing(4),
    left: "50%",
    transform: "translateX(-50%)",
    animation: "$bounce 2s infinite",
    cursor: "pointer",
  },
  "@keyframes bounce": {
    "0%, 100%": {
      transform: "translateX(-50%) translateY(0)",
    },
    "50%": {
      transform: "translateX(-50%) translateY(-10px)",
    },
  },
  backgroundPattern: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
    backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
    backgroundSize: "50px 50px",
    animation: "$patternMove 20s linear infinite",
  },
  "@keyframes patternMove": {
    "0%": {
      backgroundPosition: "0 0",
    },
    "100%": {
      backgroundPosition: "100px 100px",
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
      <div className={classes.backgroundPattern} />
      <Container className={classes.heroContent}>
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={8}>
            <Typography variant="h1" className={classes.title}>
              TaktChat
            </Typography>
            <Typography variant="h2" className={classes.subtitle}>
              A plataforma completa de atendimento e campanhas via WhatsApp
            </Typography>
            <Typography variant="body1" className={classes.description}>
              Centralize todas as suas conversas, automatize campanhas, gerencie equipes e aumente sua produtividade com inteligência artificial integrada.
            </Typography>
            <Box className={classes.ctaContainer}>
              <Button
                className={`${classes.ctaButton} ${classes.ctaPrimary}`}
                startIcon={<WhatsAppIcon />}
                onClick={scrollToForm}
                size="large"
              >
                Começar Agora
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Container>
      <Box className={classes.scrollIndicator} onClick={scrollToForm}>
        <ArrowDownwardIcon style={{ fontSize: "2rem" }} />
      </Box>
    </Box>
  );
};

export default Hero;

