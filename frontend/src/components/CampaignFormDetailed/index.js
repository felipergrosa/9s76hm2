import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import { head, isNil } from "lodash";
import moment from "moment";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import {
  Box,
  Button,
  IconButton,
  TextField,
  CircularProgress,
  Chip,
  Tooltip,
  Typography,
  Popover,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Paper,
  Divider,
  FormHelperText,
  Checkbox,
  Link,
} from "@material-ui/core";
import { Alert, Autocomplete, createFilterOptions } from "@material-ui/lab";
import { 
  AttachFile as AttachFileIcon,
  DeleteOutline as DeleteOutlineIcon,
  InfoOutlined as InfoOutlinedIcon,
  HelpOutline as HelpOutlineIcon,
  LocalOffer as LocalOfferIcon,
  Save as SaveIcon,
  Send as SendIcon,
  AccessTime as AccessTimeIcon,
  Close as CloseIcon,
  PlayCircleOutline as PlayCircleOutlineIcon,
  PauseCircleOutline as PauseCircleOutlineIcon
} from "@material-ui/icons";
import { Sparkles, Smile } from "lucide-react";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import useQueues from "../../hooks/useQueues";
import WhatsAppPreview from "../CampaignModal/WhatsAppPreview";
import WhatsAppPopover from "../WhatsAppPopover";
import FormattedTextField from "../FormattedTextField";
import TemplateVariableMapper from "../TemplateVariableMapper";
import CampaignHowItWorks from "../CampaignModal/CampaignHowItWorks";
import UserStatusIcon from "../UserModal/statusIcon";
import ChatAssistantPanel from "../ChatAssistantPanel";

import * as libraryApi from "../../services/libraryApi";
import Sidebar from "../../pages/LibraryManager/components/Sidebar";
import TopBar from "../../pages/LibraryManager/components/TopBar";
import BreadcrumbNav from "../../pages/LibraryManager/components/BreadcrumbNav";
import FolderList from "../../pages/LibraryManager/components/FolderList";
import FolderGrid from "../../pages/LibraryManager/components/FolderGrid";
import UploadModal from "../../pages/LibraryManager/components/UploadModal";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    backgroundColor: theme.palette.background.paper,
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  btnWrapper: {
    position: "relative",
  },
  container: {
    display: "flex",
    flexDirection: "row",
    flex: 1,
    overflow: "hidden",
    [theme.breakpoints.down("sm")]: {
       flexDirection: "column",
       overflow: "auto"
    }
  },
  formSection: {
    flex: 1,
    padding: theme.spacing(3),
    overflowY: "auto",
  },
  previewSection: {
    width: 360,
    borderLeft: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.default,
    padding: theme.spacing(3),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    position: "sticky",
    top: 0,
    height: "100%",
    overflowY: "auto",
    [theme.breakpoints.down("sm")]: {
      width: "100%",
      borderLeft: "none",
      borderTop: `1px solid ${theme.palette.divider}`,
      position: "relative",
      height: "auto"
    }
  },
  footer: {
    padding: theme.spacing(2, 3),
    borderTop: `1px solid ${theme.palette.divider}`,
    display: "flex",
    justifyContent: "flex-end",
    gap: theme.spacing(1),
    backgroundColor: theme.palette.background.paper,
    zIndex: 10,
  }
}));

const CampaignSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Parâmetros incompletos!")
    .max(50, "Parâmetros acima do esperado!")
    .required("Campo obrigatório"),
});

const CampaignFormDetailed = ({
  campaignId: initialCampaignId,
  initialValues,
  onSave,
  onCancel,
  resetPagination
}) => {
  const classes = useStyles();
  const isMounted = useRef(true);
  const { user, socket } = useContext(AuthContext);
  const { companyId } = user;

  const [campaignId, setCampaignId] = useState(initialCampaignId);

  const initialState = {
    name: "",
    message1: "",
    message2: "",
    message3: "",
    message4: "",
    message5: "",
    confirmationMessage1: "",
    confirmationMessage2: "",
    confirmationMessage3: "",
    confirmationMessage4: "",
    confirmationMessage5: "",
    mediaUrl1: "",
    mediaName1: "",
    mediaUrl2: "",
    mediaName2: "",
    mediaUrl3: "",
    mediaName3: "",
    mediaUrl4: "",
    mediaName4: "",
    mediaUrl5: "",
    mediaName5: "",
    status: "INATIVA",
    confirmation: false,
    scheduledAt: "",
    contactListId: "",
    tagListId: "Nenhuma",
    companyId,
    statusTicket: "closed",
    openTicket: "disabled",
    dispatchStrategy: "single",
    allowedWhatsappIds: [],
    metaTemplateName: null,
    metaTemplateLanguage: null,
    metaTemplateVariables: {},
    sendMediaSeparately: false,
  };

  const [campaign, setCampaign] = useState(initialState);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [whatsapps, setWhatsapps] = useState([]);
  const [whatsappId, setWhatsappId] = useState(false);
  const [contactLists, setContactLists] = useState([]);
  const [tagLists, setTagLists] = useState([]);
  const [messageTab, setMessageTab] = useState(0);
  const [mainTab, setMainTab] = useState(0);
  const [campaignEditable, setCampaignEditable] = useState(true);
  
  const [dispatchMode, setDispatchMode] = useState("single");
  const [allowedWhatsappIds, setAllowedWhatsappIds] = useState([]);
  const [dispatchStrategy, setDispatchStrategy] = useState("single");

  const [options, setOptions] = useState([]);
  const [queues, setQueues] = useState([]);
  const [allQueues, setAllQueues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedQueue, setSelectedQueue] = useState("");
  const { findAllForSelection } = useQueues();

  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [metaTemplateVariables, setMetaTemplateVariables] = useState({});

  const [fileLibraryOpen, setFileLibraryOpen] = useState(false);
  const [fileLibraryTargetIndex, setFileLibraryTargetIndex] = useState(null);
  const [libraryCurrentFolder, setLibraryCurrentFolder] = useState(null);
  const [libraryBreadcrumbs, setLibraryBreadcrumbs] = useState([{ id: null, name: "Home" }]);
  const [libraryViewMode, setLibraryViewMode] = useState("list");
  const [librarySearchValue, setLibrarySearchValue] = useState("");
  const [libraryFolders, setLibraryFolders] = useState([]);
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryUploadOpen, setLibraryUploadOpen] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewName, setPreviewName] = useState("");

  const [tagsAnchorEl, setTagsAnchorEl] = useState(null);
  const [tagsSearch, setTagsSearch] = useState("");
  const [tagsTargetField, setTagsTargetField] = useState(null);
  const [infoAnchorEl, setInfoAnchorEl] = useState(null);
  const openInfo = Boolean(infoAnchorEl);
  const handleOpenInfo = (event) => setInfoAnchorEl(event.currentTarget);
  const handleCloseInfo = () => setInfoAnchorEl(null);

  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantTargetField, setAssistantTargetField] = useState(null);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistantContextSummary, setAssistantContextSummary] = useState("");
  const [assistantPresets, setAssistantPresets] = useState([]);

  const setFieldValueRef = useRef(null);
  const formValuesRef = useRef(initialState);
  const attachmentFile = useRef(null);

  const mustacheVars = [
    { key: "firstName", label: "primeiro-nome", desc: "Primeiro nome do contato", category: "Contato" },
    { key: "name", label: "nome", desc: "Nome completo do contato", category: "Contato" },
    { key: "email", label: "email", desc: "Email do contato", category: "Contato" },
    { key: "cpfCnpj", label: "cnpj-cpf", desc: "CPF/CNPJ do contato", category: "Contato" },
    { key: "representativeCode", label: "codigo-representante", desc: "Código do representante", category: "Contato" },
    { key: "city", label: "cidade", desc: "Cidade", category: "Contato" },
    { key: "situation", label: "situacao", desc: "Situação do cliente", category: "Contato" },
    { key: "fantasyName", label: "fantasia", desc: "Nome fantasia", category: "Contato" },
    { key: "foundationDate", label: "data-fundacao", desc: "Data de fundação (DD-MM-YYYY)", category: "Contato" },
    { key: "creditLimit", label: "limite-credito", desc: "Limite de crédito", category: "Contato" },
    { key: "segment", label: "segmento", desc: "Segmento de mercado", category: "Contato" },
    { key: "ticket_id", label: "ticket", desc: "ID do ticket", category: "Atendimento" },
    { key: "userName", label: "atendente", desc: "Nome do atendente", category: "Atendimento" },
    { key: "queue", label: "fila", desc: "Nome da fila", category: "Atendimento" },
    { key: "connection", label: "conexao", desc: "Nome da conexão/WhatsApp", category: "Atendimento" },
    { key: "protocol", label: "protocolo", desc: "Protocolo único da conversa", category: "Atendimento" },
    { key: "date", label: "data", desc: "Data atual (DD-MM-YYYY)", category: "Data/Hora" },
    { key: "hour", label: "hora", desc: "Hora atual (HH:MM:SS)", category: "Data/Hora" },
    { key: "data_hora", label: "data-hora", desc: "Data e hora juntas", category: "Data/Hora" },
    { key: "ms", label: "saudacao", desc: "Saudação contextual", category: "Saudação/Contexto" },
    { key: "periodo_dia", label: "periodo-dia", desc: "Período do dia", category: "Saudação/Contexto" },
    { key: "name_company", label: "empresa", desc: "Nome da empresa", category: "Empresa" },
  ];

  const groupedVars = mustacheVars.reduce((acc, v) => {
    const cat = v.category || "Outros";
    acc[cat] = acc[cat] || [];
    acc[cat].push(v);
    return acc;
  }, {});

  const openTags = Boolean(tagsAnchorEl);
  const handleOpenTags = (event) => setTagsAnchorEl(event.currentTarget);
  const handleCloseTags = () => setTagsAnchorEl(null);

  const insertTagIntoField = (targetField, setFieldValue, values) => (label) => {
    const insertion = `{${label}}`;
    const prev = (values && values[targetField]) || "";
    setFieldValue(targetField, prev + insertion);
  };

  const isAllowedMedia = (opt) => {
    const fileUrl = (opt?.url || opt?.path || "").toLowerCase();
    const mime = (opt?.mediaType || "").toLowerCase();
    const allowedExt = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".mp4", ".mp3", ".ogg", ".opus", ".wav"];
    const allowedMime = ["image/", "video/", "audio/", "application/pdf"];
    const okExt = allowedExt.some(ext => fileUrl.endsWith(ext));
    const okMime = allowedMime.some(prefix => mime.startsWith(prefix));
    return okExt || okMime;
  };

  const isImage = (url = "") => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  const isVideo = (url = "") => /\.(mp4|webm|ogg)$/i.test(url);
  const isAudio = (url = "") => /\.(mp3|wav|ogg|opus)$/i.test(url);
  const isPdf = (url = "") => /\.(pdf)$/i.test(url);

  const openPreview = (url, name) => { setPreviewUrl(url); setPreviewName(name || "Arquivo"); setPreviewOpen(true); };
  const closePreview = () => { setPreviewOpen(false); setPreviewUrl(""); setPreviewName(""); };

  const getMediaUrlFieldByTab = (tabIdx) => `mediaUrl${tabIdx + 1}`;
  const getMediaNameFieldByTab = (tabIdx) => `mediaName${tabIdx + 1}`;

  const clearTabMedia = (idx) => {
    if (setFieldValueRef.current) {
      setFieldValueRef.current(getMediaUrlFieldByTab(idx), null);
      setFieldValueRef.current(getMediaNameFieldByTab(idx), null);
    }
  };

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    const loadQueuesData = async () => {
      const list = await findAllForSelection();
      setAllQueues(list);
      setQueues(list);
    };
    loadQueuesData();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [contactListsRes, whatsappsRes, tagsRes] = await Promise.all([
          api.get(`/contact-lists/list`, { params: { companyId } }),
          api.get(`/whatsapp`, { params: { companyId, session: 0 } }),
          api.get(`/tags/list`, { params: { companyId, kanban: 0 } })
        ]);

        setContactLists(contactListsRes.data || []);
        setWhatsapps((whatsappsRes.data || []).map(w => ({ ...w, selected: false })));
        setTagLists((tagsRes.data || []).map(tag => ({
          id: tag.id,
          name: `${tag.name} (${Array.isArray(tag.contacts) ? tag.contacts.length : 0})`
        })));

        if (campaignId) {
          setCampaignLoading(true);
          const { data } = await api.get(`/campaigns/${campaignId}`);
          
          if (data?.whatsappId) setWhatsappId(data.whatsappId);
          if (data?.dispatchStrategy) setDispatchStrategy(data.dispatchStrategy);
          
          if (data?.metaTemplateVariables) {
            setMetaTemplateVariables(typeof data.metaTemplateVariables === 'string' ? JSON.parse(data.metaTemplateVariables) : data.metaTemplateVariables);
          }

          if (data?.allowedWhatsappIds) {
             const parsed = typeof data.allowedWhatsappIds === 'string' ? JSON.parse(data.allowedWhatsappIds) : data.allowedWhatsappIds;
             if (Array.isArray(parsed)) setAllowedWhatsappIds(parsed);
          }

          const formattedData = {};
          Object.entries(data).forEach(([key, value]) => {
            if (key === "scheduledAt" && value) {
              formattedData[key] = moment(value).format("YYYY-MM-DDTHH:mm");
            } else {
              formattedData[key] = value === null ? "" : value;
            }
          });
          setCampaign(prev => ({ ...prev, ...formattedData }));
          setCampaignLoading(false);
        } else if (initialValues) {
          setCampaign(prev => ({ ...prev, ...initialValues }));
        }
      } catch (err) {
        toastError(err);
        setCampaignLoading(false);
      }
    };
    loadData();
  }, [campaignId, companyId]);

  useEffect(() => {
    const loadTemplates = async () => {
      if (!whatsappId) {
        setAvailableTemplates([]);
        return;
      }
      const whatsapp = whatsapps.find(w => w.id === whatsappId);
      if (whatsapp?.channelType !== "official") {
        setAvailableTemplates([]);
        return;
      }
      setLoadingTemplates(true);
      try {
        const { data: templatesRes } = await api.get(`/whatsapp/${whatsappId}/templates`);
        const { data: whatsappData } = await api.get(`/whatsapp/${whatsappId}`);
        const allowed = whatsappData.allowedTemplates;
        const allTemplates = templatesRes.templates || [];
        setAvailableTemplates(allowed?.length > 0 ? allTemplates.filter(t => allowed.includes(t.id)) : allTemplates);
      } catch (err) {
        toastError(err);
      } finally {
        setLoadingTemplates(false);
      }
    };
    loadTemplates();
  }, [whatsappId, whatsapps]);

  const ensureUsersLoaded = async () => {
    if (options.length > 0) return;
    try {
      setLoading(true);
      const { data } = await api.get("/users/available");
      setOptions(data || []);
      
      if (campaignId && campaign.userIds) {
          const ids = typeof campaign.userIds === 'string' ? JSON.parse(campaign.userIds) : campaign.userIds;
          setSelectedUsers(data.filter(u => ids.includes(u.id)));
      }
    } catch (err) {
      if (err?.response?.status !== 403) toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const now = moment();
    const scheduledAt = moment(campaign.scheduledAt);
    const isEditable = campaign.status === "INATIVA" || campaign.status === "CANCELADA" || 
                       (campaign.status === "PROGRAMADA" && scheduledAt.diff(now, "hour") > 1);
    setCampaignEditable(isEditable);
  }, [campaign.status, campaign.scheduledAt]);

  const processValues = (values) => {
    const processed = {};
    Object.entries(values).forEach(([key, value]) => {
      if (key === "scheduledAt" && value) {
        processed[key] = moment(value).format("YYYY-MM-DD HH:mm:ss");
      } else {
        processed[key] = value === "" ? null : value;
      }
    });
    return processed;
  };

  const finalizeSave = async (dataValues) => {
      if (campaignId) {
        await api.put(`/campaigns/${campaignId}`, dataValues);
      } else {
        const { data } = await api.post("/campaigns", dataValues);
        setCampaignId(data.id);
      }
      toast.success(i18n.t("campaigns.toasts.success"));
      if (onSave) onSave();
  };

  const handleSaveImmediate = async (values) => {
    try {
      const dataValues = {
        ...processValues(values),
        whatsappId,
        userId: selectedUsers.length === 1 ? selectedUsers[0].id : null,
        userIds: selectedUsers.length > 0 ? JSON.stringify(selectedUsers.map(u => u.id)) : null,
        queueId: selectedQueue || null,
        dispatchStrategy,
        allowedWhatsappIds,
        metaTemplateVariables
      };
      await finalizeSave(dataValues);
    } catch (err) {
      toastError(err);
    }
  };

  const handleSaveRascunho = async (values) => {
    try {
      const dataValues = {
        ...processValues(values),
        status: "INATIVA",
        whatsappId,
        userId: selectedUsers.length === 1 ? selectedUsers[0].id : null,
        userIds: selectedUsers.length > 0 ? JSON.stringify(selectedUsers.map(u => u.id)) : null,
        queueId: selectedQueue || null,
        dispatchStrategy,
        allowedWhatsappIds,
        metaTemplateVariables
      };
      await finalizeSave(dataValues);
    } catch (err) {
      toastError(err);
    }
  };

  const handleSaveOnly = async (values) => {
    try {
      const processed = processValues(values);
      const hasSchedule = processed.scheduledAt && processed.scheduledAt !== null;
      const dataValues = {
        ...processed,
        status: hasSchedule ? "PROGRAMADA" : "INATIVA",
        whatsappId,
        userId: selectedUsers.length === 1 ? selectedUsers[0].id : null,
        userIds: selectedUsers.length > 0 ? JSON.stringify(selectedUsers.map(u => u.id)) : null,
        queueId: selectedQueue || null,
        dispatchStrategy,
        allowedWhatsappIds,
        metaTemplateVariables
      };
      await finalizeSave(dataValues);
      toast.success(hasSchedule ? "Envio programado!" : "Campanha salva como inativa.");
    } catch (err) {
      toastError(err);
    }
  };

  const cancelCampaign = async () => {
    try {
      await api.post(`/campaigns/${campaignId}/cancel`);
      setCampaign(prev => ({ ...prev, status: "CANCELADA" }));
      toast.success("Campanha pausada!");
      if (resetPagination) resetPagination();
    } catch (err) {
      toastError(err);
    }
  };

  const restartCampaign = async () => {
    try {
      await api.post(`/campaigns/${campaignId}/restart`);
      setCampaign(prev => ({ ...prev, status: "EM_ANDAMENTO" }));
      toast.success("Campanha retomada!");
      if (resetPagination) resetPagination();
    } catch (err) {
      toastError(err);
    }
  };

  const handleChooseFromLibrary = (file) => {
    const idx = Number.isInteger(fileLibraryTargetIndex) ? fileLibraryTargetIndex : messageTab;
    const fileUrl = file?.url || file?.path || file?.fileOption?.url || file?.fileOption?.path;
    if (!fileUrl) {
      toast.error("Arquivo sem URL");
      return;
    }
    const filename = file?.name || file?.title || (fileUrl ? fileUrl.split("/").pop() : "arquivo");
    if (setFieldValueRef.current) {
      setFieldValueRef.current(getMediaUrlFieldByTab(idx), fileUrl);
      setFieldValueRef.current(getMediaNameFieldByTab(idx), filename);
    }
    setFileLibraryOpen(false);
  };

  useEffect(() => {
    if (!fileLibraryOpen) return;
    const loadLibrary = async () => {
      setLibraryLoading(true);
      try {
        const folders = await libraryApi.fetchFolders(libraryCurrentFolder);
        const files = libraryCurrentFolder ? await libraryApi.fetchFiles(libraryCurrentFolder) : [];
        setLibraryFolders(Array.isArray(folders) ? folders : []);
        setLibraryFiles(Array.isArray(files) ? files : []);
      } catch (_) {
        setLibraryFolders([]);
        setLibraryFiles([]);
      } finally {
        setLibraryLoading(false);
      }
    };
    loadLibrary();
  }, [fileLibraryOpen, libraryCurrentFolder]);

  const handleOpenAssistant = (field, values) => {
    if (!campaignEditable) return;
    setAssistantTargetField(field);
    setAssistantDraft(values[field] || "");
    setAssistantOpen(true);
  };

  const renderMessageFieldUI = (identifier, setFieldValue, values) => (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="h6" style={{ fontSize: '1rem', fontWeight: 500 }}>
          {i18n.t(`campaigns.dialog.form.${identifier}`)}
        </Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <Tooltip title="Assistente de IA">
              <IconButton size="small" onClick={() => handleOpenAssistant(identifier, values)} disabled={!campaignEditable}>
                <Sparkles size={16} />
              </IconButton>
          </Tooltip>
          <Tooltip title="Tags">
            <IconButton size="small" onClick={(e) => { setTagsTargetField(identifier); handleOpenTags(e); }} disabled={!campaignEditable}>
              <LocalOfferIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Emoji">
            <WhatsAppPopover onSelectEmoji={(emoji) => setFieldValue(identifier, (values[identifier] || "") + emoji)} disabled={!campaignEditable}>
              <IconButton size="small" disabled={!campaignEditable}><Smile size={16} /></IconButton>
            </WhatsAppPopover>
          </Tooltip>
        </Box>
      </Box>
      <FormattedTextField
        id={identifier}
        value={values[identifier] || ""}
        onChange={(e) => setFieldValue(identifier, e.target.value)}
        placeholder={i18n.t("campaigns.dialog.form.messagePlaceholder")}
        rows={5}
        disabled={!campaignEditable}
      />
    </>
  );

  const filterOptions = createFilterOptions({ trim: true });

  if (campaignLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100%" p={10}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className={classes.root}>
      <Tabs
        value={mainTab}
        onChange={(e, v) => setMainTab(v)}
        indicatorColor="primary"
        textColor="primary"
        style={{ borderBottom: '1px solid #ddd' }}
      >
        <Tab label="Configuração" />
        <Tab label="Como Funciona" icon={<HelpOutlineIcon style={{ fontSize: 18 }} />} />
      </Tabs>

      {mainTab === 1 ? (
        <Box flex={1} overflow="auto">
          <CampaignHowItWorks />
        </Box>
      ) : (
        <Formik
          initialValues={campaign}
          enableReinitialize
          validationSchema={CampaignSchema}
          onSubmit={handleSaveImmediate}
        >
          {({ values, errors, touched, isSubmitting, setFieldValue }) => {
            setFieldValueRef.current = setFieldValue;
            formValuesRef.current = values;
            return (
              <>
                <Form className={classes.container}>
                  <Box className={classes.formSection}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <Field as={TextField} label={i18n.t("campaigns.dialog.form.name")} name="name" 
                               error={touched.name && Boolean(errors.name)} helperText={touched.name && errors.name}
                               variant="outlined" margin="dense" fullWidth disabled={!campaignEditable} />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl variant="outlined" margin="dense" fullWidth>
                          <InputLabel>{i18n.t("campaigns.dialog.form.confirmation")}</InputLabel>
                          <Field as={Select} name="confirmation" label={i18n.t("campaigns.dialog.form.confirmation")} disabled={!campaignEditable}>
                            <MenuItem value={false}>Desabilitada</MenuItem>
                            <MenuItem value={true}>Habilitada</MenuItem>
                          </Field>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl variant="outlined" margin="dense" fullWidth>
                          <InputLabel>{i18n.t("campaigns.dialog.form.contactList")}</InputLabel>
                          <Field as={Select} name="contactListId" label={i18n.t("campaigns.dialog.form.contactList")} disabled={!campaignEditable}>
                            <MenuItem value="">Nenhuma</MenuItem>
                            {contactLists.map(cl => <MenuItem key={cl.id} value={cl.id}>{cl.name}</MenuItem>)}
                          </Field>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl variant="outlined" margin="dense" fullWidth>
                          <InputLabel>{i18n.t("campaigns.dialog.form.tagList")}</InputLabel>
                          <Field as={Select} name="tagListId" label={i18n.t("campaigns.dialog.form.tagList")} disabled={!campaignEditable}>
                            {tagLists.map(tl => <MenuItem key={tl.id} value={tl.id}>{tl.name}</MenuItem>)}
                          </Field>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl variant="outlined" margin="dense" fullWidth>
                          <InputLabel>{i18n.t("campaigns.dialog.form.whatsapp")}</InputLabel>
                          <Select value={whatsappId} onChange={(e) => setWhatsappId(e.target.value)} label={i18n.t("campaigns.dialog.form.whatsapp")} disabled={!campaignEditable}>
                            {whatsapps.map(w => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl variant="outlined" margin="dense" fullWidth>
                          <InputLabel>Estratégia de Envio</InputLabel>
                          <Select value={dispatchMode} onChange={(e) => setDispatchMode(e.target.value)} label="Estratégia de Envio" disabled={!campaignEditable}>
                             <MenuItem value="single">📱 Única conexão</MenuItem>
                             <MenuItem value="all">🔄 Todas as conexões</MenuItem>
                             <MenuItem value="custom">🎯 Rodízio personalizado</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      {dispatchMode === "custom" && (
                        <Grid item xs={12}>
                          <Autocomplete
                            multiple
                            options={whatsapps}
                            getOptionLabel={(o) => o.name}
                            value={whatsapps.filter(w => allowedWhatsappIds.includes(w.id))}
                            onChange={(e, v) => setAllowedWhatsappIds(v.map(w => w.id))}
                            renderInput={(params) => <TextField {...params} variant="outlined" margin="dense" label="Conexões para Rodízio" />}
                            disabled={!campaignEditable}
                          />
                        </Grid>
                      )}

                      <Grid item xs={12} md={4}>
                         <Field as={TextField} label={i18n.t("campaigns.dialog.form.scheduledAt")} name="scheduledAt" 
                                type="datetime-local" InputLabelProps={{ shrink: true }} variant="outlined" margin="dense" fullWidth disabled={!campaignEditable} />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl variant="outlined" margin="dense" fullWidth>
                          <InputLabel>{i18n.t("campaigns.dialog.form.openTicket")}</InputLabel>
                          <Field as={Select} name="openTicket" label={i18n.t("campaigns.dialog.form.openTicket")} disabled={!campaignEditable}>
                            <MenuItem value="enabled">Habilitado</MenuItem>
                            <MenuItem value="disabled">Desabilitado</MenuItem>
                          </Field>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Autocomplete
                          multiple
                          variant="outlined"
                          size="small"
                          openOnFocus
                          onOpen={ensureUsersLoaded}
                          getOptionLabel={(o) => o.name}
                          value={selectedUsers}
                          onChange={(e, v) => setSelectedUsers(v)}
                          options={options}
                          filterOptions={filterOptions}
                          disabled={!campaignEditable || values.openTicket === 'disabled'}
                          renderInput={(params) => <TextField {...params} label="Usuários (distribuição)" variant="outlined" margin="dense" />}
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl variant="outlined" margin="dense" fullWidth>
                          <InputLabel>Fila de Destino</InputLabel>
                          <Select value={selectedQueue} onChange={(e) => setSelectedQueue(e.target.value)} label="Fila de Destino" disabled={!campaignEditable}>
                            {queues.map(q => <MenuItem key={q.id} value={q.id}>{q.name}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <FormControl variant="outlined" margin="dense" fullWidth>
                          <InputLabel>{i18n.t("campaigns.dialog.form.statusTicket")}</InputLabel>
                          <Field as={Select} name="statusTicket" label={i18n.t("campaigns.dialog.form.statusTicket")} disabled={!campaignEditable}>
                            <MenuItem value="closed">Fechado</MenuItem>
                            <MenuItem value="open">Aberto</MenuItem>
                            <MenuItem value="pending">Pendente</MenuItem>
                          </Field>
                        </FormControl>
                      </Grid>

                      {/* Mensagens */}
                      <Grid item xs={12}>
                        <Tabs value={messageTab} onChange={(e, v) => setMessageTab(v)} variant="fullWidth" style={{ background: "#f5f5f5", borderRadius: 4, marginTop: 16 }}>
                          {[1, 2, 3, 4, 5].map(i => <Tab key={i} label={`Msg. ${i}`} />)}
                        </Tabs>
                        <Box mt={2}>
                          {renderMessageFieldUI(`message${messageTab + 1}`, setFieldValue, values)}
                          {values.confirmation && (
                            <Box mt={2}>{renderMessageFieldUI(`confirmationMessage${messageTab + 1}`, setFieldValue, values)}</Box>
                          )}
                          
                          <Box display="flex" alignItems="center" gap={2} mt={2}>
                            <Button size="small" variant="outlined" color="primary" onClick={() => { setFileLibraryTargetIndex(messageTab); setFileLibraryOpen(true); }} disabled={!campaignEditable}>
                              {values[getMediaUrlFieldByTab(messageTab)] ? "Trocar anexo" : "Selecionar anexo"}
                            </Button>
                            {values[getMediaNameFieldByTab(messageTab)] && (
                               <Chip label={values[getMediaNameFieldByTab(messageTab)]} onDelete={() => clearTabMedia(messageTab)} disabled={!campaignEditable} />
                            )}
                          </Box>
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>

                  <Box className={classes.previewSection}>
                     <WhatsAppPreview
                        messages={[values.message1, values.message2, values.message3, values.message4, values.message5].filter(Boolean)}
                        mediaUrls={{
                          mediaUrl1: values.mediaUrl1, mediaUrl2: values.mediaUrl2, mediaUrl3: values.mediaUrl3, mediaUrl4: values.mediaUrl4, mediaUrl5: values.mediaUrl5
                        }}
                        contactName="João Silva"
                        companyName={user?.company?.name || "Empresa"}
                     />
                  </Box>
                </Form>

                <Box className={classes.footer}>
                  {campaignId && (
                    <Box mr="auto" display="flex" gap={1}>
                      {(campaign.status === "CANCELADA" || campaign.status === "PROGRAMADA" || campaign.status === "INATIVA") && (
                        <Button color="primary" onClick={restartCampaign} variant="outlined" startIcon={<PlayCircleOutlineIcon />}>
                           {campaign.status === "CANCELADA" ? "Retomar" : "Iniciar"}
                        </Button>
                      )}
                      {campaign.status === "EM_ANDAMENTO" && (
                        <Button color="secondary" onClick={cancelCampaign} variant="outlined" startIcon={<PauseCircleOutlineIcon />}>
                          Pausar
                        </Button>
                      )}
                    </Box>
                  )}
                  <Button onClick={onCancel} variant="outlined">Cancelar</Button>
                  {(campaignEditable || campaign.status === "CANCELADA") && (
                    <>
                      <Button color="primary" onClick={() => handleSaveRascunho(values)} disabled={isSubmitting} variant="outlined" startIcon={<SaveIcon />}>
                        Salvar Rascunho
                      </Button>
                      <Button color="primary" onClick={() => handleSaveOnly(values)} disabled={isSubmitting || !values.scheduledAt} variant="outlined" startIcon={<AccessTimeIcon />} style={{ color: '#ff9800', borderColor: '#ff9800' }}>
                        Programar
                      </Button>
                      <Button type="submit" color="primary" onClick={() => handleSaveImmediate(values)} disabled={isSubmitting} variant="contained" startIcon={<SendIcon />}>
                         Enviar Agora
                      </Button>
                    </>
                  )}
                </Box>
                
                {/* Modais e Popovers */}
                <Popover open={openTags} anchorEl={tagsAnchorEl} onClose={handleCloseTags} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
                  <Box p={2} maxWidth={380}>
                    <TextField value={tagsSearch} onChange={(e) => setTagsSearch(e.target.value)} placeholder="Buscar #tags..." variant="outlined" size="small" fullWidth />
                    <Box maxHeight={260} overflow="auto" mt={1}>
                      {Object.keys(groupedVars).map(cat => (
                        <div key={cat} style={{ marginBottom: 8 }}>
                          <Typography variant="subtitle2" color="textSecondary">{cat}</Typography>
                          <Box display="flex" flexWrap="wrap" gap={0.5}>
                            {groupedVars[cat].filter(v => v.label.toLowerCase().includes(tagsSearch.toLowerCase())).map(v => (
                              <Chip key={v.key} label={`#${v.label}`} onClick={() => { insertTagIntoField(tagsTargetField, setFieldValue, values)(v.label); handleCloseTags(); }} size="small" clickable />
                            ))}
                          </Box>
                        </div>
                      ))}
                    </Box>
                  </Box>
                </Popover>

                <Dialog open={fileLibraryOpen} onClose={() => setFileLibraryOpen(false)} maxWidth="lg" fullWidth>
                  <DialogTitle>Biblioteca de Arquivos</DialogTitle>
                  <DialogContent dividers style={{ padding: 0 }}>
                    <Box display="flex" height="70vh">
                       <Sidebar currentFolderId={libraryCurrentFolder} onFolderClick={(f) => setLibraryCurrentFolder(f?.id || null)} />
                       <Box flex={1} display="flex" flexDirection="column">
                          <TopBar searchValue={librarySearchValue} onSearchChange={setLibrarySearchValue} onViewModeChange={setLibraryViewMode} viewMode={libraryViewMode} onUploadClick={() => setLibraryUploadOpen(true)} />
                          <Box flex={1} overflow="auto" p={2}>
                             <FolderGrid folders={libraryFolders} files={libraryFiles} onFolderClick={(f) => setLibraryCurrentFolder(f.id)} onFileClick={handleChooseFromLibrary} />
                          </Box>
                       </Box>
                    </Box>
                  </DialogContent>
                  <DialogActions><Button onClick={() => setFileLibraryOpen(false)}>Fechar</Button></DialogActions>
                </Dialog>

                <UploadModal open={libraryUploadOpen} onClose={() => setLibraryUploadOpen(false)} currentFolder={libraryCurrentFolder} user={user} 
                             onUploadComplete={() => { setLibraryUploadOpen(false); setLibraryCurrentFolder({...libraryCurrentFolder}) }} />

                <ChatAssistantPanel 
                  open={assistantOpen} 
                  onClose={() => setAssistantOpen(false)} 
                  draft={assistantDraft}
                  setInputMessage={setAssistantDraft}
                  actions={["replace", "append", "apply"]}
                  dialogMode
                  onApply={(action, text) => {
                    const sanitized = text.replace(/\{\s*([a-zA-Z0-9_-]+)\s*\}/g, "{$1}").trim();
                    const nextValue = action === "append" ? (values[assistantTargetField] ? `${values[assistantTargetField]}\n\n${sanitized}` : sanitized) : sanitized;
                    setFieldValue(assistantTargetField, nextValue);
                    setAssistantOpen(false);
                  }}
                />
              </>
            );
          }}
        </Formik>
      )}
    </Box>
  );
};

export default CampaignFormDetailed;
