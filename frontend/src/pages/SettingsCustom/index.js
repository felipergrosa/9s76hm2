import React, { useState, useEffect, useContext } from "react";
import {
  Box, Typography, Paper, Tabs, Tab, makeStyles, CircularProgress
} from "@material-ui/core";
import {
  Settings as SettingsIcon,
  AccessTime as ScheduleIcon,
  Tune as OptionsIcon,
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import TabPanel from "../../components/TabPanel";
import SchedulesForm from "../../components/SchedulesForm";
import Options from "../../components/Settings/Options";
import { i18n } from "../../translate/i18n.js";
import { toast } from "react-toastify";
import useCompanies from "../../hooks/useCompanies";
import { AuthContext } from "../../context/Auth/AuthContext";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import useSettings from "../../hooks/useSettings";
import ForbiddenPage from "../../components/ForbiddenPage/index.js";
import usePermissions from "../../hooks/usePermissions";

const useStyles = makeStyles((theme) => ({
  hero: {
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    borderRadius: 16,
    padding: "24px 28px",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
    flexShrink: 0,
  },
  heroIcon: { fontSize: 44, opacity: 0.9 },
  heroTitle: { fontWeight: 700, fontSize: 22, color: "#fff", lineHeight: 1.2 },
  heroSub: { fontSize: 13, color: "rgba(255,255,255,0.72)", marginTop: 4 },

  paper: {
    borderRadius: 12,
    overflow: "hidden",
    ...theme.scrollbarStyles,
  },
  tabs: {
    backgroundColor: theme.palette.type === "dark" ? "#1a1a1a" : "#f8f8f8",
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  tabLabel: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    fontWeight: 500,
  },
  tabContent: {
    padding: theme.spacing(3),
  },
  container: {
    width: "100%",
  },
  root: {
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
}));

function TabLabel({ icon, label }) {
  const classes = useStyles();
  return (
    <span className={classes.tabLabel}>
      {React.cloneElement(icon, { style: { fontSize: 15 } })}
      {label}
    </span>
  );
}

const SettingsCustom = () => {
  const classes = useStyles();
  const [tab, setTab] = useState("options");
  const [schedules, setSchedules] = useState([]);
  const [company, setCompany] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState({});
  const [settings, setSettings] = useState({});
  const [oldSettings, setOldSettings] = useState({});
  const [schedulesEnabled, setSchedulesEnabled] = useState(false);

  const { find, updateSchedules } = useCompanies();
  const { getAll: getAllSettings } = useCompanySettings();
  const { getAll: getAllSettingsOld } = useSettings();
  const { user, socket } = useContext(AuthContext);
  const { hasPermission } = usePermissions();

  useEffect(() => {
    async function findData() {
      setLoading(true);
      try {
        const companyId = user.companyId;
        const company = await find(companyId);
        const settingList = await getAllSettings(companyId);
        const settingListOld = await getAllSettingsOld();
        setCompany(company);
        setSchedules(company.schedules);
        setSettings(settingList);
        setOldSettings(settingListOld);
        setSchedulesEnabled(settingList.scheduleType === "company");
        setCurrentUser(user);
      } catch (e) {
        toast.error(e);
      }
      setLoading(false);
    }
    findData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = (_, newValue) => setTab(newValue);

  const handleSubmitSchedules = async (data) => {
    setLoading(true);
    try {
      setSchedules(data);
      await updateSchedules({ id: company.id, schedules: data });
      toast.success("Horários atualizados com sucesso.");
    } catch (e) {
      toast.error(e);
    }
    setLoading(false);
  };

  if (!hasPermission("settings.view")) return <ForbiddenPage />;

  return (
    <MainContainer useWindowScroll>
      <Box className={classes.root}>
        {/* ── Hero ── */}
        <Box className={classes.hero}>
          <SettingsIcon className={classes.heroIcon} />
          <Box>
            <Typography className={classes.heroTitle}>
              {i18n.t("settings.title") || "Configurações"}
            </Typography>
            <Typography className={classes.heroSub}>
              Gerencie as opções do sistema, horários, planos e personalização
            </Typography>
          </Box>
          {loading && (
            <CircularProgress size={20} style={{ color: "rgba(255,255,255,0.7)", marginLeft: "auto" }} />
          )}
        </Box>

        {/* ── Content ── */}
        <Paper className={classes.paper} elevation={0} variant="outlined">
          <Tabs
            value={tab}
            indicatorColor="primary"
            textColor="primary"
            scrollButtons="auto"
            variant="scrollable"
            onChange={handleTabChange}
            className={classes.tabs}
          >
            <Tab
              value="options"
              label={<TabLabel icon={<OptionsIcon />} label={i18n.t("settings.tabs.options") || "Opções"} />}
            />
            {schedulesEnabled && (
              <Tab
                value="schedules"
                label={<TabLabel icon={<ScheduleIcon />} label="Horários" />}
              />
            )}
          </Tabs>

          <Box className={classes.tabContent}>
            <TabPanel className={classes.container} value={tab} name="options">
              <Options
                settings={settings}
                oldSettings={oldSettings}
                user={currentUser}
                scheduleTypeChanged={(value) => setSchedulesEnabled(value === "company")}
              />
            </TabPanel>

            <TabPanel className={classes.container} value={tab} name="schedules">
              <SchedulesForm
                loading={loading}
                onSubmit={handleSubmitSchedules}
                initialValues={schedules}
              />
            </TabPanel>
          </Box>
        </Paper>
      </Box>
    </MainContainer>
  );
};

export default SettingsCustom;
