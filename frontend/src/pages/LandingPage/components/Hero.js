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
    background: "linear-gradient(135deg, #0F2027 0%, #203A43 50%, #2C5364 100%)", // Modern dark gradient
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
  title: {
    fontWeight: 800,
    marginBottom: theme.spacing(3),
    fontSize: "4rem",
    lineHeight: 1.1,
    background: "linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)",
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
    marginBottom: theme.spacing(5),
    opacity: 0.9,
    maxWidth: "600px",
    lineHeight: 1.6,
    [theme.breakpoints.down("sm")]: {
      fontSize: "1.2rem",
      textAlign: "center",
      margin: "0 auto",
      marginBottom: theme.spacing(4),
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
    background: "#764ba2",
  },
  shape2: {
    bottom: "-10%",
    left: "-10%",
    width: "400px",
    height: "400px",
    background: "#667eea",
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
                className={`${classes.ctaButton} ${classes.ctaPrimary}`}
                startIcon={<WhatsAppIcon />}
                onClick={scrollToForm}
                size="large"
              >
                Começar Agora
              </Button>
              <Button
                className={`${classes.ctaButton} ${classes.ctaSecondary}`}
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                size="large"
              >
                Saiba Mais
              </Button>
            </Box>
          </Grid>
          {/* Placeholder for a Hero Image/Illustration if we had one */}
          {/* <Grid item xs={12} md={5}> ... </Grid> */}
        </Grid>
      </Container>

      <Box className={classes.scrollIndicator} onClick={scrollToForm}>
        <ArrowDownwardIcon style={{ fontSize: "2.5rem" }} />
      </Box>
    </Box>
  );
};

export default Hero;

