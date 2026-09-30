import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  makeStyles,
} from "@material-ui/core";

import Whitelabel from "../../../components/Settings/Whitelabel";
import useSettings from "../../../hooks/useSettings";

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
  loader: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(6),
  },
}));

// Aba Whitelabel: wrapper do componente de Settings/Whitelabel.
// Em SettingsCustom ele recebe `settings={oldSettings}` de useSettings().getAll();
// aqui a própria aba carrega os settings globais (key/value) antes de renderizar.
const WhitelabelTab = () => {
  const classes = useStyles();
  const { getAll } = useSettings();

  const [settings, setSettings] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getAll();
        setSettings(Array.isArray(data) ? data : []);
      } finally {
        // getAll retorna null quando falha/403 — o finally evita spinner infinito
        setLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box>
      <Box className={classes.header}>
        <Typography className={classes.title}>Personalização (Whitelabel)</Typography>
        <Typography className={classes.subtitle}>
          Nome do sistema, cores primárias e logotipos exibidos para todos os tenants.
        </Typography>
      </Box>
      {loaded ? (
        <Whitelabel settings={settings} />
      ) : (
        <Box className={classes.loader}>
          <CircularProgress size={32} />
        </Box>
      )}
    </Box>
  );
};

export default WhitelabelTab;
