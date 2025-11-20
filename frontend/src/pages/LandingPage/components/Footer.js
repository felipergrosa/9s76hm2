import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Container, Typography, Box, Grid, Link } from "@material-ui/core";
import { Link as RouterLink } from "react-router-dom";

const useStyles = makeStyles((theme) => ({
  footer: {
    backgroundColor: "#1a1a1a",
    color: "#ffffff",
    padding: theme.spacing(6, 0, 3),
    marginTop: theme.spacing(8),
  },
  footerContent: {
    marginBottom: theme.spacing(4),
  },
  footerSection: {
    marginBottom: theme.spacing(3),
  },
  footerTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(2),
    fontSize: "1.1rem",
  },
  footerLink: {
    display: "block",
    color: "rgba(255, 255, 255, 0.7)",
    textDecoration: "none",
    marginBottom: theme.spacing(1),
    "&:hover": {
      color: "#ffffff",
      textDecoration: "underline",
    },
  },
  footerCopyright: {
    paddingTop: theme.spacing(3),
    borderTop: "1px solid rgba(255, 255, 255, 0.1)",
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.6)",
  },
}));

const Footer = () => {
  const classes = useStyles();
  const currentYear = new Date().getFullYear();

  return (
    <Box component="footer" className={classes.footer}>
      <Container>
        <Grid container spacing={4} className={classes.footerContent}>
          <Grid item xs={12} sm={6} md={3}>
            <Box className={classes.footerSection}>
              <Typography variant="h6" className={classes.footerTitle}>
                TaktChat
              </Typography>
              <Typography variant="body2" style={{ color: "rgba(255, 255, 255, 0.7)" }}>
                Plataforma completa de atendimento e campanhas via WhatsApp. Transforme sua comunicação com automação inteligente.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box className={classes.footerSection}>
              <Typography variant="h6" className={classes.footerTitle}>
                Produto
              </Typography>
              <Link component={RouterLink} to="/landing#features" className={classes.footerLink}>
                Funcionalidades
              </Link>
              <Link component={RouterLink} to="/landing#plans" className={classes.footerLink}>
                Planos
              </Link>
              <Link component={RouterLink} to="/docs" className={classes.footerLink}>
                Documentação
              </Link>
              <Link component={RouterLink} to="/login" className={classes.footerLink}>
                Login
              </Link>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box className={classes.footerSection}>
              <Typography variant="h6" className={classes.footerTitle}>
                Empresa
              </Typography>
              <Link href="#sobre" className={classes.footerLink}>
                Sobre Nós
              </Link>
              <Link href="#contato" className={classes.footerLink}>
                Contato
              </Link>
              <Link href="#suporte" className={classes.footerLink}>
                Suporte
              </Link>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Box className={classes.footerSection}>
              <Typography variant="h6" className={classes.footerTitle}>
                Legal
              </Typography>
              <Link href="#privacidade" className={classes.footerLink}>
                Política de Privacidade
              </Link>
              <Link href="#termos" className={classes.footerLink}>
                Termos de Uso
              </Link>
              <Link href="#lgpd" className={classes.footerLink}>
                LGPD
              </Link>
            </Box>
          </Grid>
        </Grid>
        <Box className={classes.footerCopyright}>
          <Typography variant="body2">
            © {currentYear} TaktChat. Todos os direitos reservados.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;

