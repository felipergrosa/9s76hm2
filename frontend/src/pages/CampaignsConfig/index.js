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
  FormHelperText
} from "@material-ui/core";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import ConfirmationModal from "../../components/ConfirmationModal";
import ForbiddenPage from "../../components/ForbiddenPage";

import { AuthContext } from "../../context/Auth/AuthContext";
import AIIntegrationSelector from "../../components/AIIntegrationSelector";

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

}));

const initialSettings = {
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
  suppressionTagNames: []
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

  const [sabado, setSabado] = React.useState(false);
  const [domingo, setDomingo] = React.useState(false);

  const [startHour, setStartHour] = useState("08:00");
  const [endHour, setEndHour] = useState("19:00");
  // Campo editável (string) para as tags de supressão, separado por vírgula
  const [suppressionTagNamesStr, setSuppressionTagNamesStr] = useState("");

  const { getPlanCompany } = usePlans();

  // --- Integração IA Global + Prompt Base ---
  const [aiIntegrationId, setAiIntegrationId] = useState("");
  const [aiIntegrationObj, setAiIntegrationObj] = useState(null);
  const [aiBasePrompt, setAiBasePrompt] = useState("");
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);

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

  // Status de criptografia (backend)
  useEffect(() => {
    const loadEncryptionStatus = async () => {
      try {
        const { data } = await api.get('/ai/encryption-status');
        setEncryptionEnabled(Boolean(data?.encryptionEnabled));
      } catch (_) {
        setEncryptionEnabled(true); // assume habilitado se não conseguir verificar
      }
    };
    loadEncryptionStatus();
  }, []);

  // Carregar integração IA preferida e prompt base dos settings
  useEffect(() => {
    api.get("/campaign-settings").then(({ data }) => {
      try {
        const map = new Map((Array.isArray(data) ? data : []).map(it => [it.key, it.value]));
        const savedIntegrationId = map.get("aiIntegrationId");
        const savedPrompt = map.get("aiBasePrompt");
        if (savedIntegrationId) setAiIntegrationId(savedIntegrationId);
        if (typeof savedPrompt === "string") setAiBasePrompt(savedPrompt);
      } catch (_) {}
    });
  }, []);

  const handleOnChangeVariable = (e) => {
    if (e.target.value !== null) {
      const changedProp = {};
      changedProp[e.target.name] = e.target.value;
      setVariable((prev) => ({ ...prev, ...changedProp }));
    }
  };

  // Handler do seletor de integração IA
  const handleAIIntegrationChange = (id, integrationObj) => {
    setAiIntegrationId(id || "");
    setAiIntegrationObj(integrationObj || null);
  };

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

    // Persistir integração IA e prompt base
    payload.aiIntegrationId = aiIntegrationId || "";
    payload.aiBasePrompt = aiBasePrompt || "";

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
      {
        user.profile === "user" ?
          <ForbiddenPage />
          :
          <>
            <MainHeader>
              <Grid style={{ width: "99.6%" }} container>
                <Grid xs={12} item>
                  <Title>{i18n.t("campaignsConfig.title")}</Title>
                </Grid>
              </Grid>
            </MainHeader>

            <Paper className={classes.mainPaper} variant="outlined">

              {/* <Typography component={"h1"}>Período de Disparo das Campanhas &nbsp;</Typography>
        <Paper className={classes.paper}>
          <TextField
            id="buttonText"
            label="Começar o envio que hora?"
            margin="dense"
            variant="outlined"
            fullWidth
            value={startHour}
            onChange={(e) => setStartHour(e.target.value)}
            style={{ marginRight: "10px" }}
          />

          <TextField
            id="buttonText"
            label="Terminar o envio que hora?"
            margin="dense"
            variant="outlined"
            fullWidth
            value={endHour}
            onChange={(e) => setEndHour(e.target.value)}
            style={{ marginRight: "10px" }}
          />

          <FormControlLabel
            control={<Checkbox checked={sabado} onChange={handleChange} name="sabado" />}
            label="Sábado"
          />

          <FormControlLabel
            control={<Checkbox checked={domingo} onChange={handleChange} name="domingo" />}
            label="Domigo"
          />

          <Button
            variant="contained"
            color="primary"
            className={classes.button}
            onClick={() => {
              handleSaveTimeMass();
            }}
            style={{ marginRight: "10px" }}
          >
            Salvar
          </Button>

        </Paper> */}

              <Box className={classes.tabPanelsContainer}>
                <Grid spacing={1} container>
                  {/* IA para campanhas (integração global + prompt base) */}
                  <Grid xs={12} item>
                    <Typography component={"h1"} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      IA para campanhas
                      <Tooltip
                        title={
                          <span>
                            Selecione uma integração global (OpenAI/Gemini) e defina um prompt base para gerar mensagens aleatórias e variações nas campanhas.<br/>
                            Dicas: inclua contexto do negócio, persona do público, objetivo e restrições (ex.: evitar termos sensíveis).
                          </span>
                        }
                        placement="right"
                      >
                        <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.7 }} />
                      </Tooltip>
                    </Typography>
                  </Grid>
                  {!encryptionEnabled && (
                    <Grid xs={12} item>
                      <Paper className={classes.paper} variant="outlined" style={{ background: '#fff8e1', borderColor: '#ffb300', alignItems: 'stretch', flexDirection: 'column' }}>
                        <Typography style={{ fontWeight: 600, marginBottom: 4 }}>Atenção: criptografia de API Key não habilitada</Typography>
                        <Typography variant="body2">
                          Defina a variável de ambiente <b>OPENAI_ENCRYPTION_KEY</b> (ou <b>DATA_KEY</b>) no backend para que a sua API Key seja armazenada de forma criptografada.
                        </Typography>
                      </Paper>
                    </Grid>
                  )}
                  <Grid xs={12} md={6} item>
                    <AIIntegrationSelector
                      value={aiIntegrationId}
                      onChange={handleAIIntegrationChange}
                      label="Integração IA (OpenAI/Gemini)"
                      required
                      helperText="Selecione qual integração usar para gerar variações e mensagens aleatórias"
                    />
                  </Grid>
                  <Grid xs={12} item>
                    <TextField
                      label="Prompt base para geração de mensagens"
                      variant="outlined"
                      fullWidth
                      multiline
                      rows={5}
                      value={aiBasePrompt}
                      onChange={(e) => setAiBasePrompt(e.target.value)}
                      placeholder={`Você é um assistente de marketing que cria mensagens curtas, claras e personalizadas para WhatsApp.\nInstruções:\n- Use linguagem natural, tom profissional e amigável.\n- Inclua variação de abertura, CTA e urgência suave.\n- Adapte-se ao contexto do negócio, público e oferta.\n- Evite palavras de spam e termos proibidos.\n- Nunca inclua links encurtados sem autorização.\n- Mensagens de 200-350 caracteres.\n- Personalize usando variáveis {nome}, {empresa}, {vendedor}.`}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <Tooltip
                              title={
                                <span>
                                  Dicas de uso:<br/>
                                  • Descreva público-alvo, oferta, objetivo e restrições.<br/>
                                  • Liste 2-3 exemplos de mensagens que você gosta (estilo).<br/>
                                  • Indique palavras que devem/ não devem aparecer.<br/>
                                  • Informe variáveis disponíveis: {`{nome}`}, {`{empresa}`}, {`{cidade}`}.<br/>
                                  Ideias: follow-up, confirmação, recuperação de carrinho, reativação, lançamento.
                                </span>
                              }
                              placement="left"
                            >
                              <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.7, cursor: 'help' }} />
                            </Tooltip>
                          </InputAdornment>
                        )
                      }}
                      helperText="Use este prompt como base. O criador de campanhas poderá adaptar/combinar com instruções específicas"
                    />
                  </Grid>
                  <Grid xs={12} item>
                    <Typography component={"h1"} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                  {/* Lista de Supressão */}
                  <Grid xs={12} item>
                    <Typography component={"h1"} style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
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
                      helperText="Separe por vírgulas; usamos correspondência exata das tags do contato"
                    />
                  </Grid>
                  <Grid xs={12} className={classes.textRight} item>
                    {/* <Button
                onClick={() => setShowVariablesForm(!showVariablesForm)}
                color="primary"
                style={{ marginRight: 10 }}
              >
                {i18n.t("campaigns.settings.addVar")}
              </Button> */}
                    <Button
                      onClick={saveSettings}
                      color="primary"
                      variant="contained"
                    >
                      {i18n.t("campaigns.settings.save")}
                    </Button>
                  </Grid>
                  {/* {showVariablesForm && (
              <>
                <Grid xs={12} md={6} item>
                  <TextField
                    label={i18n.t("campaigns.settings.shortcut")}
                    variant="outlined"
                    value={variable.key}
                    name="key"
                    onChange={handleOnChangeVariable}
                    fullWidth
                  />
                </Grid>
                <Grid xs={12} md={6} item>
                  <TextField
                    label={i18n.t("campaigns.settings.content")}
                    variant="outlined"
                    value={variable.value}
                    name="value"
                    onChange={handleOnChangeVariable}
                    fullWidth
                  />
                </Grid>
                <Grid xs={12} className={classes.textRight} item>
                  <Button
                    onClick={() => setShowVariablesForm(!showVariablesForm)}
                    color="primary"
                    style={{ marginRight: 10 }}
                  >
                    {i18n.t("campaigns.settings.close")}
                  </Button>
                  <Button
                    onClick={addVariable}
                    color="primary"
                    variant="contained"
                  >
                    {i18n.t("campaigns.settings.add")}
                  </Button>
                </Grid>
              </>
            )}
            {settings.variables.length > 0 && (
              <Grid xs={12} className={classes.textRight} item>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell style={{ width: "1%" }}></TableCell>
                      <TableCell>{i18n.t("campaigns.settings.shortcut")}
                      </TableCell>
                      <TableCell>{i18n.t("campaigns.settings.content")}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.isArray(settings.variables) &&
                      settings.variables.map((v, k) => (
                        <TableRow key={k}>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedKey(v.key);
                                setConfirmationOpen(true);
                              }}
                            >
                              <DeleteOutlineIcon />
                            </IconButton>
                          </TableCell>
                          <TableCell>{"{" + v.key + "}"}</TableCell>
                          <TableCell>{v.value}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </Grid>
            )} */}
                </Grid>
              </Box>
            </Paper>
          </>}
    </MainContainer>
  );
};

export default CampaignsConfig;
