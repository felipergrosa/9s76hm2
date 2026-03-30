import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import { useHistory, useParams } from "react-router-dom";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import { head, isNil } from "lodash";
import moment from "moment";
import Swal from "sweetalert2";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import {
  Button, IconButton, TextField, CircularProgress, Chip, Tooltip, Typography,
  Box, FormControl, FormControlLabel, Grid, InputLabel, MenuItem, Select,
  Tab, Tabs, Paper, Divider, FormHelperText, Checkbox, Popover,
  Stepper, Step, StepLabel, Dialog, DialogTitle, DialogContent,
} from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import Autocomplete, { createFilterOptions } from "@material-ui/lab/Autocomplete";

import AttachFileIcon from "@material-ui/icons/AttachFile";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import SaveIcon from "@material-ui/icons/Save";
import AccessTimeIcon from "@material-ui/icons/AccessTime";
import { ChevronRight, ChevronLeft, ArrowLeft, Settings as SettingsIcon, Assignment as AssignmentIcon, Event as EventIcon, QuestionAnswer as QuestionAnswerIcon, Send as SendIcon, FlashOn as FlashOnIcon, PlayCircleOutline as PlayCircleOutlineIcon, PauseCircleOutline as PauseCircleOutlineIcon } from "@material-ui/icons";
import { Sparkles, Smile, Settings, Rocket, Calendar, Zap } from "lucide-react";

import api from "../../services/api";
import * as libraryApi from "../../services/libraryApi";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import useQueues from "../../hooks/useQueues";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import ConfirmationModal from "../../components/ConfirmationModal";
import UserStatusIcon from "../../components/UserModal/statusIcon";
import ChatAssistantPanel from "../../components/ChatAssistantPanel";
import WhatsAppPreview from "../../components/CampaignModal/WhatsAppPreview";
import WhatsAppPopover from "../../components/WhatsAppPopover";
import FormattedTextField from "../../components/FormattedTextField";
import TemplateVariableMapper from "../../components/TemplateVariableMapper";
import Sidebar from "../../pages/LibraryManager/components/Sidebar";
import TopBar from "../../pages/LibraryManager/components/TopBar";
import BreadcrumbNav from "../../pages/LibraryManager/components/BreadcrumbNav";
import FolderList from "../../pages/LibraryManager/components/FolderList";
import FolderGrid from "../../pages/LibraryManager/components/FolderGrid";
import UploadModal from "../../pages/LibraryManager/components/UploadModal";

const useStyles = makeStyles((theme) => ({
  root: { display: "flex", flexDirection: "column", height: "100%", backgroundColor: "#f8fafc" },
  stepperBar: {
    padding: theme.spacing(2, 4), 
    "&.MuiStepper-root.MuiPaper-root": {
      background: "transparent !important",
      backdropFilter: "none !important",
      WebkitBackdropFilter: "none !important",
      boxShadow: "none !important",
      border: "none !important",
    },
    "& .MuiStepLabel-label": { fontSize: "0.85rem" },
    "& .MuiStepIcon-root.MuiStepIcon-active": { color: "#005c53" },
    "& .MuiStepIcon-root.MuiStepIcon-completed": { color: "#005c53" },
  },
  body: { flex: 1, overflowY: "auto", padding: theme.spacing(0, 4, 4) },
  card: { 
    borderRadius: 20, 
    padding: theme.spacing(4), 
    boxShadow: "0 2px 16px rgba(0,0,0,0.04)", 
    backgroundColor: "#fff",
    "&.MuiPaper-root": { padding: "20px !important" },
  },
  sideCard: { borderRadius: 20, padding: theme.spacing(3), backgroundColor: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.03)", position: "sticky", top: 16 },
  stepTitle: { fontSize: "1.6rem", fontWeight: 800, color: "#0f172a", marginBottom: 4 },
  stepSub: { color: "#64748b", marginBottom: theme.spacing(4), fontSize: "0.95rem" },
  label: { fontWeight: 600, color: "#334155", marginBottom: 6, display: "block", fontSize: "0.875rem" },
  footer: {
    padding: theme.spacing(2, 4), backgroundColor: "transparent", borderTop: "1px solid #f1f5f9",
    display: "flex", justifyContent: "space-between", alignItems: "center",
  },
  primaryBtn: { borderRadius: 12, padding: "10px 28px", textTransform: "none", fontWeight: 700, backgroundColor: "#005c53", color: "#fff", "&:hover": { backgroundColor: "#004d45" } },
  secondaryBtn: { borderRadius: 12, padding: "10px 24px", textTransform: "none", fontWeight: 600 },
  schedCard: { borderRadius: 16, border: "2px solid #f1f5f9", padding: theme.spacing(2.5), cursor: "pointer", transition: "all 0.2s", "&:hover": { borderColor: "#005c53" } },
  schedCardActive: { borderColor: "#005c53", backgroundColor: "rgba(0,92,83,0.04)" },
  msgTab: { borderRadius: 10, marginRight: 8, textTransform: "none", minWidth: 70, padding: "4px 14px", fontSize: "0.8rem" },
  msgTabActive: { backgroundColor: "#005c53", color: "#fff", "&:hover": { backgroundColor: "#004d45" } },
  tipBox: { borderRadius: 12, padding: theme.spacing(2), backgroundColor: "#f0fdf9", border: "1px solid #bbf7d0", display: "flex", gap: 12, alignItems: "flex-start", marginTop: theme.spacing(2) },
  stepIcon: {
    backgroundColor: "#fff", zIndex: 1, color: "#94a3b8", width: 48, height: 48, display: "flex",
    borderRadius: 14, justifyContent: "center", alignItems: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    transition: "all 0.3s ease",
  },
  stepIconActive: { backgroundColor: "#005c53", color: "#fff", boxShadow: "0 4px 12px rgba(0,92,83,0.3)" },
  stepIconCompleted: { backgroundColor: "#e2e8f0", color: "#005c53" },
  dispatchCard: {
    padding: theme.spacing(2), borderRadius: 16, border: "1px solid #e2e8f0", cursor: "pointer",
    transition: "all 0.2s", marginBottom: theme.spacing(1.5), display: "flex", alignItems: "center", gap: 16,
    "&:hover": { borderColor: "#005c53", backgroundColor: "rgba(0,92,83,0.02)" }
  },
  // Campos de formulário com cantos arredondados
  formField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
      minHeight: 56,
    },
    "& .MuiSelect-root": {
      borderRadius: 12,
    },
    "& .MuiFormControl-root": {
      "& .MuiOutlinedInput-root": {
        borderRadius: 12,
        minHeight: 56,
      },
    },
    // Força altura consistente no renderValue do Select
    "& .MuiSelect-select": {
      minHeight: "unset !important",
      paddingTop: 12,
      paddingBottom: 12,
    },
  },
  // Autocomplete com cantos arredondados
  autoCompleteField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
      minHeight: 56,
    },
  },
  dispatchCardActive: { borderColor: "#005c53", backgroundColor: "rgba(0,92,83,0.04)", borderWidth: 2 },
  btnSave: { borderRadius: 12, padding: "10px 24px", textTransform: "none", fontWeight: 700, border: "1px solid #005c53", color: "#005c53", "&:hover": { backgroundColor: "#f0fdfa" } },
  btnSchedule: { borderRadius: 12, padding: "10px 24px", textTransform: "none", fontWeight: 700, border: "1px solid #f97316", color: "#f97316", "&:hover": { backgroundColor: "#fff7ed" } },
  btnSend: { borderRadius: 12, padding: "10px 28px", textTransform: "none", fontWeight: 700, background: "linear-gradient(135deg, #005c53 0%, #00897b 100%)", color: "#fff", boxShadow: "0 4px 12px rgba(0,92,83,0.2)", "&:hover": { background: "linear-gradient(135deg, #004d45 0%, #00695c 100%)" } },
}));

const ColorlibStepIcon = (props) => {
  const classes = useStyles();
  const { active, completed } = props;
  const icons = { 
    1: <SettingsIcon size={20} />, 
    2: <AssignmentIcon size={20} />, 
    3: <EventIcon size={20} />, 
    4: <QuestionAnswerIcon size={20} /> 
  };
  return (
    <div className={`${classes.stepIcon} ${active ? classes.stepIconActive : ""} ${completed ? classes.stepIconCompleted : ""}`}>
      {icons[String(props.icon)]}
    </div>
  );
};

const CampaignSchema = Yup.object().shape({
  name: Yup.string().min(2, "Mínimo 2 caracteres").max(50, "Máximo 50").required("Obrigatório"),
});

const STEPS = ["Configuração", "Regras", "Agendamento", "Mensagem"];

// Função para validar e mostrar erros com SweetAlert2 (por step)
const validateStepAndShowErrors = async (validateForm, values, whatsappId, selectedQueue, currentStep) => {
  const errors = await validateForm();
  
  // Definir quais campos pertencem a cada step
  const stepFields = {
    0: ["name", "contactListId", "contactListIds", "whatsappId", "tagListId"],
    1: ["openTicket", "statusTicket", "queueId", "confirmation"],
    2: ["scheduledAt"],
    3: ["message1", "message2", "message3", "message4", "message5"],
  };
  
  // Mapear campos para labels
  const FIELD_LABELS = {
    name: "Nome da Campanha",
    contactListId: "Lista de Contatos",
    whatsappId: "Conexão WhatsApp",
    message1: "Mensagem 1",
    scheduledAt: "Data de Agendamento",
    openTicket: "Abrir Ticket",
    statusTicket: "Status do Ticket",
    queueId: "Fila (Queue)",
    confirmation: "Confirmação",
  };
  
  // Validações customizadas por step
  const customErrors = {};
  
  // Só validar campos do step atual
  const fieldsToCheck = stepFields[currentStep] || [];
  
  if (currentStep === 0) {
    if (!values.contactListId && (!values.contactListIds || values.contactListIds.length === 0)) {
      customErrors.contactListId = "Selecione ao menos uma lista de contatos";
    }
    if (!whatsappId) {
      customErrors.whatsappId = "Selecione uma conexão WhatsApp";
    }
  }
  
  if (currentStep === 1) {
    // Step 2 (Regras) - validações
    if (!values.openTicket) {
      customErrors.openTicket = "Selecione se deseja abrir ticket";
    }
    if (!values.statusTicket) {
      customErrors.statusTicket = "Selecione o status do ticket";
    }
    if (!selectedQueue) {
      customErrors.queueId = "Selecione uma fila";
    }
    if (!values.confirmation && values.confirmation !== false) {
      customErrors.confirmation = "Selecione a confirmação";
    }
  }
  
  if (currentStep === 2) {
    // Step 3 (Agendamento) - validação
    if (values.scheduledAt) {
      const scheduledDate = moment(values.scheduledAt);
      const now = moment();
      if (scheduledDate.isBefore(now)) {
        customErrors.scheduledAt = "A data de agendamento deve ser futura";
      }
    }
  }
  
  if (currentStep === 3) {
    // Step 4 (Mensagem) - validações
    if (!values.message1 || values.message1.trim() === "") {
      customErrors.message1 = "A mensagem 1 é obrigatória";
    }
    // Validação de tamanho máximo
    if (values.message1 && values.message1.length > 1024) {
      customErrors.message1 = "A mensagem 1 deve ter no máximo 1024 caracteres";
    }
  }
  
  // Filtrar apenas erros do step atual
  const allErrors = {};
  fieldsToCheck.forEach(field => {
    if (errors[field]) allErrors[field] = errors[field];
    if (customErrors[field]) allErrors[field] = customErrors[field];
  });
  
  if (Object.keys(allErrors).length > 0) {
    const errorList = Object.entries(allErrors)
      .map(([field, error]) => {
        const label = FIELD_LABELS[field] || field;
        return `• <strong>${label}:</strong> ${error}`;
      })
      .join("<br>");
    
    const stepNames = ["Configuração", "Regras", "Agendamento", "Mensagem"];
    
    const result = await Swal.fire({
      title: `<span style="color: #dc2626;">⚠️ Etapa ${currentStep + 1}: ${stepNames[currentStep]}</span>`,
      html: `
        <div style="text-align: left; padding: 16px; background: #fef2f2; border-radius: 12px; border: 1px solid #fecaca;">
          <p style="margin: 0 0 12px 0; color: #991b1b; font-weight: 600;">
            Por favor, corrija os campos desta etapa:
          </p>
          <div style="color: #7f1d1d; line-height: 1.8;">
            ${errorList}
          </div>
        </div>
      `,
      icon: "warning",
      confirmButtonText: "✓ OK, Corrigir",
      confirmButtonColor: "#005c53",
      width: "600px",
      padding: "2em",
      backdrop: `rgba(0,0,0,0.4)`,
    });
    
    // Focar no primeiro campo com erro
    if (result.isConfirmed) {
      const firstErrorField = Object.keys(allErrors)[0];
      setTimeout(() => {
        const fieldElement = document.querySelector(`[name="${firstErrorField}"]`) || 
                           document.getElementById(firstErrorField);
        if (fieldElement) {
          fieldElement.focus();
          fieldElement.scrollIntoView({ behavior: "smooth", block: "center" });
          fieldElement.style.transition = "all 0.3s ease";
          fieldElement.style.boxShadow = "0 0 0 3px rgba(220, 38, 38, 0.3)";
          setTimeout(() => {
            fieldElement.style.boxShadow = "";
          }, 2000);
        }
      }, 100);
    }
    
    return false;
  }
  
  return true;
};

const CampaignForm = () => {
  const classes = useStyles();
  const history = useHistory();
  const { campaignId: paramId } = useParams();
  const isMounted = useRef(true);
  const { user, socket } = useContext(AuthContext);
  const { companyId } = user;
  const { findAllForSelection } = useQueues();

  const initialState = {
    name: "", message1: "", message2: "", message3: "", message4: "", message5: "",
    confirmationMessage1: "", confirmationMessage2: "", confirmationMessage3: "", confirmationMessage4: "", confirmationMessage5: "",
    mediaUrl1: "", mediaName1: "", mediaUrl2: "", mediaName2: "", mediaUrl3: "", mediaName3: "", mediaUrl4: "", mediaName4: "", mediaUrl5: "", mediaName5: "",
    status: "INATIVA", confirmation: false, scheduledAt: "",
    contactListId: "", contactListIds: [], tagListId: "Nenhuma", companyId,
    statusTicket: "closed", openTicket: "disabled", dispatchStrategy: "single",
    allowedWhatsappIds: [], metaTemplateName: null, metaTemplateLanguage: null,
    metaTemplateVariables: {}, sendMediaSeparately: false,
  };

  // Core state
  const [activeStep, setActiveStep] = useState(0);
  const [campaignId, setCampaignId] = useState(paramId);
  const [campaign, setCampaign] = useState(initialState);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignEditable, setCampaignEditable] = useState(true);

  // Data lists
  const [contactLists, setContactLists] = useState([]);
  const [tagLists, setTagLists] = useState([]);
  const [whatsapps, setWhatsapps] = useState([]);
  const [options, setOptions] = useState([]);
  const [queues, setQueues] = useState([]);
  const [allQueues, setAllQueues] = useState([]);
  const [loading, setLoading] = useState(false);

  // Selections
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedQueue, setSelectedQueue] = useState("");
  const [whatsappId, setWhatsappId] = useState(false);
  const [dispatchMode, setDispatchMode] = useState("single");
  const [dispatchStrategy, setDispatchStrategy] = useState("single");
  const [allowedWhatsappIds, setAllowedWhatsappIds] = useState([]);

  // Templates
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [metaTemplateVariables, setMetaTemplateVariables] = useState({});

  // Message tabs & media
  const [messageTab, setMessageTab] = useState(0);
  const [attachment, setAttachment] = useState(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const attachmentFile = useRef(null);

  // File library
  const [fileLibraryOpen, setFileLibraryOpen] = useState(false);
  const [fileLibraryTargetIndex, setFileLibraryTargetIndex] = useState(null);
  const [libraryCurrentFolder, setLibraryCurrentFolder] = useState(null);
  const [libraryBreadcrumbs, setLibraryBreadcrumbs] = useState([{ id: null, name: "Home" }]);
  const [libraryViewMode, setLibraryViewMode] = useState("list");
  const [librarySearchValue, setLibrarySearchValue] = useState("");
  const [libraryFolders, setLibraryFolders] = useState([]);
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const librarySearch = librarySearchValue;
  const setLibrarySearch = setLibrarySearchValue;
  const setFieldValueRef = useRef(null);
  const formValuesRef = useRef(initialState);

  // Assistant
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantTargetField, setAssistantTargetField] = useState(null);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistantContextSummary, setAssistantContextSummary] = useState("");
  const [assistantPresets, setAssistantPresets] = useState([]);

  // Tags popover
  const [tagsTargetField, setTagsTargetField] = useState(null);
  const [tagsAnchorEl, setTagsAnchorEl] = useState(null);
  const [tagsSearch, setTagsSearch] = useState("");
  const [infoAnchorEl, setInfoAnchorEl] = useState(null);
  const openInfo = Boolean(infoAnchorEl);
  const openTags = Boolean(tagsAnchorEl);
  const handleOpenInfo = (e) => setInfoAnchorEl(e.currentTarget);
  const handleCloseInfo = () => setInfoAnchorEl(null);
  const handleOpenTags = (e) => setTagsAnchorEl(e.currentTarget);
  const handleCloseTags = () => setTagsAnchorEl(null);

  const mustacheVars = [
    { key: "firstName", label: "primeiro-nome", desc: "Primeiro nome do contato", category: "Contato" },
    { key: "name", label: "nome", desc: "Nome completo do contato", category: "Contato" },
    { key: "email", label: "email", desc: "Email do contato", category: "Contato" },
    { key: "cpfCnpj", label: "cnpj-cpf", desc: "CPF/CNPJ do contato", category: "Contato" },
    { key: "city", label: "cidade", desc: "Cidade", category: "Contato" },
    { key: "fantasyName", label: "fantasia", desc: "Nome fantasia", category: "Contato" },
    { key: "creditLimit", label: "limite-credito", desc: "Limite de crédito", category: "Contato" },
    { key: "segment", label: "segmento", desc: "Segmento de mercado", category: "Contato" },
    { key: "date", label: "data", desc: "Data atual", category: "Data/Hora" },
    { key: "hour", label: "hora", desc: "Hora atual", category: "Data/Hora" },
    { key: "ms", label: "saudacao", desc: "Saudação contextual", category: "Saudação" },
    { key: "name_company", label: "empresa", desc: "Nome da empresa", category: "Empresa" },
  ];
  const groupedVars = mustacheVars.reduce((acc, v) => { acc[v.category] = acc[v.category] || []; acc[v.category].push(v); return acc; }, {});
  const insertTagIntoField = (targetField, setFieldValue, values) => (label) => {
    const prev = (values && values[targetField]) || "";
    setFieldValue(targetField, prev + `{${label}}`);
  };

  const isAllowedMedia = (opt) => {
    const url = (opt?.url || opt?.path || "").toLowerCase();
    const mime = (opt?.mediaType || "").toLowerCase();
    const exts = [".jpg",".jpeg",".png",".gif",".webp",".pdf",".mp4",".mp3",".ogg",".opus",".wav"];
    const mimes = ["image/","video/","audio/","application/pdf"];
    
    // Verifica se a URL termina com alguma extensão permitida
    const hasAllowedExt = exts.some(ext => url.endsWith(ext));
    // Verifica se o mime type é permitido
    const hasAllowedMime = mimes.some(m => mime.startsWith(m));
    
    return hasAllowedExt || hasAllowedMime;
  };

  const getMediaUrlFieldByTab = (i) => `mediaUrl${i+1}`;
  const getMediaNameFieldByTab = (i) => `mediaName${i+1}`;
  const clearTabMedia = (idx) => { const s = setFieldValueRef.current; if (!s) return; s(getMediaUrlFieldByTab(idx), null); s(getMediaNameFieldByTab(idx), null); };


  const isImage = (url = "") => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  const isVideo = (url = "") => /\.(mp4|webm|ogg)$/i.test(url);
  const isAudio = (url = "") => /\.(mp3|wav|ogg|opus)$/i.test(url);
  const isPdf = (url = "") => /\.(pdf)$/i.test(url);

  const renderMediaPreview = (url, name) => {
    if (!url) return null;
    const wrapperStyle = { cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 };
    if (isImage(url)) return <div style={wrapperStyle}><img src={url} alt={name || 'preview'} style={{ maxWidth: 120, maxHeight: 90, borderRadius: 4, border: '1px solid #eee' }} /></div>;
    return <Button size="small" variant="outlined" style={{ pointerEvents: "none" }}>Pré-visualizar</Button>;
  };

  const filterOptions = createFilterOptions({ trim: true });

  // ─── Lifecycle ───
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  useEffect(() => {
    if (!isMounted.current) return;
    (async () => { const list = await findAllForSelection(); setAllQueues(list); setQueues(list); })();
  }, []);

  useEffect(() => {
    if (!isMounted.current) return;
    (async () => {
      try {
        const [clRes, waRes, tagRes] = await Promise.all([
          api.get("/contact-lists/list", { params: { companyId } }),
          api.get("/whatsapp", { params: { companyId, session: 0 } }),
          api.get("/tags/list", { params: { companyId, kanban: 0 } }),
        ]);
        setContactLists(clRes.data || []);
        setWhatsapps((waRes.data || []).map(w => ({ ...w, selected: false })));
        setTagLists((tagRes.data || []).map(t => ({ id: t.id, name: `${t.name} (${(t.contacts||[]).length})` })));

        if (campaignId) {
          setCampaignLoading(true);
          const { data } = await api.get(`/campaigns/${campaignId}`);
          
          // Carregar usuários se necessário antes de filtrar
          if (data?.userIds && (!options || options.length === 0)) {
            try {
              const { data: usersData } = await api.get("/users/available");
              setOptions(usersData || []);
              const ids = typeof data.userIds === 'string' ? JSON.parse(data.userIds) : data.userIds;
              if (Array.isArray(ids)) {
                setSelectedUsers((usersData || []).filter(u => ids.includes(u.id)));
              }
            } catch (e) {
              console.error("Erro ao carregar usuários:", e);
            }
          } else if (data?.userIds) {
            try {
              const ids = typeof data.userIds === 'string' ? JSON.parse(data.userIds) : data.userIds;
              if (Array.isArray(ids)) {
                setSelectedUsers((options || []).filter(u => ids.includes(u.id)));
              }
            } catch (e) {}
          } else if (data?.user) {
            setSelectedUsers([data.user]);
          }
          
          if (data?.queue) setSelectedQueue(data.queue.id);
          if (data?.whatsappId) setWhatsappId(data.whatsappId);
          if (data?.dispatchStrategy) setDispatchStrategy(data.dispatchStrategy);
          
          const prev = {};
          
          // Garantir que tagListId seja "Nenhuma" quando null/vazio, ou string quando tem valor
          console.log("[DEBUG] tagListId original:", data?.tagListId, "tipo:", typeof data?.tagListId);
          if (!data?.tagListId || data.tagListId === null || data.tagListId === "" || data.tagListId === undefined) {
            prev.tagListId = "Nenhuma";
          } else {
            prev.tagListId = String(data.tagListId);
          }
          console.log("[DEBUG] tagListId após processamento:", prev.tagListId);
          
          // Copiar demais campos, mas NÃO sobrescrever tagListId já processado
          Object.entries(data).forEach(([k,v]) => { 
            if (k !== "tagListId") {
              prev[k] = k === "scheduledAt" && v ? moment(v).format("YYYY-MM-DDTHH:mm") : (v === null ? "" : v); 
            }
          });
          
          if (data?.contactListIds) {
            try {
              const ids = typeof data.contactListIds === 'string' ? JSON.parse(data.contactListIds) : data.contactListIds;
              if (Array.isArray(ids)) {
                prev.contactListIds = ids;
              }
            } catch (e) {
              console.error("Error parsing contactListIds", e);
            }
          }
          
          if (data?.metaTemplateVariables) { try { setMetaTemplateVariables(typeof data.metaTemplateVariables === 'string' ? JSON.parse(data.metaTemplateVariables) : data.metaTemplateVariables || {}); } catch(e){ setMetaTemplateVariables({}); } }
          if (data?.allowedWhatsappIds) { try { const p = typeof data.allowedWhatsappIds === 'string' ? JSON.parse(data.allowedWhatsappIds) : data.allowedWhatsappIds; if (Array.isArray(p)) setAllowedWhatsappIds(p); } catch(e){} }
          
          // Restaurar dispatchMode baseado em allowedWhatsappIds e dispatchStrategy
          // Usa waRes.data que já está disponível aqui
          if (data?.dispatchStrategy === "round_robin" && data?.allowedWhatsappIds) {
            try {
              const allowedIds = typeof data.allowedWhatsappIds === 'string' ? JSON.parse(data.allowedWhatsappIds) : data.allowedWhatsappIds;
              const loadedWhatsapps = waRes.data || [];
              const allIds = loadedWhatsapps.map(w => w.id).sort();
              const allowedSorted = [...allowedIds].sort();
              
              if (JSON.stringify(allIds) === JSON.stringify(allowedSorted)) {
                setDispatchMode("all");
              } else {
                const baileysIds = loadedWhatsapps.filter(w => w.channelType !== "official").map(w => w.id).sort();
                const officialIds = loadedWhatsapps.filter(w => w.channelType === "official").map(w => w.id).sort();
                
                if (JSON.stringify(baileysIds) === JSON.stringify(allowedSorted)) {
                  setDispatchMode("baileys");
                } else if (JSON.stringify(officialIds) === JSON.stringify(allowedSorted)) {
                  setDispatchMode("official");
                } else {
                  setDispatchMode("custom");
                }
              }
            } catch (e) {}
          } else if (data?.dispatchStrategy === "single" || !data?.dispatchStrategy) {
            setDispatchMode("single");
          }
          
          setCampaign(prev);
          setCampaignLoading(false);
        }
      } catch (err) { if (err?.response?.status !== 403) toastError(err); setCampaignLoading(false); }
    })();
  }, [campaignId, companyId]);

  useEffect(() => {
    const now = moment(); const s = moment(campaign.scheduledAt);
    const ok = campaign.status === "INATIVA" || campaign.status === "CANCELADA" || (campaign.status === "PROGRAMADA" && s.diff(now,"hour") > 1);
    setCampaignEditable(ok);
  }, [campaign.status, campaign.scheduledAt]);

  useEffect(() => {
    if (!whatsappId) { setAvailableTemplates([]); return; }
    const wa = whatsapps.find(w => w.id === whatsappId);
    if (wa?.channelType !== "official") { setAvailableTemplates([]); return; }
    (async () => {
      setLoadingTemplates(true);
      try {
        const { data: td } = await api.get(`/whatsapp/${whatsappId}/templates`);
        const { data: wd } = await api.get(`/whatsapp/${whatsappId}`);
        const all = td.templates || [];
        const allowed = wd.allowedTemplates;
        setAvailableTemplates(allowed?.length ? all.filter(t => allowed.includes(t.id)) : all);
      } catch(e) { toastError(e); } finally { setLoadingTemplates(false); }
    })();
  }, [whatsappId, whatsapps]);

  // Carregar pastas/arquivos da biblioteca quando o dialog abrir
  useEffect(() => {
    if (!fileLibraryOpen) return;
    let active = true;
    (async () => {
      try {
        setLibraryLoading(true);
        const foldersData = await libraryApi.fetchFolders(libraryCurrentFolder);
        const filesData = libraryCurrentFolder ? await libraryApi.fetchFiles(libraryCurrentFolder) : [];
        if (!active) return;
        setLibraryFolders(Array.isArray(foldersData) ? foldersData : []);
        setLibraryFiles(Array.isArray(filesData) ? filesData : []);
      } catch (_) {
        if (!active) return;
        setLibraryFolders([]);
        setLibraryFiles([]);
      } finally {
        if (active) setLibraryLoading(false);
      }
    })();
    return () => { active = false; };
  }, [fileLibraryOpen, libraryCurrentFolder]);

  const ensureUsersLoaded = async () => {
    if (options?.length > 0) return;
    try { setLoading(true); const { data } = await api.get("/users/available"); setOptions(data || []); }
    catch(e) { if (e?.response?.status !== 403) toastError(e); }
    finally { setLoading(false); }
  };

  // ─── Handlers ───
  const handleClose = () => history.push("/campaigns");

  const handleSaveCampaign = async (values) => {
    try {
      const processed = {};
      Object.entries(values).forEach(([k,v]) => { processed[k] = k === "scheduledAt" && v ? moment(v).format("YYYY-MM-DD HH:mm:ss") : (v === "" ? null : v); });
      const userIds = selectedUsers.length > 0 ? JSON.stringify(selectedUsers.map(u => u.id)) : null;
      const userId = selectedUsers.length === 1 ? selectedUsers[0].id : null;
      // Convert contactListIds to JSON string if it's an array
      const contactListIds = Array.isArray(values.contactListIds) ? JSON.stringify(values.contactListIds) : values.contactListIds;
      // Process tagListId: "Nenhuma" → null, string → number
      const tagListId = values.tagListId === "Nenhuma" ? null : (values.tagListId ? Number(values.tagListId) : null);
      const dv = { ...processed, whatsappId, userId, userIds, contactListIds, queueId: selectedQueue || null, dispatchStrategy, allowedWhatsappIds, metaTemplateVariables, tagListId };
      if (campaignId) { await api.put(`/campaigns/${campaignId}`, dv); if (attachment) { const fd = new FormData(); fd.append("file", attachment); await api.post(`/campaigns/${campaignId}/media-upload`, fd); } }
      else { const { data } = await api.post("/campaigns", dv); if (attachment) { const fd = new FormData(); fd.append("file", attachment); await api.post(`/campaigns/${data.id}/media-upload`, fd); } }
      toast.success(i18n.t("campaigns.toasts.success"));
      handleClose();
    } catch (err) { toastError(err); }
  };

  const handleSaveOnly = async (values, setSubmitting) => {
    try {
      setSubmitting(true);
      const processed = {};
      Object.entries(values).forEach(([k,v]) => { processed[k] = k === "scheduledAt" && v ? moment(v).format("YYYY-MM-DD HH:mm:ss") : (v === "" ? null : v); });
      const hasSched = !!processed.scheduledAt;
      processed.status = hasSched ? "PROGRAMADA" : "INATIVA";
      const userIds = selectedUsers.length > 0 ? JSON.stringify(selectedUsers.map(u => u.id)) : null;
      // Convert contactListIds to JSON string if it's an array
      const contactListIds = Array.isArray(values.contactListIds) ? JSON.stringify(values.contactListIds) : values.contactListIds;
      // Process tagListId: "Nenhuma" → null, string → number
      const tagListId = values.tagListId === "Nenhuma" ? null : (values.tagListId ? Number(values.tagListId) : null);
      const dv = { ...processed, whatsappId, userId: selectedUsers.length === 1 ? selectedUsers[0].id : null, userIds, contactListIds, queueId: selectedQueue || null, dispatchStrategy, allowedWhatsappIds, metaTemplateVariables, tagListId };
      if (campaignId) { await api.put(`/campaigns/${campaignId}`, dv); } else { const { data } = await api.post("/campaigns", dv); setCampaignId(data.id); }
      toast.success(hasSched ? "Campanha programada!" : "Rascunho salvo!");
      handleClose();
    } catch (err) { toastError(err); } finally { setSubmitting(false); }
  };

  const handleChooseFromLibrary = async (file) => {
    try {
      const idx = Number.isInteger(fileLibraryTargetIndex) ? fileLibraryTargetIndex : messageTab;
      const fileUrl = file?.fileOption?.url || file?.fileOption?.path || file?.url || file?.path;
      if (!fileUrl) { toast.error("Arquivo sem URL"); return; }
      if (!isAllowedMedia({ url: fileUrl, mediaType: file?.mediaType || file?.fileOption?.mediaType })) { toast.error("Tipo não suportado"); return; }
      const fname = file?.title || file?.name || fileUrl.split("/").pop() || "arquivo.bin";
      const sfv = setFieldValueRef.current;
      if (sfv) { sfv(getMediaUrlFieldByTab(idx), fileUrl); sfv(getMediaNameFieldByTab(idx), fname); setFileLibraryOpen(false); setFileLibraryTargetIndex(null); toast.success(`Anexo definido: "${fname}"`); }
    } catch (e) { toastError(e); }
  };

  const handleLibraryNavigateToFolder = (folder) => {
    setLibraryCurrentFolder(folder?.id || null);
    setLibraryBreadcrumbs((prev) => {
      const folderId = folder?.id || null;
      const folderName = folder?.name || "Home";
      if (!folderId) return [{ id: null, name: "Home" }];
      const existingIndex = prev.findIndex((crumb) => crumb.id === folderId);
      if (existingIndex >= 0) return prev.slice(0, existingIndex + 1);
      return [...prev, { id: folderId, name: folderName }];
    });
  };

  const filterItemsBySearch = (items, searchTerm) => {
    if (!searchTerm) return items;
    const term = String(searchTerm).toLowerCase();
    return (items || []).filter((item) => {
      const name = (item.name || item.title || "").toLowerCase();
      return name.includes(term);
    });
  };

  const deleteMedia = async () => {
    if (attachment) { setAttachment(null); attachmentFile.current.value = null; }
    if (campaign.mediaPath) { await api.delete(`/campaigns/${campaign.id}/media-upload`); setCampaign(p => ({ ...p, mediaPath: null, mediaName: null })); toast.success(i18n.t("campaigns.toasts.deleted")); }
  };

  // Funções de controle da campanha
  const restartCampaign = async () => {
    try {
      await api.post(`/campaigns/${campaignId}/restart`);
      toast.success(i18n.t("campaigns.toasts.restart"));
      setCampaign((prev) => ({ ...prev, status: "EM_ANDAMENTO" }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const cancelCampaign = async () => {
    try {
      await api.post(`/campaigns/${campaignId}/cancel`);
      toast.success(i18n.t("campaigns.toasts.cancel"));
      setCampaign((prev) => ({ ...prev, status: "CANCELADA" }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEmojiSelect = (field, emoji, setFieldValue, values) => { setFieldValue(field, (values[field] || "") + emoji); };

  const renderTabAttachment = (idx, values, disabled) => {
    const nf = getMediaNameFieldByTab(idx), uf = getMediaUrlFieldByTab(idx);
    const name = values[nf], url = values[uf], has = !!name;
    return (
      <Box display="flex" alignItems="center" style={{ gap: 12, margin: "8px 0" }}>
        <Button size="small" variant="outlined" onClick={() => { setFileLibraryTargetIndex(idx); setFileLibraryOpen(true); }} disabled={disabled}>
          {has ? `Trocar anexo` : `Anexar Arquivo`}
        </Button>
        {has && (<><Chip size="small" label={name} /><IconButton size="small" onClick={() => clearTabMedia(idx)} disabled={disabled}><DeleteOutlineIcon fontSize="small" color="secondary" /></IconButton></>)}
      </Box>
    );
  };

  const renderMessageField = (identifier, setFieldValue, values, label = "Conteúdo da Mensagem") => (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="subtitle2" style={{ fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 0.5, color: "#64748b" }}>
            {label}
          </Typography>
          <Tooltip title={label.includes("Confirmação") 
            ? "Mensagem reservada para validar a intenção do cliente, caso a opção de Confirmação esteja ativa no Passo 2."
            : "O texto que seu cliente receberá. Use as tags no botão abaixo para personalizar com o nome do contato, etc."}>
            <InfoOutlinedIcon style={{ fontSize: 13, color: "#94a3b8", cursor: "pointer" }} />
          </Tooltip>
        </Box>
        <Typography variant="caption" color="textSecondary">
          {(values[identifier] || "").length} / 1024 caracteres
        </Typography>
      </Box>
      <Box display="flex" alignItems="center" style={{ gap: 4 }} mb={1}>
        <Tooltip title="Tags"><IconButton size="small" onClick={(e) => { setTagsTargetField(identifier); handleOpenTags(e); }} disabled={!campaignEditable}><LocalOfferIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Emoji">
          <WhatsAppPopover onSelectEmoji={(emoji) => handleEmojiSelect(identifier, emoji, setFieldValue, values)} disabled={!campaignEditable}>
            <IconButton size="small" disabled={!campaignEditable}><Smile size={16} /></IconButton>
          </WhatsAppPopover>
        </Tooltip>
        <Tooltip title="Assistente IA"><IconButton size="small" onClick={() => setAssistantOpen(true)} disabled={!campaignEditable}><Sparkles size={16} /></IconButton></Tooltip>
        <Tooltip title="Info"><IconButton size="small" onClick={handleOpenInfo} disabled={!campaignEditable}><InfoOutlinedIcon fontSize="small" /></IconButton></Tooltip>
      </Box>
      <FormattedTextField
        id={identifier} value={values[identifier] || ""} onChange={(e) => setFieldValue(identifier, e.target.value)}
        placeholder="Olá {nome}! 👋 Escreva sua mensagem aqui..." rows={6}
        disabled={!campaignEditable && campaign.status !== "CANCELADA"}
      />
    </>
  );

  if (campaignLoading) return <Box display="flex" justifyContent="center" alignItems="center" height="100vh"><CircularProgress /></Box>;

  return (
    <MainContainer className={classes.root}>
      <MainHeader>
        <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
          <Box display="flex" alignItems="center">
            <IconButton onClick={handleClose} style={{ marginRight: 12 }}><ArrowLeft /></IconButton>
            <Title>
              {campaignId 
                ? (campaignEditable ? "Editar Campanha" : "Visualizar Campanha")
                : "Nova Campanha"
              }
            </Title>
          </Box>
          {/* Badge de status da campanha */}
          {campaignId && campaign.status && (
            <Chip 
              label={
                campaign.status === "INATIVA" ? "Inativa" :
                campaign.status === "PROGRAMADA" ? "Programada" :
                campaign.status === "EM_ANDAMENTO" ? "Em Andamento" :
                campaign.status === "CANCELADA" ? "Pausada" :
                campaign.status === "FINALIZADA" ? "Finalizada" :
                campaign.status
              }
              color={
                campaign.status === "EM_ANDAMENTO" ? "primary" :
                campaign.status === "PROGRAMADA" ? "secondary" :
                campaign.status === "FINALIZADA" ? "default" :
                "default"
              }
              size="small"
              style={{ fontWeight: 600 }}
            />
          )}
        </Box>
      </MainHeader>

      <Stepper activeStep={activeStep} alternativeLabel elevation={0} style={{ backgroundColor: "transparent" }} className={classes.stepperBar} connector={<div style={{ top: 24, left: "calc(-50% + 24px)", right: "calc(50% + 24px)", position: "absolute", height: 2, backgroundColor: "#e2e8f0" }} />}>
        {STEPS.map((label, i) => (
          <Step key={label} completed={activeStep > i} style={{ cursor: i < activeStep ? "pointer" : "default" }} onClick={() => i < activeStep && setActiveStep(i)}>
            <StepLabel StepIconComponent={ColorlibStepIcon}>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Formik initialValues={campaign} enableReinitialize validationSchema={CampaignSchema}
        onSubmit={(values, { setSubmitting }) => { handleSaveCampaign(values); setSubmitting(false); }}>
        {({ values, errors, touched, setFieldValue, isSubmitting, setSubmitting, validateForm }) => {
          setFieldValueRef.current = setFieldValue;
          formValuesRef.current = values;
          return (
            <Form style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Tags Popover */}
              <Popover open={openTags} anchorEl={tagsAnchorEl} onClose={handleCloseTags} anchorOrigin={{ vertical: "bottom", horizontal: "left" }}>
                <Box p={1.5} style={{ maxWidth: 380 }}>
                  <TextField value={tagsSearch} onChange={e => setTagsSearch(e.target.value)} placeholder="Buscar tags..." variant="outlined" size="small" fullWidth style={{ marginBottom: 8 }} />
                  {Object.keys(groupedVars).map(cat => {
                    const items = groupedVars[cat].filter(v => v.label.toLowerCase().includes((tagsSearch||"").toLowerCase()));
                    if (!items.length) return null;
                    return (<Box key={cat} mb={1}><Typography variant="caption" style={{ opacity: 0.7 }}>{cat}</Typography>
                      <Box display="flex" flexWrap="wrap" style={{ gap: 4 }}>{items.map(v => (
                        <Chip key={v.key} label={`{${v.label}}`} size="small" clickable onClick={() => { if (tagsTargetField) insertTagIntoField(tagsTargetField, setFieldValue, values)(v.label); handleCloseTags(); }} />
                      ))}</Box></Box>);
                  })}
                </Box>
              </Popover>

              <div className={classes.body}>
                <Grid container spacing={3}>
                   {/* ═══ STEP 0: Configuração ═══ */}
                   {activeStep === 0 && (<>
                     <Grid item xs={12} md={7}>
                       <Paper className={classes.card}>
                         <Typography className={classes.stepTitle}>Detalhes da Campanha</Typography>
                         <Typography className={classes.stepSub}>Defina os parâmetros básicos para sua campanha de automação.</Typography>
                         
                         <Box mb={3}>
                           <Box display="flex" alignItems="center" mb={1} gap={0.5}>
                             <label className={classes.label} style={{ marginBottom: 0 }}>Nome da Campanha</label>
                             <Tooltip title="Nome identificador interno. Use termos que ajudem a localizar a campanha na lista depois."><InfoOutlinedIcon style={{ fontSize: 16, color: "#64748b", cursor: "pointer" }} /></Tooltip>
                           </Box>
                           <Field as={TextField} name="name" fullWidth variant="outlined" placeholder="Ex: Q4 Promoção Black Friday" error={errors.name && touched.name} helperText={errors.name && touched.name ? errors.name : ""} disabled={!campaignEditable} className={classes.formField} />
                         </Box>

                         <Grid container spacing={3}>
                           <Grid item xs={12} md={6}>
                             <Box display="flex" alignItems="center" mb={1} gap={0.5}>
                                <label className={classes.label} style={{ marginBottom: 0 }}>Listas de Contatos</label>
                                <Tooltip title="Bases de dados que receberão o disparo. Você pode selecionar múltiplas listas."><InfoOutlinedIcon style={{ fontSize: 16, color: "#64748b", cursor: "pointer" }} /></Tooltip>
                              </Box>
                              <Box className={classes.autoCompleteField}>
                                <Autocomplete
                                  multiple
                                  name="contactListIds"
                                  options={contactLists || []}
                                  getOptionLabel={(option) => option?.name || ""}
                                  value={(contactLists || []).filter(cl => (values.contactListIds || []).includes(cl?.id))}
                                  onChange={(e, nv) => setFieldValue("contactListIds", (nv || []).map(cl => cl?.id))}
                                  disabled={!campaignEditable}
                                  renderTags={(value, getTagProps) =>
                                    (value || []).map((option, index) => (
                                      <Chip key={option?.id || index} label={option?.name || ""} size="small" {...getTagProps({ index })} />
                                    ))
                                  }
                                  renderInput={(params) => (
                                    <TextField {...params} variant="outlined" placeholder="Selecionar listas..." fullWidth />
                                  )}
                                />
                              </Box>
                           </Grid>
                           <Grid item xs={12} md={6}>
                             <Box display="flex" alignItems="center" mb={1} gap={0.5}>
                               <label className={classes.label} style={{ marginBottom: 0 }}>Conexão</label>
                               <Tooltip title="O WhatsApp que será o remetente oficial desta campanha."><InfoOutlinedIcon style={{ fontSize: 16, color: "#64748b", cursor: "pointer" }} /></Tooltip>
                             </Box>
                             <FormControl variant="outlined" fullWidth error={errors.whatsappId && touched.whatsappId} className={classes.formField}>
                               <Select value={whatsappId||""} onChange={e => setWhatsappId(e.target.value)} displayEmpty disabled={!campaignEditable}>
                                 <MenuItem value="" disabled>Escolher WhatsApp</MenuItem>
                                 {whatsapps.map(w => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
                               </Select>
                               {errors.whatsappId && touched.whatsappId && <FormHelperText error>{errors.whatsappId}</FormHelperText>}
                             </FormControl>
                           </Grid>
                         </Grid>

                         <Box mt={3}>
                           <Box display="flex" alignItems="center" mb={1} gap={0.5}>
                             <label className={classes.label} style={{ marginBottom: 0 }}>Tags (Filtrar Contatos)</label>
                             <Tooltip title="Selecione uma tag para enviar APENAS para contatos da lista que possuam essa etiqueta específica."><InfoOutlinedIcon style={{ fontSize: 16, color: "#64748b", cursor: "pointer" }} /></Tooltip>
                           </Box>
                           <FormControl variant="outlined" fullWidth className={classes.formField}>
                             {(() => { console.log("[DEBUG RENDER] values.tagListId:", values.tagListId, "tagLists:", tagLists); return null; })()}
                             <Select name="tagListId" value={values.tagListId||"Nenhuma"} onChange={e => setFieldValue("tagListId", e.target.value)} disabled={!campaignEditable}>
                               <MenuItem value="Nenhuma">Nenhuma</MenuItem>
                               {tagLists.map(t => <MenuItem key={t.id} value={String(t.id)}>{t.name}</MenuItem>)}
                             </Select>
                           </FormControl>
                         </Box>

                         <Box className={classes.tipBox} mt={3}>
                           <InfoOutlinedIcon style={{ color: "#059669", marginTop: 2 }} />
                           <Typography variant="body2" style={{ color: "#065f46" }}>Tickets existentes receberão a mensagem. Certifique-se de que os limites da conexão suportam envio em massa.</Typography>
                         </Box>
                       </Paper>
                     </Grid>
                     <Grid item xs={12} md={5}>
                       <Paper className={classes.sideCard} style={{ textAlign: "center" }}>
                         <Box p={2} style={{ backgroundColor: "#f8fafc", borderRadius: 16, display: "inline-flex", marginBottom: 12 }}><Settings size={40} color="#005c53" /></Box>
                         <Typography variant="h6" style={{ fontWeight: 700, color: "#005c53" }}>Primeira Etapa</Typography>
                         <Typography variant="body2" color="textSecondary" style={{ maxWidth: 260, margin: "8px auto 0" }}>Defina quem receberá suas mensagens e qual canal será utilizado.</Typography>
                       </Paper>
                     </Grid>
                   </>)}

                   {/* ═══ STEP 1: Regras ═══ */}
                   {activeStep === 1 && (<>
                     <Grid item xs={12} md={7}>
                       <Paper className={classes.card}>
                         <Typography className={classes.stepTitle}>Regras de Atendimento</Typography>
                         <Typography className={classes.stepSub}>Defina como as respostas dos clientes serão gerenciadas.</Typography>
                         
                         <Grid container spacing={3}>
                           {/* Linha 1: Abrir Ticket | Status do Ticket */}
                           <Grid item xs={12} md={6}>
                             <Box display="flex" alignItems="center" mb={1} gap={0.5}>
                               <label className={classes.label} style={{ marginBottom: 0 }}>Abrir Ticket</label>
                               <Tooltip title="Se 'Habilitado', o chat aparecerá imediatamente na tela do atendente. 'Desabilitado' só mostrará quando houver resposta."><InfoOutlinedIcon style={{ fontSize: 16, color: "#64748b", cursor: "pointer" }} /></Tooltip>
                             </Box>
                             <FormControl variant="outlined" fullWidth error={errors.openTicket && touched.openTicket} className={classes.formField}>
                               <Field as={Select} name="openTicket" disabled={!campaignEditable}>
                                 <MenuItem value="enabled">{i18n.t("campaigns.dialog.form.enabledOpenTicket")}</MenuItem>
                                 <MenuItem value="disabled">{i18n.t("campaigns.dialog.form.disabledOpenTicket")}</MenuItem>
                               </Field>
                               {errors.openTicket && touched.openTicket && <FormHelperText error>{errors.openTicket}</FormHelperText>}
                             </FormControl>
                           </Grid>
                           <Grid item xs={12} md={6}>
                             <Box display="flex" alignItems="center" mb={1} gap={0.5}>
                               <label className={classes.label} style={{ marginBottom: 0 }}>Status do Ticket</label>
                               <Tooltip title="Define se o ticket nascerá como Fechado, Pendente ou Aberto no sistema."><InfoOutlinedIcon style={{ fontSize: 16, color: "#64748b", cursor: "pointer" }} /></Tooltip>
                             </Box>
                             <FormControl variant="outlined" fullWidth error={errors.statusTicket && touched.statusTicket} className={classes.formField}>
                               <Field as={Select} name="statusTicket" disabled={!campaignEditable || values.openTicket === "disabled"}>
                                 <MenuItem value="closed">{i18n.t("campaigns.dialog.form.closedTicketStatus")}</MenuItem>
                                 <MenuItem value="pending">{i18n.t("campaigns.dialog.form.pendingTicketStatus")}</MenuItem>
                                 <MenuItem value="open">{i18n.t("campaigns.dialog.form.openTicketStatus")}</MenuItem>
                               </Field>
                               {errors.statusTicket && touched.statusTicket && <FormHelperText error>{errors.statusTicket}</FormHelperText>}
                             </FormControl>
                           </Grid>

                           {/* Linha 2: Fila (Queue) | Usuários */}
                           <Grid item xs={12} md={6}>
                             <Box display="flex" alignItems="center" mb={1} gap={0.5}>
                               <label className={classes.label} style={{ marginBottom: 0 }}>Fila (Queue)</label>
                               <Tooltip title="Para qual setor o ticket será direcionado caso o cliente responda."><InfoOutlinedIcon style={{ fontSize: 16, color: "#64748b", cursor: "pointer" }} /></Tooltip>
                             </Box>
                             <FormControl variant="outlined" fullWidth error={errors.queueId && touched.queueId} className={classes.formField}>
                               <Select value={selectedQueue} onChange={e => setSelectedQueue(e.target.value)} displayEmpty disabled={!campaignEditable}>
                                 <MenuItem value="">Selecione a fila...</MenuItem>
                                 {queues.map(q => <MenuItem key={q.id} value={q.id}>{q.name}</MenuItem>)}
                               </Select>
                               {errors.queueId && touched.queueId && <FormHelperText error>{errors.queueId}</FormHelperText>}
                             </FormControl>
                           </Grid>
                           <Grid item xs={12} md={6}>
                             <Box display="flex" alignItems="center" mb={1} gap={0.5}>
                               <label className={classes.label} style={{ marginBottom: 0 }}>Usuários</label>
                               <Tooltip title="Quais atendentes terão acesso a este ticket. Se houver mais de um, o sistema distribui entre eles."><InfoOutlinedIcon style={{ fontSize: 16, color: "#64748b", cursor: "pointer" }} /></Tooltip>
                             </Box>
                             <Box className={classes.autoCompleteField}>
                               <Autocomplete multiple options={options || []} getOptionLabel={o => o?.name || ""} value={selectedUsers || []} openOnFocus onOpen={ensureUsersLoaded}
                                 onChange={(e, nv) => { setSelectedUsers(nv||[]); if (nv?.length === 1 && nv[0]?.queues) { setQueues(nv[0].queues); if(nv[0].queues?.length===1) setSelectedQueue(nv[0].queues[0]?.id); } else { setQueues(allQueues); if(!nv?.length) setSelectedQueue(""); } }}
                                 filterOptions={filterOptions} disabled={!campaignEditable || values.openTicket === "disabled"} loading={loading}
                                 renderTags={(v, gtp) => (v || []).map((o,i) => <Chip key={o?.id || i} label={o?.name || ""} size="small" {...gtp({index:i})} />)}
                                 renderInput={p => <TextField {...p} variant="outlined" placeholder="Adicionar..." fullWidth />} />
                             </Box>
                           </Grid>

                           {/* Linha 3: Estratégia de Envio | Confirmação */}
                           <Grid item xs={12} md={6}>
                             <Box display="flex" alignItems="center" mb={1} gap={0.5}>
                               <label className={classes.label} style={{ marginBottom: 0 }}>Estratégia de Envio</label>
                               <Tooltip title="Escolha entre disparar de um número só ou alternar entre vários anexados para maior segurança."><InfoOutlinedIcon style={{ fontSize: 16, color: "#64748b", cursor: "pointer" }} /></Tooltip>
                             </Box>
                             <FormControl variant="outlined" fullWidth className={classes.formField}>
                               <Select
                                 value={dispatchMode}
                                 onChange={(e) => {
                                   const val = e.target.value;
                                   if(!campaignEditable) return;
                                   setDispatchMode(val);
                                   if(val==="all"){ setAllowedWhatsappIds(whatsapps.map(w=>w.id)); setDispatchStrategy("round_robin"); }
                                   else if(val==="baileys"){ setAllowedWhatsappIds(whatsapps.filter(w=>w.channelType!=="official").map(w=>w.id)); setDispatchStrategy("round_robin"); }
                                   else if(val==="official"){ setAllowedWhatsappIds(whatsapps.filter(w=>w.channelType==="official").map(w=>w.id)); setDispatchStrategy("round_robin"); }
                                   else if(val==="single"){ setAllowedWhatsappIds([]); setDispatchStrategy("single"); }
                                   else if(val==="custom"){ setDispatchStrategy("round_robin"); }
                                 }}
                                 disabled={!campaignEditable}
                                 renderValue={(selected) => {
                                   const opt = [
                                     { id: "single", label: "Única conexão", icon: "📱" },
                                     { id: "custom", label: "Rodízio personalizado", icon: "🎯" },
                                     { id: "all", label: "Todas as conexões", icon: "🔄" },
                                     { id: "baileys", label: "Apenas Baileys (Grátis)", icon: "📱" },
                                     { id: "official", label: "Apenas API Oficial", icon: "✅" }
                                   ].find(o => o.id === selected);
                                   return opt ? (
                                     <Box display="flex" alignItems="center" gap={1} style={{ height: 24 }}>
                                       <Typography style={{ fontSize: 16, lineHeight: 1 }}>{opt.icon}</Typography>
                                       <Typography style={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1 }}>{opt.label}</Typography>
                                     </Box>
                                   ) : selected;
                                 }}
                               >
                                 {[
                                   { id: "single", label: "Única conexão", icon: "📱", desc: "Usa apenas a conexão principal" },
                                   { id: "custom", label: "Rodízio personalizado", icon: "🎯", desc: "Você escolhe quais conexões usar" },
                                   { id: "all", label: "Todas as conexões", icon: "🔄", desc: `Usa todas as ${whatsapps.length} conexões disponíveis` },
                                   { id: "baileys", label: "Apenas Baileys (Grátis)", icon: "📱", desc: `${whatsapps.filter(w => w.channelType !== "official").length} conexões disponíveis` },
                                   { id: "official", label: "Apenas API Oficial", icon: "✅", desc: `${whatsapps.filter(w => w.channelType === "official").length} conexões disponíveis` }
                                 ].map(opt => (
                                   <MenuItem key={opt.id} value={opt.id} style={{ padding: '12px 16px' }}>
                                     <Box display="flex" alignItems="center" gap={2} width="100%">
                                       <Box className={classes.stepIcon} style={{ width: 40, height: 40, minWidth: 40, backgroundColor: "#f1f5f9", color: "#64748b" }}>
                                         <Typography style={{ fontSize: 20 }}>{opt.icon}</Typography>
                                       </Box>
                                       <Box>
                                         <Typography style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{opt.label}</Typography>
                                         <Typography variant="caption" style={{ color: '#64748b', display: 'block' }}>{opt.desc}</Typography>
                                       </Box>
                                     </Box>
                                   </MenuItem>
                                 ))}
                               </Select>
                             </FormControl>
                           </Grid>
                           <Grid item xs={12} md={6}>
                             <Box display="flex" alignItems="center" mb={1} gap={0.5}>
                               <label className={classes.label} style={{ marginBottom: 0 }}>Confirmação</label>
                               <Tooltip title="Se ativado, o bot pedirá ao cliente para digitar algo antes de iniciar o fluxo humano."><InfoOutlinedIcon style={{ fontSize: 16, color: "#64748b", cursor: "pointer" }} /></Tooltip>
                             </Box>
                             <FormControl variant="outlined" fullWidth error={errors.confirmation && touched.confirmation} className={classes.formField}>
                               <Field as={Select} name="confirmation" disabled={!campaignEditable}>
                                 <MenuItem value={false}>Desabilitada</MenuItem>
                                 <MenuItem value={true}>Habilitada</MenuItem>
                               </Field>
                               {errors.confirmation && touched.confirmation && <FormHelperText error>{errors.confirmation}</FormHelperText>}
                             </FormControl>
                           </Grid>

                           {/* Campo de conexões customizadas (ocupa linha inteira se necessário) */}
                           {dispatchMode === "custom" && (
                             <Grid item xs={12}>
                               <label className={classes.label}>Escolha as conexões para o rodízio</label>
                               <Autocomplete multiple options={whatsapps || []} getOptionLabel={(option) => `${option?.channelType==="official"?"✅":"📱"} ${option?.name || ""}`}
                                 value={(whatsapps || []).filter(w => (allowedWhatsappIds || []).includes(w?.id))}
                                 onChange={(event, nv) => setAllowedWhatsappIds((nv || []).map(w => w?.id))}
                                 renderTags={(value, getTagProps) => (value || []).map((option, index) => (
                                     <Chip key={option?.id || index} variant="outlined" size="small" color={option?.channelType === "official" ? "primary" : "default"} label={option?.name || ""} {...getTagProps({ index })} />
                                   ))
                                 }
                                 renderInput={(params) => <TextField {...params} variant="outlined" placeholder="Selecione as conexões..." fullWidth />}
                                 disableCloseOnSelect disabled={!campaignEditable}
                               />
                             </Grid>
                           )}
                         </Grid>
                       </Paper>
                     </Grid>
                     <Grid item xs={12} md={5}>
                       <Paper className={classes.sideCard}>
                          {allowedWhatsappIds.length > 1 && (
                             <Box mb={2}>
                               <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 700 }}>📊 Pool de Disparo Ativo</Typography>
                               <Paper variant="outlined" style={{ padding: 12, borderRadius: 12, backgroundColor: "#f8fafc" }}>
                                 <Typography variant="body2">{allowedWhatsappIds.length} conexões selecionadas</Typography>
                                 <Typography variant="caption" color="textSecondary">As mensagens serão enviadas em rodízio aleatório entre estes canais.</Typography>
                               </Paper>
                             </Box>
                          )}
                         <Box display="flex" alignItems="center" mb={2}><Zap size={22} color="#005c53" style={{ marginRight: 8 }} /><Typography variant="subtitle1" style={{ fontWeight: 700 }}>IA e Automação</Typography></Box>
                         <Alert severity="info" icon={<InfoOutlinedIcon />} style={{ marginBottom: 12 }}>O motor RAG utilizará sua base de conhecimento para responder automaticamente as dúvidas frequentes.</Alert>
                         {values.openTicket === "disabled" && <Box p={1.5} style={{ backgroundColor: "#005c53", borderRadius: 12, color: "#fff", textAlign: "center" }}><Typography variant="caption">STATUS DA REGRA</Typography><Typography variant="subtitle2" style={{ fontWeight: 700 }}>Otimização Ativa</Typography></Box>}
                       </Paper>
                     </Grid>
                   </>)}

                  {/* ═══ STEP 2: Agendamento ═══ */}
                  {activeStep === 2 && (<>
                    <Grid item xs={12} md={7}>
                      <Paper className={classes.card}>
                        <Typography className={classes.stepTitle}>Estratégia de Envio</Typography>
                        <Typography className={classes.stepSub}>Defina o momento ideal para o disparo das suas mensagens.</Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Paper className={`${classes.schedCard} ${!values.scheduledAt ? classes.schedCardActive : ""}`} onClick={() => setFieldValue("scheduledAt", "")}>
                              <Rocket size={28} color={!values.scheduledAt ? "#005c53" : "#94a3b8"} style={{ marginBottom: 8 }} />
                              <Typography variant="subtitle1" style={{ fontWeight: 700 }}>Envio Imediato</Typography>
                              <Typography variant="body2" color="textSecondary">Dispara ao finalizar a configuração.</Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={6}>
                            <Paper className={`${classes.schedCard} ${values.scheduledAt ? classes.schedCardActive : ""}`} onClick={() => { if (!values.scheduledAt) setFieldValue("scheduledAt", moment().add(1,"hour").format("YYYY-MM-DDTHH:mm")); }}>
                              <Calendar size={28} color={values.scheduledAt ? "#005c53" : "#94a3b8"} style={{ marginBottom: 8 }} />
                              <Typography variant="subtitle1" style={{ fontWeight: 700 }}>Agendamento Programado</Typography>
                              <Typography variant="body2" color="textSecondary">Escolha data e horário específicos.</Typography>
                            </Paper>
                          </Grid>
                        </Grid>
                        {values.scheduledAt && (
                          <Box mt={3}><Grid container spacing={2}>
                            <Grid item xs={6}>
                              <Box display="flex" alignItems="center" mb={1} gap={0.5}>
                                <label className={classes.label} style={{ marginBottom: 0 }}>Data e Hora</label>
                                <Tooltip title="Escolha uma data e horário futuros para o início automático dos disparos."><InfoOutlinedIcon style={{ fontSize: 16, color: "#64748b", cursor: "pointer" }} /></Tooltip>
                              </Box>
                              <Field as={TextField} name="scheduledAt" type="datetime-local" fullWidth variant="outlined" InputLabelProps={{ shrink: true }} disabled={!campaignEditable} className={classes.formField} />
                            </Grid>
                          </Grid></Box>
                        )}
                        <Box className={classes.tipBox} mt={3}>
                          <InfoOutlinedIcon style={{ color: "#059669", marginTop: 2 }} />
                          <Box><Typography variant="subtitle2" style={{ fontWeight: 700, color: "#065f46" }}>Proteção Anti-Spam Ativa</Typography>
                            <Typography variant="body2" style={{ color: "#065f46" }}>Recomendamos um intervalo mínimo de 30-60 segundos entre mensagens para evitar bloqueios.</Typography></Box>
                        </Box>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} md={5}>
                      <Paper className={classes.sideCard}>
                        <Typography variant="h6" style={{ fontWeight: 700, marginBottom: 16 }}>📊 Resumo da Estratégia</Typography>
                        
                        <Box mb={2}>
                          <Typography variant="caption" color="textSecondary">CAMPANHA</Typography>
                          <Typography variant="body2" style={{ fontWeight: 600 }}>{values.name || "N/A"}</Typography>
                        </Box>

                        <Box mb={2}>
                          <Typography variant="caption" color="textSecondary">PÚBLICO ALVO</Typography>
                          <Typography variant="body2" style={{ fontWeight: 600 }}>
                            {values.contactListIds?.length > 0 
                              ? contactLists.filter(c => values.contactListIds.includes(c.id)).map(c => c.name).join(", ")
                              : "Nenhuma lista selecionada"}
                          </Typography>
                          {values.tagListId !== "Nenhuma" && <Typography variant="caption" style={{ display: 'block', marginTop: 2, color: '#0369a1' }}>🎯 Filtro de Tag: {tagLists.find(t => t.id === values.tagListId)?.name}</Typography>}
                        </Box>

                        <Box mb={2}>
                          <Typography variant="caption" color="textSecondary">CONEXÃO PRINCIPAL</Typography>
                          <Typography variant="body2" style={{ fontWeight: 600 }}>{whatsapps.find(w => w.id === whatsappId)?.name || "Nenhuma"}</Typography>
                        </Box>

                        <Box mb={2}>
                          <Typography variant="caption" color="textSecondary">RODÍZIO (POOL)</Typography>
                          <Typography variant="body2" style={{ fontWeight: 600 }}>{dispatchStrategy === "single" ? "📱 Conexão Única" : `🎯 ${allowedWhatsappIds.length} conexões selecionadas`}</Typography>
                        </Box>

                        <Box mb={2}>
                          <Typography variant="caption" color="textSecondary">ATENDIMENTO</Typography>
                          <Typography variant="body2" style={{ fontWeight: 600 }}>
                            {values.openTicket === "enabled" ? "✅ Abre Ticket" : "❌ Apenas Mensagem"} 
                            {values.statusTicket && ` (${values.statusTicket.toUpperCase()})`}
                          </Typography>
                          <Typography variant="caption">{selectedQueue ? `Fila: ${queues.find(q => q.id === selectedQueue)?.name}` : "Sem fila definida"}</Typography>
                        </Box>

                        <Divider style={{ margin: "16px 0" }} />

                        <Box display="flex" justifyContent="space-between" mb={1}>
                          <Typography variant="caption" color="textSecondary">AGENDAMENTO</Typography>
                          <Typography variant="body2" style={{ fontWeight: 600, color: values.scheduledAt ? "#f97316" : "#005c53" }}>
                            {values.scheduledAt ? moment(values.scheduledAt).format("DD/MM [às] HH:mm") : "Imediato"}
                          </Typography>
                        </Box>

                        <Box display="flex" justifyContent="space-between" mb={1}>
                          <Typography variant="caption" color="textSecondary">FREQUÊNCIA ESTIMA.</Typography>
                          <Typography variant="body2" style={{ fontWeight: 600 }}>~80 msg/h</Typography>
                        </Box>
                      </Paper>
                    </Grid>
                   </>)}

                   {activeStep === 3 && (<>
                     <Grid item xs={12} md={7}>
                       <Paper className={classes.card}>
                         <Typography className={classes.stepTitle}>Compor Conteúdo</Typography>
                         <Typography className={classes.stepSub}>Personalize a experiência do seu cliente com textos, mídias ou templates oficiais.</Typography>
                         
                         {/* Templates Meta (API Oficial) - MOVED HERE */}
                         {(() => {
                           const selectedWhatsapp = whatsapps.find(w => w.id === whatsappId);
                           return selectedWhatsapp?.channelType === "official" ? (
                             <Box mb={3} p={2.5} style={{ backgroundColor: "#eff6ff", borderRadius: 16, border: "1px solid #bfdbfe" }}>
                               <Box display="flex" alignItems="center" mb={1} gap={1}>
                                 <Zap size={18} color="#1d4ed8" />
                                 <Typography variant="subtitle2" style={{ fontWeight: 700, color: "#1d4ed8" }}>WhatsApp Business API</Typography>
                               </Box>
                               <Box mb={2}>
                                 <Box display="flex" alignItems="center" mb={1} gap={0.5}>
                                   <label className={classes.label} style={{ marginBottom: 0 }}>Escolha um Template</label>
                                   <Tooltip title="Templates pré-aprovados pela Meta. Necessário para iniciar conversas oficiais."><InfoOutlinedIcon style={{ fontSize: 16, color: "#64748b", cursor: "pointer" }} /></Tooltip>
                                 </Box>
                                 <FormControl fullWidth variant="outlined" size="small">
                                   <Select value={selectedTemplate?.id || ""} onChange={(e) => {
                                       const template = availableTemplates.find(t => t.id === e.target.value);
                                       setSelectedTemplate(template);
                                       if (template?.components) {
                                         const body = template.components.find(c => c.type === "BODY");
                                         if (body?.text) setFieldValue("message1", body.text);
                                       }
                                       if (template) { setFieldValue("metaTemplateName", template.name); setFieldValue("metaTemplateLanguage", template.language); }
                                       else { setFieldValue("metaTemplateName", null); setFieldValue("metaTemplateLanguage", null); }
                                     }} disabled={loadingTemplates || !campaignEditable} displayEmpty>
                                     <MenuItem value=""><em>Nenhum (Mensagem Livre)</em></MenuItem>
                                     {availableTemplates.map(t => (<MenuItem key={t.id} value={t.id}>{t.name} ({t.language})</MenuItem>))}
                                   </Select>
                                   {loadingTemplates && <FormHelperText>Carregando templates...</FormHelperText>}
                                 </FormControl>
                               </Box>

                               {selectedTemplate && (
                                 <Box mt={2} p={2} style={{ backgroundColor: "#fff", borderRadius: 12, border: "1px solid #dbeafe" }}>
                                   <Typography variant="caption" style={{ fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", display: "block", marginBottom: 12 }}>Relacionar Variáveis do Template</Typography>
                                   <TemplateVariableMapper whatsappId={whatsappId} templateName={selectedTemplate.name} languageCode={selectedTemplate.language} value={metaTemplateVariables} 
                                     onChange={(val) => { setMetaTemplateVariables(val); setFieldValue("metaTemplateVariables", val); }} disabled={!campaignEditable} />
                                 </Box>
                               )}
                             </Box>
                           ) : null;
                         })()}

                         <Box display="flex" mb={2} style={{ borderBottom: "1px solid #f1f5f9" }}>
                           {[1,2,3,4,5].map((n,idx) => (
                             <Button key={n} className={`${classes.msgTab} ${messageTab === idx ? classes.msgTabActive : ""}`}
                               variant={messageTab === idx ? "contained" : "text"} onClick={() => setMessageTab(idx)}>Msg {n}</Button>
                           ))}
                         </Box>

                         {renderMessageField(`message${messageTab+1}`, setFieldValue, values, "Mensagem Principal")}
                         {renderTabAttachment(messageTab, values, !campaignEditable)}
                         
                         {/* Enviar anexo separado - NEW FROM SCREENSHOT */}
                         <Box display="flex" alignItems="center" mt={1} mb={2} p={1.5} style={{ backgroundColor: "#f8fafc", borderRadius: 12 }}>
                           <FormControlLabel control={<Checkbox checked={values.sendMediaSeparately} onChange={e => setFieldValue("sendMediaSeparately", e.target.checked)} color="primary" disabled={!campaignEditable} />}
                             label={<Box><Typography variant="body2" style={{ fontWeight: 600 }}>Enviar anexo separado</Typography><Typography variant="caption" color="textSecondary">Quando ativado, envia o texto e o anexo em mensagens separadas (2 mensagens). Quando desativado, envia o texto como legenda do anexo.</Typography></Box>}
                           />
                           <Tooltip title="Útil se o arquivo for muito grande ou se você quiser que o texto apareça antes do arquivo."><InfoOutlinedIcon style={{ fontSize: 16, color: "#64748b", marginLeft: 8 }} /></Tooltip>
                         </Box>

                         {values.confirmation && (<Box mt={3} p={2} style={{ border: "1px dashed #cbd5e1", borderRadius: 16 }}>
                           <Typography variant="subtitle2" style={{ fontWeight: 700, marginBottom: 8, color: "#475569" }}>Confirmação Requerida</Typography>
                           <Alert severity="warning" style={{ marginBottom: 16, fontSize: "0.75rem", borderRadius: 10 }}>Esta mensagem só será enviada para verificar a intenção do cliente.</Alert>
                           {renderMessageField(`confirmationMessage${messageTab+1}`, setFieldValue, values, "Conteúdo da Confirmação")}
                         </Box>)}
                       </Paper>
                     </Grid>
                     <Grid item xs={12} md={5}>
                       <Paper className={classes.sideCard}>
                         <Typography variant="h6" style={{ fontWeight: 700, marginBottom: 16 }}>Live Preview</Typography>
                         <WhatsAppPreview messages={[values[`message${messageTab+1}`], values.confirmation ? values[`confirmationMessage${messageTab+1}`] : null].filter(Boolean)} />
                       </Paper>
                     </Grid>
                   </>)}
                </Grid>
              </div>

               {/* Footer */}
               <div className={classes.footer}>
                 {/* Botões de controle da campanha - aparecem primeiro se campanha existente */}
                 {campaignId && (
                   <Box display="flex" style={{ gap: 8, marginRight: 'auto' }}>
                     {/* Retomar/Iniciar - para campanhas pausadas ou programadas */}
                     {(campaign.status === "CANCELADA" || campaign.status === "PROGRAMADA") && (
                       <Button
                         color="primary"
                         onClick={() => restartCampaign()}
                         variant="outlined"
                         startIcon={<PlayCircleOutlineIcon />}
                         className={classes.secondaryBtn}
                       >
                         {campaign.status === "CANCELADA" ? "Retomar" : "Iniciar"}
                       </Button>
                     )}
                     {/* Pausar - para campanhas em andamento */}
                     {campaign.status === "EM_ANDAMENTO" && (
                       <Button
                         color="secondary"
                         onClick={() => cancelCampaign()}
                         variant="outlined"
                         startIcon={<PauseCircleOutlineIcon />}
                         className={classes.secondaryBtn}
                       >
                         Pausar
                       </Button>
                     )}
                   </Box>
                 )}
                 
                 <Button variant="outlined" onClick={handleClose} className={classes.secondaryBtn} startIcon={<ArrowLeft size={16} />}>Voltar</Button>
                 
                 {/* Botões de navegação/salvar - só aparecem se campaignEditable ou status CANCELADA */}
                 {(campaignEditable || campaign.status === "CANCELADA") && (
                   <Box display="flex" style={{ gap: 8 }}>
                     {activeStep === 0 && (
                       <Button variant="contained" onClick={async () => { 
                         const isValid = await validateStepAndShowErrors(validateForm, values, whatsappId, selectedQueue, 0);
                         if (isValid) setActiveStep(1);
                       }} className={classes.primaryBtn} endIcon={<ChevronRight />}>PRÓXIMO PASSO</Button>
                     )}
                     {activeStep === 1 && (<>
                       <Button onClick={() => setActiveStep(0)} className={classes.secondaryBtn} startIcon={<ChevronLeft />}>Anterior</Button>
                       <Button variant="contained" onClick={async () => {
                         const isValid = await validateStepAndShowErrors(validateForm, values, whatsappId, selectedQueue, 1);
                         if (isValid) setActiveStep(2);
                       }} className={classes.primaryBtn} endIcon={<ChevronRight />}>PRÓXIMO PASSO</Button>
                     </>)}
                     {activeStep === 2 && (<>
                       <Button onClick={() => setActiveStep(1)} className={classes.secondaryBtn} startIcon={<ChevronLeft />}>Anterior</Button>
                       <Button variant="outlined" onClick={() => handleSaveOnly(values, setSubmitting)} className={classes.btnSave} startIcon={<SaveIcon />} disabled={isSubmitting}>Salvar Rascunho</Button>
                       <Button variant="contained" onClick={async () => {
                         const isValid = await validateStepAndShowErrors(validateForm, values, whatsappId, selectedQueue, 2);
                         if (isValid) setActiveStep(3);
                       }} className={classes.primaryBtn} endIcon={<ChevronRight />}>PRÓXIMO PASSO</Button>
                     </>)}
                     {activeStep === 3 && (<>
                       <Button onClick={() => setActiveStep(2)} className={classes.secondaryBtn} startIcon={<ChevronLeft />}>Anterior</Button>
                       <Button variant="outlined" onClick={() => handleSaveOnly(values, setSubmitting)} className={classes.btnSave} startIcon={<SaveIcon />} disabled={isSubmitting}>Salvar Rascunho</Button>
                       {/* Botão Programar Envio - salva e agenda para data/hora específica */}
                       <Button
                         variant="outlined"
                         disabled={isSubmitting || !values.scheduledAt}
                         onClick={async () => {
                           const isValid = await validateStepAndShowErrors(validateForm, values, whatsappId, selectedQueue, 3);
                           if (isValid) handleSaveOnly(values, setSubmitting);
                         }}
                         className={classes.btnSchedule}
                         startIcon={isSubmitting ? <CircularProgress size={16} /> : <AccessTimeIcon />}
                       >
                         Programar Envio
                       </Button>
                       {/* Botão Enviar Imediatamente - dispara imediatamente */}
                       <Button
                         variant="contained"
                         disabled={isSubmitting}
                         onClick={async (e) => {
                           e.preventDefault();
                           const isValid = await validateStepAndShowErrors(validateForm, values, whatsappId, selectedQueue, 3);
                           if (isValid) {
                             const form = e.target.closest('form');
                             if (form) form.requestSubmit();
                           }
                         }}
                         className={classes.btnSend}
                         startIcon={isSubmitting ? <CircularProgress size={16} /> : <SendIcon />}
                       >
                         {isSubmitting ? "Enviando..." : "Enviar Imediatamente"}
                       </Button>
                     </>)}
                   </Box>
                 )}
               </div>

              <ChatAssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)}
                onSelect={(text) => { const f = `message${messageTab+1}`; setFieldValue(f, (values[f]||"") + text); setAssistantOpen(false); }} />

              {/* Modal da Biblioteca de Arquivos */}
              <Dialog open={fileLibraryOpen} onClose={() => setFileLibraryOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="h6">Biblioteca de Arquivos</Typography>
                  <IconButton onClick={() => setFileLibraryOpen(false)}><DeleteOutlineIcon /></IconButton>
                </DialogTitle>
                <DialogContent dividers>
                  <Box style={{ height: 500, display: "flex", flexDirection: "column" }}>
                    <TopBar
                      viewMode={libraryViewMode}
                      onViewModeChange={setLibraryViewMode}
                      onUploadClick={() => setUploadModalOpen(true)}
                      searchValue={librarySearch}
                      onSearchChange={setLibrarySearch}
                    />
                    <BreadcrumbNav
                      breadcrumbs={libraryBreadcrumbs}
                      onNavigate={(index) => {
                        const target = libraryBreadcrumbs[index];
                        setLibraryCurrentFolder(target?.id || null);
                        setLibraryBreadcrumbs(libraryBreadcrumbs.slice(0, index + 1));
                      }}
                    />
                    <Box flex={1} overflow="auto" mt={2}>
                      {libraryViewMode === "list" ? (
                        <FolderList
                          folders={filterItemsBySearch(libraryFolders, librarySearch)}
                          files={filterItemsBySearch(libraryFiles, librarySearch)}
                          onFolderClick={(folder) => handleLibraryNavigateToFolder(folder)}
                          onFileClick={(file) => handleChooseFromLibrary(file)}
                          onMenuAction={(action, item) => { if (action === 'select') handleChooseFromLibrary(item); }}
                          selectedItems={[]}
                          onSelectItem={() => {}}
                          onSelectAll={() => {}}
                        />
                      ) : (
                        <FolderGrid
                          folders={filterItemsBySearch(libraryFolders, librarySearch)}
                          files={filterItemsBySearch(libraryFiles, librarySearch)}
                          onFolderClick={(folder) => handleLibraryNavigateToFolder(folder)}
                          onFileClick={(file) => handleChooseFromLibrary(file)}
                          onMenuAction={(action, item) => { if (action === 'select') handleChooseFromLibrary(item); }}
                          selectedItems={[]}
                          onSelectItem={() => {}}
                          onSelectAll={() => {}}
                        />
                      )}
                    </Box>
                  </Box>
                </DialogContent>
              </Dialog>

              <UploadModal
                open={uploadModalOpen}
                onClose={() => setUploadModalOpen(false)}
                currentFolder={libraryCurrentFolder}
                onUploadComplete={() => {
                  setUploadModalOpen(false);
                  toast.success("Arquivo enviado com sucesso!");
                }}
              />
            </Form>
          );
        }}
      </Formik>
    </MainContainer>
  );
};

export default CampaignForm;
