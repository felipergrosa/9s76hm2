import React, { useState, useEffect, useRef, useContext, Fragment } from "react";

import * as Yup from "yup";
import { Formik, FieldArray, Form, Field } from "formik";
import { toast } from "react-toastify";

import { FormControl, FormControlLabel, Grid, InputLabel, MenuItem, Paper, Select, Tab, Tabs } from "@material-ui/core";

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
import EditIcon from "@material-ui/icons/Edit";
import HelpOutlineOutlinedIcon from "@material-ui/icons/HelpOutlineOutlined";
import { i18n } from "../../translate/i18n";
import Switch from "@material-ui/core/Switch";
import { isArray } from "lodash";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import ColorPicker from "../ColorPicker";
import { IconButton, InputAdornment } from "@material-ui/core";
import { Colorize } from "@material-ui/icons";
import Typography from "@material-ui/core/Typography";
import DeleteOutline from "@material-ui/icons/DeleteOutline";
import Stepper from "@material-ui/core/Stepper";
import Step from "@material-ui/core/Step";
import StepLabel from "@material-ui/core/StepLabel";
import StepContent from "@material-ui/core/StepContent";
import ConfirmationModal from "../ConfirmationModal";
import Checkbox from '@mui/material/Checkbox';

import OptionsChatBot from "../ChatBots/options";
import CustomToolTip from "../ToolTips";
import { Tooltip, Box } from "@material-ui/core";
import HelpOutlineIcon from "@material-ui/icons/HelpOutline";
import HelpIcon from "@material-ui/icons/Help";

import SchedulesForm from "../SchedulesForm";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import { AuthContext } from "../../context/Auth/AuthContext";
import Autocomplete, { createFilterOptions } from "@material-ui/lab/Autocomplete";
import useQueues from "../../hooks/useQueues";
import UserStatusIcon from "../UserModal/statusIcon";
import usePlans from "../../hooks/usePlans";
import ColorBoxModal from "../ColorBoxModal";
// import { ColorBox } from "material-ui-color";


const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },

  textField1: {
    margin: theme.spacing(1),
    minWidth: 120,
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
  colorAdorment: {
    width: 20,
    height: 20,
  },
  greetingMessage: {
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    "& > *:not(:last-child)": {
      marginRight: theme.spacing(1),
    },
  },
  custom: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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

const QueueModal = ({ open, onClose, queueId, onEdit }) => {
  const classes = useStyles();

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
    autoSendStrategy: "none",
    confirmationTemplate: "",
    maxFilesPerSession: 3,
    ragCollection: ""
  };

  const [colorPickerModalOpen, setColorPickerModalOpen] = useState(false);
  const [queue, setQueue] = useState(initialState);
  const greetingRef = useRef();
  const [activeStep, setActiveStep] = useState(null);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isStepContent, setIsStepContent] = useState(true);
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [file, setFile] = useState([]);
  const [isGreetingMessageEdit, setGreetingMessageEdit] = useState(null);
  const [isNameEdit, setIsNamedEdit] = useState(null);
  const [queues, setQueues] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [schedulesEnabled, setSchedulesEnabled] = useState(false);
  const [tab, setTab] = useState(0);
  const [tipsExpanded, setTipsExpanded] = useState(false);
  const [selectedQueueOption, setSelectedQueueOption] = useState("");
  const { findAll: findAllQueues } = useQueues();
  const [allQueues, setAllQueues] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const isMounted = useRef(true);

  const initialStateSchedule = [
    { weekday: i18n.t("Segunda-feira"), weekdayEn: "monday", startTimeA: "00:00", endTimeA: "12:00", startTimeB: "12:01", endTimeB: "23:59" },
    { weekday: i18n.t("Terça-feira"), weekdayEn: "tuesday", startTimeA: "00:00", endTimeA: "12:00", startTimeB: "12:01", endTimeB: "23:59" },
    { weekday: i18n.t("Quarta-feira"), weekdayEn: "wednesday", startTimeA: "00:00", endTimeA: "12:00", startTimeB: "12:01", endTimeB: "23:59" },
    { weekday: i18n.t("Quinta-feira"), weekdayEn: "thursday", startTimeA: "00:00", endTimeA: "12:00", startTimeB: "12:01", endTimeB: "23:59" },
    { weekday: i18n.t("Sexta-feira"), weekdayEn: "friday", startTimeA: "00:00", endTimeA: "12:00", startTimeB: "12:01", endTimeB: "23:59" },
    { weekday: "Sábado", weekdayEn: "saturday", startTimeA: "00:00", endTimeA: "12:01", startTimeB: "12:01", endTimeB: "23:59" },
    { weekday: "Domingo", weekdayEn: "sunday", startTimeA: "00:00", endTimeA: "12:01", startTimeB: "12:01", endTimeB: "23:59" }
  ];


  const [schedules, setSchedules] = useState(initialStateSchedule);

  const companyId = user.companyId;

  const { get: getSetting } = useCompanySettings();
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const { getPlanCompany } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);

      setShowOpenAi(planConfigs.plan.useOpenAi);
      setShowIntegrations(planConfigs.plan.useIntegrations);
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchData = async () => {

      const setting = await getSetting({
        "column": "scheduleType"
      });
      if (setting.scheduleType === "queue") setSchedulesEnabled(true);
    }
    fetchData();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/files/", {
          params: { companyId }
        });

        setFile(data.files);
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!queueId) return;
      try {
        const { data } = await api.get(`/queue/${queueId}`);

        setQueue((prevState) => {
          return { 
            ...prevState, 
            ...data,
            orderQueue: data.orderQueue || 1,
            tempoRoteador: data.tempoRoteador || 0,
            maxFilesPerSession: data.maxFilesPerSession || 3,
            autoSendStrategy: data.autoSendStrategy || "none",
            confirmationTemplate: data.confirmationTemplate || "",
            ragCollection: data.ragCollection || ""
          };
        });

        if (isArray(data.schedules) && data.schedules.length > 0)
          setSchedules(data.schedules);
      } catch (err) {
        toastError(err);
      }
    })();

    return () => {
      setQueue({
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
        autoSendStrategy: "none",
        confirmationTemplate: "",
        maxFilesPerSession: 3,
        ragCollection: ""
      });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchParam.length < 3) {
      setLoading(false);
      setSelectedQueueOption("");
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      //setLoading(true);
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
    (async () => {
      try {
        const { data } = await api.get("/queueIntegration");

        setIntegrations(data.queueIntegrations);
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  useEffect(() => {

    if (activeStep) {
      setSelectedQueueOption(queue.chatbots[activeStep]?.optQueueId)
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
  };

  const handleSaveSchedules = async (values) => {
    toast.success("Clique em salvar para registar as alterações");
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
      toast.success(`${i18n.t("queues.toasts.deleted")}`);
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

      toast.success(`${i18n.t("queues.toasts.success")}`);
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  const handleSaveBot = async (values) => {
    console.log(values)
    try {
      if (queueId) {
        const { data } = await api.put(`/queue/${queueId}`, values);
        if (data.chatbots && data.chatbots.length) {
          onEdit(data);
          setQueue(data);
        }
      } else {
        const { data } = await api.post("/queue", values);
        if (data.chatbots && data.chatbots.length) {
          setQueue(data);
          onEdit(data);
          handleClose();
        }
      }

      setIsNamedEdit(null)
      setGreetingMessageEdit(null)
      toast.success(`${i18n.t("queues.toasts.success")}`);

    } catch (err) {
      toastError(err);
    }
  };

  // const renderColorBox = (open, handleClose, color, handleColorChange) => {
  //   return (
  //     <Dialog open={open} onClose={handleClose}>

  //       <DialogTitle>Escolha uma cor</DialogTitle>
  //       <DialogContent>
  //         <ColorBox
  //           disableAlpha={true}
  //           hslGradient={false}
  //           style={{ margin: '20px auto 0' }}
  //           value={color}
  //           onChange={handleColorChange} />
  //       </DialogContent>
  //       <DialogActions>
  //         <Button onClick={handleClose} color="primary">
  //           Cancelar
  //         </Button>
  //         <Button
  //           color="primary"
  //           variant="contained"
  //           className={classes.btnWrapper}
  //           onClick={handleClose} >
  //           OK
  //         </Button>
  //       </DialogActions>
  //     </Dialog>
  //   )
  // }
  return (
    <div className={classes.root}>
      <ConfirmationModal
        title={
          selectedQueue &&
          `${i18n.t("queues.confirmationModal.deleteTitle")} ${selectedQueue.name
          }?`
        }
        open={confirmModalOpen}
        onClose={handleCloseConfirmationModal}
        onConfirm={() => handleDeleteQueue(selectedQueue.id)}
      >
        {i18n.t("queueModal.title.confirmationDelete")}
      </ConfirmationModal>
      <Dialog
        maxWidth="md"
        fullWidth
        open={open}
        onClose={handleClose}
        scroll="paper"
      >
        <DialogTitle>
          {queueId
            ? `${i18n.t("queueModal.title.edit")}`
            : `${i18n.t("queueModal.title.add")}`}
        </DialogTitle>
        <Tabs
          value={tab}
          indicatorColor="primary"
          textColor="primary"
          onChange={(e, v) => {
            console.log('Mudando para aba:', v);
            setTab(v);
          }}
          aria-label="disabled tabs example"
        >
          <Tab label={i18n.t("queueModal.title.queueData")} />
          {schedulesEnabled && <Tab label={i18n.t("queueModal.title.text")} />}
          <Tab 
            label={
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <HelpIcon fontSize="small" />
                Dicas de Uso
              </div>
            } 
          />
        </Tabs>
        {tab === 0 && (
          <Formik
            initialValues={queue}
            validateOnChange={false}
            enableReinitialize={true}
            validationSchema={QueueSchema}
            onSubmit={(values, actions) => {
              setTimeout(() => {
                handleSaveQueue(values);
                actions.setSubmitting(false);
              }, 400);
            }}
          >
            {({ setFieldValue, touched, errors, isSubmitting, values }) => (
              <Form>
                <DialogContent dividers>
                  {/* PRIMEIRA LINHA: Nome, Cor, Ordem da Fila */}
                  <Grid container spacing={2} style={{ marginBottom: 16 }}>
                    <Grid item xs={12} md={5}>
                      <Field
                        as={TextField}
                        label={i18n.t("queueModal.form.name")}
                        InputProps={{
                          endAdornment: (
                            <Tooltip title="Nome da fila que aparecerá no chatbot. Ex: 'Vendas', 'Suporte', 'Financeiro'. Seja claro e objetivo para facilitar a escolha do cliente." arrow placement="top">
                              <HelpOutlineIcon fontSize="small" color="action" style={{ cursor: 'help', marginLeft: 8 }} />
                            </Tooltip>
                          )
                        }}
                        autoFocus
                        name="name"
                        error={touched.name && Boolean(errors.name)}
                        helperText={touched.name && errors.name}
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        placeholder="Ex: Vendas, Suporte, Financeiro"
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                      <Field
                        as={TextField}
                        label={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {i18n.t("queueModal.form.color")}
                            <Tooltip title="Cor que identificará esta fila no sistema. Escolha cores distintas para facilitar a identificação visual pelos agentes." arrow placement="top">
                              <HelpOutlineIcon fontSize="small" color="action" style={{ cursor: 'help' }} />
                            </Tooltip>
                          </div>
                        }
                        name="color"
                        id="color"
                        onFocus={() => {
                          setColorPickerModalOpen(true);
                          greetingRef.current.focus();
                        }}
                        error={touched.color && Boolean(errors.color)}
                        helperText={touched.color && errors.color}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <div
                                style={{ backgroundColor: values.color }}
                                className={classes.colorAdorment}
                              ></div>
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <IconButton
                              size="small"
                              color="default"
                              onClick={() => setColorPickerModalOpen(!colorPickerModalOpen)}
                            >
                              <Colorize />
                            </IconButton>
                          ),
                        }}
                        variant="outlined"
                        margin="dense"
                        fullWidth
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={3}>
                      <Field
                        as={TextField}
                        label={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {i18n.t("queueModal.form.orderQueue")}
                            <Tooltip title="Ordem de exibição da fila no menu do chatbot. Número menor aparece primeiro. Ex: 1=Vendas, 2=Suporte, 3=Financeiro" arrow>
                              <HelpOutlineIcon fontSize="small" color="action" style={{ cursor: 'help' }} />
                            </Tooltip>
                          </div>
                        }
                        name="orderQueue"
                        type="number"
                        error={touched.orderQueue && Boolean(errors.orderQueue)}
                        helperText={touched.orderQueue && errors.orderQueue}
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        placeholder="1, 2, 3..."
                        inputProps={{ min: 1, max: 999 }}
                        value={values.orderQueue || 1}
                      />
                    </Grid>
                  </Grid>

                  <ColorBoxModal
                    open={colorPickerModalOpen}
                    handleClose={() => setColorPickerModalOpen(false)}
                    onChange={(color) => {
                      setFieldValue("color", `#${color.hex}`);
                    }}
                    currentColor={values.color}
                  />

                  {/* SEGUNDA LINHA: Flags e Tempo de Rodízio */}
                  <Grid container spacing={2} style={{ marginBottom: 16 }}>
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
                        label={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {i18n.t("queueModal.form.rotate")}
                            <Tooltip title="Ativa rodízio automático entre agentes. Distribui tickets igualmente entre todos os agentes disponíveis da fila, evitando sobrecarga." arrow>
                              <HelpOutlineIcon fontSize="small" color="action" style={{ cursor: 'help' }} />
                            </Tooltip>
                          </div>
                        }
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
                        label={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {i18n.t("queueModal.form.closeTicket")}
                            <Tooltip title="Fecha automaticamente o ticket quando cliente escolhe esta fila. Útil para filas informativas ou de finalização de atendimento." arrow>
                              <HelpOutlineIcon fontSize="small" color="action" style={{ cursor: 'help' }} />
                            </Tooltip>
                          </div>
                        }
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                      <FormControl variant="outlined" margin="dense" fullWidth>
                        <InputLabel>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {i18n.t("queueModal.form.timeRotate")}
                            <Tooltip title="Tempo de espera antes de rotacionar para próximo agente. Só funciona se 'Ativar Rodízio' estiver ligado." arrow>
                              <HelpOutlineIcon fontSize="small" color="action" style={{ cursor: 'help' }} />
                            </Tooltip>
                          </div>
                        </InputLabel>
                        <Field
                          as={Select}
                          label={i18n.t("queueModal.form.timeRotate")}
                          name="tempoRoteador"
                          id="tempoRoteador"
                        >
                          <MenuItem value="0" disabled>Selecione o tempo</MenuItem>
                          <MenuItem value="2">2 minutos</MenuItem>
                          <MenuItem value="5">5 minutos</MenuItem>
                          <MenuItem value="10">10 minutos</MenuItem>
                          <MenuItem value="15">15 minutos</MenuItem>
                          <MenuItem value="30">30 minutos</MenuItem>
                          <MenuItem value="45">45 minutos</MenuItem>
                          <MenuItem value="60">60 minutos</MenuItem>
                        </Field>
                      </FormControl>
                    </Grid>
                  </Grid>

                  {/* TERCEIRA LINHA: Integração + Arquivos */}
                  <Grid container spacing={2} style={{ marginBottom: 16 }}>
                    {showIntegrations && (
                      <Grid item xs={12} md={6}>
                        <FormControl variant="outlined" margin="dense" fullWidth>
                          <InputLabel>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {i18n.t("queueModal.form.integrationId")}
                              <Tooltip title="Integração com sistemas externos (Dialogflow, N8N, etc.). Permite automação avançada e fluxos personalizados para esta fila." arrow>
                                <HelpOutlineIcon fontSize="small" color="action" style={{ cursor: 'help' }} />
                              </Tooltip>
                            </div>
                          </InputLabel>
                          <Field
                            as={Select}
                            label={i18n.t("queueModal.form.integrationId")}
                            name="integrationId"
                            id="integrationId"
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
                    
                    <Grid item xs={12} md={showIntegrations ? 6 : 12}>
                      <FormControl variant="outlined" margin="dense" fullWidth>
                        <InputLabel>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {i18n.t("queueModal.form.fileListId")}
                            <Tooltip title="Arquivos que podem ser enviados automaticamente nesta fila. Configure catálogos, manuais, formulários, etc. Funciona com o sistema inteligente abaixo." arrow>
                              <HelpOutlineIcon fontSize="small" color="action" style={{ cursor: 'help' }} />
                            </Tooltip>
                          </div>
                        </InputLabel>
                        <Field
                          as={Select}
                          label={i18n.t("queueModal.form.fileListId")}
                          name="fileListId"
                          id="fileListId"
                          value={values.fileListId || ""}
                        >
                          <MenuItem value="">Nenhuma Arquivos</MenuItem>
                          {file.map(f => (
                            <MenuItem key={f.id} value={f.id}>
                              {f.name}
                            </MenuItem>
                          ))}
                        </Field>
                      </FormControl>
                    </Grid>
                  </Grid>
                  
                  {/* SEÇÃO: Configurações Inteligentes de Arquivos */}
                  <Typography variant="h6" style={{ marginTop: 24, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    🤖 Configurações Inteligentes de Arquivos
                    <Tooltip title="Sistema que automatiza o envio de arquivos baseado no comportamento do cliente. Funciona apenas se uma 'Arquivos' estiver selecionada acima." arrow>
                      <HelpOutlineIcon fontSize="small" color="action" style={{ cursor: 'help' }} />
                    </Tooltip>
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl variant="outlined" margin="dense" fullWidth>
                        <InputLabel>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            Estratégia de Envio
                            <Tooltip title={
                              <div>
                                <strong>Estratégias disponíveis:</strong><br/>
                                • <strong>Nenhum:</strong> Desativa envio automático<br/>
                                • <strong>Ao Entrar na Fila:</strong> Pergunta se quer receber arquivos quando cliente entra<br/>
                                • <strong>Sob Demanda:</strong> Analisa mensagens e sugere arquivos relevantes<br/>
                                • <strong>Manual:</strong> Apenas agentes decidem quando enviar
                              </div>
                            } arrow>
                              <HelpOutlineIcon fontSize="small" color="action" style={{ cursor: 'help' }} />
                            </Tooltip>
                          </div>
                        </InputLabel>
                        <Field
                          as={Select}
                          label="Estratégia de Envio"
                          name="autoSendStrategy"
                          id="autoSendStrategy"
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
                        label={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            Máximo de Arquivos por Sessão
                            <Tooltip title="Limite de arquivos que podem ser enviados por conversa. Evita spam e melhora a experiência do cliente. Recomendado: 3-5 arquivos." arrow>
                              <HelpOutlineIcon fontSize="small" color="action" style={{ cursor: 'help' }} />
                            </Tooltip>
                          </div>
                        }
                        name="maxFilesPerSession"
                        type="number"
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        inputProps={{ min: 1, max: 10 }}
                        placeholder="3"
                        value={values.maxFilesPerSession || 3}
                        helperText="Recomendado: 3-5 arquivos por conversa"
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Field
                        as={TextField}
                        label={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            Template de Confirmação
                            <Tooltip title={
                              <div>
                                <strong>Mensagem enviada antes dos arquivos.</strong><br/>
                                <strong>Variáveis disponíveis:</strong><br/>
                                • {'{{name}}'} - Nome do contato<br/>
                                • {'{{number}}'} - Número do WhatsApp<br/>
                                • {'{{protocol}}'} - Protocolo do ticket<br/>
                                <strong>Exemplo:</strong> "Olá {'{{name}}'}, gostaria de receber nosso catálogo?"
                              </div>
                            } arrow>
                              <HelpOutlineIcon fontSize="small" color="action" style={{ cursor: 'help' }} />
                            </Tooltip>
                          </div>
                        }
                        name="confirmationTemplate"
                        multiline
                        rows={3}
                        fullWidth
                        variant="outlined"
                        margin="dense"
                        placeholder={`Olá ${'{{name}}'}! Gostaria de receber nosso catálogo de produtos? Digite 1 para SIM ou 2 para NÃO`}
                        helperText={`Use ${'{{name}}'}, ${'{{number}}'}, ${'{{protocol}}'} para personalizar a mensagem`}
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Field
                        as={TextField}
                        label={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            Coleção RAG
                            <Tooltip title={
                              <div>
                                <strong>Sistema de busca inteligente de arquivos.</strong><br/>
                                O sistema analisa mensagens do cliente e sugere arquivos relevantes automaticamente.<br/>
                                <strong>Como funciona:</strong><br/>
                                • Cliente escreve "preciso do manual"<br/>
                                • Sistema busca arquivos com palavra "manual" nos metadados<br/>
                                • Sugere arquivos mais relevantes baseado no score<br/>
                                <strong>Futuro:</strong> Integração com IA para busca semântica avançada
                              </div>
                            } arrow>
                              <HelpOutlineIcon fontSize="small" color="action" style={{ cursor: 'help' }} />
                            </Tooltip>
                          </div>
                        }
                        name="ragCollection"
                        variant="outlined"
                        margin="dense"
                        fullWidth
                        placeholder="Ex: catalogo_produtos, manuais_tecnicos, formularios"
                        helperText="✅ Funcional: Sistema inteligente de sugestão de arquivos baseado em palavras-chave"
                      />
                    </Grid>
                  </Grid>
                  
                  <div>
                    <Field
                      as={TextField}
                      label={i18n.t("queueModal.form.greetingMessage")}
                      type="greetingMessage"
                      multiline
                      inputRef={greetingRef}
                      minRows={5}
                      fullWidth
                      name="greetingMessage"
                      error={
                        touched.greetingMessage && Boolean(errors.greetingMessage)
                      }
                      helperText={
                        touched.greetingMessage && errors.greetingMessage
                      }
                      variant="outlined"
                      margin="dense"
                    />
                    {schedulesEnabled && (
                      <Field
                        as={TextField}
                        label={i18n.t("queueModal.form.outOfHoursMessage")}
                        type="outOfHoursMessage"
                        multiline
                        rows={5}
                        fullWidth
                        required={schedulesEnabled}
                        name="outOfHoursMessage"
                        error={
                          touched.outOfHoursMessage &&
                          Boolean(errors.outOfHoursMessage)
                        }
                        helperText={
                          touched.outOfHoursMessage && errors.outOfHoursMessage
                        }
                        variant="outlined"
                        margin="dense"
                      />
                    )}
                  </div>

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
                                            // helpertext={touched?.chatbots?.[index]?.queueType && errors?.chatbots?.[index]?.queueType}
                                            // value={`chatbots[${index}].queueType`}
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
                                                      // value={`chatbots[${index}].optQueueId`}
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
                                                {/* SELECIONAR USUARIO */}
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
                                                      // value={`chatbots[${index}].optQueueId`}
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
                                                  {file.map(f => (
                                                    <MenuItem key={f.id} value={f.id}>
                                                      {f.name}
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
                </DialogContent>
                <DialogActions>
                  <Button
                    onClick={handleClose}
                    // color="secondary"
                    disabled={isSubmitting}
                  // variant="outlined"
                  >
                    {i18n.t("queueModal.buttons.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    color="primary"
                    disabled={isSubmitting}
                    variant="contained"
                    className={classes.btnWrapper}
                  >
                    {queueId
                      ? `${i18n.t("queueModal.buttons.okEdit")}`
                      : `${i18n.t("queueModal.buttons.okAdd")}`}
                    {isSubmitting && (
                      <CircularProgress
                        size={24}
                        className={classes.buttonProgress}
                      />
                    )}
                  </Button>
                </DialogActions>
              </Form>
            )}
          </Formik>
        )}
        {tab === 1 && schedulesEnabled && (
          <Paper style={{ padding: 20 }}>
            <SchedulesForm
              loading={false}
              onSubmit={handleSaveSchedules}
              initialValues={schedules}
              labelSaveButton={i18n.t("whatsappModal.buttons.okAdd")}
            />
          </Paper>
        )}
        {(tab === 2 || (!schedulesEnabled && tab === 1)) && (
          <DialogContent dividers style={{ maxHeight: '70vh', overflow: 'auto' }}>
            {console.log('Renderizando aba Dicas de Uso, tab:', tab, 'schedulesEnabled:', schedulesEnabled)}
            
            {/* TESTE SIMPLES */}
            <div style={{ padding: 20, textAlign: 'center' }}>
              <HelpIcon style={{ fontSize: 48, color: '#1976d2', marginBottom: 16 }} />
              <Typography variant="h4" style={{ fontWeight: 'bold', marginBottom: 16, color: '#1976d2' }}>
                🚀 Dicas de Uso - Filas Inteligentes
              </Typography>
              <Typography variant="body1" style={{ marginBottom: 24 }}>
                Esta é a nova aba de dicas! Aqui você encontrará orientações completas sobre como configurar e usar as filas inteligentes.
              </Typography>
              
              <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <Typography variant="h6" style={{ fontWeight: 'bold', marginBottom: 8 }}>
                  📋 Configuração Básica:
                </Typography>
                <ul style={{ textAlign: 'left', margin: 0, paddingLeft: 20 }}>
                  <li><strong>Nome da Fila:</strong> Use nomes claros como "Vendas", "Suporte", "Financeiro"</li>
                  <li><strong>Cor:</strong> Escolha cores distintas para facilitar identificação</li>
                  <li><strong>Arquivos:</strong> Crie e selecione uma lista com seus documentos</li>
                  <li><strong>Estratégia de Envio:</strong> Defina quando os arquivos serão oferecidos</li>
                </ul>
              </div>

              <div style={{ background: '#e3f2fd', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <Typography variant="h6" style={{ fontWeight: 'bold', marginBottom: 8, color: '#1976d2' }}>
                  🎯 Estratégias de Envio:
                </Typography>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                  <div style={{ background: 'white', padding: 12, borderRadius: 4 }}>
                    <Typography variant="subtitle2" style={{ fontWeight: 'bold', color: '#d32f2f' }}>
                      🚫 Nenhum
                    </Typography>
                    <Typography variant="body2">
                      Arquivos não são oferecidos automaticamente
                    </Typography>
                  </div>
                  <div style={{ background: 'white', padding: 12, borderRadius: 4 }}>
                    <Typography variant="subtitle2" style={{ fontWeight: 'bold', color: '#388e3c' }}>
                      🚪 Ao Entrar
                    </Typography>
                    <Typography variant="body2">
                      Pergunta se quer receber arquivos ao entrar na fila
                    </Typography>
                  </div>
                  <div style={{ background: 'white', padding: 12, borderRadius: 4 }}>
                    <Typography variant="subtitle2" style={{ fontWeight: 'bold', color: '#f57c00' }}>
                      🤖 Sob Demanda
                    </Typography>
                    <Typography variant="body2">
                      IA analisa mensagens e sugere arquivos
                    </Typography>
                  </div>
                  <div style={{ background: 'white', padding: 12, borderRadius: 4 }}>
                    <Typography variant="subtitle2" style={{ fontWeight: 'bold', color: '#7b1fa2' }}>
                      👤 Manual
                    </Typography>
                    <Typography variant="body2">
                      Apenas agentes decidem quando enviar
                    </Typography>
                  </div>
                </div>
              </div>

              <Button 
                variant="contained" 
                color="primary"
                onClick={() => setTab(0)}
                style={{ marginTop: 16 }}
              >
                ⚙️ Voltar para Configuração
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default QueueModal;