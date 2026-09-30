import React from "react";
import { Box, Typography, makeStyles } from "@material-ui/core";

import HelpsManager from "../../../components/HelpsManager";

const useStyles = makeStyles(theme => ({
  header: {
    marginBottom: theme.spacing(2),
  },
  title: {
    fontSize: "1rem",
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 13,
    color: theme.palette.text.secondary,
  },
}));

// Aba Ajuda: wrapper fino do HelpsManager (mesmo gestor usado em /settings).
// O manager já traz form + grid + exclusão — aqui só entra o contexto da aba.
const AjudaTab = () => {
  const classes = useStyles();

  return (
    <Box>
      <Box className={classes.header}>
        <Typography className={classes.title}>Central de Ajuda</Typography>
        <Typography className={classes.subtitle}>
          Tutoriais e vídeos de apoio exibidos aos usuários na página de ajuda.
        </Typography>
      </Box>
      <HelpsManager />
    </Box>
  );
};

export default AjudaTab;
