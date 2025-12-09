import React, { useEffect, useState, useContext } from "react";
import { Field } from "formik";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import api from "../../services/api";
import usePlans from "../../hooks/usePlans";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import {
  Box,
  Button,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  TextField,
  Tooltip,
  InputAdornment,
  FormHelperText,
  Tabs,
  Tab
} from "@material-ui/core";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import BusinessIcon from "@material-ui/icons/Business";
import SettingsIcon from "@material-ui/icons/Settings";
import ConfirmationModal from "../../components/ConfirmationModal";
import ForbiddenPage from "../../components/ForbiddenPage";
import usePermissions from "../../hooks/usePermissions";

import { AuthContext } from "../../context/Auth/AuthContext";

// Componente TabPanel para renderizar conteúdo das abas
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`campaign-config-tabpanel-${index}`}
      aria-labelledby={`campaign-config-tab-${index}`}
      {...other}
    >
      {value === index && <Box p={2}>{children}</Box>}
    </div>
  );
}

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    // padding: theme.padding,
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  textRight: {
    textAlign: "right",
  },
  tabPanelsContainer: {
    // padding: theme.spacing(2),
    padding: theme.padding,
  },
  paper: {
    padding: theme.spacing(2),
    display: "flex",
    alignItems: "center",
    marginBottom: 12,
  },
  tabs: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(2),
  },
  tabIcon: {
    marginRight: theme.spacing(1),
    fontSize: 20,
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  officialApiInfo: {
    backgroundColor: theme.palette.type === 'dark' ? '#1e3a2f' : '#e8f5e9',
    padding: theme.spacing(2),
    borderRadius: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
}));

const initialSettings = {
  // Configurações WhatsApp Não Oficial (Baileys)
  messageInterval: 20,
  longerIntervalAfter: 20,
  greaterInterval: 60,
  variables: [],
  sabado: "false",
  domingo: "false",
  startHour: "09:00",
  endHour: "18:00",
  capHourly: 300,
  capDaily: 2000,
  backoffErrorThreshold: 5,
  backoffPauseMinutes: 10,
  suppressionTagNames: [],
  // Configurações WhatsApp API Oficial (Meta)
  officialApiEnabled: true,
  officialApiMessageInterval: 5,
  officialApiCapHourly: 1000,
  officialApiCapDaily: 10000,
  officialApiRetryOnError: true,
  officialApiMaxRetries: 3,
};

const CampaignsConfig = () => {
  const classes = useStyles();
  const history = useHistory();

  const [settings, setSettings] = useState(initialSettings);
  const [showVariablesForm, setShowVariablesForm] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [variable, setVariable] = useState({ key: "", value: "" });
  const { user, socket } = useContext(AuthContext);
  const { hasPermission } = usePermissions();

  const [sabado, setSabado] = React.useState(false);
  const [domingo, setDomingo] = React.useState(false);

  const [startHour, setStartHour] = useState("08:00");
  const [endHour, setEndHour] = useState("19:00");
  // Campo editável (string) para as tags de supressão, separado por vírgula
  const [suppressionTagNamesStr, setSuppressionTagNamesStr] = useState("");
  
  // Estado para controlar a aba ativa
  const [activeTab, setActiveTab] = useState(0);
  
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const { getPlanCompany } = usePlans();

  // IA global removida desta tela: configuração agora é por campanha no modal de Nova Campanha

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useCampaigns) {
        toast.error("Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando.");
        setTimeout(() => {
          history.push(`/`)
        }, 1000);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.get("/campaign-settings").then(({ data }) => {
      const settingsList = [];
      console.log(data)
      if (Array.isArray(data) && data.length > 0) {
        data.forEach((item) => {
          settingsList.push([item.key, item.value]);
          if (item.key === "sabado") setSabado(item?.value === "true");
          if (item.key === "domingo") setDomingo(item?.value === "true");
          if (item.key === "startHour") setStartHour(item?.value);
          if (item.key === "endHour") setEndHour(item?.value);
          if (item.key === "suppressionTagNames") {
            try {
              const arr = JSON.parse(item.value);
              if (Array.isArray(arr)) setSuppressionTagNamesStr(arr.join(", "));
            } catch (e) {}
          }
        });
        setSettings(Object.fromEntries(settingsList));
      }
    });
  }, []);

  // Removido: status de criptografia. A configuração de IA passou para o modal de campanha.

  // Removido: leitura de integração IA/prompt base. Agora é por campanha.

  const handleOnChangeVariable = (e) => {
    if (e.target.value !== null) {
      const changedProp = {};
      changedProp[e.target.name] = e.target.value;
      setVariable((prev) => ({ ...prev, ...changedProp }));
    }
  };

  // Removido: handler de integração IA (a seleção agora é por campanha)

  const handleOnChangeSettings = (e) => {
    const changedProp = {};
    changedProp[e.target.name] = e.target.value;
    setSettings((prev) => ({ ...prev, ...changedProp }));
  };

  const addVariable = () => {
    setSettings((prev) => {
      if (!Array.isArray(prev.variables)) {
        // Lidar com o caso em que prev.variables não é um array
        return { ...prev, variables: [Object.assign({}, variable)] };
      }
      const variablesExists = settings.variables.filter(
        (v) => v.key === variable.key
      );
      const variables = prev.variables;
      if (variablesExists.length === 0) {
        variables.push(Object.assign({}, variable));
        setVariable({ key: "", value: "" });
      }
      return { ...prev, variables };
    });
  };

  const removeVariable = () => {
    const newList = settings.variables.filter((v) => v.key !== selectedKey);
    setSettings((prev) => ({ ...prev, variables: newList }));
    setSelectedKey(null);
  };

  const saveSettings = async () => {
    // Monta payload garantindo tipos corretos
    const payload = { ...settings };
    // Coerção numérica
    [
      "messageInterval",
      "longerIntervalAfter",
      "greaterInterval",
      "capHourly",
      "capDaily",
      "backoffErrorThreshold",
      "backoffPauseMinutes",
    ].forEach((k) => {
      if (payload[k] !== undefined) payload[k] = Number(payload[k]);
    });

    // Supressão: converte string em array de tags normalizadas (trim) e únicas
    if (typeof suppressionTagNamesStr === "string") {
      const list = suppressionTagNamesStr
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      payload.suppressionTagNames = Array.from(new Set(list));
    }

    // Removido: integração IA e prompt base agora são por campanha

    await api.post("/campaign-settings", { settings: payload });
    toast.success("Configurações salvas");
  };

  const handleChange = (event) => {
    if (event.target.name === "sabado") {
      setSabado(event.target.checked);
    }
    if (event.target.name === "domingo") {
      setDomingo(event.target.checked);
    }
  };

  const handleSaveTimeMass = async () => {
    let settings = {
      sabado: sabado,
      domingo: domingo,
      startHour: startHour,
      endHour: endHour
    }

    try {
      await api.post(`/campaign-settings/`, { settings });

      toast.success(i18n.t("settings.success"));
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={i18n.t("campaigns.confirmationModal.deleteTitle")}
        open={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={removeVariable}
      >
        {i18n.t("campaigns.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      { hasPermission("campaigns-config.view") ? (
          <>
            <MainHeader>
              <Grid style={{ width: "99.6%" }} container>
                <Grid xs={12} item>
                  <Title>{i18n.t("campaignsConfig.title")}</Title>
                </Grid>
              </Grid>
            </MainHeader>

            <Paper className={classes.mainPaper} variant="outlined">
              {/* Tabs para separar configurações por tipo de conexão */}
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                className={classes.tabs}
                indicatorColor="primary"
                textColor="primary"
                variant="fullWidth"
              >
                <Tab 
                  icon={<WhatsAppIcon className={classes.tabIcon} />}
                  label="WhatsApp Não Oficial (Baileys)"
                  id="campaign-config-tab-0"
                />
                <Tab 
                  icon={<BusinessIcon className={classes.tabIcon} />}
                  label="WhatsApp API Oficial (Meta)"
                  id="campaign-config-tab-1"
                />
                <Tab 
                  icon={<SettingsIcon className={classes.tabIcon} />}
                  label="Configurações Gerais"
                  id="campaign-config-tab-2"
                />
              </Tabs>

              {/* TAB 0: WhatsApp Não Oficial (Baileys) */}
              <TabPanel value={activeTab} index={0}>
                <Box className={classes.officialApiInfo} style={{ backgroundColor: '#fff3e0' }}>
                  <Typography variant="body2">
                    <strong>⚠️ Atenção:</strong> Estas configurações são para conexões via Baileys (API não oficial). 
                    É importante configurar intervalos e limites adequados para evitar bloqueios do WhatsApp.
                  </Typography>
                </Box>
                <Grid spacing={2} container>
                  <Grid xs={12} item>
                    <Typography component={"h2"} className={classes.sectionTitle}>
                      Intervalos
                      <Tooltip title="Defina pausas entre envios para reduzir risco de bloqueio e melhorar taxa de entrega" placement="right">
                        <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.7 }} />
                      </Tooltip>
                    </Typography>
                  </Grid>

                  {/* TEMPO ENTRE DISPAROS */}
                  {/* <Grid xs={12} md={3} item>
              <FormControl
                variant="outlined"
                className={classes.formControl}
                fullWidth
              >
                <InputLabel id="messageInterval-label">
                  Tempo entre Disparos
                </InputLabel>
                <Select
                  name="messageInterval"
                  id="messageInterval"
                  labelId="messageInterval-label"
                  label="Intervalo Randômico de Disparo"
                  value={settings.messageInterval}
                  onChange={(e) => handleOnChangeSettings(e)}
                >
                  <MenuItem value={0}>Sem Intervalo</MenuItem>
                  <MenuItem value={5}>5 segundos</MenuItem>
                  <MenuItem value={10}>10 segundos</MenuItem>
                  <MenuItem value={15}>15 segundos</MenuItem>
                  <MenuItem value={20}>20 segundos</MenuItem>
                </Select>
              </FormControl>
            </Grid> */}

                  <Grid xs={12} md={3} item>
                    <FormControl
                      variant="outlined"
                      className={classes.formControl}
                      fullWidth
                    >
                      <InputLabel id="messageInterval-label">
                        {i18n.t("campaigns.settings.randomInterval")}
                      </InputLabel>
                      <Select
                        name="messageInterval"
                        id="messageInterval"
                        labelId="messageInterval-label"
                        label={i18n.t("campaigns.settings.randomInterval")}
                        value={settings.messageInterval}
                        onChange={(e) => handleOnChangeSettings(e)}
                      >
                        <MenuItem value={0}>{i18n.t("campaigns.settings.noBreak")}</MenuItem>
                        <MenuItem value={5}>5 segundos</MenuItem>
                        <MenuItem value={10}>10 segundos</MenuItem>
                        <MenuItem value={15}>15 segundos</MenuItem>
                        <MenuItem value={20}>20 segundos</MenuItem>
                        <MenuItem value={30}>30 segundos</MenuItem>
                        <MenuItem value={40}>40 segundos</MenuItem>
                        <MenuItem value={60}>60 segundos</MenuItem>
                        <MenuItem value={80}>80 segundos</MenuItem>
                        <MenuItem value={100}>100 segundos</MenuItem>
                        <MenuItem value={120}>120 segundos</MenuItem>
                      </Select>
                      <FormHelperText>
                        <Box display="flex" alignItems="center" gridGap={6}>
                          <Tooltip title="Intervalo aplicado entre mensagens para cada conexão. Variações maiores reduzem risco de bloqueio.">
                            <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.7 }} />
                          </Tooltip>
                          Sugestão: 10-30s para contas aquecidas
                        </Box>
                      </FormHelperText>
                    </FormControl>
                  </Grid>
                  <Grid xs={12} md={3} item>
                    <FormControl
                      variant="outlined"
                      className={classes.formControl}
                      fullWidth
                    >
                      <InputLabel id="longerIntervalAfter-label">
                        {i18n.t("campaigns.settings.intervalGapAfter")}
                      </InputLabel>
                      <Select
                        name="longerIntervalAfter"
                        id="longerIntervalAfter"
                        labelId="longerIntervalAfter-label"
                        label={i18n.t("campaigns.settings.intervalGapAfter")}
                        value={settings.longerIntervalAfter}
                        onChange={(e) => handleOnChangeSettings(e)}
                      >
                        <MenuItem value={0}>{i18n.t("campaigns.settings.undefined")}</MenuItem>
                        <MenuItem value={5}>5 {i18n.t("campaigns.settings.messages")}</MenuItem>
                        <MenuItem value={10}>10 {i18n.t("campaigns.settings.messages")}</MenuItem>
                        <MenuItem value={15}>15 {i18n.t("campaigns.settings.messages")}</MenuItem>
                        <MenuItem value={20}>20 {i18n.t("campaigns.settings.messages")}</MenuItem>
                        <MenuItem value={30}>30 {i18n.t("campaigns.settings.messages")}</MenuItem>
                        <MenuItem value={40}>40 {i18n.t("campaigns.settings.messages")}</MenuItem>
                        <MenuItem value={50}>50 {i18n.t("campaigns.settings.messages")}</MenuItem>
                        <MenuItem value={60}>60 {i18n.t("campaigns.settings.messages")}</MenuItem>
                      </Select>
                      <FormHelperText>
                        <Box display="flex" alignItems="center" gridGap={6}>
                          <Tooltip title="A cada N mensagens, aplicamos um intervalo maior (abaixo). Ajuda a reduzir padrões repetitivos.">
                            <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.7 }} />
                          </Tooltip>
                          Ex.: após 20 mensagens, aplicar pausa maior
                        </Box>
                      </FormHelperText>
                    </FormControl>
                  </Grid>
                  <Grid xs={12} md={3} item>
                    <FormControl
                      variant="outlined"
                      className={classes.formControl}
                      fullWidth
                    >
                      <InputLabel id="greaterInterval-label">
                        {i18n.t("campaigns.settings.laggerTriggerRange")}
                      </InputLabel>
                      <Select
                        name="greaterInterval"
                        id="greaterInterval"
                        labelId="greaterInterval-label"
                        label={i18n.t("campaigns.settings.laggerTriggerRange")}
                        value={settings.greaterInterval}
                        onChange={(e) => handleOnChangeSettings(e)}
                      >
                        <MenuItem value={0}>{i18n.t("campaigns.settings.noBreak")}</MenuItem>
                        <MenuItem value={20}>20 segundos</MenuItem>
                        <MenuItem value={30}>30 segundos</MenuItem>
                        <MenuItem value={40}>40 segundos</MenuItem>
                        <MenuItem value={50}>50 segundos</MenuItem>
                        <MenuItem value={60}>60 segundos</MenuItem>
                        <MenuItem value={70}>70 segundos</MenuItem>
                        <MenuItem value={80}>80 segundos</MenuItem>
                        <MenuItem value={90}>90 segundos</MenuItem>
                        <MenuItem value={100}>100 segundos</MenuItem>
                        <MenuItem value={110}>110 segundos</MenuItem>
                        <MenuItem value={120}>120 segundos</MenuItem>
                        <MenuItem value={130}>130 segundos</MenuItem>
                        <MenuItem value={140}>140 segundos</MenuItem>
                        <MenuItem value={150}>150 segundos</MenuItem>
                        <MenuItem value={160}>160 segundos</MenuItem>
                        <MenuItem value={170}>170 segundos</MenuItem>
                        <MenuItem value={180}>180 segundos</MenuItem>
                      </Select>
                      <FormHelperText>
                        <Box display="flex" alignItems="center" gridGap={6}>
                          <Tooltip title="Intervalo maior aplicado quando a regra acima é atingida (após N mensagens).">
                            <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.7 }} />
                          </Tooltip>
                          Ex.: 60-120s
                        </Box>
                      </FormHelperText>
                    </FormControl>
                  </Grid>
                  {/* Limites e Backoff */}
                  <Grid xs={12} item>
                    <Typography component={"h1"} style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
                      Limites e Backoff
                      <Tooltip
                        title={
                          <span>
                            Defina limites por conexão para reduzir risco de banimento.<br/>
                            Recomendações: por hora 100-300, por dia 800-2000, dependendo do aquecimento e reputação.<br/>
                            Backoff: após N erros consecutivos, pausar alguns minutos.
                          </span>
                        }
                        placement="right"
                      >
                        <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.7 }} />
                      </Tooltip>
                    </Typography>
                  </Grid>
                  <Grid xs={12} md={3} item>
                    <TextField
                      label="Limite por hora (mensagens/conexão)"
                      variant="outlined"
                      name="capHourly"
                      type="number"
                      value={settings.capHourly || 300}
                      onChange={handleOnChangeSettings}
                      fullWidth
                      inputProps={{ min: 10 }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <Tooltip title="Evita picos por conexão. Comece conservador e aumente gradualmente.">
                              <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.7, cursor: 'help' }} />
                            </Tooltip>
                          </InputAdornment>
                        )
                      }}
                      helperText="Sugestão: iniciar entre 100 e 300 por hora e ajustar conforme desempenho"
                    />
                  </Grid>
                  <Grid xs={12} md={3} item>
                    <TextField
                      label="Limite por dia (mensagens/conexão)"
                      variant="outlined"
                      name="capDaily"
                      type="number"
                      value={settings.capDaily || 2000}
                      onChange={handleOnChangeSettings}
                      fullWidth
                      inputProps={{ min: 50 }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <Tooltip title="Limite diário por conexão. Aumente após aquecimento da conta.">
                              <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.7, cursor: 'help' }} />
                            </Tooltip>
                          </InputAdornment>
                        )
                      }}
                      helperText="Sugestão: 800 a 2000 por dia por conexão; evite picos"
                    />
                  </Grid>
                  <Grid xs={12} md={3} item>
                    <TextField
                      label="Backoff após N erros"
                      variant="outlined"
                      name="backoffErrorThreshold"
                      type="number"
                      value={settings.backoffErrorThreshold || 5}
                      onChange={handleOnChangeSettings}
                      fullWidth
                      inputProps={{ min: 1 }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <Tooltip title="Número de erros consecutivos para acionar pausa automática.">
                              <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.7, cursor: 'help' }} />
                            </Tooltip>
                          </InputAdornment>
                        )
                      }}
                      helperText="Ao atingir este número de erros seguidos, pausamos o envio (backoff)"
                    />
                  </Grid>
                  <Grid xs={12} md={3} item>
                    <TextField
                      label="Pausa de backoff (minutos)"
                      variant="outlined"
                      name="backoffPauseMinutes"
                      type="number"
                      value={settings.backoffPauseMinutes || 10}
                      onChange={handleOnChangeSettings}
                      fullWidth
                      inputProps={{ min: 1 }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <Tooltip title="Duração da pausa quando o backoff é acionado.">
                              <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.7, cursor: 'help' }} />
                            </Tooltip>
                          </InputAdornment>
                        )
                      }}
                      helperText="Tempo de pausa após acionar o backoff; aumente se persistirem erros"
                    />
                  </Grid>
                  
                  <Grid xs={12} className={classes.textRight} item style={{ marginTop: 16 }}>
                    <Button
                      onClick={saveSettings}
                      color="primary"
                      variant="contained"
                    >
                      {i18n.t("campaigns.settings.save")}
                    </Button>
                  </Grid>
                </Grid>
              </TabPanel>

              {/* TAB 1: WhatsApp API Oficial (Meta) */}
              <TabPanel value={activeTab} index={1}>
                <Box className={classes.officialApiInfo}>
                  <Typography variant="body2">
                    <strong>✅ API Oficial da Meta:</strong> Estas configurações são para conexões via WhatsApp Business API oficial. 
                    A Meta gerencia automaticamente os rate limits, então as configurações aqui são mais flexíveis.
                  </Typography>
                </Box>
                <Grid spacing={2} container>
                  <Grid xs={12} item>
                    <Typography component={"h2"} className={classes.sectionTitle}>
                      Configurações de Envio
                      <Tooltip title="Configurações específicas para campanhas via API oficial" placement="right">
                        <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.7 }} />
                      </Tooltip>
                    </Typography>
                  </Grid>
                  
                  <Grid xs={12} md={4} item>
                    <FormControl variant="outlined" fullWidth>
                      <InputLabel id="officialApiMessageInterval-label">
                        Intervalo entre mensagens
                      </InputLabel>
                      <Select
                        name="officialApiMessageInterval"
                        id="officialApiMessageInterval"
                        labelId="officialApiMessageInterval-label"
                        label="Intervalo entre mensagens"
                        value={settings.officialApiMessageInterval || 5}
                        onChange={(e) => handleOnChangeSettings(e)}
                      >
                        <MenuItem value={0}>Sem intervalo</MenuItem>
                        <MenuItem value={1}>1 segundo</MenuItem>
                        <MenuItem value={2}>2 segundos</MenuItem>
                        <MenuItem value={3}>3 segundos</MenuItem>
                        <MenuItem value={5}>5 segundos</MenuItem>
                        <MenuItem value={10}>10 segundos</MenuItem>
                      </Select>
                      <FormHelperText>
                        A API oficial permite intervalos menores sem risco de bloqueio
                      </FormHelperText>
                    </FormControl>
                  </Grid>

                  <Grid xs={12} md={4} item>
                    <TextField
                      label="Limite por hora"
                      variant="outlined"
                      name="officialApiCapHourly"
                      type="number"
                      value={settings.officialApiCapHourly || 1000}
                      onChange={handleOnChangeSettings}
                      fullWidth
                      inputProps={{ min: 100 }}
                      helperText="Limite de mensagens por hora (depende do tier da conta)"
                    />
                  </Grid>

                  <Grid xs={12} md={4} item>
                    <TextField
                      label="Limite por dia"
                      variant="outlined"
                      name="officialApiCapDaily"
                      type="number"
                      value={settings.officialApiCapDaily || 10000}
                      onChange={handleOnChangeSettings}
                      fullWidth
                      inputProps={{ min: 500 }}
                      helperText="Limite diário (depende do tier: 1K, 10K, 100K ou ilimitado)"
                    />
                  </Grid>

                  <Grid xs={12} item>
                    <Typography component={"h2"} className={classes.sectionTitle} style={{ marginTop: 16 }}>
                      Tratamento de Erros
                    </Typography>
                  </Grid>

                  <Grid xs={12} md={4} item>
                    <FormControl variant="outlined" fullWidth>
                      <InputLabel id="officialApiRetryOnError-label">
                        Retentar em caso de erro
                      </InputLabel>
                      <Select
                        name="officialApiRetryOnError"
                        id="officialApiRetryOnError"
                        labelId="officialApiRetryOnError-label"
                        label="Retentar em caso de erro"
                        value={settings.officialApiRetryOnError ? "true" : "false"}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          officialApiRetryOnError: e.target.value === "true" 
                        }))}
                      >
                        <MenuItem value="true">Sim</MenuItem>
                        <MenuItem value="false">Não</MenuItem>
                      </Select>
                      <FormHelperText>
                        Retentar automaticamente mensagens que falharam
                      </FormHelperText>
                    </FormControl>
                  </Grid>

                  <Grid xs={12} md={4} item>
                    <TextField
                      label="Máximo de retentativas"
                      variant="outlined"
                      name="officialApiMaxRetries"
                      type="number"
                      value={settings.officialApiMaxRetries || 3}
                      onChange={handleOnChangeSettings}
                      fullWidth
                      inputProps={{ min: 1, max: 10 }}
                      helperText="Número máximo de tentativas por mensagem"
                    />
                  </Grid>

                  <Grid xs={12} className={classes.textRight} item style={{ marginTop: 16 }}>
                    <Button
                      onClick={saveSettings}
                      color="primary"
                      variant="contained"
                    >
                      {i18n.t("campaigns.settings.save")}
                    </Button>
                  </Grid>
                </Grid>
              </TabPanel>

              {/* TAB 2: Configurações Gerais */}
              <TabPanel value={activeTab} index={2}>
                <Grid spacing={2} container>
                  <Grid xs={12} item>
                    <Typography component={"h2"} className={classes.sectionTitle}>
                      Supressão (não enviar para contatos com estas tags)
                      <Tooltip
                        title={
                          <span>
                            Evite enviar para opt-outs ou bloqueados. Configure tags como DNC, SAIR, CANCELAR.<br/>
                            A supressão reduz denúncias e melhora a reputação de envio.
                          </span>
                        }
                        placement="right"
                      >
                        <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.7 }} />
                      </Tooltip>
                    </Typography>
                  </Grid>
                  <Grid xs={12} item>
                    <TextField
                      label="Tags separadas por vírgula (ex: DNC, SAIR, CANCELAR)"
                      variant="outlined"
                      value={suppressionTagNamesStr}
                      onChange={(e) => setSuppressionTagNamesStr(e.target.value)}
                      fullWidth
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <Tooltip title="Evite enviar para contatos com opt-out/bloqueio. Ex.: DNC, SAIR, CANCELAR.">
                              <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.7, cursor: 'help' }} />
                            </Tooltip>
                          </InputAdornment>
                        )
                      }}
                      helperText="Separe por vírgulas; usamos correspondência exata das tags do contato. Aplica-se a todas as conexões."
                    />
                  </Grid>

                  <Grid xs={12} item>
                    <Typography component={"h2"} className={classes.sectionTitle} style={{ marginTop: 16 }}>
                      Outras Configurações
                      <Tooltip title="Configurações que se aplicam a todas as conexões" placement="right">
                        <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.7 }} />
                      </Tooltip>
                    </Typography>
                  </Grid>

                  <Grid xs={12} item>
                    <Typography variant="body2" color="textSecondary">
                      Configurações adicionais para outros tipos de conexão serão adicionadas aqui no futuro 
                      (ex: Telegram, Instagram, etc).
                    </Typography>
                  </Grid>

                  <Grid xs={12} className={classes.textRight} item style={{ marginTop: 16 }}>
                    <Button
                      onClick={saveSettings}
                      color="primary"
                      variant="contained"
                    >
                      {i18n.t("campaigns.settings.save")}
                    </Button>
                  </Grid>
                </Grid>
              </TabPanel>
            </Paper>
          </>
        ) : <ForbiddenPage /> }
    </MainContainer>
  );
};

export default CampaignsConfig;
