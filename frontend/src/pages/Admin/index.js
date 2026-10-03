import React, { lazy, Suspense, useContext } from "react";
import { useLocation, useHistory } from "react-router-dom";
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  CircularProgress,
  makeStyles,
} from "@material-ui/core";
import {
  SupervisorAccount as AdminIcon,
  Business as BusinessIcon,
  PhonelinkSetup as ConnectionsIcon,
  CardMembership as PlansIcon,
  LocalAtm as FinanceiroIcon,
  Palette as WhitelabelIcon,
  HelpOutline as HelpIcon,
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import ForbiddenPage from "../../components/ForbiddenPage";
import { AuthContext } from "../../context/Auth/AuthContext";

const EmpresasTab = lazy(() => import("./tabs/EmpresasTab"));
const ConexoesTab = lazy(() => import("./tabs/ConexoesTab"));
const PlanosTab = lazy(() => import("./tabs/PlanosTab"));
const FinanceiroTab = lazy(() => import("./tabs/FinanceiroTab"));
const WhitelabelTab = lazy(() => import("./tabs/WhitelabelTab"));
const AjudaTab = lazy(() => import("./tabs/AjudaTab"));

const TABS = [
  { value: "empresas", label: "Empresas", icon: <BusinessIcon fontSize="small" /> },
  { value: "conexoes", label: "Conexões", icon: <ConnectionsIcon fontSize="small" /> },
  { value: "planos", label: "Planos", icon: <PlansIcon fontSize="small" /> },
  { value: "financeiro", label: "Financeiro", icon: <FinanceiroIcon fontSize="small" /> },
  { value: "whitelabel", label: "Whitelabel", icon: <WhitelabelIcon fontSize="small" /> },
  { value: "ajuda", label: "Ajuda", icon: <HelpIcon fontSize="small" /> },
];

const useStyles = makeStyles(theme => ({
  root: {
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
  },
  paper: {
    borderRadius: 12,
    overflow: "hidden",
    border: `1px solid ${theme.palette.divider}`,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(2.5, 3),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  headerIcon: {
    color: theme.palette.primary.main,
    fontSize: 30,
  },
  title: {
    fontSize: "1.3rem",
    fontWeight: 700,
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: 13,
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  tabs: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.type === "dark" ? "rgba(255,255,255,0.02)" : "#fafafa",
    padding: theme.spacing(0, 1),
  },
  tabLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    textTransform: "none",
    fontWeight: 600,
  },
  tabContent: {
    padding: theme.spacing(3),
    // Em mobile reduz o padding para dar mais área útil às abas
    [theme.breakpoints.down("xs")]: {
      padding: theme.spacing(1.5),
    },
  },
  loader: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(6),
  },
}));

// Console central do superadmin: empresas, conexões, planos, financeiro,
// whitelabel e ajuda — tudo que é cross-tenant vive aqui. Configurações
// do tenant permanecem em /settings.
const Admin = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const history = useHistory();

  const params = new URLSearchParams(location.search);
  const currentTab = params.get("tab") || "empresas";
  const validTab = TABS.some(t => t.value === currentTab) ? currentTab : "empresas";

  const handleTabChange = (_, value) => {
    history.replace(`/admin?tab=${value}`);
  };

  if (!user?.super) return <ForbiddenPage />;

  return (
    <MainContainer useWindowScroll>
      <Box className={classes.root}>
        <Paper className={classes.paper} elevation={0} variant="outlined">
          <Box className={classes.header}>
            <AdminIcon className={classes.headerIcon} />
            <Box>
              <Typography className={classes.title}>Administração</Typography>
              <Typography className={classes.subtitle}>
                Controle central do SaaS — empresas, conexões, planos, financeiro e personalização
              </Typography>
            </Box>
          </Box>

          <Tabs
            value={validTab}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
            scrollButtons="auto"
            className={classes.tabs}
          >
            {TABS.map(t => (
              <Tab
                key={t.value}
                value={t.value}
                label={<span className={classes.tabLabel}>{t.icon}{t.label}</span>}
              />
            ))}
          </Tabs>

          <Box className={classes.tabContent}>
            <Suspense
              fallback={
                <div className={classes.loader}>
                  <CircularProgress size={32} />
                </div>
              }
            >
              {validTab === "empresas" && <EmpresasTab />}
              {validTab === "conexoes" && <ConexoesTab />}
              {validTab === "planos" && <PlanosTab />}
              {validTab === "financeiro" && <FinanceiroTab />}
              {validTab === "whitelabel" && <WhitelabelTab />}
              {validTab === "ajuda" && <AjudaTab />}
            </Suspense>
          </Box>
        </Paper>
      </Box>
    </MainContainer>
  );
};

export default Admin;
