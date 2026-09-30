import React from "react";
import { Box, Typography, makeStyles } from "@material-ui/core";

import PlansManager from "../../../components/PlansManager";

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

// Aba Planos: wrapper fino do PlansManager (mesmo gestor usado em /settings).
// O manager já traz form + grid + exclusão — aqui só entra o contexto da aba.
const PlanosTab = () => {
  const classes = useStyles();

  return (
    <Box>
      <Box className={classes.header}>
        <Typography className={classes.title}>Planos do SaaS</Typography>
        <Typography className={classes.subtitle}>
          Cadastro de planos comercializados — limites de usuários, conexões, filas e recursos habilitados.
        </Typography>
      </Box>
      <PlansManager />
    </Box>
  );
};

export default PlanosTab;
