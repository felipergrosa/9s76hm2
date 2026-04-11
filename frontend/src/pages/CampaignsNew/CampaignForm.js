import React, { useState, useEffect, useRef, useContext, useMemo, useCallback } from "react";
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
  Accordion, AccordionSummary, AccordionDetails,
} from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import Autocomplete, { createFilterOptions } from "@material-ui/lab/Autocomplete";

import AttachFileIcon from "@material-ui/icons/AttachFile";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import SaveIcon from "@material-ui/icons/Save";
import AccessTimeIcon from "@material-ui/icons/AccessTime";
import { ChevronRight, ChevronLeft, ArrowLeft, Settings as SettingsIcon, Assignment as AssignmentIcon, Event as EventIcon, QuestionAnswer as QuestionAnswerIcon, Send as SendIcon, FlashOn as FlashOnIcon, PlayCircleOutline as PlayCircleOutlineIcon, PauseCircleOutline as PauseCircleOutlineIcon, Refresh as RefreshIcon, OpenInNew as OpenInNewIcon, ExpandMore as ExpandMoreIcon, HelpOutline as HelpOutlineIcon } from "@material-ui/icons";
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
  sideCardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: theme.spacing(2),
    textAlign: "left",
  },
  sideCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#f0fdfa",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  guideIntro: {
    color: "#64748b",
    fontSize: "0.9rem",
    lineHeight: 1.55,
    marginBottom: theme.spacing(2),
  },
  guideIntroRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1.25),
    marginBottom: theme.spacing(2),
  },
  guideIntroText: {
    color: "#64748b",
    fontSize: "0.9rem",
    lineHeight: 1.55,
    margin: 0,
    flex: 1,
  },
  guideIntroIcon: {
    color: "#0f766e",
    fontSize: 20,
    marginTop: 2,
    flexShrink: 0,
  },
  guideList: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
  },
  guideItem: {
    padding: theme.spacing(1.5),
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  guideItemTitle: {
    color: "#0f172a",
    fontSize: "0.86rem",
    fontWeight: 700,
    marginBottom: 4,
  },
  guideItemText: {
    color: "#64748b",
    fontSize: "0.82rem",
    lineHeight: 1.45,
  },
  guideFooter: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1.5),
    borderRadius: 14,
    backgroundColor: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#047857",
  },
  helpAccordion: {
    marginTop: theme.spacing(2),
    borderRadius: "14px !important",
    border: "1px solid #e2e8f0",
    boxShadow: "none",
    overflow: "hidden",
    "&:before": {
      display: "none",
    },
    "&.Mui-expanded": {
      marginTop: theme.spacing(2),
    },
  },
  helpAccordionSummary: {
    minHeight: 44,
    backgroundColor: "#f8fafc",
    "&.Mui-expanded": {
      minHeight: 44,
    },
    "& .MuiAccordionSummary-content": {
      margin: "10px 0",
      "&.Mui-expanded": {
        margin: "10px 0",
      },
    },
  },
  helpAccordionDetails: {
    display: "block",
    padding: theme.spacing(1.5),
    backgroundColor: "#fff",
  },
  helpAccordionSubtle: {
    marginTop: theme.spacing(1),
    borderRadius: "12px !important",
    border: "1px solid #edf2f7",
    backgroundColor: "#fafcfc",
    boxShadow: "none",
    overflow: "hidden",
    "&:before": {
      display: "none",
    },
    "&.Mui-expanded": {
      marginTop: theme.spacing(1),
    },
  },
  helpAccordionSummarySubtle: {
    minHeight: 38,
    padding: "0 10px",
    backgroundColor: "transparent",
    "&.Mui-expanded": {
      minHeight: 38,
    },
    "& .MuiAccordionSummary-content": {
      margin: "8px 0",
      "&.Mui-expanded": {
        margin: "8px 0",
      },
    },
  },
  negativeTagField: {
    "& .MuiOutlinedInput-root": {
      backgroundColor: "#fff1f2",
      borderRadius: 12,
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: "#fecdd3",
    },
    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: "#fb7185",
    },
    "& .MuiChip-root": {
      backgroundColor: "#ffe4e6",
      color: "#9f1239",
    },
  },
  tagExplainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: theme.spacing(1.5),
    marginTop: theme.spacing(1.5),
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "1fr",
    },
  },
  tagExplainPositive: {
    borderRadius: 12,
    padding: theme.spacing(1.5),
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e40af",
  },
  tagExplainNegative: {
    borderRadius: 12,
    padding: theme.spacing(1.5),
    backgroundColor: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#9f1239",
  },
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
    3: <QuestionAnswerIcon size={20} />,
    4: <EventIcon size={20} />
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

const STEPS = ["Configuração", "Regras", "Mensagem", "Confirmação"];
const META_TEMPLATE_MANAGER_URL = "https://business.facebook.com/wa/manage/message-templates";
const CAMPAIGN_ESTIMATE_DEFAULTS = {
  messageInterval: 20,
  longerIntervalAfter: 20,
  greaterInterval: 60,
  capHourly: 100,
  capDaily: 150,
  officialApiMessageInterval: 5,
  officialApiCapHourly: 1000,
  officialApiCapDaily: 10000,
};
const normalizeCampaignSettingValue = (value) => {
  if (value === null || value === undefined) return value;

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_) {
    return value;
  }
};

const getNumericSetting = (value, fallback) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

const getPositiveCap = (value) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.floor(parsedValue) : Infinity;
};

const getSelectedContactListIds = (values = {}) => {
  const ids = [];

  if (Array.isArray(values.contactListIds)) {
    ids.push(...values.contactListIds);
  }

  if (values.contactListId && values.contactListId !== "Nenhuma") {
    ids.push(values.contactListId);
  }

  return Array.from(new Set(ids.map(id => Number(id)).filter(Number.isFinite)));
};

const parseStoredIdArray = (value) => {
  if (value === null || value === undefined || value === "" || value === "Nenhuma") {
    return [];
  }

  let parsed = value;

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value.split(",");
    }
  }

  const values = Array.isArray(parsed) ? parsed : [parsed];

  return Array.from(new Set(
    values
      .map(item => Number(item))
      .filter(item => Number.isFinite(item) && item > 0)
  ));
};

const getTagNameById = (tagLists, tagId) => {
  const tag = (tagLists || []).find(item => Number(item?.id) === Number(tagId));
  return tag?.name || "";
};

const getTagNamesByIds = (tagLists, tagIds) => (
  parseStoredIdArray(tagIds)
    .map(tagId => getTagNameById(tagLists, tagId))
    .filter(Boolean)
);

const getContactListContactsCount = (contactList) => {
  const rawCount = contactList?.contactsCount
    ?? contactList?.contactCount
    ?? contactList?.count
    ?? contactList?.dataValues?.contactsCount
    ?? contactList?.contacts?.length
    ?? 0;
  const contactsCount = Number(rawCount);
  return Number.isFinite(contactsCount) ? contactsCount : 0;
};

const formatContactListOptionLabel = (contactList) => (
  contactList?.name ? `${contactList.name} (${getContactListContactsCount(contactList)})` : ""
);

const formatTagOption = (tag) => {
  const rawCount = tag?.contactCount ?? tag?.contactsCount ?? tag?.count ?? tag?.contacts?.length ?? 0;
  const contactCount = Number(rawCount);
  return {
    ...tag,
    id: tag.id,
    name: `${tag.name} (${Number.isFinite(contactCount) ? contactCount : 0})`,
  };
};

const formatEstimatedDuration = (totalSeconds) => {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "menos de 1 min";
  }

  if (totalSeconds < 60) {
    return `${Math.max(1, Math.ceil(totalSeconds))}s`;
  }

  const roundedSeconds = Math.max(60, Math.ceil(totalSeconds / 60) * 60);
  const days = Math.floor(roundedSeconds / 86400);
  const hours = Math.floor((roundedSeconds % 86400) / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const parts = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && parts.length < 2) parts.push(`${minutes}min`);

  if (parts.length === 0) {
    return "menos de 1 min";
  }

  return parts.join(" ");
};

const getConnectionEstimateSettings = (connection, settings) => {
  const isOfficial = connection?.channelType === "official";

  if (isOfficial) {
    const messageInterval = Math.max(0, getNumericSetting(settings.officialApiMessageInterval, CAMPAIGN_ESTIMATE_DEFAULTS.officialApiMessageInterval));
    const hourlyCap = getPositiveCap(settings.officialApiCapHourly ?? CAMPAIGN_ESTIMATE_DEFAULTS.officialApiCapHourly);
    const dailyCap = getPositiveCap(settings.officialApiCapDaily ?? CAMPAIGN_ESTIMATE_DEFAULTS.officialApiCapDaily);
    const paceHourlyRate = messageInterval > 0 ? 3600 / messageInterval : hourlyCap;

    return {
      isOfficial,
      messageInterval,
      longerIntervalAfter: 0,
      greaterInterval: 0,
      hourlyCap,
      dailyCap,
      paceHourlyRate: Number.isFinite(paceHourlyRate) ? paceHourlyRate : 0,
    };
  }

  const messageInterval = Math.max(0, getNumericSetting(settings.messageInterval, CAMPAIGN_ESTIMATE_DEFAULTS.messageInterval));
  const longerIntervalAfter = Math.max(0, getNumericSetting(settings.longerIntervalAfter, CAMPAIGN_ESTIMATE_DEFAULTS.longerIntervalAfter));
  const greaterInterval = Math.max(0, getNumericSetting(settings.greaterInterval, CAMPAIGN_ESTIMATE_DEFAULTS.greaterInterval));
  const hourlyCap = getPositiveCap(settings.capHourly ?? CAMPAIGN_ESTIMATE_DEFAULTS.capHourly);
  const dailyCap = getPositiveCap(settings.capDaily ?? CAMPAIGN_ESTIMATE_DEFAULTS.capDaily);
  const paceHourlyRate = longerIntervalAfter > 0
    ? (3600 * longerIntervalAfter) / ((longerIntervalAfter * messageInterval) + greaterInterval)
    : (messageInterval > 0 ? 3600 / messageInterval : hourlyCap);

  return {
    isOfficial,
    messageInterval,
    longerIntervalAfter,
    greaterInterval,
    hourlyCap,
    dailyCap,
    paceHourlyRate: Number.isFinite(paceHourlyRate) ? paceHourlyRate : 0,
  };
};

const estimateBatchDurationSeconds = (count, estimateSettings) => {
  if (count <= 0) return 0;

  const intervalDuration = count * estimateSettings.messageInterval;
  const longPauseCount = estimateSettings.longerIntervalAfter > 0
    ? Math.floor((count - 1) / estimateSettings.longerIntervalAfter)
    : 0;

  return intervalDuration + (longPauseCount * estimateSettings.greaterInterval);
};

const getEffectiveWindowCap = (cap, windowSeconds, estimateSettings) => {
  if (!Number.isFinite(cap)) return Infinity;

  const durationToReachCap = estimateBatchDurationSeconds(cap, estimateSettings);
  return durationToReachCap < windowSeconds ? cap : Infinity;
};

const estimateConnectionDurationSeconds = (contactCount, estimateSettings) => {
  if (contactCount <= 0) return 0;

  const hourlyCap = getEffectiveWindowCap(estimateSettings.hourlyCap, 3600, estimateSettings);
  const dailyCap = getEffectiveWindowCap(estimateSettings.dailyCap, 86400, estimateSettings);
  let remaining = contactCount;
  let elapsed = 0;
  let sentToday = 0;

  while (remaining > 0) {
    const remainingToday = Number.isFinite(dailyCap) ? Math.max(0, dailyCap - sentToday) : remaining;

    if (remainingToday <= 0) {
      elapsed = Math.max(elapsed, Math.ceil(elapsed / 86400) * 86400);
      sentToday = 0;
      continue;
    }

    const batchLimit = Math.min(remaining, remainingToday, Number.isFinite(hourlyCap) ? hourlyCap : remaining);
    const batchDuration = estimateBatchDurationSeconds(batchLimit, estimateSettings);
    elapsed += batchDuration;
    remaining -= batchLimit;
    sentToday += batchLimit;

    if (remaining <= 0) break;

    if (Number.isFinite(dailyCap) && sentToday >= dailyCap) {
      elapsed = Math.max(elapsed, Math.ceil(elapsed / 86400) * 86400);
      sentToday = 0;
      continue;
    }

    if (Number.isFinite(hourlyCap) && batchLimit >= hourlyCap) {
      elapsed = Math.max(elapsed, Math.ceil(elapsed / 3600) * 3600);
    }
  }

  return elapsed;
};

// Função para validar e mostrar erros com SweetAlert2 (por step)
const validateStepAndShowErrors = async (validateForm, values, whatsappId, selectedQueue, currentStep, isOfficialConnection = false) => {
  const errors = await validateForm();
  
  // Definir quais campos pertencem a cada step
  const stepFields = {
    0: ["name", "contactListId", "contactListIds", "whatsappId", "tagListId", "negativeTagListIds"],
    1: ["openTicket", "statusTicket", "queueId", "confirmation"],
    2: ["message1", "message2", "message3", "message4", "message5", "metaTemplateName"],
    3: ["scheduledAt"],
  };
  
  // Mapear campos para labels
  const FIELD_LABELS = {
    name: "Nome da Campanha",
    contactListId: "Lista de Contatos",
    tagListId: "Tags positivas",
    negativeTagListIds: "Tags negativas",
    whatsappId: "Conexão WhatsApp",
    message1: "Mensagem 1",
    metaTemplateName: "Template oficial",
    scheduledAt: "Data de Agendamento",
    openTicket: "Abrir Ticket",
    statusTicket: "Status do Ticket",
    queueId: "Fila (Departamento)",
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
    // Step 3 (Mensagem) - validações
    if (isOfficialConnection) {
      if (!values.metaTemplateName) {
        customErrors.metaTemplateName = "Selecione um template oficial";
      }
    } else {
      if (!values.message1 || values.message1.trim() === "") {
        customErrors.message1 = "A mensagem 1 é obrigatória";
      }
      // Validação de tamanho máximo
      if (values.message1 && values.message1.length > 1024) {
        customErrors.message1 = "A mensagem 1 deve ter no máximo 1024 caracteres";
      }
    }
  }

  if (currentStep === 3) {
    // Step 4 (Confirmação/Agendamento) - validação
    if (values.scheduledAt) {
      const scheduledDate = moment(values.scheduledAt);
      const now = moment();
      if (scheduledDate.isBefore(now)) {
        customErrors.scheduledAt = "A data de agendamento deve ser futura";
      }
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
    
    const stepNames = ["Configuração", "Regras", "Mensagem", "Confirmação"];
    
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
    contactListId: "", contactListIds: [], tagListId: "Nenhuma", negativeTagListIds: [], companyId,
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
  const [campaignSettings, setCampaignSettings] = useState(CAMPAIGN_ESTIMATE_DEFAULTS);

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
    let active = true;

    api.get("/campaign-settings")
      .then(({ data }) => {
        if (!active || !Array.isArray(data)) return;

        const normalizedSettings = data.reduce((acc, item) => {
          acc[item.key] = normalizeCampaignSettingValue(item.value);
          return acc;
        }, {});

        setCampaignSettings(prev => ({
          ...prev,
          ...normalizedSettings
        }));
      })
      .catch((error) => {
        if (error?.response?.status !== 403) {
          toastError(error);
        }
      });

    return () => { active = false; };
  }, []);

  const loadAllContactLists = useCallback(async () => {
    const allRecords = [];
    let pageNumber = 1;
    let hasMore = true;

    while (hasMore) {
      const { data } = await api.get("/contact-lists", {
        params: { pageNumber }
      });

      const records = Array.isArray(data?.records) ? data.records : [];
      allRecords.push(...records);
      hasMore = Boolean(data?.hasMore);
      pageNumber += 1;
    }

    return allRecords;
  }, []);

  useEffect(() => {
    if (!isMounted.current) return;
    (async () => {
      try {
        const [clRes, waRes, tagRes] = await Promise.all([
          loadAllContactLists(),
          api.get("/whatsapp", { params: { companyId, session: 0 } }),
          api.get("/tags/list", { params: { companyId, kanban: 0 } }),
        ]);
        setContactLists(clRes || []);
        setWhatsapps((waRes.data || []).map(w => ({ ...w, selected: false })));
        setTagLists((tagRes.data || []).map(formatTagOption));

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
          
          if (!data?.tagListId || data.tagListId === null || data.tagListId === "" || data.tagListId === undefined) {
            prev.tagListId = "Nenhuma";
          } else {
            prev.tagListId = String(data.tagListId);
          }
          prev.negativeTagListIds = parseStoredIdArray(data?.negativeTagListIds);
          
          // Copiar demais campos, mas NÃO sobrescrever campos normalizados acima
          Object.entries(data).forEach(([k,v]) => { 
            if (k !== "tagListId" && k !== "negativeTagListIds") {
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
          // Fallback: se tem contactListId mas nao tem contactListIds, preencher contactListIds
          if (!prev.contactListIds && data?.contactListId) {
            prev.contactListIds = [data.contactListId];
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
  }, [campaignId, companyId, loadAllContactLists]);

  useEffect(() => {
    const now = moment(); const s = moment(campaign.scheduledAt);
    const ok = campaign.status === "INATIVA" || campaign.status === "CANCELADA" || (campaign.status === "PROGRAMADA" && s.diff(now,"hour") > 1);
    setCampaignEditable(ok);
  }, [campaign.status, campaign.scheduledAt]);

  const loadOfficialTemplates = useCallback(async (targetWhatsappId, options = {}) => {
    const { showSuccessToast = false } = options;

    if (!targetWhatsappId) {
      setAvailableTemplates([]);
      return [];
    }

    setLoadingTemplates(true);

    try {
      const [{ data: templatesData }, { data: whatsappData }] = await Promise.all([
        api.get(`/whatsapp/${targetWhatsappId}/templates`),
        api.get(`/whatsapp/${targetWhatsappId}`)
      ]);

      const allTemplates = templatesData.templates || [];
      const allowedTemplates = whatsappData.allowedTemplates;
      const filteredTemplates = allowedTemplates?.length
        ? allTemplates.filter(template => allowedTemplates.includes(template.id))
        : allTemplates;

      setAvailableTemplates(filteredTemplates);

      if (showSuccessToast) {
        toast.success(`Lista atualizada: ${filteredTemplates.length} template(s) carregado(s).`);
      }

      return filteredTemplates;
    } catch (error) {
      toastError(error);
      return [];
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (!whatsappId) { setAvailableTemplates([]); return; }
    const wa = whatsapps.find(w => w.id === whatsappId);
    if (wa?.channelType !== "official") { setAvailableTemplates([]); setSelectedTemplate(null); return; }
    loadOfficialTemplates(whatsappId);
  }, [whatsappId, whatsapps, loadOfficialTemplates]);

  useEffect(() => {
    const wa = whatsapps.find(w => w.id === whatsappId);
    if (wa?.channelType === "official" && messageTab !== 0) {
      setMessageTab(0);
    }
  }, [whatsappId, whatsapps, messageTab]);

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

  const buildCampaignDeliveryEstimate = (values) => {
    const selectedListIds = getSelectedContactListIds(values);
    const totalContacts = selectedListIds.reduce((sum, listId) => {
      const list = (contactLists || []).find(item => Number(item?.id) === Number(listId));
      return sum + getContactListContactsCount(list);
    }, 0);

    const poolIds = dispatchStrategy === "round_robin" && Array.isArray(allowedWhatsappIds) && allowedWhatsappIds.length > 0
      ? allowedWhatsappIds
      : (whatsappId ? [whatsappId] : []);

    const selectedConnections = Array.from(new Set(poolIds.map(id => Number(id)).filter(Number.isFinite)))
      .map(id => (whatsapps || []).find(item => Number(item?.id) === id))
      .filter(Boolean);

    const connectionEstimates = selectedConnections.map((connection, index) => {
      const estimateSettings = getConnectionEstimateSettings(connection, campaignSettings);
      const baseShare = Math.floor(totalContacts / selectedConnections.length);
      const extraContact = index < (totalContacts % selectedConnections.length) ? 1 : 0;
      const assignedContacts = selectedConnections.length > 0 ? baseShare + extraContact : 0;

      return {
        ...estimateSettings,
        assignedContacts,
        durationSeconds: estimateConnectionDurationSeconds(assignedContacts, estimateSettings),
      };
    });

    const estimatedDurationSeconds = connectionEstimates.reduce(
      (maxDuration, item) => Math.max(maxDuration, item.durationSeconds),
      0
    );
    const paceHourlyRate = connectionEstimates.reduce((sum, item) => sum + item.paceHourlyRate, 0);
    const hourlyCap = connectionEstimates.reduce((sum, item) => {
      if (!Number.isFinite(item.hourlyCap)) return sum;
      return sum + item.hourlyCap;
    }, 0);

    return {
      totalContacts,
      connectionCount: selectedConnections.length,
      hourlyRate: paceHourlyRate,
      hourlyCap,
      estimatedDurationSeconds,
      hasTagFilter: (values?.tagListId && values.tagListId !== "Nenhuma") || parseStoredIdArray(values?.negativeTagListIds).length > 0,
    };
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
      // Preencher contactListId com o primeiro ID de contactListIds para compatibilidade com backend
      const firstListId = Array.isArray(values.contactListIds) && values.contactListIds.length > 0 ? values.contactListIds[0] : null;
      const contactListId = firstListId || values.contactListId || null;
      // Process tagListId: "Nenhuma" → null, string → number
      const tagListId = values.tagListId === "Nenhuma" ? null : (values.tagListId ? Number(values.tagListId) : null);
      const negativeTagIds = parseStoredIdArray(values.negativeTagListIds);
      const negativeTagListIds = negativeTagIds.length > 0 ? JSON.stringify(negativeTagIds) : null;
      const dv = { ...processed, whatsappId, userId, userIds, contactListIds, contactListId, queueId: selectedQueue || null, dispatchStrategy, allowedWhatsappIds, metaTemplateVariables, tagListId, negativeTagListIds };
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
      // Preencher contactListId com o primeiro ID de contactListIds para compatibilidade com backend
      const firstListId = Array.isArray(values.contactListIds) && values.contactListIds.length > 0 ? values.contactListIds[0] : null;
      const contactListId = firstListId || values.contactListId || null;
      // Process tagListId: "Nenhuma" → null, string → number
      const tagListId = values.tagListId === "Nenhuma" ? null : (values.tagListId ? Number(values.tagListId) : null);
      const negativeTagIds = parseStoredIdArray(values.negativeTagListIds);
      const negativeTagListIds = negativeTagIds.length > 0 ? JSON.stringify(negativeTagIds) : null;
      const dv = { ...processed, whatsappId, userId: selectedUsers.length === 1 ? selectedUsers[0].id : null, userIds, contactListIds, contactListId, queueId: selectedQueue || null, dispatchStrategy, allowedWhatsappIds, metaTemplateVariables, tagListId, negativeTagListIds };
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

  const renderMessageField = (identifier, setFieldValue, values, label = "Conteúdo da Mensagem", options = {}) => (
    (() => {
      const fieldDisabled = typeof options.disabled === "boolean"
        ? options.disabled
        : (!campaignEditable && campaign.status !== "CANCELADA");
      const tooltipText = options.tooltip || (label.includes("Confirmação")
        ? "Mensagem reservada para validar a intenção do cliente, caso a opção de Confirmação esteja ativa no Passo 2."
        : "O texto que seu cliente receberá. Use as tags no botão abaixo para personalizar com o nome do contato, etc.");

      return (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Box display="flex" alignItems="center" gap={0.5}>
          <Typography variant="subtitle2" style={{ fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: 0.5, color: "#64748b" }}>
            {label}
          </Typography>
          <Tooltip title={tooltipText}>
            <InfoOutlinedIcon style={{ fontSize: 13, color: "#94a3b8", cursor: "pointer" }} />
          </Tooltip>
        </Box>
        <Typography variant="caption" color="textSecondary">
          {(values[identifier] || "").length} / 1024 caracteres
        </Typography>
      </Box>
      <Box display="flex" alignItems="center" style={{ gap: 4 }} mb={1}>
        <Tooltip title="Tags"><IconButton size="small" onClick={(e) => { setTagsTargetField(identifier); handleOpenTags(e); }} disabled={fieldDisabled}><LocalOfferIcon fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Emoji">
          <WhatsAppPopover onSelectEmoji={(emoji) => handleEmojiSelect(identifier, emoji, setFieldValue, values)} disabled={fieldDisabled}>
            <IconButton size="small" disabled={fieldDisabled}><Smile size={16} /></IconButton>
          </WhatsAppPopover>
        </Tooltip>
        <Tooltip title="Assistente IA"><IconButton size="small" onClick={() => setAssistantOpen(true)} disabled={fieldDisabled}><Sparkles size={16} /></IconButton></Tooltip>
        <Tooltip title="Info"><IconButton size="small" onClick={handleOpenInfo} disabled={fieldDisabled}><InfoOutlinedIcon fontSize="small" /></IconButton></Tooltip>
      </Box>
      <FormattedTextField
        id={identifier} value={values[identifier] || ""} onChange={(e) => setFieldValue(identifier, e.target.value)}
        placeholder="Olá {nome}! 👋 Escreva sua mensagem aqui..." rows={6}
        disabled={fieldDisabled}
      />
    </>
      );
    })()
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
          const selectedWhatsapp = whatsapps.find(w => w.id === whatsappId);
          const isOfficialConnection = selectedWhatsapp?.channelType === "official";
          const currentMessageField = `message${messageTab + 1}`;
          const currentConfirmationField = `confirmationMessage${messageTab + 1}`;
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
                                  getOptionLabel={formatContactListOptionLabel}
                                  value={(contactLists || []).filter(cl => getSelectedContactListIds(values).includes(Number(cl?.id)))}
                                  onChange={(e, nv) => setFieldValue("contactListIds", (nv || []).map(cl => cl?.id))}
                                  disabled={!campaignEditable}
                                  renderTags={(value, getTagProps) =>
                                    (value || []).map((option, index) => (
                                      <Chip key={option?.id || index} label={formatContactListOptionLabel(option)} size="small" {...getTagProps({ index })} />
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

                         <Grid container spacing={2} style={{ marginTop: 24 }}>
                           <Grid item xs={12} md={6}>
                             <Box display="flex" alignItems="center" mb={1} gap={0.5}>
                               <label className={classes.label} style={{ marginBottom: 0 }}>Tags positivas (incluir)</label>
                               <Tooltip title="Envia APENAS para contatos das listas que possuam esta tag. Se ficar como Nenhuma, todos os contatos das listas entram no público."><InfoOutlinedIcon style={{ fontSize: 16, color: "#64748b", cursor: "pointer" }} /></Tooltip>
                             </Box>
                             <FormControl variant="outlined" fullWidth className={classes.formField}>
                               <Select name="tagListId" value={values.tagListId||"Nenhuma"} onChange={e => setFieldValue("tagListId", e.target.value)} disabled={!campaignEditable}>
                                 <MenuItem value="Nenhuma">Nenhuma</MenuItem>
                                 {tagLists.map(t => <MenuItem key={t.id} value={String(t.id)}>{t.name}</MenuItem>)}
                               </Select>
                             </FormControl>
                           </Grid>

                           <Grid item xs={12} md={6}>
                             <Box display="flex" alignItems="center" mb={1} gap={0.5}>
                               <label className={classes.label} style={{ marginBottom: 0, color: "#9f1239" }}>Tags negativas (excluir)</label>
                               <Tooltip title="Remove do envio qualquer contato que possua uma das tags negativas selecionadas, mesmo que ele esteja nas listas ou na tag positiva."><InfoOutlinedIcon style={{ fontSize: 16, color: "#be123c", cursor: "pointer" }} /></Tooltip>
                             </Box>
                             <Box className={`${classes.autoCompleteField} ${classes.negativeTagField}`}>
                               <Autocomplete
                                 multiple
                                 options={tagLists || []}
                                 getOptionLabel={(option) => option?.name || ""}
                                 value={(tagLists || []).filter(tag => parseStoredIdArray(values.negativeTagListIds).includes(Number(tag.id)))}
                                 onChange={(e, nv) => setFieldValue("negativeTagListIds", (nv || []).map(tag => Number(tag.id)))}
                                 disabled={!campaignEditable}
                                 renderTags={(value, getTagProps) =>
                                   (value || []).map((option, index) => (
                                     <Chip key={option?.id || index} label={option?.name || ""} size="small" {...getTagProps({ index })} />
                                   ))
                                 }
                                 renderInput={(params) => (
                                   <TextField {...params} variant="outlined" placeholder="Selecionar tags para excluir..." fullWidth />
                                 )}
                               />
                             </Box>
                           </Grid>
                         </Grid>

                         <Box className={classes.tagExplainGrid}>
                           <Box className={classes.tagExplainPositive}>
                             <Typography variant="caption" style={{ fontWeight: 700 }}>Tags positivas</Typography>
                             <Typography variant="body2">Limitam o público: só entra quem estiver nas listas selecionadas e também possuir a tag escolhida.</Typography>
                           </Box>
                           <Box className={classes.tagExplainNegative}>
                             <Typography variant="caption" style={{ fontWeight: 700 }}>Tags negativas</Typography>
                             <Typography variant="body2">Removem contatos do público: se o contato tiver qualquer tag negativa selecionada, a campanha não será enviada para ele.</Typography>
                           </Box>
                         </Box>

                         <Box className={classes.tipBox} mt={3}>
                           <InfoOutlinedIcon style={{ color: "#059669", marginTop: 2 }} />
                           <Typography variant="body2" style={{ color: "#065f46" }}>Tickets existentes receberão a mensagem. Certifique-se de que os limites da conexão suportam envio em massa.</Typography>
                         </Box>
                       </Paper>
                     </Grid>
                     <Grid item xs={12} md={5} style={{ display: "flex", alignItems: "flex-start" }}>
                       <Paper className={classes.sideCard} style={{ width: "100%", top: 0 }}>
                         <Box className={classes.sideCardHeader}>
                           <Box className={classes.sideCardIcon}>
                             <Settings size={32} color="#005c53" />
                           </Box>
                           <Box>
                             <Typography variant="overline" style={{ color: "#0f766e", fontWeight: 700, letterSpacing: 0.7 }}>Primeira Etapa</Typography>
                             <Typography variant="h6" style={{ fontWeight: 800, color: "#005c53", lineHeight: 1.2 }}>Configuração da campanha</Typography>
                           </Box>
                         </Box>

                         <Box className={classes.guideIntroRow}>
                           <HelpOutlineIcon className={classes.guideIntroIcon} />
                           <Typography className={classes.guideIntroText}>
                             Preencha estes dados antes de avançar. Eles definem o público, o canal de envio e alimentam o resumo com a estimativa da campanha.
                           </Typography>
                         </Box>

                         <Box className={classes.guideList}>
                           <Box className={classes.guideItem}>
                             <Typography className={classes.guideItemTitle}>Nome da Campanha</Typography>
                             <Typography className={classes.guideItemText}>Use um nome interno fácil de localizar depois, como objetivo, público e data da ação.</Typography>
                           </Box>
                           <Box className={classes.guideItem}>
                             <Typography className={classes.guideItemTitle}>Listas de Contatos</Typography>
                             <Typography className={classes.guideItemText}>Selecione uma ou mais listas. A quantidade total de contatos será somada para calcular o público e a estimativa de envio.</Typography>
                           </Box>
                           <Box className={classes.guideItem}>
                             <Typography className={classes.guideItemTitle}>Conexão</Typography>
                             <Typography className={classes.guideItemText}>Escolha o WhatsApp remetente. API Oficial usa templates e limites Meta; Baileys usa os intervalos e limites configurados para Baileys.</Typography>
                           </Box>
                           <Box className={classes.guideItem}>
                             <Typography className={classes.guideItemTitle}>Tags positivas e negativas</Typography>
                             <Typography className={classes.guideItemText}>A tag positiva reduz o público para quem deve receber. As tags negativas são uma lista de exclusão e impedem o envio para contatos marcados com elas.</Typography>
                           </Box>
                         </Box>

                         <Box className={classes.guideFooter}>
                           <Typography variant="body2" style={{ fontWeight: 600 }}>
                             Antes de continuar, confirme se a conexão está ativa e se as listas possuem números válidos.
                           </Typography>
                         </Box>
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

                           {/* Linha 2: Fila (Departamento) | Usuários */}
                           <Grid item xs={12} md={6}>
                             <Box display="flex" alignItems="center" mb={1} gap={0.5}>
                               <label className={classes.label} style={{ marginBottom: 0 }}>Fila (Departamento)</label>
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
                               <Tooltip title="Quais atendentes ficarão responsáveis pelo atendimento quando houver resposta ou ticket vinculado."><InfoOutlinedIcon style={{ fontSize: 16, color: "#64748b", cursor: "pointer" }} /></Tooltip>
                             </Box>
                             <Box className={classes.autoCompleteField}>
                               <Autocomplete multiple options={options || []} getOptionLabel={o => o?.name || ""} value={selectedUsers || []} openOnFocus onOpen={ensureUsersLoaded}
                                 onChange={(e, nv) => { setSelectedUsers(nv||[]); if (nv?.length === 1 && nv[0]?.queues) { setQueues(nv[0].queues); if(nv[0].queues?.length===1) setSelectedQueue(nv[0].queues[0]?.id); } else { setQueues(allQueues); if(!nv?.length) setSelectedQueue(""); } }}
                                 filterOptions={filterOptions} disabled={!campaignEditable} loading={loading}
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
                     <Grid item xs={12} md={5} style={{ display: "flex", alignItems: "flex-start" }}>
                       <Paper className={classes.sideCard} style={{ width: "100%", top: 0 }}>
                         <Box className={classes.sideCardHeader}>
                           <Box className={classes.sideCardIcon}>
                             <AssignmentIcon style={{ fontSize: 30, color: "#005c53" }} />
                           </Box>
                           <Box>
                             <Typography variant="overline" style={{ color: "#0f766e", fontWeight: 700, letterSpacing: 0.7 }}>Segunda Etapa</Typography>
                             <Typography variant="h6" style={{ fontWeight: 800, color: "#005c53", lineHeight: 1.2 }}>Regras de atendimento</Typography>
                           </Box>
                         </Box>

                         <Box className={classes.guideIntroRow}>
                           <HelpOutlineIcon className={classes.guideIntroIcon} />
                           <Typography className={classes.guideIntroText}>
                             Configure como os tickets serão criados, para onde as respostas serão enviadas e como o disparo deve usar as conexões disponíveis.
                           </Typography>
                         </Box>

                         <Box className={classes.guideList}>
                           <Box className={classes.guideItem}>
                             <Typography className={classes.guideItemTitle}>Abrir Ticket</Typography>
                             <Typography className={classes.guideItemText}>Habilitado cria o ticket imediatamente. Desabilitado envia a campanha sem abrir atendimento agora e só organiza a conversa quando houver resposta.</Typography>
                           </Box>
                           <Box className={classes.guideItem}>
                             <Typography className={classes.guideItemTitle}>Status do Ticket</Typography>
                             <Typography className={classes.guideItemText}>Define se o ticket nascerá fechado, pendente ou aberto. Este campo só vale quando a abertura de ticket estiver habilitada.</Typography>
                           </Box>
                           <Box className={classes.guideItem}>
                             <Typography className={classes.guideItemTitle}>Fila e Usuários</Typography>
                             <Typography className={classes.guideItemText}>Escolha o departamento e os atendentes responsáveis por receber as respostas. Sem fila definida, o atendimento pode ficar sem roteamento claro.</Typography>
                           </Box>
                           <Box className={classes.guideItem}>
                             <Typography className={classes.guideItemTitle}>Estratégia de Envio</Typography>
                             <Typography className={classes.guideItemText}>Única conexão usa apenas o WhatsApp principal. Rodízio distribui os envios entre as conexões selecionadas para respeitar limites e reduzir concentração.</Typography>
                           </Box>
                           <Box className={classes.guideItem}>
                             <Typography className={classes.guideItemTitle}>Confirmação</Typography>
                             <Typography className={classes.guideItemText}>Quando habilitada, a campanha pode enviar uma mensagem de confirmação antes de encaminhar o cliente para o fluxo de atendimento.</Typography>
                           </Box>
                         </Box>

                         {allowedWhatsappIds.length > 1 && (
                           <Box mt={2}>
                             <Paper variant="outlined" style={{ padding: 12, borderRadius: 12, backgroundColor: "#f8fafc" }}>
                               <Typography variant="body2" style={{ fontWeight: 700 }}>{allowedWhatsappIds.length} conexões selecionadas</Typography>
                               <Typography variant="caption" color="textSecondary">As mensagens serão distribuídas entre estes canais conforme a estratégia escolhida.</Typography>
                             </Paper>
                           </Box>
                         )}

                         <Box className={classes.guideFooter}>
                           <Typography variant="body2" style={{ fontWeight: 600 }}>
                             {values.openTicket === "disabled"
                               ? "Otimização ativa: a campanha envia sem abrir tickets imediatamente."
                               : "Confirme fila, usuários e status antes de avançar para a mensagem."}
                           </Typography>
                         </Box>
                       </Paper>
                     </Grid>
                   </>)}

                  {/* ═══ STEP 3: Confirmação / Agendamento ═══ */}
                  {activeStep === 3 && (<>
                    <Grid item xs={12} md={7}>
                      <Paper className={classes.card}>
                        <Typography className={classes.stepTitle}>Confirmação da Campanha</Typography>
                        <Typography className={classes.stepSub}>Revise a estratégia e defina quando os disparos devem iniciar.</Typography>
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
                      {(() => {
                        const selectedListIds = getSelectedContactListIds(values);
                        const selectedListNames = contactLists
                          .filter(c => selectedListIds.includes(Number(c?.id)))
                          .map(c => c.name);
                        const positiveTagName = values.tagListId !== "Nenhuma"
                          ? getTagNameById(tagLists, values.tagListId)
                          : "";
                        const negativeTagNames = getTagNamesByIds(tagLists, values.negativeTagListIds);
                        const deliveryEstimate = buildCampaignDeliveryEstimate(values);
                        const frequencyLabel = deliveryEstimate.hourlyRate > 0
                          ? `~${Math.max(1, Math.round(deliveryEstimate.hourlyRate))} msg/h`
                          : "Defina uma conexão";
                        const isHourlyCapLowerThanPace = deliveryEstimate.hourlyCap > 0 && deliveryEstimate.hourlyCap < deliveryEstimate.hourlyRate;
                        const estimateDetail = deliveryEstimate.totalContacts > 0 && deliveryEstimate.hourlyRate > 0
                          ? `${deliveryEstimate.totalContacts} contato(s) • conclusão em ~${formatEstimatedDuration(deliveryEstimate.estimatedDurationSeconds)}`
                          : (selectedListIds.length > 0
                            ? `${deliveryEstimate.totalContacts} contato(s) na(s) lista(s)`
                            : "Selecione uma lista para estimar");

                        return (
                          <Paper className={classes.sideCard}>
                            <Typography variant="h6" style={{ fontWeight: 700, marginBottom: 16 }}>📊 Resumo da Estratégia</Typography>

                            <Box mb={2}>
                              <Typography variant="caption" color="textSecondary">CAMPANHA</Typography>
                              <Typography variant="body2" style={{ fontWeight: 600 }}>{values.name || "N/A"}</Typography>
                            </Box>

                            <Box mb={2}>
                              <Typography variant="caption" color="textSecondary">PÚBLICO ALVO</Typography>
                              <Typography variant="body2" style={{ fontWeight: 600 }}>
                                {selectedListNames.length > 0 ? selectedListNames.join(", ") : "Nenhuma lista selecionada"}
                              </Typography>
                              {positiveTagName && <Typography variant="caption" style={{ display: "block", marginTop: 2, color: "#0369a1" }}>Tag positiva: {positiveTagName}</Typography>}
                              {negativeTagNames.length > 0 && <Typography variant="caption" style={{ display: "block", marginTop: 2, color: "#be123c" }}>Tags negativas: {negativeTagNames.join(", ")}</Typography>}
                            </Box>

                            <Box mb={2}>
                              <Typography variant="caption" color="textSecondary">CONEXÃO PRINCIPAL</Typography>
                              <Typography variant="body2" style={{ fontWeight: 600 }}>{whatsapps.find(w => w.id === whatsappId)?.name || "Nenhuma"}</Typography>
                            </Box>

                            <Box mb={2}>
                              <Typography variant="caption" color="textSecondary">RODÍZIO (POOL)</Typography>
                              <Typography variant="body2" style={{ fontWeight: 600 }}>
                                {dispatchStrategy === "single"
                                  ? "📱 Conexão Única"
                                  : `🎯 ${deliveryEstimate.connectionCount || allowedWhatsappIds.length} conexões selecionadas`}
                              </Typography>
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

                            <Box display="flex" justifyContent="space-between" mb={0.5}>
                              <Typography variant="caption" color="textSecondary">FREQUÊNCIA ESTIMA.</Typography>
                              <Typography variant="body2" style={{ fontWeight: 600 }}>{frequencyLabel}</Typography>
                            </Box>

                            <Typography variant="caption" style={{ display: "block", color: "#475569" }}>
                              {estimateDetail}
                            </Typography>

                            {isHourlyCapLowerThanPace && (
                              <Typography variant="caption" style={{ display: "block", marginTop: 4, color: "#475569" }}>
                                Limite configurado: {deliveryEstimate.hourlyCap} msg/h. O intervalo define o ritmo ate esse limite ser atingido.
                              </Typography>
                            )}

                            {deliveryEstimate.hasTagFilter && (
                              <Typography variant="caption" style={{ display: "block", marginTop: 4, color: "#475569" }}>
                                Tags positivas e negativas podem reduzir o total no envio real.
                              </Typography>
                            )}

                            <Accordion className={classes.helpAccordion}>
                              <AccordionSummary expandIcon={<ExpandMoreIcon />} className={classes.helpAccordionSummary}>
                                <Typography variant="body2" style={{ fontWeight: 700, color: "#0f766e" }}>Ajuda do agendamento e estimativa</Typography>
                              </AccordionSummary>
                              <AccordionDetails className={classes.helpAccordionDetails}>
                                <Box className={classes.guideList}>
                                  <Box className={classes.guideItem}>
                                    <Typography className={classes.guideItemTitle}>Envio Imediato</Typography>
                                    <Typography className={classes.guideItemText}>Use quando a campanha deve entrar na fila de disparo assim que a configuração for concluída.</Typography>
                                  </Box>
                                  <Box className={classes.guideItem}>
                                    <Typography className={classes.guideItemTitle}>Agendamento Programado</Typography>
                                    <Typography className={classes.guideItemText}>Use quando precisa controlar data e horário. Ao programar, informe sempre uma data futura.</Typography>
                                  </Box>
                                  <Box className={classes.guideItem}>
                                    <Typography className={classes.guideItemTitle}>Data e Hora</Typography>
                                    <Typography className={classes.guideItemText}>Este campo só aparece no modo programado e valida se o início está no futuro antes de salvar.</Typography>
                                  </Box>
                                  <Box className={classes.guideItem}>
                                    <Typography className={classes.guideItemTitle}>Frequência estimada</Typography>
                                    <Typography className={classes.guideItemText}>A estimativa usa contatos das listas, conexão escolhida e intervalos configurados para API Oficial ou Baileys.</Typography>
                                  </Box>
                                  <Box className={classes.guideItem}>
                                    <Typography className={classes.guideItemTitle}>Proteção anti-spam</Typography>
                                    <Typography className={classes.guideItemText}>Os limites por hora, por dia e pausas maiores continuam sendo respeitados no envio real.</Typography>
                                  </Box>
                                </Box>
                              </AccordionDetails>
                            </Accordion>
                          </Paper>
                        );
                      })()}
                    </Grid>
                   </>)}

                   {/* ═══ STEP 2: Mensagem ═══ */}
                   {activeStep === 2 && (<>
                     <Grid item xs={12} md={7}>
                       <Paper className={classes.card}>
                         <Typography className={classes.stepTitle}>Compor Conteúdo</Typography>
                         <Typography className={classes.stepSub}>Personalize a experiência do seu cliente com textos, mídias ou templates oficiais.</Typography>
                         
                         {/* Templates Meta (API Oficial) */}
                         {isOfficialConnection ? (
                           <Box mb={3} p={2.5} style={{ backgroundColor: "#eff6ff", borderRadius: 16, border: "1px solid #bfdbfe" }}>
                             <Box display="flex" alignItems="center" mb={1} gap={1}>
                               <Zap size={18} color="#1d4ed8" />
                               <Typography variant="subtitle2" style={{ fontWeight: 700, color: "#1d4ed8" }}>WhatsApp Business API</Typography>
                               <Tooltip title="Na API Oficial, o primeiro contato precisa usar template aprovado pela Meta. Depois de criar ou editar um template no Meta, volte aqui e recarregue a lista.">
                                 <InfoOutlinedIcon style={{ fontSize: 16, color: "#1d4ed8", cursor: "pointer" }} />
                               </Tooltip>
                             </Box>
                             <Box mb={2}>
                               <Box display="flex" alignItems="center" mb={1} gap={0.5}>
                                 <label className={classes.label} style={{ marginBottom: 0 }}>Escolha um Template</label>
                                 <Tooltip title="Selecione um template aprovado e liberado para esta conexão oficial. Sem ele, a abertura da conversa pode falhar na Meta.">
                                   <InfoOutlinedIcon style={{ fontSize: 16, color: "#64748b", cursor: "pointer" }} />
                                 </Tooltip>
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

                             <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" style={{ gap: 8 }}>
                               <Tooltip title="Abre o gerenciador da Meta em nova aba para criar ou editar templates oficiais desta conta.">
                                 <span>
                                   <Button
                                     size="small"
                                     variant="outlined"
                                     color="primary"
                                     startIcon={<OpenInNewIcon fontSize="small" />}
                                     onClick={() => window.open(META_TEMPLATE_MANAGER_URL, "_blank", "noopener,noreferrer")}
                                   >
                                     Criar template no Meta
                                   </Button>
                                 </span>
                               </Tooltip>

                               <Tooltip title="Recarrega apenas a lista local de templates aprovados, sem atualizar a página inteira.">
                                 <span>
                                   <IconButton
                                     size="small"
                                     color="primary"
                                     onClick={async () => {
                                       const refreshedTemplates = await loadOfficialTemplates(whatsappId, { showSuccessToast: true });

                                       if (!selectedTemplate) {
                                         return;
                                       }

                                       const updatedTemplate = refreshedTemplates.find(template => template.id === selectedTemplate.id);

                                       if (updatedTemplate) {
                                         setSelectedTemplate(updatedTemplate);
                                         return;
                                       }

                                       setSelectedTemplate(null);
                                       setMetaTemplateVariables({});
                                       setFieldValue("metaTemplateName", null);
                                       setFieldValue("metaTemplateLanguage", null);
                                       setFieldValue("metaTemplateVariables", {});
                                       toast.info("O template selecionado não está mais disponível na lista atual.");
                                     }}
                                     disabled={loadingTemplates || !whatsappId}
                                   >
                                     {loadingTemplates ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
                                   </IconButton>
                                 </span>
                               </Tooltip>
                             </Box>

                             {selectedTemplate && (
                               <Box mt={2} p={2} style={{ backgroundColor: "#fff", borderRadius: 12, border: "1px solid #dbeafe" }}>
                                 <Box display="flex" alignItems="center" gap={0.5} mb={1.5}>
                                   <Typography variant="caption" style={{ fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase" }}>Relacionar Variáveis do Template</Typography>
                                   <Tooltip title="Associe cada variável exigida pelo template, como nome, vencimento ou valor. Esses dados serão enviados exatamente nas posições definidas na Meta.">
                                     <InfoOutlinedIcon style={{ fontSize: 15, color: "#1d4ed8", cursor: "pointer" }} />
                                   </Tooltip>
                                 </Box>
                                 <TemplateVariableMapper whatsappId={whatsappId} templateName={selectedTemplate.name} languageCode={selectedTemplate.language} value={metaTemplateVariables}
                                   onChange={(val) => { setMetaTemplateVariables(val); setFieldValue("metaTemplateVariables", val); }} disabled={!campaignEditable} />
                               </Box>
                             )}
                           </Box>
                         ) : null}

                         {!isOfficialConnection && (
                           <Box display="flex" mb={2} style={{ borderBottom: "1px solid #f1f5f9" }}>
                             {[1,2,3,4,5].map((n,idx) => (
                               <Button key={n} className={`${classes.msgTab} ${messageTab === idx ? classes.msgTabActive : ""}`}
                                 variant={messageTab === idx ? "contained" : "text"} onClick={() => setMessageTab(idx)}>Msg {n}</Button>
                             ))}
                           </Box>
                         )}

                         {!isOfficialConnection && renderMessageField(currentMessageField, setFieldValue, values, "Mensagem Principal")}

                         {!isOfficialConnection && renderTabAttachment(messageTab, values, !campaignEditable)}
                         
                         {!isOfficialConnection && (
                           <Box display="flex" alignItems="center" mt={1} mb={2} p={1.5} style={{ backgroundColor: "#f8fafc", borderRadius: 12 }}>
                             <FormControlLabel control={<Checkbox checked={values.sendMediaSeparately} onChange={e => setFieldValue("sendMediaSeparately", e.target.checked)} color="primary" disabled={!campaignEditable} />}
                               label={<Box><Typography variant="body2" style={{ fontWeight: 600 }}>Enviar anexo separado</Typography><Typography variant="caption" color="textSecondary">Quando ativado, envia o texto e o anexo em mensagens separadas (2 mensagens). Quando desativado, envia o texto como legenda do anexo.</Typography></Box>}
                             />
                             <Tooltip title="Útil se o arquivo for muito grande ou se você quiser que o texto apareça antes do arquivo."><InfoOutlinedIcon style={{ fontSize: 16, color: "#64748b", marginLeft: 8 }} /></Tooltip>
                           </Box>
                         )}

                         {values.confirmation && (<Box mt={3} p={2} style={{ border: "1px dashed #cbd5e1", borderRadius: 16 }}>
                           <Typography variant="subtitle2" style={{ fontWeight: 700, marginBottom: 8, color: "#475569" }}>Confirmação Requerida</Typography>
                           <Alert severity="warning" style={{ marginBottom: 16, fontSize: "0.75rem", borderRadius: 10 }}>Esta mensagem só será enviada para verificar a intenção do cliente.</Alert>
                           {renderMessageField(currentConfirmationField, setFieldValue, values, "Conteúdo da Confirmação")}
                         </Box>)}
                       </Paper>
                     </Grid>
                     <Grid item xs={12} md={5} style={{ display: "flex", alignItems: "flex-start" }}>
                       <Paper className={classes.sideCard} style={{ width: "100%", top: 0 }}>
                         <Box className={classes.sideCardHeader}>
                           <Box className={classes.sideCardIcon}>
                             <QuestionAnswerIcon style={{ fontSize: 30, color: "#005c53" }} />
                           </Box>
                           <Box>
                             <Typography variant="overline" style={{ color: "#0f766e", fontWeight: 700, letterSpacing: 0.7 }}>Terceira Etapa</Typography>
                             <Typography variant="h6" style={{ fontWeight: 800, color: "#005c53", lineHeight: 1.2 }}>Mensagem</Typography>
                           </Box>
                         </Box>

                         <Accordion className={classes.helpAccordionSubtle}>
                           <AccordionSummary expandIcon={<ExpandMoreIcon style={{ fontSize: 18, color: "#94a3b8" }} />} className={classes.helpAccordionSummarySubtle}>
                             <Box display="flex" alignItems="center" style={{ gap: 8 }}>
                               <HelpOutlineIcon style={{ fontSize: 20, color: "#64748b" }} />
                               <Typography variant="body2" style={{ fontWeight: 600, color: "#475569" }}>
                                 {isOfficialConnection ? "Ajuda da API Oficial" : "Ajuda da etapa de mensagem"}
                               </Typography>
                             </Box>
                           </AccordionSummary>
                           <AccordionDetails className={classes.helpAccordionDetails}>
                             <Box className={classes.guideIntroRow}>
                               <HelpOutlineIcon className={classes.guideIntroIcon} />
                               <Typography className={classes.guideIntroText}>
                                 {isOfficialConnection
                                   ? "Nesta conexão, a abertura da conversa é guiada por templates aprovados pela Meta. Use a lista de templates, recarregue quando necessário e confira as variáveis obrigatórias."
                                   : "Monte o conteúdo que será enviado, use variações quando fizer sentido e revise a prévia antes de avançar para a confirmação final."}
                               </Typography>
                             </Box>
                             <Box className={classes.guideList}>
                               {isOfficialConnection ? (
                                 <>
                                   <Box className={classes.guideItem}>
                                     <Typography className={classes.guideItemTitle}>Escolha do template</Typography>
                                     <Typography className={classes.guideItemText}>Selecione um template aprovado para iniciar a conversa oficial. O conteúdo principal e a estrutura da mensagem vêm dele.</Typography>
                                   </Box>
                                   <Box className={classes.guideItem}>
                                     <Typography className={classes.guideItemTitle}>Criar e recarregar</Typography>
                                     <Typography className={classes.guideItemText}>Se o template ainda não existir, crie no Meta e depois use o botão de recarregar para atualizar apenas a lista local.</Typography>
                                   </Box>
                                   <Box className={classes.guideItem}>
                                     <Typography className={classes.guideItemTitle}>Variáveis do template</Typography>
                                     <Typography className={classes.guideItemText}>Mapeie cada variável obrigatória exatamente na posição esperada pela Meta. Isso evita erro de envio ou placeholder vazio.</Typography>
                                   </Box>
                                   <Box className={classes.guideItem}>
                                     <Typography className={classes.guideItemTitle}>Variações ocultas</Typography>
                                     <Typography className={classes.guideItemText}>As abas Msg 2-5 e o anexo livre ficam ocultos porque a abertura oficial é controlada pelo template escolhido.</Typography>
                                   </Box>
                                 </>
                               ) : (
                                 <>
                                   <Box className={classes.guideItem}>
                                     <Typography className={classes.guideItemTitle}>Mensagem Principal</Typography>
                                     <Typography className={classes.guideItemText}>A primeira mensagem é obrigatória e deve respeitar o limite de 1024 caracteres.</Typography>
                                   </Box>
                                   <Box className={classes.guideItem}>
                                     <Typography className={classes.guideItemTitle}>Variações de mensagem</Typography>
                                     <Typography className={classes.guideItemText}>Use as abas Msg 2-5 para preparar alternativas de texto e testar abordagens diferentes no disparo.</Typography>
                                   </Box>
                                   <Box className={classes.guideItem}>
                                     <Typography className={classes.guideItemTitle}>Anexo e envio separado</Typography>
                                     <Typography className={classes.guideItemText}>Você pode anexar arquivo livre e escolher se ele será enviado junto da legenda ou em mensagem separada.</Typography>
                                   </Box>
                                   <Box className={classes.guideItem}>
                                     <Typography className={classes.guideItemTitle}>Mensagem de confirmação</Typography>
                                     <Typography className={classes.guideItemText}>Quando a confirmação estiver habilitada na etapa de regras, preencha o texto que solicita a resposta do cliente.</Typography>
                                   </Box>
                                 </>
                               )}
                             </Box>
                           </AccordionDetails>
                         </Accordion>

                         <Divider style={{ margin: "16px 0" }} />

                         <Typography variant="subtitle2" style={{ fontWeight: 700, marginBottom: 12, color: "#0f172a" }}>Prévia da mensagem</Typography>
                         <WhatsAppPreview messages={[values[currentMessageField], values.confirmation ? values[currentConfirmationField] : null].filter(Boolean)} />
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
                         const isValid = await validateStepAndShowErrors(validateForm, values, whatsappId, selectedQueue, 0, isOfficialConnection);
                         if (isValid) setActiveStep(1);
                       }} className={classes.primaryBtn} endIcon={<ChevronRight />}>PRÓXIMO PASSO</Button>
                     )}
                     {activeStep === 1 && (<>
                       <Button onClick={() => setActiveStep(0)} className={classes.secondaryBtn} startIcon={<ChevronLeft />}>Anterior</Button>
                       <Button variant="contained" onClick={async () => {
                         const isValid = await validateStepAndShowErrors(validateForm, values, whatsappId, selectedQueue, 1, isOfficialConnection);
                         if (isValid) setActiveStep(2);
                       }} className={classes.primaryBtn} endIcon={<ChevronRight />}>PRÓXIMO PASSO</Button>
                     </>)}
                     {activeStep === 2 && (<>
                       <Button onClick={() => setActiveStep(1)} className={classes.secondaryBtn} startIcon={<ChevronLeft />}>Anterior</Button>
                       <Button variant="outlined" onClick={() => handleSaveOnly(values, setSubmitting)} className={classes.btnSave} startIcon={<SaveIcon />} disabled={isSubmitting}>Salvar Rascunho</Button>
                       <Button variant="contained" onClick={async () => {
                         const isValid = await validateStepAndShowErrors(validateForm, values, whatsappId, selectedQueue, 2, isOfficialConnection);
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
                           const isValid = await validateStepAndShowErrors(validateForm, values, whatsappId, selectedQueue, 3, isOfficialConnection);
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
                           const isValid = await validateStepAndShowErrors(validateForm, values, whatsappId, selectedQueue, 3, isOfficialConnection);
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
