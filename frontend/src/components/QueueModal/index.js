import React, { useState, useEffect, useRef, useContext, Fragment } from "react";
import * as Yup from "yup";
import { Formik, FieldArray, Form, Field } from "formik";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";

import {
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  Box,
  Typography,
  Divider,
  Card,
  CardContent
} from "@material-ui/core";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import SaveIcon from "@material-ui/icons/Save";
import Switch from "@material-ui/core/Switch";
import { Tooltip, IconButton } from "@material-ui/core";
import HelpOutlineIcon from "@material-ui/icons/HelpOutline";
import { Colorize } from "@material-ui/icons";
import { isArray } from "lodash";

// Imports de componentes internos
import api from "../../services/api";
import toastError from "../../errors/toastError";
import ColorPicker from "../ColorPicker";
import SchedulesForm from "../SchedulesForm";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePlans from "../../hooks/usePlans";
import useRAGCollections from "../../hooks/useRAGCollections";
import ColorBoxModal from "../ColorBoxModal";

// Imports para Chatbot (Tab 2)
import DeleteOutline from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import Stepper from "@material-ui/core/Stepper";
import Step from "@material-ui/core/Step";
import StepLabel from "@material-ui/core/StepLabel";
import StepContent from "@material-ui/core/StepContent";
import Checkbox from '@mui/material/Checkbox';
import ConfirmationModal from "../ConfirmationModal";
import OptionsChatBot from "../ChatBots/options";
import CustomToolTip from "../ToolTips";
import HelpOutlineOutlinedIcon from "@material-ui/icons/HelpOutlineOutlined";
import Autocomplete, { createFilterOptions } from "@material-ui/lab/Autocomplete";
import useQueues from "../../hooks/useQueues";
import UserStatusIcon from "../UserModal/statusIcon";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  tabPanel: {
    padding: theme.spacing(3),
  },
  sectionTitle: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(2),
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  colorAdorment: {
    width: 20,
    height: 20,
  },
  btnWrapper: {
    position: "relative",
  },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },
  textField1: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  greetingMessage: {
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    "& > *:not(:last-child)": {
      marginRight: theme.spacing(1),
    },
  },
  statsCard: {
    marginTop: theme.spacing(2),
    backgroundColor: "#f5f5f5",
  },
}));

const QueueSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Parâmetros incompletos!")
    .max(50, "Parâmetros acima do esperado!")
    .required("Required"),
  color: Yup.string().min(3, "Parâmetros incompletos!").max(9, "Parâmetros acima do esperado!").required(),
  greetingMessage: Yup.string(),
  orderQueue: Yup.number().min(1, "Ordem deve ser maior que 0").required("Ordem da fila é obrigatória"),
  tempoRoteador: Yup.number().min(0, "Tempo deve ser positivo"),
  maxFilesPerSession: Yup.number().min(1, "Mínimo 1 arquivo").max(10, "Máximo 10 arquivos"),
  autoSendStrategy: Yup.string().oneOf(["none", "on_enter", "on_request", "manual"], "Estratégia inválida"),
  confirmationTemplate: Yup.string(),
  ragCollection: Yup.string(),
  chatbots: Yup.array()
    .of(
      Yup.object().shape({
        name: Yup.string().min(4, "too short").required("Required"),
      })
    )
    .required("Must have friends"),
});

// Componente TabPanel
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`queue-tabpanel-${index}`}
      aria-labelledby={`queue-tab-${index}`}
      {...other}
    >
      {value === index && <Box p={3}>{children}</Box>}
    </div>
  );
}

const QueueModal = ({ open, onClose, queueId, onEdit }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const initialState = {
    name: "",
    color: "",
    greetingMessage: "",
    chatbots: [],
    outOfHoursMessage: "",
    orderQueue: 1,
    tempoRoteador: 0,
    ativarRoteador: false,
    integrationId: "",
    fileListId: "",
    closeTicket: false,
    sttEnabled: true,
    autoSendStrategy: "none",
    confirmationTemplate: "",
    maxFilesPerSession: 3,
    ragCollection: ""
  };

  // Estados
  const [colorPickerModalOpen, setColorPickerModalOpen] = useState(false);
  const [queue, setQueue] = useState(initialState);
  const [tab, setTab] = useState(0);
  const [file, setFile] = useState([]);
  const [folders, setFolders] = useState([]);  // Pastas do File Manager
  const [integrations, setIntegrations] = useState([]);
  const [schedulesEnabled, setSchedulesEnabled] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estados para Chatbot (Tab 2)
  const greetingRef = useRef();
  const [activeStep, setActiveStep] = useState(null);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isStepContent, setIsStepContent] = useState(true);
  const [isGreetingMessageEdit, setGreetingMessageEdit] = useState(null);
  const [isNameEdit, setIsNamedEdit] = useState(null);
  const [searchParam, setSearchParam] = useState("");
  const [queues, setQueues] = useState([]);
  const [allQueues, setAllQueues] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const [selectedQueueOption, setSelectedQueueOption] = useState("");
  const isMounted = useRef(true);

  // Hooks
  const { get: getSetting } = useCompanySettings();
  const { getPlanCompany } = usePlans();
  const { collections: ragCollections, loading: ragLoading } = useRAGCollections();
  const { findAll: findAllQueues } = useQueues();

  // Schedules
  const initialStateSchedule = [
    { weekday: "Segunda-feira", weekdayEn: "monday", startTimeA: "00:00", endTimeA: "12:00", startTimeB: "12:01", endTimeB: "23:59" },
    { weekday: "Terça-feira", weekdayEn: "tuesday", startTimeA: "00:00", endTimeA: "12:00", startTimeB: "12:01", endTimeB: "23:59" },
    { weekday: "Quarta-feira", weekdayEn: "wednesday", startTimeA: "00:00", endTimeA: "12:00", startTimeB: "12:01", endTimeB: "23:59" },
    { weekday: "Quinta-feira", weekdayEn: "thursday", startTimeA: "00:00", endTimeA: "12:00", startTimeB: "12:01", endTimeB: "23:59" },
    { weekday: "Sexta-feira", weekdayEn: "friday", startTimeA: "00:00", endTimeA: "12:00", startTimeB: "12:01", endTimeB: "23:59" },
    { weekday: "Sábado", weekdayEn: "saturday", startTimeA: "00:00", endTimeA: "12:01", startTimeB: "12:01", endTimeB: "23:59" },
    { weekday: "Domingo", weekdayEn: "sunday", startTimeA: "00:00", endTimeA: "12:01", startTimeB: "12:01", endTimeB: "23:59" }
  ];

  const [schedules, setSchedules] = useState(initialStateSchedule);

  const companyId = user.companyId;

  // useEffects
  useEffect(() => {
    async function fetchData() {
      const planConfigs = await getPlanCompany(undefined, companyId);
      setShowIntegrations(planConfigs.plan.useIntegrations);
    }
    fetchData();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const setting = await getSetting({ column: "scheduleType" });
      if (setting.scheduleType === "queue") setSchedulesEnabled(true);
    };
    fetchData();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/library/folders", { params: { companyId } });
                console.log("📊 Pastas carregadas:", data);
        setFolders(data.folders || data);
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  useEffect(() => {
    if (showIntegrations) {
      (async () => {
        try {
          const { data } = await api.get("/queueIntegration/", { params: { companyId } });
          setIntegrations(data.integrations || data.queueIntegrations || []);
        } catch (err) {
          toastError(err);
        }
      })();
    }
  }, [showIntegrations]);

  useEffect(() => {
    (async () => {
      if (!queueId) return;
      try {
        const { data } = await api.get(`/queue/${queueId}`);
        setQueue((prevState) => ({
          ...prevState,
          ...data,
          orderQueue: data.orderQueue || 1,
          tempoRoteador: data.tempoRoteador || 0,
          sttEnabled: data.sttEnabled !== undefined ? data.sttEnabled : true,
          maxFilesPerSession: data.maxFilesPerSession || 3,
          autoSendStrategy: data.autoSendStrategy || "none",
          confirmationTemplate: data.confirmationTemplate || "",
          ragCollection: data.ragCollection || ""
        }));

        if (isArray(data.schedules) && data.schedules.length > 0) {
          setSchedules(data.schedules);
        }
      } catch (err) {
        toastError(err);
      }
    })();

    return () => {
      setQueue(initialState);
    };
  }, [queueId, open]);

  useEffect(() => {
    if (isMounted.current) {
      const loadQueues = async () => {
        const list = await findAllQueues();
        setAllQueues(list);
        setQueues(list);
      };
      loadQueues();
    }
  }, []);

  useEffect(() => {
    if (searchParam.length < 3) {
      setLoading(false);
      setSelectedQueueOption("");
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      const fetchUsers = async () => {
        try {
          const { data } = await api.get("/users/");
          setUserOptions(data.users);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam]);

  useEffect(() => {
    if (activeStep) {
      setSelectedQueueOption(queue.chatbots[activeStep]?.optQueueId);
    }

    if (activeStep === isNameEdit) {
      setIsStepContent(false);
    } else {
      setIsStepContent(true);
    }
  }, [isNameEdit, activeStep]);

  const handleClose = () => {
    onClose();
    setIsNamedEdit(null);
    setActiveStep(null);
    setGreetingMessageEdit(null);
    setQueue(initialState);
    setTab(0);
  };

  const handleSaveSchedules = async (values) => {
    toast.success("Clique em salvar para registrar as alterações");
    setSchedules(values);
    setTab(0);
  };

  const filterOptions = createFilterOptions({
    trim: true,
  });

  const handleCloseConfirmationModal = () => {
    setConfirmModalOpen(false);
    setSelectedQueue(null);
  };

  const handleDeleteQueue = async (optionsId) => {
    try {
      await api.delete(`/chatbot/${optionsId}`);
      const { data } = await api.get(`/queue/${queueId}`);
      setQueue(initialState);
      setQueue(data);
      setIsNamedEdit(null);
      setGreetingMessageEdit(null);
      toast.success(i18n.t("queues.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
  };

  const handleSaveQueue = async (values) => {
    try {
      if (queueId) {
        await api.put(`/queue/${queueId}`, { ...values, schedules });
      } else {
        await api.post("/queue", { ...values, schedules });
      }
      toast.success(i18n.t("queues.toasts.success"));
      if (typeof onEdit === "function") {
        onEdit(values);
      }
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  const handleSaveBot = async (values) => {
    try {
      if (queueId) {
        const { data } = await api.put(`/queue/${queueId}`, values);
        if (data.chatbots && data.chatbots.length) {
          onEdit(data);
          setQueue(data);
        }
      }
      toast.success("Chatbot salvo!");
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        scroll="paper"
      >
        <DialogTitle>
          {queueId ? i18n.t("queueModal.title.edit") : i18n.t("queueModal.title.add")}
        </DialogTitle>
        <Formik
          initialValues={queue}
          enableReinitialize={true}
          validationSchema={QueueSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveQueue(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ values, errors, touched, isSubmitting, setFieldValue }) => (
            <Form>
              <DialogContent dividers>
                {/* TABS */}
                <Paper square>
                  <Tabs
                    value={tab}
                    onChange={(e, newValue) => setTab(newValue)}
                    indicatorColor="primary"
                    textColor="primary"
                    variant="fullWidth"
                  >
                    <Tab label="🤖 Bot Inteligente" />
                    <Tab label="📋 Dados + Chatbot" />
                    <Tab label="🕐 Horários" />
                    <Tab label="💡 Dicas" />
                  </Tabs>
                </Paper>

                {/* TAB 1: BOT INTELIGENTE (RAG + ARQUIVOS) */}
                <TabPanel value={tab} index={0}>
                  <Typography variant="h6" className={classes.sectionTitle}>
                    🧠 Base de Conhecimento RAG
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <FormControl variant="outlined" margin="dense" fullWidth>
                        <InputLabel>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            Coleção RAG
                            <Tooltip title="Base de conhecimento que a IA usará para responder perguntas. Selecione uma coleção ou deixe vazio para desativar o bot inteligente." arrow>
                              <HelpOutlineIcon fontSize="small" color="action" style={{ cursor: 'help' }} />
                            </Tooltip>
                          </div>
                        </InputLabel>
                        <Field
                          as={Select}
                          label="Coleção RAG"
                          name="ragCollection"
                          value={values.ragCollection || ""}
                          disabled={ragLoading}
                        >
                          <MenuItem value="">
                            <em>Nenhuma (Bot desativado)</em>
                          </MenuItem>
                          {ragCollections.map((coll) => (
                            <MenuItem key={coll.id} value={coll.name}>
                              {coll.label}
                            </MenuItem>
                          ))}
                        </Field>
                      </FormControl>

                      {ragLoading && (
                        <Typography variant="caption" color="textSecondary" style={{ display: 'block', marginTop: 4 }}>
                          Carregando coleções disponíveis...
                        </Typography>
                      )}

                      {values.ragCollection && (
                        <Card className={classes.statsCard}>
                          <CardContent>
                            <Typography variant="caption" color="textSecondary">
                              ✅ Bot ativado com coleção: <strong>{values.ragCollection}</strong>
                            </Typography>
                          </CardContent>
                        </Card>
                      )}
                    </Grid>
                  </Grid>

                  <Divider style={{ margin: '24px 0' }} />

                  <Typography variant="h6" className={classes.sectionTitle}>
                    📁 Envio Inteligente de Arquivos
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <FormControl variant="outlined" margin="dense" fullWidth>
                        <InputLabel>Pasta de Arquivos</InputLabel>
                        <Field
                          as={Select}
                          label="Arquivos"
                          name="folderId"
                          value={values.folderId || ""}
                          onChange={(e) => {
                            setFieldValue("folderId", e.target.value);
                            setFieldValue("fileListId", null); // Limpa fileListId ao selecionar pasta
                          }}
                        >
                          <MenuItem value="">Nenhuma</MenuItem>
                          <MenuItem value={-1}>📁 Tudo (Todas as Pastas)</MenuItem>                                                    {(folders || []).filter(f => f).map(folder => (
                            <MenuItem key={folder.id} value={folder.id}>
                              📁 {folder.name}
                            </MenuItem>
                          ))}
                        </Field>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <FormControl variant="outlined" margin="dense" fullWidth>
                        <InputLabel>Estratégia de Envio</InputLabel>
                        <Field
                          as={Select}
                          label="Estratégia de Envio"
                          name="autoSendStrategy"
                          value={values.autoSendStrategy || "none"}
                        >
                          <MenuItem value="none">🚫 Nenhum</MenuItem>
                          <MenuItem value="on_enter">🚪 Ao Entrar na Fila</MenuItem>
                          <MenuItem value="on_request">🔍 Sob Demanda</MenuItem>
                          <MenuItem value="manual">👤 Manual</MenuItem>
                        </Field>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Field
                        as={TextField}
                        label="Máximo de Arquivos por Sessão"
                        name="maxFilesPerSession"
                        type="number"
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        inputProps={{ min: 1, max: 10 }}
                        value={values.maxFilesPerSession || 3}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <Field
                        as={TextField}
                        label="Template de Confirmação"
                        name="confirmationTemplate"
                        multiline
                        rows={3}
                        fullWidth
                        variant="outlined"
                        margin="dense"
                        placeholder={`Olá {{name}}! Gostaria de receber nosso catálogo?`}
                        helperText="Use {{name}}, {{number}}, {{protocol}} para personalizar"
                      />
                    </Grid>
                  </Grid>
                </TabPanel>

                {/* TAB 2: DADOS + CHATBOT */}
                <TabPanel value={tab} index={1}>
                  <Typography variant="h6" className={classes.sectionTitle}>
                    ℹ️ Informações Básicas
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Field
                        as={TextField}
                        label={i18n.t("queueModal.form.name")}
                        autoFocus
                        name="name"
                        error={touched.name && Boolean(errors.name)}
                        helperText={touched.name && errors.name}
                        variant="outlined"
                        margin="dense"
                        fullWidth
                      />
                    </Grid>

                    <Grid item xs={12} md={3}>
                      <Field
                        as={TextField}
                        label={i18n.t("queueModal.form.orderQueue")}
                        name="orderQueue"
                        type="number"
                        error={touched.orderQueue && Boolean(errors.orderQueue)}
                        helperText={touched.orderQueue && errors.orderQueue}
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        inputProps={{ min: 1 }}
                      />
                    </Grid>

                    <Grid item xs={12} md={3}>
                      <FormControl variant="outlined" margin="dense" fullWidth>
                        <Field
                          as={TextField}
                          label={i18n.t("queueModal.form.color")}
                          name="color"
                          error={touched.color && Boolean(errors.color)}
                          helperText={touched.color && errors.color}
                          InputProps={{
                            startAdornment: (
                              <IconButton
                                size="small"
                                onClick={() => setColorPickerModalOpen(true)}
                              >
                                <div
                                  style={{
                                    backgroundColor: values.color,
                                  }}
                                  className={classes.colorAdorment}
                                />
                                <Colorize />
                              </IconButton>
                            ),
                          }}
                          variant="outlined"
                          margin="dense"
                        />
                      </FormControl>
                    </Grid>

                    <Grid item xs={12}>
                      <Field
                        as={TextField}
                        label={i18n.t("queueModal.form.greetingMessage")}
                        type="greetingMessage"
                        multiline
                        inputRef={greetingRef}
                        minRows={5}
                        fullWidth
                        name="greetingMessage"
                        error={touched.greetingMessage && Boolean(errors.greetingMessage)}
                        helperText={touched.greetingMessage && errors.greetingMessage}
                        variant="outlined"
                        margin="dense"
                      />
                    </Grid>

                    {schedulesEnabled && (
                      <Grid item xs={12}>
                        <Field
                          as={TextField}
                          label={i18n.t("queueModal.form.outOfHoursMessage")}
                          type="outOfHoursMessage"
                          multiline
                          rows={5}
                          fullWidth
                          required={schedulesEnabled}
                          name="outOfHoursMessage"
                          error={touched.outOfHoursMessage && Boolean(errors.outOfHoursMessage)}
                          helperText={touched.outOfHoursMessage && errors.outOfHoursMessage}
                          variant="outlined"
                          margin="dense"
                        />
                      </Grid>
                    )}
                  </Grid>

                  <Divider style={{ margin: '24px 0' }} />

                  <Typography variant="h6" className={classes.sectionTitle}>
                    ⚙️ Configurações
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <FormControlLabel
                        control={
                          <Field
                            as={Switch}
                            color="primary"
                            name="ativarRoteador"
                            checked={values.ativarRoteador}
                          />
                        }
                        label={i18n.t("queueModal.form.rotate")}
                      />
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <FormControlLabel
                        control={
                          <Field
                            as={Switch}
                            color="primary"
                            name="closeTicket"
                            checked={values.closeTicket}
                          />
                        }
                        label={i18n.t("queueModal.form.closeTicket")}
                      />
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <FormControlLabel
                        control={
                          <Field
                            as={Switch}
                            color="primary"
                            name="sttEnabled"
                            checked={values.sttEnabled}
                          />
                        }
                        label={i18n.t("queueModal.form.sttEnabled")}
                      />
                    </Grid>

                    <Grid item xs={12} md={4}>
                      <FormControl variant="outlined" margin="dense" fullWidth>
                        <InputLabel>{i18n.t("queueModal.form.timeRotate")}</InputLabel>
                        <Field
                          as={Select}
                          label={i18n.t("queueModal.form.timeRotate")}
                          name="tempoRoteador"
                        >
                          <MenuItem value="0" disabled>Selecione o tempo</MenuItem>
                          <MenuItem value="2">2 minutos</MenuItem>
                          <MenuItem value="5">5 minutos</MenuItem>
                          <MenuItem value="10">10 minutos</MenuItem>
                          <MenuItem value="15">15 minutos</MenuItem>
                          <MenuItem value="30">30 minutos</MenuItem>
                        </Field>
                      </FormControl>
                    </Grid>

                    {showIntegrations && (
                      <Grid item xs={12}>
                        <FormControl variant="outlined" margin="dense" fullWidth>
                          <InputLabel>{i18n.t("queueModal.form.integrationId")}</InputLabel>
                          <Field
                            as={Select}
                            label={i18n.t("queueModal.form.integrationId")}
                            name="integrationId"
                            value={values.integrationId || ""}
                          >
                            <MenuItem value="">Nenhuma integração</MenuItem>
                            {integrations.map((integration) => (
                              <MenuItem key={integration.id} value={integration.id}>
                                {integration.name}
                              </MenuItem>
                            ))}
                          </Field>
                        </FormControl>
                      </Grid>
                    )}
                  </Grid>

                  <Divider style={{ margin: '24px 0' }} />

                  <Typography variant="subtitle1">
                    {i18n.t("queueModal.bot.title")}
                    <CustomToolTip
                      title={i18n.t("queueModal.bot.toolTipTitle")}
                      content={i18n.t("queueModal.bot.toolTip")}
                    >
                      <HelpOutlineOutlinedIcon
                        style={{ marginLeft: "14px" }}
                        fontSize="small"
                      />
                    </CustomToolTip>
                  </Typography>

                  {/* CHATBOT LOGIC - Mantendo a implementação original */}
                  <div>
                    <FieldArray name="chatbots">
                      {({ push, remove }) => (
                        <>
                          <Stepper
                            nonLinear
                            activeStep={activeStep}
                            orientation="vertical"
                          >
                            {values.chatbots &&
                              values.chatbots.length > 0 &&
                              values.chatbots.map((info, index) => (
                                <Step
                                  key={`${info.id ? info.id : index}-chatbots`}
                                  onClick={() => setActiveStep(index)}
                                >
                                  <StepLabel key={`${info.id}-chatbots`}>
                                    {isNameEdit !== index &&
                                      queue.chatbots[index]?.name ? (
                                      <div
                                        className={classes.greetingMessage}
                                        variant="body1"
                                      >
                                        {values.chatbots[index].name}

                                        <IconButton
                                          size="small"
                                          onClick={() => {
                                            setIsNamedEdit(index);
                                            setIsStepContent(false);
                                          }}
                                        >
                                          <EditIcon />
                                        </IconButton>

                                        <IconButton
                                          onClick={() => {
                                            setSelectedQueue(info);
                                            setConfirmModalOpen(true);
                                          }}
                                          size="small"
                                        >
                                          <DeleteOutline />
                                        </IconButton>
                                      </div>
                                    ) : (
                                      <Grid spacing={2} container>
                                        <Grid xs={12} md={12} item>
                                          <Field
                                            as={TextField}
                                            name={`chatbots[${index}].name`}
                                            variant="outlined"
                                            margin="dense"
                                            color="primary"
                                            label={i18n.t("queueModal.form.greetingMessage")}
                                            disabled={isSubmitting}
                                            autoFocus
                                            fullWidth
                                            size="small"
                                            error={
                                              touched?.chatbots?.[index]?.name &&
                                              Boolean(
                                                errors.chatbots?.[index]?.name
                                              )
                                            }
                                            className={classes.textField}
                                          />
                                        </Grid>
                                        <Grid xs={12} md={8} item>
                                          <FormControl
                                            variant="outlined"
                                            margin="dense"
                                            className={classes.formControl}
                                            fullWidth
                                          >
                                            <InputLabel id="queueType-selection-label">{i18n.t("queueModal.form.queueType")}</InputLabel>

                                            <Field
                                              as={Select}
                                              name={`chatbots[${index}].queueType`}
                                              variant="outlined"
                                              margin="dense"
                                              fullWidth
                                              labelId="queueType-selection-label"
                                              label={i18n.t("queueModal.form.queueType")}
                                              error={touched?.chatbots?.[index]?.queueType &&
                                                Boolean(errors?.chatbots?.[index]?.queueType)}
                                            >
                                              <MenuItem value={"text"}>{i18n.t("queueModal.bot.text")}</MenuItem>
                                              <MenuItem value={"attendent"}>{i18n.t("queueModal.bot.attendent")}</MenuItem>
                                              <MenuItem value={"queue"}>{i18n.t("queueModal.bot.queue")}</MenuItem>
                                              <MenuItem value={"integration"}>{i18n.t("queueModal.bot.integration")}</MenuItem>
                                              <MenuItem value={"file"}>{i18n.t("queueModal.bot.file")}</MenuItem>
                                            </Field>
                                          </FormControl>
                                        </Grid>

                                        <Grid xs={12} md={4} item>
                                          <FormControlLabel
                                            control={
                                              <Field
                                                as={Checkbox}
                                                color="primary"
                                                name={`chatbots[${index}].closeTicket`}
                                                checked={values.chatbots[index].closeTicket || false}
                                              />
                                            }
                                            labelPlacement="top"
                                            label={i18n.t("queueModal.form.closeTicket")}
                                          />

                                          <IconButton
                                            size="small"
                                            onClick={() =>
                                              values.chatbots[index].name
                                                ? handleSaveBot(values)
                                                : null
                                            }
                                            disabled={isSubmitting}
                                          >
                                            <SaveIcon />
                                          </IconButton>

                                          <IconButton
                                            size="small"
                                            onClick={() => remove(index)}
                                            disabled={isSubmitting}
                                          >
                                            <DeleteOutline />
                                          </IconButton>
                                        </Grid>
                                      </Grid>
                                    )}
                                  </StepLabel>

                                  {isStepContent && queue.chatbots[index] && (
                                    <StepContent>
                                      <>
                                        {isGreetingMessageEdit !== index ? (
                                          <div
                                            className={classes.greetingMessage}
                                          >
                                            <Typography
                                              color="textSecondary"
                                              variant="body1"
                                            >
                                              Message:
                                            </Typography>

                                            {
                                              values.chatbots[index]
                                                .greetingMessage
                                            }

                                            {!queue.chatbots[index]
                                              ?.greetingMessage && (
                                                <CustomToolTip
                                                  title={i18n.t("queueModal.bot.toolTipMessageTitle")}
                                                  content={i18n.t("queueModal.bot.toolTipMessageContent")}
                                                >
                                                  <HelpOutlineOutlinedIcon
                                                    color="secondary"
                                                    style={{ marginLeft: "4px" }}
                                                    fontSize="small"
                                                  />
                                                </CustomToolTip>
                                              )}

                                            <IconButton
                                              size="small"
                                              onClick={() =>
                                                setGreetingMessageEdit(index)
                                              }
                                            >
                                              <EditIcon />
                                            </IconButton>
                                          </div>
                                        ) : (
                                          <Grid spacing={2} container>
                                            <div
                                              className={classes.greetingMessage}
                                            >
                                              {queue.chatbots[index].queueType === "text" && (
                                                <Grid xs={12} md={12} item>
                                                  <Field
                                                    as={TextField}
                                                    name={`chatbots[${index}].greetingMessage`}
                                                    label={i18n.t("queueModal.form.message")}
                                                    variant="outlined"
                                                    margin="dense"
                                                    fullWidth
                                                    multiline
                                                    error={
                                                      touched.greetingMessage &&
                                                      Boolean(errors.greetingMessage)
                                                    }
                                                    helperText={
                                                      touched.greetingMessage &&
                                                      errors.greetingMessage
                                                    }
                                                    className={classes.textField}
                                                  />
                                                </Grid>
                                              )}
                                            </div>
                                            {queue.chatbots[index].queueType === "queue" && (
                                              <>
                                                <Grid xs={12} md={12} item>
                                                  <Field
                                                    as={TextField}
                                                    name={`chatbots[${index}].greetingMessage`}
                                                    label={i18n.t("queueModal.form.message")}
                                                    variant="outlined"
                                                    margin="dense"
                                                    fullWidth
                                                    multiline
                                                    error={
                                                      touched.greetingMessage &&
                                                      Boolean(errors.greetingMessage)
                                                    }
                                                    helperText={
                                                      touched.greetingMessage &&
                                                      errors.greetingMessage
                                                    }
                                                    className={classes.textField}
                                                  />
                                                </Grid>
                                                <Grid xs={12} md={8} item>
                                                  <FormControl
                                                    variant="outlined"
                                                    margin="dense"
                                                    className={classes.FormControl}
                                                    fullWidth
                                                  >
                                                    <InputLabel id="queue-selection-label">{i18n.t("queueModal.form.queue")}</InputLabel>
                                                    <Field
                                                      as={Select}
                                                      name={`chatbots[${index}].optQueueId`}
                                                      error={touched?.chatbots?.[index]?.optQueueId &&
                                                        Boolean(errors?.chatbots?.[index]?.optQueueId)}
                                                      helpertext={touched?.chatbots?.[index]?.optQueueId && errors?.chatbots?.[index]?.optQueueId}
                                                      className={classes.textField1}
                                                    >
                                                      {queues.map(queue => (
                                                        <MenuItem key={queue.id} value={queue.id}>
                                                          {queue.name}
                                                        </MenuItem>
                                                      ))}
                                                    </Field>
                                                  </FormControl>
                                                </Grid>
                                              </>
                                            )}
                                            {queue.chatbots[index].queueType === "attendent" && (
                                              <>
                                                <Grid xs={12} md={12} item>
                                                  <Field
                                                    as={TextField}
                                                    name={`chatbots[${index}].greetingMessage`}
                                                    label={i18n.t("queueModal.form.message")}
                                                    variant="outlined"
                                                    margin="dense"
                                                    fullWidth
                                                    multiline
                                                    error={
                                                      touched.greetingMessage &&
                                                      Boolean(errors.greetingMessage)
                                                    }
                                                    helperText={
                                                      touched.greetingMessage &&
                                                      errors.greetingMessage
                                                    }
                                                    className={classes.textField}
                                                  />
                                                </Grid>
                                                <Grid xs={12} md={4} item>
                                                  <Autocomplete
                                                    style={{ marginTop: '8px' }}
                                                    variant="outlined"
                                                    margin="dense"
                                                    getOptionLabel={(option) => `${option.name}`}
                                                    value={queue.chatbots[index].user}
                                                    onChange={(e, newValue) => {
                                                      if (newValue != null) {
                                                        setFieldValue(`chatbots[${index}].optUserId`, newValue.id);
                                                      } else {
                                                        setFieldValue(`chatbots[${index}].optUserId`, null);
                                                      }
                                                      if (newValue != null && Array.isArray(newValue.queues)) {
                                                        if (newValue.queues.length === 1) {
                                                          setSelectedQueueOption(newValue.queues[0].id);
                                                          setFieldValue(`chatbots[${index}].optQueueId`, newValue.queues[0].id);
                                                        }
                                                        setQueues(newValue.queues);
                                                      } else {
                                                        setQueues(allQueues);
                                                        setSelectedQueueOption("");
                                                      }
                                                    }}
                                                    options={userOptions}
                                                    filterOptions={filterOptions}
                                                    freeSolo
                                                    fullWidth
                                                    autoHighlight
                                                    noOptionsText={i18n.t("transferTicketModal.noOptions")}
                                                    loading={loading}
                                                    size="small"
                                                    renderOption={option => (<span> <UserStatusIcon user={option} /> {option.name}</span>)}
                                                    renderInput={(params) => (
                                                      <TextField
                                                        {...params}
                                                        label={i18n.t("transferTicketModal.fieldLabel")}
                                                        variant="outlined"
                                                        onChange={(e) => setSearchParam(e.target.value)}
                                                        InputProps={{
                                                          ...params.InputProps,
                                                          endAdornment: (
                                                            <Fragment>
                                                              {loading ? (
                                                                <CircularProgress color="inherit" size={20} />
                                                              ) : null}
                                                              {params.InputProps.endAdornment}
                                                            </Fragment>
                                                          ),
                                                        }}
                                                      />
                                                    )}
                                                  />
                                                </Grid>
                                                <Grid xs={12} md={4} item>
                                                  <FormControl
                                                    variant="outlined"
                                                    margin="dense"
                                                    fullWidth
                                                    className={classes.formControl}
                                                  >
                                                    <InputLabel>
                                                      {i18n.t("transferTicketModal.fieldQueueLabel")}
                                                    </InputLabel>
                                                    <Select
                                                      value={selectedQueueOption}
                                                      onChange={(e) => {
                                                        setSelectedQueueOption(e.target.value)
                                                        setFieldValue(`chatbots[${index}].optQueueId`, e.target.value);
                                                      }}
                                                      label={i18n.t("transferTicketModal.fieldQueuePlaceholder")}
                                                    >
                                                      {queues.map((queue) => (
                                                        <MenuItem key={queue.id} value={queue.id}>
                                                          {queue.name}
                                                        </MenuItem>
                                                      ))}
                                                    </Select>
                                                  </FormControl>
                                                </Grid>
                                              </>
                                            )}
                                            {queue.chatbots[index].queueType === "integration" && (
                                              <>
                                                <Grid xs={12} md={12} item>
                                                  <Field
                                                    as={TextField}
                                                    name={`chatbots[${index}].greetingMessage`}
                                                    label={i18n.t("queueModal.form.message")}
                                                    variant="outlined"
                                                    margin="dense"
                                                    fullWidth
                                                    multiline
                                                    error={
                                                      touched.greetingMessage &&
                                                      Boolean(errors.greetingMessage)
                                                    }
                                                    helperText={
                                                      touched.greetingMessage &&
                                                      errors.greetingMessage
                                                    }
                                                    className={classes.textField}
                                                  />
                                                </Grid>
                                                <Grid xs={12} md={8} item>
                                                  <FormControl
                                                    variant="outlined"
                                                    margin="dense"
                                                    className={classes.FormControl}
                                                    fullWidth
                                                  >
                                                    <InputLabel id="optIntegrationId-selection-label">{i18n.t("queueModal.form.integration")}</InputLabel>
                                                    <Field
                                                      as={Select}
                                                      name={`chatbots[${index}].optIntegrationId`}
                                                      error={touched?.chatbots?.[index]?.optIntegrationId &&
                                                        Boolean(errors?.chatbots?.[index]?.optIntegrationId)}
                                                      helpertext={touched?.chatbots?.[index]?.optIntegrationId && errors?.chatbots?.[index]?.optIntegrationId}
                                                      className={classes.textField1}
                                                    >
                                                      {integrations.map(integration => (
                                                        <MenuItem key={integration.id} value={integration.id}>
                                                          {integration.name}
                                                        </MenuItem>
                                                      ))}
                                                    </Field>
                                                  </FormControl>
                                                </Grid>
                                              </>
                                            )}
                                            {queue.chatbots[index].queueType === "file" && (
                                              <>
                                                <Grid xs={12} md={12} item>
                                                  <Field
                                                    as={TextField}
                                                    name={`chatbots[${index}].greetingMessage`}
                                                    label={i18n.t("queueModal.form.message")}
                                                    variant="outlined"
                                                    margin="dense"
                                                    fullWidth
                                                    multiline
                                                    error={
                                                      touched.greetingMessage &&
                                                      Boolean(errors.greetingMessage)
                                                    }
                                                    helperText={
                                                      touched.greetingMessage &&
                                                      errors.greetingMessage
                                                    }
                                                    className={classes.textField}
                                                  />
                                                </Grid>
                                                <InputLabel>{"Selecione um Arquivo"}</InputLabel>
                                                <Field
                                                  as={Select}
                                                  name={`chatbots[${index}].optFileId`}
                                                  error={touched?.chatbots?.[index]?.optFileId &&
                                                    Boolean(errors?.chatbots?.[index]?.optFileId)}
                                                  helpertext={touched?.chatbots?.[index]?.optFileId && errors?.chatbots?.[index]?.optFileId}
                                                  className={classes.textField1}
                                                >
                                                  {(folders || []).filter(f => f).map(folder => (
                                                    <MenuItem key={folder.id} value={folder.id}>
                                                      📁 {folder.name}
                                                    </MenuItem>
                                                  ))}
                                                </Field>
                                              </>
                                            )}
                                            <IconButton
                                              size="small"
                                              onClick={() =>
                                                handleSaveBot(values)
                                              }
                                              disabled={isSubmitting}
                                            >
                                              {" "}
                                              <SaveIcon />
                                            </IconButton>
                                          </Grid>
                                        )}

                                        <OptionsChatBot chatBotId={info.id} />
                                      </>
                                    </StepContent>
                                  )}
                                </Step>
                              ))}

                            <Step>
                              <StepLabel
                                onClick={() => push({ name: "", value: "" })}
                              >
                                {i18n.t("queueModal.bot.addOptions")}
                              </StepLabel>
                            </Step>
                          </Stepper>
                        </>
                      )}
                    </FieldArray>
                  </div>
                </TabPanel>

                {/* TAB 3: HORÁRIOS */}
                <TabPanel value={tab} index={2}>
                  {schedulesEnabled ? (
                    <SchedulesForm
                      loading={false}
                      onSubmit={handleSaveSchedules}
                      initialValues={schedules}
                      labelSaveButton={i18n.t("whatsappModal.buttons.okAdd")}
                    />
                  ) : (
                    <Typography variant="body1" color="textSecondary">
                      Horários por fila não estão habilitados nesta empresa.
                    </Typography>
                  )}
                </TabPanel>

                {/* TAB 4: DICAS */}
                <TabPanel value={tab} index={3}>
                  <Typography variant="h6" gutterBottom>
                    💡 Dicas de Uso
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Bot Inteligente (RAG):</strong> Use para respostas automáticas baseadas em documentos e conhecimento.
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Chatbot Tradicional:</strong> Use para menus de opções e fluxos estruturados.
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Envio de Arquivos:</strong> Configure para enviar catálogos, manuais e formulários automaticamente.
                  </Typography>
                </TabPanel>
              </DialogContent>

              <DialogActions>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("queueModal.buttons.cancel")}
                </Button>
                <div className={classes.btnWrapper}>
                  <Button
                    type="submit"
                    color="primary"
                    disabled={isSubmitting}
                    variant="contained"
                    className={classes.btnWrapper}
                  >
                    {queueId ? i18n.t("queueModal.buttons.okEdit") : i18n.t("queueModal.buttons.okAdd")}
                    {isSubmitting && (
                      <CircularProgress
                        size={24}
                        className={classes.buttonProgress}
                      />
                    )}
                  </Button>
                </div>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>

      <ColorBoxModal
        open={colorPickerModalOpen}
        handleClose={() => setColorPickerModalOpen(false)}
        onChange={(color) => {
          // Color picker integration
        }}
      />

      <ConfirmationModal
        title={i18n.t("queues.confirmationModal.deleteTitle")}
        open={confirmModalOpen}
        onClose={handleCloseConfirmationModal}
        onConfirm={() => handleDeleteQueue(selectedQueue.id)}
      >
        {i18n.t("queues.confirmationModal.deleteMessage")}
      </ConfirmationModal>
    </div>
  );
};

export default QueueModal;
