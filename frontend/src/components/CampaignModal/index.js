import React, { useState, useEffect, useRef, useContext, useMemo } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import { head } from "lodash";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import InfoOutlinedIcon from "@material-ui/icons/InfoOutlined";
import PlayCircleOutlineIcon from "@material-ui/icons/PlayCircleOutline";
import PauseCircleOutlineIcon from "@material-ui/icons/PauseCircleOutline";
import Chip from '@material-ui/core/Chip';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import Link from '@material-ui/core/Link';
import ClickAwayListener from '@material-ui/core/ClickAwayListener';
import Popover from '@material-ui/core/Popover';
import { isNil } from "lodash";
import { i18n } from "../../translate/i18n";
import moment from "moment";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  Box,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Paper,
  Divider,
  FormHelperText,
} from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import { AuthContext } from "../../context/Auth/AuthContext";
import ConfirmationModal from "../ConfirmationModal";
import UserStatusIcon from "../UserModal/statusIcon";
import Autocomplete, { createFilterOptions } from "@material-ui/lab/Autocomplete";
import useQueues from "../../hooks/useQueues";
import ChatAssistantPanel from "../ChatAssistantPanel";
import WhatsAppPreview from "./WhatsAppPreview";
import { Sparkles } from "lucide-react";
import TemplateVariableMapper from "../TemplateVariableMapper";  // NOVO
import * as libraryApi from "../../services/libraryApi";
import Sidebar from "../../pages/LibraryManager/components/Sidebar";
import TopBar from "../../pages/LibraryManager/components/TopBar";
import BreadcrumbNav from "../../pages/LibraryManager/components/BreadcrumbNav";
import FolderList from "../../pages/LibraryManager/components/FolderList";
import FolderGrid from "../../pages/LibraryManager/components/FolderGrid";
import UploadModal from "../../pages/LibraryManager/components/UploadModal";
import CampaignHowItWorks from "./CampaignHowItWorks";
import HelpOutlineIcon from "@material-ui/icons/HelpOutline";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },

  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },

  extraAttr: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
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
}));

const CampaignSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Parâmetros incompletos!")
    .max(50, "Parâmetros acima do esperado!")
    .required("Required"),
});

const CampaignModal = ({
  open,
  onClose,
  campaignId,
  initialValues,
  onSave,
  resetPagination,
  defaultWhatsappId
}) => {

  const classes = useStyles();
  const isMounted = useRef(true);
  const { user, socket } = useContext(AuthContext);
  const { companyId } = user;

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
    // Anexos por mensagem (1..5)
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
    status: "INATIVA", // INATIVA, PROGRAMADA, EM_ANDAMENTO, CANCELADA, FINALIZADA,
    confirmation: false,
    scheduledAt: "",
    //whatsappId: "",
    contactListId: "",
    tagListId: "Nenhuma",
    companyId,
    statusTicket: "closed",
    openTicket: "disabled",
    dispatchStrategy: "single",
    allowedWhatsappIds: [],
    metaTemplateName: null,
    metaTemplateLanguage: null,
    metaTemplateVariables: {},  // NOVO: mapeamento de variáveis
  };

  // Validação de mídia permitida
  const isAllowedMedia = (opt) => {
    const fileUrl = (opt?.url || opt?.path || "").toLowerCase();
    const mime = (opt?.mediaType || "").toLowerCase();
    const allowedExt = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".mp4", ".mp3", ".ogg", ".opus", ".wav"];
    const allowedMime = ["image/", "video/", "audio/", "application/pdf"]; // prefixos
    const okExt = allowedExt.some(ext => fileUrl.endsWith(ext));
    const okMime = allowedMime.some(prefix => mime.startsWith(prefix));
    return okExt || okMime;
  };

  const [tagsTargetField, setTagsTargetField] = useState(null);
  const insertTagIntoField = (targetField, setFieldValue, values) => (label) => {
    const field = targetField;
    const insertion = `{${label}}`;
    const prev = (values && values[field]) || "";
    setFieldValue(field, prev + insertion);
  };

  const isImage = (url = "") => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  const isVideo = (url = "") => /\.(mp4|webm|ogg)$/i.test(url);
  const isAudio = (url = "") => /\.(mp3|wav|ogg|opus)$/i.test(url);
  const isPdf = (url = "") => /\.(pdf)$/i.test(url);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewName, setPreviewName] = useState("");
  const openPreview = (url, name) => { setPreviewUrl(url); setPreviewName(name || "Arquivo"); setPreviewOpen(true); };
  const closePreview = () => { setPreviewOpen(false); setPreviewUrl(""); setPreviewName(""); };

  const renderMediaPreview = (url, name) => {
    if (!url) return null;
    const wrapperStyle = { cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 };
    if (isImage(url)) {
      return (
        <div style={wrapperStyle} onClick={() => openPreview(url, name)}>
          <img
            src={url}
            alt={name || 'preview'}
            style={{ maxWidth: 120, maxHeight: 90, borderRadius: 4, border: '1px solid #eee' }}
          />
        </div>
      );
    }
    if (isVideo(url) || isAudio(url) || isPdf(url)) {
      return (
        <Button size="small" variant="outlined" onClick={() => openPreview(url, name)}>Pré-visualizar</Button>
      );
    }
    return (
      <Button size="small" variant="outlined" onClick={() => openPreview(url, name)}>Pré-visualizar</Button>
    );
  };

  const renderTagsToolbar = (values, setFieldValue, targetField) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 8px' }}>
      <Button size="small" variant="outlined" onClick={(e) => { setTagsTargetField(targetField); handleOpenTags(e); }}>#Tags</Button>

      <Tooltip title="Como usar as tags?">
        <IconButton size="small" onClick={handleOpenInfo} aria-label="como usar as tags">
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Assistente de IA">
        <span>
          <IconButton
            size="small"
            onClick={() => handleOpenAssistant(targetField, values)}
            aria-label="assistente de ia"
            disabled={!campaignEditable}
          >
            <Sparkles size={16} />
          </IconButton>
        </span>
      </Tooltip>
    </div>
  );

  const renderTabAttachment = (idx, values, disabled) => {
    const nameField = getMediaNameFieldByTab(idx);
    const urlField = getMediaUrlFieldByTab(idx);
    const currentName = values[nameField];
    const currentUrl = values[urlField];
    const hasFile = !!currentName;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0' }}>
        <Button
          size="small"
          variant="outlined"
          color="primary"
          onClick={() => { setFileLibraryTargetIndex(idx); setFileLibraryOpen(true); }}
          disabled={disabled}
        >
          {hasFile ? `Trocar anexo (aba ${idx + 1})` : `Selecionar anexo (aba ${idx + 1})`}
        </Button>
        {hasFile && (
          <>
            <Chip size="small" label={currentName} />
            <IconButton size="small" onClick={() => clearTabMedia(idx)} disabled={disabled}>
              <DeleteOutlineIcon color="secondary" />
            </IconButton>
            {renderMediaPreview(currentUrl, currentName)}
          </>
        )}
      </div>
    );
  };

  const [campaign, setCampaign] = useState(initialState);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [dispatchMode, setDispatchMode] = useState("single"); // single | custom | all | baileys | official
  const [whatsapps, setWhatsapps] = useState([]);
  const [selectedWhatsapps, setSelectedWhatsapps] = useState([]);
  const [dispatchStrategy, setDispatchStrategy] = useState("single");
  const [allowedWhatsappIds, setAllowedWhatsappIds] = useState([]);
  const [whatsappId, setWhatsappId] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [metaTemplateVariables, setMetaTemplateVariables] = useState({});  // NOVO

  useEffect(() => {
    if (!campaignId && defaultWhatsappId) {
      setWhatsappId(defaultWhatsappId);
    }
  }, [defaultWhatsappId, campaignId]);

  const [contactLists, setContactLists] = useState([]);
  const [tagLists, setTagLists] = useState([]);
  const [messageTab, setMessageTab] = useState(0);
  const [mainTab, setMainTab] = useState(0); // 0 = Formulário, 1 = Como Funciona
  const [attachment, setAttachment] = useState(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [campaignEditable, setCampaignEditable] = useState(true);
  const attachmentFile = useRef(null);

  const [options, setOptions] = useState([]);
  const [queues, setQueues] = useState([]);
  const [allQueues, setAllQueues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);  // Agora é array para múltiplos usuários
  const [selectedQueue, setSelectedQueue] = useState("");
  const { findAll: findAllQueues } = useQueues();

  // Seletor de arquivos (File Manager)
  const [fileLibraryOpen, setFileLibraryOpen] = useState(false);
  const [fileLibraryTargetIndex, setFileLibraryTargetIndex] = useState(null); // 0..4
  const [libraryCurrentFolder, setLibraryCurrentFolder] = useState(null);
  const [libraryBreadcrumbs, setLibraryBreadcrumbs] = useState([{ id: null, name: "Home" }]);
  const [libraryViewMode, setLibraryViewMode] = useState("list");
  const [librarySearchValue, setLibrarySearchValue] = useState("");
  const [libraryFolders, setLibraryFolders] = useState([]);
  const [libraryFiles, setLibraryFiles] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryUploadOpen, setLibraryUploadOpen] = useState(false);
  const setFieldValueRef = useRef(null);
  const formValuesRef = useRef(initialState);

  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantTargetField, setAssistantTargetField] = useState(null);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistantContextSummary, setAssistantContextSummary] = useState("");
  const [assistantPresets, setAssistantPresets] = useState([]);
  const assistantQueueIdRef = useRef(null);
  const assistantWhatsappIdRef = useRef(null);

  // Tags (#tags) - semelhante ao PromptModal
  const [tagsAnchorEl, setTagsAnchorEl] = useState(null);
  const [tagsSearch, setTagsSearch] = useState("");
  const [infoAnchorEl, setInfoAnchorEl] = useState(null);
  const openInfo = Boolean(infoAnchorEl);
  const handleOpenInfo = (event) => setInfoAnchorEl(event.currentTarget);
  const handleCloseInfo = () => setInfoAnchorEl(null);
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

  const availableTagsList = mustacheVars.map((item) => `{${item.label}}`);

  const assistantFieldConfigs = useMemo(() => {
    const messageConfigs = [
      { field: "message1", title: "Mensagem principal 1", purpose: "primeiro disparo da campanha", category: "message" },
      { field: "message2", title: "Mensagem principal 2", purpose: "sequência após a primeira mensagem", category: "message" },
      { field: "message3", title: "Mensagem principal 3", purpose: "reforço intermediário da campanha", category: "message" },
      { field: "message4", title: "Mensagem principal 4", purpose: "manter o engajamento do contato", category: "message" },
      { field: "message5", title: "Mensagem principal 5", purpose: "último disparo da campanha", category: "message" },
    ];
    const confirmationConfigs = [
      { field: "confirmationMessage1", title: "Confirmação 1", purpose: "confirmar o recebimento e orientar o contato", category: "confirmation" },
      { field: "confirmationMessage2", title: "Confirmação 2", purpose: "reforçar a confirmação com tom cordial", category: "confirmation" },
      { field: "confirmationMessage3", title: "Confirmação 3", purpose: "agradecer e reforçar próximos passos", category: "confirmation" },
      { field: "confirmationMessage4", title: "Confirmação 4", purpose: "encerrar o fluxo com orientação final", category: "confirmation" },
      { field: "confirmationMessage5", title: "Confirmação 5", purpose: "último lembrete de confirmação", category: "confirmation" },
    ];
    return [...messageConfigs, ...confirmationConfigs].reduce((acc, item) => {
      acc[item.field] = item;
      return acc;
    }, {});
  }, []);

  const messagePresetBuilders = [
    {
      label: "Boas-vindas calorosa",
      buildPrompt: (config) => `Escreva uma mensagem acolhedora em português para ${config.title}, destacando ${config.purpose}. Use tom amigável, incentive resposta e preserve todas as tags ({nome}, {primeiro-nome}, etc.).`
    },
    {
      label: "Mensagem com CTA clara",
      buildPrompt: (config) => `Gere uma mensagem objetiva para ${config.title}, com call-to-action direto e tom profissional. Preserve as tags disponíveis e use emojis moderados.`
    },
    {
      label: "Versão curta",
      buildPrompt: (config) => `Crie uma versão curta e impactante para ${config.title}, em até 3 frases curtas, mantendo as tags {nome} e demais tags intactas.`
    }
  ];

  const confirmationPresetBuilders = [
    {
      label: "Confirmação amigável",
      buildPrompt: (config) => `Gere uma mensagem de confirmação amigável para ${config.title}, agradecendo o contato, reforçando próxima etapa e mantendo todas as tags intactas.`
    },
    {
      label: "Confirmação com CTA",
      buildPrompt: (config) => `Escreva uma confirmação objetiva para ${config.title}, incluindo instruções claras de próxima ação e preservando {tags}.`
    },
    {
      label: "Confirmação curta",
      buildPrompt: (config) => `Produza uma mensagem de confirmação curta (até 2 frases) para ${config.title}, mantendo formalidade leve e todas as tags.`
    }
  ];

  const sanitizeAssistantText = (text = "") => {
    let safeText = String(text);
    safeText = safeText.replace(/\{\s*([a-zA-Z0-9_-]+)\s*\}/g, "{$1}");
    safeText = safeText.replace(/\n{3,}/g, "\n\n");
    return safeText.trim();
  };

  const buildAssistantSummary = (field, values) => {
    const config = assistantFieldConfigs[field] || { title: field, purpose: "gerar a mensagem" };
    const highlightedTags = availableTagsList.slice(0, 8).join(", ");
    const campaignName = values?.name ? `Campanha: ${values.name}. ` : "";
    return `${campaignName}${config.title} — objetivo: ${config.purpose}. Tags disponíveis: ${highlightedTags}${availableTagsList.length > 8 ? ", ..." : ""}`;
  };

  const buildAssistantPresets = (field) => {
    const config = assistantFieldConfigs[field] || { title: field, purpose: "gerar a mensagem", category: "message" };
    const builders = config.category === "confirmation" ? confirmationPresetBuilders : messagePresetBuilders;
    return builders.map((preset) => ({
      label: preset.label,
      prompt: preset.buildPrompt(config),
    }));
  };

  const handleCloseAssistant = () => {
    setAssistantOpen(false);
    setAssistantTargetField(null);
  };

  const handleOpenAssistant = (field, values) => {
    if (!campaignEditable) return;
    setAssistantTargetField(field);
    const currentValue = values?.[field] || "";
    setAssistantDraft(currentValue);
    setAssistantContextSummary(buildAssistantSummary(field, values));
    setAssistantPresets(buildAssistantPresets(field));
    setAssistantOpen(true);
  };

  const handleApplyAssistant = (action, generatedText) => {
    if (!assistantTargetField || !setFieldValueRef.current) return;
    const sanitized = sanitizeAssistantText(generatedText);
    const currentValue = formValuesRef.current?.[assistantTargetField] || "";
    let nextValue = sanitized;
    if (action === "append") {
      nextValue = currentValue ? `${currentValue}\n\n${sanitized}` : sanitized;
    }
    setFieldValueRef.current(assistantTargetField, nextValue);
    setAssistantDraft(nextValue);
    handleCloseAssistant();
  };
  const groupedVars = mustacheVars.reduce((acc, v) => {
    const cat = v.category || "Outros";
    acc[cat] = acc[cat] || [];
    acc[cat].push(v);
    return acc;
  }, {});
  const openTags = Boolean(tagsAnchorEl);
  const handleOpenTags = (event) => setTagsAnchorEl(event.currentTarget);
  const handleCloseTags = () => setTagsAnchorEl(null);

  const getMessageFieldByTab = (tabIdx) => {
    switch (tabIdx) {
      case 0: return "message1";
      case 1: return "message2";
      case 2: return "message3";
      case 3: return "message4";
      case 4: return "message5";
      default: return "message1";
    }
  };
  const getMediaUrlFieldByTab = (tabIdx) => {
    switch (tabIdx) {
      case 0: return "mediaUrl1";
      case 1: return "mediaUrl2";
      case 2: return "mediaUrl3";
      case 3: return "mediaUrl4";
      case 4: return "mediaUrl5";
      default: return "mediaUrl1";
    }
  };
  const getMediaNameFieldByTab = (tabIdx) => {
    switch (tabIdx) {
      case 0: return "mediaName1";
      case 1: return "mediaName2";
      case 2: return "mediaName3";
      case 3: return "mediaName4";
      case 4: return "mediaName5";
      default: return "mediaName1";
    }
  };
  const clearTabMedia = (idx) => {
    const setFieldValue = setFieldValueRef.current;
    if (!setFieldValue) return;
    setFieldValue(getMediaUrlFieldByTab(idx), null);
    setFieldValue(getMediaNameFieldByTab(idx), null);
  };

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

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

  // Carregar templates da Meta quando selecionar WhatsApp da API Oficial
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
        const { data } = await api.get(`/whatsapp/${whatsappId}/templates`);
        setAvailableTemplates(data.templates || []);
      } catch (err) {
        console.error("Erro ao carregar templates", err);
        toastError(err);
      } finally {
        setLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, [whatsappId, whatsapps]);

  // Restaurar selectedTemplate quando templates são carregados e campanha tem template salvo
  useEffect(() => {
    if (availableTemplates.length > 0 && campaign.metaTemplateName && !selectedTemplate) {
      const savedTemplate = availableTemplates.find(
        t => t.name === campaign.metaTemplateName &&
          (t.language === campaign.metaTemplateLanguage || !campaign.metaTemplateLanguage)
      );
      if (savedTemplate) {
        console.log('[CampaignModal] Restaurando template salvo:', savedTemplate.name);
        setSelectedTemplate(savedTemplate);
      }
    }
  }, [availableTemplates, campaign.metaTemplateName, campaign.metaTemplateLanguage, selectedTemplate]);

  // Carrega todos os usuários sob demanda (ao abrir o campo)
  const ensureUsersLoaded = async () => {
    if (options && options.length > 0) return;
    try {
      setLoading(true);
      const { data } = await api.get("/users/");
      setOptions(data.users || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !isMounted.current) return;

    const loadData = async () => {
      try {
        // Carregar dados básicos em paralelo (não dependem da campanha)
        const [contactListsRes, whatsappsRes, tagsRes] = await Promise.all([
          api.get(`/contact-lists/list`, { params: { companyId } }),
          api.get(`/whatsapp`, { params: { companyId, session: 0 } }),
          api.get(`/tags/list`, { params: { companyId, kanban: 0 } })
        ]);

        setContactLists(contactListsRes.data || []);

        const mappedWhatsapps = (whatsappsRes.data || []).map((whatsapp) => ({
          ...whatsapp,
          selected: false,
        }));
        setWhatsapps(mappedWhatsapps);

        const formattedTagLists = (tagsRes.data || [])
          .map((tag) => {
            const count = Array.isArray(tag.contacts) ? tag.contacts.length : 0;
            const countLabel = ` (${count})`;
            return {
              id: tag.id,
              name: `${tag.name}${countLabel}`,
            };
          });
        setTagLists(formattedTagLists);

        // Se tem campaignId, carregar dados da campanha
        if (campaignId) {
          setCampaignLoading(true);
          const { data } = await api.get(`/campaigns/${campaignId}`);
          console.log('[CampaignModal] Dados recebidos da API:', data);

          // Carregar usuários selecionados (múltiplos ou único para compatibilidade)
          if (data?.userIds) {
            try {
              const userIdsArray = typeof data.userIds === 'string'
                ? JSON.parse(data.userIds)
                : data.userIds;
              if (Array.isArray(userIdsArray) && userIdsArray.length > 0) {
                // Buscar dados completos dos usuários
                const usersData = options.filter(u => userIdsArray.includes(u.id));
                setSelectedUsers(usersData);
              }
            } catch (e) {
              console.error('[CampaignModal] Erro ao parsear userIds:', e);
            }
          } else if (data?.user) {
            // Compatibilidade: se só tem user (antigo), converter para array
            setSelectedUsers([data.user]);
          }
          if (data?.queue) setSelectedQueue(data.queue.id);
          if (data?.whatsappId) setWhatsappId(data.whatsappId);
          if (data?.dispatchStrategy) setDispatchStrategy(data.dispatchStrategy);

          // NOVO: Carregar metaTemplateVariables
          if (data?.metaTemplateVariables) {
            try {
              const variables = typeof data.metaTemplateVariables === 'string'
                ? JSON.parse(data.metaTemplateVariables)
                : data.metaTemplateVariables;
              setMetaTemplateVariables(variables || {});
            } catch (e) {
              console.error('[CampaignModal] Erro ao parsear metaTemplateVariables:', e);
              setMetaTemplateVariables({});
            }
          }

          if (data?.allowedWhatsappIds) {
            try {
              const parsed = typeof data.allowedWhatsappIds === 'string'
                ? JSON.parse(data.allowedWhatsappIds)
                : data.allowedWhatsappIds;
              if (Array.isArray(parsed)) setAllowedWhatsappIds(parsed);
            } catch (e) {
              console.error('[CampaignModal] Erro ao parsear allowedWhatsappIds:', e);
            }
          }

          // Atualizar estado da campanha
          const prevCampaignData = {};
          Object.entries(data).forEach(([key, value]) => {
            if (key === "scheduledAt" && value !== "" && value !== null) {
              prevCampaignData[key] = moment(value).format("YYYY-MM-DDTHH:mm");
            } else {
              prevCampaignData[key] = value === null ? "" : value;
            }
          });
          setCampaign(prevCampaignData);
          setCampaignLoading(false);
        } else if (initialValues) {
          // Nova campanha com valores iniciais
          setCampaign((prevState) => ({ ...prevState, ...initialValues }));
        }
      } catch (err) {
        console.error('[CampaignModal] Erro ao carregar dados:', err);
        toastError(err);
        setCampaignLoading(false);
      }
    };

    loadData();
  }, [campaignId, open, companyId]);

  // Carregar listas simples de arquivos para a biblioteca (quando abrir)
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

  const handleLibraryNavigateBreadcrumb = (index) => {
    setLibraryBreadcrumbs((prev) => {
      const newBreadcrumbs = prev.slice(0, index + 1);
      const last = newBreadcrumbs[newBreadcrumbs.length - 1];
      setLibraryCurrentFolder(last?.id || null);
      return newBreadcrumbs;
    });
  };

  const filterItemsBySearch = (items, searchTerm) => {
    if (!searchTerm) return items;
    const term = String(searchTerm).toLowerCase();
    return (items || []).filter((item) => {
      const name = (item.name || item.title || "").toLowerCase();
      const tags = (item.defaultTags || []).join(" ").toLowerCase();
      const description = (item.description || "").toLowerCase();
      return name.includes(term) || tags.includes(term) || description.includes(term);
    });
  };

  useEffect(() => {
    const now = moment();
    const scheduledAt = moment(campaign.scheduledAt);
    const moreThenAnHour =
      !Number.isNaN(scheduledAt.diff(now)) && scheduledAt.diff(now, "hour") > 1;

    // Permite edição se:
    // 1. Campanha está INATIVA (nunca enviada)
    // 2. Campanha está PROGRAMADA com mais de 1 hora para iniciar
    // 3. Campanha está CANCELADA (pausada)
    const isEditable =
      campaign.status === "INATIVA" ||
      campaign.status === "CANCELADA" ||
      (campaign.status === "PROGRAMADA" && moreThenAnHour);

    setCampaignEditable(isEditable);
  }, [campaign.status, campaign.scheduledAt]);

  const handleClose = () => {
    onClose();
    setCampaign(initialState);
  };

  const handleAttachmentFile = (e) => {
    const file = head(e.target.files);
    if (file) {
      setAttachment(file);
    }
  };

  const handleSaveCampaign = async (values) => {
    try {
      console.log('[CampaignModal] Salvando campanha com metaTemplateVariables:', metaTemplateVariables);

      // Primeiro processa os values do Formik
      const processedValues = {};
      Object.entries(values).forEach(([key, value]) => {
        if (key === "scheduledAt" && value !== "" && value !== null) {
          processedValues[key] = moment(value).format("YYYY-MM-DD HH:mm:ss");
        } else {
          processedValues[key] = value === "" ? null : value;
        }
      });

      // Depois monta o dataValues com os campos extras (que têm prioridade)
      // Se múltiplos usuários selecionados, envia userIds (array JSON)
      // Se apenas um usuário, envia userId (compatibilidade)
      const userIds = selectedUsers.length > 0
        ? JSON.stringify(selectedUsers.map(u => u.id))
        : null;
      const userId = selectedUsers.length === 1 ? selectedUsers[0].id : null;

      const dataValues = {
        ...processedValues,  // Valores do Formik processados
        whatsappId: whatsappId,
        userId,  // Compatibilidade com campanhas antigas
        userIds,  // Novo: array de IDs para distribuição por tags
        queueId: selectedQueue || null,
        dispatchStrategy,
        allowedWhatsappIds,
        metaTemplateVariables  // IMPORTANTE: deve vir por último para ter prioridade
      };
      console.log('[CampaignModal] dataValues completo:', JSON.stringify(dataValues, null, 2));
      console.log('[CampaignModal] metaTemplateVariables FINAL que será enviado:', JSON.stringify(dataValues.metaTemplateVariables));

      if (campaignId) {
        console.log('[CampaignModal] Atualizando campanha existente:', campaignId);
        await api.put(`/campaigns/${campaignId}`, dataValues);

        if (attachment != null) {
          const formData = new FormData();
          formData.append("file", attachment);
          await api.post(`/campaigns/${campaignId}/media-upload`, formData);
        }
        handleClose();
      } else {
        const { data } = await api.post("/campaigns", dataValues);

        if (attachment != null) {
          const formData = new FormData();
          formData.append("file", attachment);
          await api.post(`/campaigns/${data.id}/media-upload`, formData);
        }
        if (onSave) {
          onSave(data);
        }
        handleClose();
      }
      toast.success(i18n.t("campaigns.toasts.success"));
    } catch (err) {
      console.log(err);
      toastError(err);
    }
  };

  /**
   * Salva a campanha sem disparar imediatamente
   * - Se tiver scheduledAt: status = PROGRAMADA (aguarda agendamento)
   * - Se não tiver scheduledAt: status = INATIVA (parada)
   */
  const handleSaveOnly = async (values, setSubmitting) => {
    try {
      setSubmitting(true);

      // Primeiro processa os values do Formik
      const processedValues = {};
      Object.entries(values).forEach(([key, value]) => {
        if (key === "scheduledAt" && value !== "" && value !== null) {
          processedValues[key] = moment(value).format("YYYY-MM-DD HH:mm:ss");
        } else {
          processedValues[key] = value === "" ? null : value;
        }
      });

      // Define o status baseado no agendamento
      const hasSchedule = processedValues.scheduledAt && processedValues.scheduledAt !== null;
      processedValues.status = hasSchedule ? "PROGRAMADA" : "INATIVA";

      const userIds = selectedUsers.length > 0
        ? JSON.stringify(selectedUsers.map(u => u.id))
        : null;
      const userId = selectedUsers.length === 1 ? selectedUsers[0].id : null;

      const dataValues = {
        ...processedValues,
        whatsappId: whatsappId,
        userId,
        userIds,
        queueId: selectedQueue || null,
        dispatchStrategy,
        allowedWhatsappIds,
        metaTemplateVariables
      };

      if (campaignId) {
        await api.put(`/campaigns/${campaignId}`, dataValues);
        if (attachment != null) {
          const formData = new FormData();
          formData.append("file", attachment);
          await api.post(`/campaigns/${campaignId}/media-upload`, formData);
        }
      } else {
        const { data } = await api.post("/campaigns", dataValues);
        if (attachment != null) {
          const formData = new FormData();
          formData.append("file", attachment);
          await api.post(`/campaigns/${data.id}/media-upload`, formData);
        }
        if (onSave) {
          onSave(data);
        }
      }

      const msg = hasSchedule
        ? "Campanha salva e programada para o horário agendado!"
        : "Campanha salva como inativa.";
      toast.success(msg);
      handleClose();
    } catch (err) {
      console.log(err);
      toastError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChooseFromLibrary = async (file) => {
    try {
      const idx = Number.isInteger(fileLibraryTargetIndex) ? fileLibraryTargetIndex : messageTab;
      const fileUrl = file?.fileOption?.url || file?.fileOption?.path || file?.url || file?.path;
      if (!fileUrl) {
        toast.error("Arquivo sem URL disponível");
        return;
      }
      if (!isAllowedMedia({ url: fileUrl, mediaType: file?.mediaType || file?.fileOption?.mediaType || file?.fileOption?.mimeType })) {
        toast.error("Tipo de arquivo não suportado para envio. Permitidos: imagens, áudio, vídeo e PDF.");
        return;
      }
      const filename = file?.title || file?.name || (fileUrl ? fileUrl.split("/").pop() : null) || "arquivo.bin";
      const setFieldValue = setFieldValueRef.current;
      if (setFieldValue) {
        setFieldValue(getMediaUrlFieldByTab(idx), fileUrl);
        setFieldValue(getMediaNameFieldByTab(idx), filename);
        setFileLibraryOpen(false);
        setFileLibraryTargetIndex(null);
        toast.success(`Anexo da aba ${idx + 1} definido: "${filename}"`);
        return;
      }
      // fallback (não esperado): mantém comportamento antigo
      setAttachment(null);
      setFileLibraryOpen(false);
    } catch (e) {
      toastError(e);
    }
  };

  const resetLibraryPickerState = () => {
    setLibraryCurrentFolder(null);
    setLibraryBreadcrumbs([{ id: null, name: "Home" }]);
    setLibrarySearchValue("");
    setLibraryViewMode("list");
  };

  const closeLibraryPicker = () => {
    setFileLibraryOpen(false);
    setFileLibraryTargetIndex(null);
    resetLibraryPickerState();
  };

  const deleteMedia = async () => {
    if (attachment) {
      setAttachment(null);
      attachmentFile.current.value = null;
    }

    if (campaign.mediaPath) {
      await api.delete(`/campaigns/${campaign.id}/media-upload`);
      setCampaign((prev) => ({ ...prev, mediaPath: null, mediaName: null }));
      toast.success(i18n.t("campaigns.toasts.deleted"));
    }
  };

  const renderMessageField = (identifier) => {
    return (
      <Field
        as={TextField}
        id={identifier}
        name={identifier}
        fullWidth
        rows={5}
        label={i18n.t(`campaigns.dialog.form.${identifier}`)}
        placeholder={i18n.t("campaigns.dialog.form.messagePlaceholder")}
        multiline={true}
        variant="outlined"
        helperText="Utilize variáveis como {nome}, {numero}, {email} ou defina variáveis personalizadas."
        disabled={!campaignEditable && campaign.status !== "CANCELADA"}
      />
    );
  };

  const renderConfirmationMessageField = (identifier) => {
    return (
      <Field
        as={TextField}
        id={identifier}
        name={identifier}
        fullWidth
        rows={5}
        label={i18n.t(`campaigns.dialog.form.${identifier}`)}
        placeholder={i18n.t("campaigns.dialog.form.messagePlaceholder")}
        multiline={true}
        variant="outlined"
        disabled={!campaignEditable && campaign.status !== "CANCELADA"}
      />
    );
  };

  const cancelCampaign = async () => {
    try {
      await api.post(`/campaigns/${campaign.id}/cancel`);
      toast.success(i18n.t("campaigns.toasts.cancel"));
      setCampaign((prev) => ({ ...prev, status: "CANCELADA" }));
      resetPagination();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const restartCampaign = async () => {
    try {
      await api.post(`/campaigns/${campaign.id}/restart`);
      toast.success(i18n.t("campaigns.toasts.restart"));
      setCampaign((prev) => ({ ...prev, status: "EM_ANDAMENTO" }));
      resetPagination();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filterOptions = createFilterOptions({
    trim: true,
  });

  return (
    <div className={classes.root}>
      <ConfirmationModal
        title={i18n.t("campaigns.confirmationModal.deleteTitle")}
        open={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={deleteMedia}
      >
        {i18n.t("campaigns.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="xl"
        scroll="paper"
      >
        <DialogTitle id="form-dialog-title" style={{ paddingBottom: 0 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">
              {campaignEditable ? (
                <>
                  {campaignId
                    ? `${i18n.t("campaigns.dialog.update")}`
                    : `${i18n.t("campaigns.dialog.new")}`}
                </>
              ) : (
                <>{`${i18n.t("campaigns.dialog.readonly")}`}</>
              )}
            </Typography>
          </Box>
          <Tabs
            value={mainTab}
            onChange={(e, newValue) => setMainTab(newValue)}
            indicatorColor="primary"
            textColor="primary"
            style={{ marginTop: 8 }}
          >
            <Tab label="Configuração" />
            <Tab label="Como Funciona" icon={<HelpOutlineIcon style={{ fontSize: 18 }} />} />
          </Tabs>
        </DialogTitle>
        <div style={{ display: "none" }}>
          <input
            type="file"
            ref={attachmentFile}
            onChange={(e) => handleAttachmentFile(e)}
          />
        </div>
        {/* Aba "Como Funciona" - Tutorial */}
        {mainTab === 1 && (
          <>
            <DialogContent dividers style={{ padding: 0 }}>
              <CampaignHowItWorks />
            </DialogContent>
            <DialogActions>
              <Button
                onClick={handleClose}
                color="primary"
                variant="outlined"
              >
                Fechar
              </Button>
              <Button
                onClick={() => setMainTab(0)}
                color="primary"
                variant="contained"
              >
                Ir para Configuração
              </Button>
            </DialogActions>
          </>
        )}

        {/* Aba "Configuração" - Formulário */}
        {mainTab === 0 && campaignLoading ? (
          <DialogContent dividers>
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <CircularProgress />
            </div>
          </DialogContent>
        ) : mainTab === 0 && (
          <Formik
            initialValues={campaign}
            enableReinitialize={true}
            validationSchema={CampaignSchema}
            onSubmit={(values, actions) => {
              setTimeout(() => {
                handleSaveCampaign(values);
                actions.setSubmitting(false);
              }, 400);
            }}
          >
            {({ values, errors, touched, isSubmitting, setFieldValue, setSubmitting }) => {
              setFieldValueRef.current = setFieldValue;
              formValuesRef.current = values;
              const assistantQueueId = selectedQueue || values.queueId || (selectedUsers.length === 1 && Array.isArray(selectedUsers[0]?.queues) ? selectedUsers[0].queues[0]?.id : null);
              const assistantWhatsappId = whatsappId || values.whatsappId || values.whatsappIds || null;
              assistantQueueIdRef.current = assistantQueueId || null;
              assistantWhatsappIdRef.current = assistantWhatsappId || null;

              return (
                <Form>
                  <DialogContent dividers style={{ padding: 0, display: "flex" }}>
                    {/* Coluna esquerda - Formulário */}
                    <Box flex={1} style={{ overflowY: "auto", padding: "20px 24px" }}>
                      <Grid spacing={2} container>
                        {/* Popover de #Tags */}
                        <Popover
                          open={openTags}
                          anchorEl={tagsAnchorEl}
                          onClose={handleCloseTags}
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                        >
                          <div style={{ padding: 12, maxWidth: 380 }}>
                            <TextField
                              value={tagsSearch}
                              onChange={(e) => setTagsSearch(e.target.value)}
                              placeholder="Buscar #tags..."
                              variant="outlined"
                              size="small"
                              fullWidth
                              style={{ marginBottom: 8 }}
                            />
                            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                              {Object.keys(groupedVars).map(cat => {
                                const items = groupedVars[cat].filter(v =>
                                  (v.label || '').toLowerCase().includes((tagsSearch || '').toLowerCase()) ||
                                  (v.desc || '').toLowerCase().includes((tagsSearch || '').toLowerCase())
                                );
                                if (items.length === 0) return null;
                                return (
                                  <div key={cat} style={{ marginBottom: 8 }}>
                                    <Typography variant="subtitle2" style={{ opacity: 0.8, marginBottom: 4 }}>{cat}</Typography>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                      {items.map(item => (
                                        <Chip
                                          key={item.key}
                                          label={`#${item.label}`}
                                          onClick={() => {
                                            if (tagsTargetField) {
                                              insertTagIntoField(tagsTargetField, setFieldValue, values)(item.label);
                                            }
                                            handleCloseTags();
                                          }}
                                          variant="default"
                                          clickable
                                        />
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                              {/* Dica */}
                              <Typography variant="caption" style={{ display: 'block', marginTop: 8, opacity: 0.8 }}>
                                As tags serão inseridas no campo selecionado (mensagem ou prompt da aba atual) no formato {`{tag}`}. Ex.: {`{nome}`}, {`{empresa}`}
                              </Typography>
                            </div>
                          </div>
                        </Popover>
                        {/* Popover de instruções (i) */}
                        <Popover
                          open={openInfo}
                          anchorEl={infoAnchorEl}
                          onClose={handleCloseInfo}
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                        >
                          <div style={{ padding: 14, maxWidth: 520 }}>
                            <Typography variant="subtitle1" style={{ marginBottom: 8 }}>Como usar as tags</Typography>
                            <Typography variant="body2" paragraph>
                              Escreva as variáveis no texto entre chaves. Ex.: {`{nome}`}, {`{primeiro-nome}`}, {`{data}`}, {`{saudacao}`}.
                            </Typography>
                            <Typography variant="subtitle2">Tags nativas</Typography>
                            <ul style={{ marginTop: 4, marginBottom: 8, paddingLeft: 18 }}>
                              <li>{`{nome}`} — Nome completo do contato</li>
                              <li>{`{primeiro-nome}`} — Primeiro nome do contato</li>
                              <li>{`{email}`} — Email do contato</li>
                              <li>{`{numero}`} — Número do contato</li>
                              <li>{`{data}`} — Data atual (DD/MM/AAAA)</li>
                              <li>{`{hora}`} — Hora atual (HH:MM:SS)</li>
                              <li>{`{data-hora}`} — Data e hora atuais</li>
                              <li>{`{periodo-dia}`} — manhã, tarde ou noite</li>
                              <li>{`{saudacao}`} — Bom dia, Boa tarde, Boa noite</li>
                            </ul>
                            <Typography variant="subtitle2">Campos do cadastro</Typography>
                            <Typography variant="body2" paragraph>
                              Você pode usar <strong>qualquer campo do cadastro do contato</strong> como tag. Ex.: {`{fantasyName}`} ou {`{fantasy-name}`}, {`{cpfCnpj}`} ou {`{cpf-cnpj}`}, {`{city}`}.
                              O nome da tag pode ser o <em>nome exato do campo</em> ou sua versão <em>kebab-case</em> (com hífens).
                            </Typography>
                            <Typography variant="subtitle2">Variáveis personalizadas</Typography>
                            <Typography variant="body2">
                              Também é possível definir variáveis nas configurações da campanha. Use-as como {`{minha-variavel}`}.
                            </Typography>
                          </div>
                        </Popover>
                        <Grid xs={12} md={4} item>
                          <Field
                            as={TextField}
                            label={i18n.t("campaigns.dialog.form.name")}
                            name="name"
                            error={touched.name && Boolean(errors.name)}
                            helperText={touched.name && errors.name}
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.textField}
                            disabled={!campaignEditable}
                          />
                        </Grid>
                        <Grid xs={12} md={4} item>
                          <FormControl
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.formControl}
                          >
                            <InputLabel id="confirmation-selection-label">
                              {i18n.t("campaigns.dialog.form.confirmation")}
                            </InputLabel>
                            <Field
                              as={Select}
                              label={i18n.t("campaigns.dialog.form.confirmation")}
                              placeholder={i18n.t(
                                "campaigns.dialog.form.confirmation"
                              )}
                              labelId="confirmation-selection-label"
                              id="confirmation"
                              name="confirmation"
                              error={
                                touched.confirmation && Boolean(errors.confirmation)
                              }
                              disabled={!campaignEditable}
                            >
                              <MenuItem value={false}>Desabilitada</MenuItem>
                              <MenuItem value={true}>Habilitada</MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>
                        <Grid xs={12} md={4} item>
                          <FormControl
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.formControl}
                          >
                            <InputLabel id="contactList-selection-label">
                              {i18n.t("campaigns.dialog.form.contactList")}
                            </InputLabel>
                            <Field
                              as={Select}
                              label={i18n.t("campaigns.dialog.form.contactList")}
                              placeholder={i18n.t(
                                "campaigns.dialog.form.contactList"
                              )}
                              labelId="contactList-selection-label"
                              id="contactListId"
                              name="contactListId"
                              error={
                                touched.contactListId && Boolean(errors.contactListId)
                              }
                              disabled={!campaignEditable}
                            >
                              <MenuItem value="">Nenhuma</MenuItem>
                              {contactLists &&
                                contactLists.map((contactList) => (
                                  <MenuItem
                                    key={contactList.id}
                                    value={contactList.id}
                                  >
                                    {contactList.name}
                                  </MenuItem>
                                ))}
                            </Field>
                          </FormControl>
                        </Grid>
                        <Grid xs={12} md={4} item>
                          <FormControl
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.formControl}
                          >
                            <InputLabel id="tagList-selection-label">
                              {i18n.t("campaigns.dialog.form.tagList")}
                            </InputLabel>
                            <Field
                              as={Select}
                              label={i18n.t("campaigns.dialog.form.tagList")}
                              placeholder={i18n.t("campaigns.dialog.form.tagList")}
                              labelId="tagList-selection-label"
                              id="tagListId"
                              name="tagListId"
                              error={touched.tagListId && Boolean(errors.tagListId)}
                              disabled={!campaignEditable}
                            >
                              {/* <MenuItem value="">Nenhuma</MenuItem> */}
                              {Array.isArray(tagLists) &&
                                tagLists.map((tagList) => (
                                  <MenuItem key={tagList.id} value={tagList.id}>
                                    {tagList.name}
                                  </MenuItem>
                                ))}
                            </Field>
                          </FormControl>
                        </Grid>

                        <Grid xs={12} md={4} item>
                          <FormControl
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.formControl}
                          >
                            <InputLabel id="whatsapp-selection-label">
                              {i18n.t("campaigns.dialog.form.whatsapp")}
                            </InputLabel>
                            <Field
                              as={Select}
                              // multiple
                              label={i18n.t("campaigns.dialog.form.whatsapp")}
                              placeholder={i18n.t("campaigns.dialog.form.whatsapp")}
                              labelId="whatsapp-selection-label"
                              id="whatsappIds"
                              name="whatsappIds"
                              required
                              error={touched.whatsappId && Boolean(errors.whatsappId)}
                              disabled={!campaignEditable}
                              value={whatsappId}
                              onChange={(event) => {
                                console.log(event.target.value)
                                setWhatsappId(event.target.value)
                              }}
                            // renderValue={(selected) => (
                            //   <div>
                            //     {selected.map((value) => (
                            //       <Chip key={value} label={whatsapps.find((whatsapp) => whatsapp.id === value).name} />
                            //     ))}
                            //   </div>
                            // )}
                            >
                              {whatsapps &&
                                whatsapps.map((whatsapp) => (
                                  <MenuItem key={whatsapp.id} value={whatsapp.id}>
                                    {whatsapp.name}
                                  </MenuItem>
                                ))}
                            </Field>
                          </FormControl>
                        </Grid>

                        <Grid xs={12} md={4} item>
                          <FormControl
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.formControl}
                          >
                            <InputLabel id="dispatch-strategy-label">
                              Estratégia de Envio
                            </InputLabel>
                            <Select
                              labelId="dispatch-strategy-label"
                              id="dispatch-strategy"
                              value={dispatchMode}
                              onChange={(e) => {
                                const value = e.target.value;
                                setDispatchMode(value);

                                if (value === "all") {
                                  setAllowedWhatsappIds(whatsapps.map(w => w.id));
                                  setDispatchStrategy("round_robin");
                                } else if (value === "baileys") {
                                  const ids = whatsapps.filter(w => w.channelType !== "official").map(w => w.id);
                                  setAllowedWhatsappIds(ids);
                                  setDispatchStrategy("round_robin");
                                } else if (value === "official") {
                                  const ids = whatsapps.filter(w => w.channelType === "official").map(w => w.id);
                                  setAllowedWhatsappIds(ids);
                                  setDispatchStrategy("round_robin");
                                } else if (value === "single") {
                                  setAllowedWhatsappIds([]);
                                  setDispatchStrategy("single");
                                } else if (value === "custom") {
                                  setDispatchStrategy("round_robin");
                                }
                              }}
                              label="Estratégia de Envio"
                              disabled={!campaignEditable}
                            >
                              <MenuItem value="single">
                                <Box>
                                  <Typography variant="body2">📱 Única conexão</Typography>
                                  <Typography variant="caption" color="textSecondary">
                                    Usa apenas a conexão principal
                                  </Typography>
                                </Box>
                              </MenuItem>

                              <MenuItem value="custom">
                                <Box>
                                  <Typography variant="body2">🎯 Rodízio personalizado</Typography>
                                  <Typography variant="caption" color="textSecondary">
                                    Você escolhe quais conexões usar
                                  </Typography>
                                </Box>
                              </MenuItem>

                              <MenuItem value="all">
                                <Box>
                                  <Typography variant="body2">🔄 Todas as conexões</Typography>
                                  <Typography variant="caption" color="textSecondary">
                                    Usa todas as {whatsapps.length} conexões disponíveis
                                  </Typography>
                                </Box>
                              </MenuItem>

                              <MenuItem value="baileys">
                                <Box>
                                  <Typography variant="body2">📱 Apenas Baileys (Grátis)</Typography>
                                  <Typography variant="caption" color="textSecondary">
                                    {whatsapps.filter(w => w.channelType !== "official").length} conexões disponíveis
                                  </Typography>
                                </Box>
                              </MenuItem>

                              <MenuItem value="official">
                                <Box>
                                  <Typography variant="body2">✅ Apenas API Oficial (R$ 0,50/msg)</Typography>
                                  <Typography variant="caption" color="textSecondary">
                                    {whatsapps.filter(w => w.channelType === "official").length} conexões disponíveis
                                  </Typography>
                                </Box>
                              </MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>

                        {dispatchMode === "custom" && (
                          <Grid xs={12} md={12} item>
                            <Autocomplete
                              multiple
                              options={whatsapps}
                              getOptionLabel={(option) => {
                                const type = option.channelType === "official" ? "API" : "Baileys";
                                const icon = option.channelType === "official" ? "✅" : "📱";
                                return `${icon} ${option.name} (${type})`;
                              }}
                              value={
                                Array.isArray(allowedWhatsappIds)
                                  ? whatsapps.filter(w => allowedWhatsappIds.includes(w.id))
                                  : []
                              }
                              onChange={(event, newValue) => {
                                const ids = newValue.map(w => w.id);
                                setAllowedWhatsappIds(ids);
                              }}
                              renderTags={(value, getTagProps) =>
                                value.map((option, index) => (
                                  <Chip
                                    variant="outlined"
                                    color={option.channelType === "official" ? "primary" : "default"}
                                    label={option.name}
                                    {...getTagProps({ index })}
                                  />
                                ))
                              }
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  variant="outlined"
                                  margin="dense"
                                  label="Escolha as conexões"
                                  placeholder="Ex: Selecione A, C, D..."
                                  helperText={`${allowedWhatsappIds.length} selecionadas`}
                                />
                              )}
                              disableCloseOnSelect
                              disabled={!campaignEditable}
                            />
                          </Grid>
                        )}

                        {allowedWhatsappIds.length > 0 && dispatchMode !== "single" && (
                          <Grid xs={12} md={12} item>
                            <Paper style={{ padding: 16, background: "#f5f5f5" }}>
                              <Typography variant="subtitle2" gutterBottom>📊 Resumo da Estratégia</Typography>
                              <Divider style={{ marginBottom: 12 }} />
                              {(() => {
                                const selected = whatsapps.filter(w => allowedWhatsappIds.includes(w.id));
                                const baileys = selected.filter(w => w.channelType !== "official");
                                const official = selected.filter(w => w.channelType === "official");
                                return (
                                  <>
                                    <Typography variant="body2"><strong>Total:</strong> {selected.length} conexões</Typography>
                                    <Typography variant="body2"><strong>📱 Baileys:</strong> {baileys.length}</Typography>
                                    <Typography variant="body2"><strong>✅ API Oficial:</strong> {official.length}</Typography>
                                    <Typography variant="body2" style={{ marginTop: 8 }}><strong>Ordem do rodízio:</strong></Typography>
                                    <Box display="flex" gap={0.5} flexWrap="wrap" mt={1}>
                                      {selected.map((w, idx) => (
                                        <Chip
                                          key={w.id}
                                          size="small"
                                          label={`${idx + 1}. ${w.name}`}
                                          color={w.channelType === "official" ? "primary" : "default"}
                                        />
                                      ))}
                                    </Box>
                                    {baileys.length > 0 && official.length > 0 && (
                                      <Alert severity="warning" style={{ marginTop: 12 }}>
                                        ⚠️ Você está misturando Baileys e API Oficial: velocidades diferentes, custos variáveis.
                                      </Alert>
                                    )}
                                  </>
                                );
                              })()}
                            </Paper>
                          </Grid>
                        )}

                        <Grid xs={12} md={4} item>
                          <Field
                            as={TextField}
                            label={i18n.t("campaigns.dialog.form.scheduledAt")}
                            name="scheduledAt"
                            error={touched.scheduledAt && Boolean(errors.scheduledAt)}
                            helperText={touched.scheduledAt && errors.scheduledAt}
                            variant="outlined"
                            margin="dense"
                            type="datetime-local"
                            InputLabelProps={{
                              shrink: true,
                            }}
                            fullWidth
                            className={classes.textField}
                            disabled={!campaignEditable}
                          />
                        </Grid>
                        <Grid xs={12} md={4} item>
                          <FormControl
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.formControl}
                          >
                            <InputLabel id="openTicket-selection-label">
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                {i18n.t("campaigns.dialog.form.openTicket")}
                                <Tooltip
                                  arrow
                                  placement="top"
                                  title={
                                    <div style={{ maxWidth: 360 }}>
                                      <Typography variant="body2" style={{ marginBottom: 6 }}>
                                        <strong>Habilitado</strong>: cria ticket normal (fluxo atendimento/bot).
                                      </Typography>
                                      <Typography variant="body2" style={{ marginBottom: 6 }}>
                                        <strong>Desabilitado</strong>: fica na aba <strong>Campanha</strong> até o contato responder.
                                      </Typography>
                                      <Typography variant="body2">
                                        <strong>Ao responder</strong>: se a fila tiver bot/agente (Chatbot ou RAG) vai para <strong>BOT</strong>; se não tiver, vai para <strong>Atendendo</strong>.
                                      </Typography>
                                    </div>
                                  }
                                >
                                  <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.8 }} />
                                </Tooltip>
                              </span>
                            </InputLabel>
                            <Field
                              as={Select}
                              label={i18n.t("campaigns.dialog.form.openTicket")}
                              placeholder={i18n.t(
                                "campaigns.dialog.form.openTicket"
                              )}
                              labelId="openTicket-selection-label"
                              id="openTicket"
                              name="openTicket"
                              error={
                                touched.openTicket && Boolean(errors.openTicket)
                              }
                              disabled={!campaignEditable}
                            >
                              <MenuItem value={"enabled"}>{i18n.t("campaigns.dialog.form.enabledOpenTicket")}</MenuItem>
                              <MenuItem value={"disabled"}>{i18n.t("campaigns.dialog.form.disabledOpenTicket")}</MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>
                        {/* SELECIONAR USUARIOS (múltiplos) */}
                        <Grid xs={12} md={4} item>
                          <Autocomplete
                            multiple
                            style={{ marginTop: '8px' }}
                            variant="outlined"
                            margin="dense"
                            className={classes.formControl}
                            getOptionLabel={(option) => `${option.name}`}
                            value={selectedUsers}
                            size="small"
                            openOnFocus
                            onOpen={ensureUsersLoaded}
                            onChange={(e, newValue) => {
                              setSelectedUsers(newValue || []);
                              // Se só um usuário selecionado, usar suas filas
                              if (newValue && newValue.length === 1 && Array.isArray(newValue[0].queues)) {
                                if (newValue[0].queues.length === 1) {
                                  setSelectedQueue(newValue[0].queues[0].id);
                                }
                                setQueues(newValue[0].queues);
                              } else {
                                // Múltiplos usuários ou nenhum: mostrar todas as filas
                                setQueues(allQueues);
                                if (newValue && newValue.length > 1) {
                                  // Manter fila selecionada se já houver
                                } else {
                                  setSelectedQueue("");
                                }
                              }
                            }}
                            options={options}
                            filterOptions={filterOptions}
                            freeSolo={false}
                            fullWidth
                            autoHighlight
                            disabled={!campaignEditable || values.openTicket === 'disabled'}
                            noOptionsText={i18n.t("transferTicketModal.noOptions")}
                            loading={loading}
                            renderOption={(option, { selected }) => (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <UserStatusIcon user={option} />
                                {option.name}
                                {option.tags && option.tags.length > 0 && (
                                  <span style={{ fontSize: '0.75rem', color: '#666', marginLeft: 4 }}>
                                    ({option.tags.filter(t => t.name.startsWith('#') && !t.name.startsWith('##')).map(t => t.name).join(', ')})
                                  </span>
                                )}
                              </span>
                            )}
                            renderTags={(value, getTagProps) =>
                              value.map((option, index) => (
                                <Chip
                                  key={option.id}
                                  label={option.name}
                                  size="small"
                                  {...getTagProps({ index })}
                                />
                              ))
                            }
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Usuários (distribuição por tags)"
                                variant="outlined"
                                helperText={selectedUsers.length > 1 ? "Tickets serão distribuídos por tags dos contatos" : ""}
                                InputProps={{
                                  ...params.InputProps,
                                  endAdornment: (
                                    <React.Fragment>
                                      {loading ? (
                                        <CircularProgress color="inherit" size={20} />
                                      ) : null}
                                      {params.InputProps.endAdornment}
                                    </React.Fragment>
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
                              value={selectedQueue}
                              onChange={(e) => setSelectedQueue(e.target.value)}
                              label={i18n.t("transferTicketModal.fieldQueuePlaceholder")}
                              required={selectedUsers.length > 0}
                              disabled={!campaignEditable}
                            >
                              {queues.map((queue) => (
                                <MenuItem key={queue.id} value={queue.id}>
                                  {queue.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>

                        {/* Alerta informativo quando openTicket=disabled */}
                        {values.openTicket === 'disabled' && (
                          <Grid item xs={12}>
                            <Alert severity="info" icon={<InfoOutlinedIcon />}>
                              <Typography variant="body2">
                                <strong>Modo Campanha:</strong> Os tickets ficarão na aba "Campanha" até o contato responder.
                                {selectedQueue && " Quando responder, será direcionado para a fila selecionada."}
                                {!selectedQueue && " Selecione uma fila para direcionar quando o contato responder."}
                              </Typography>
                            </Alert>
                          </Grid>
                        )}

                        {/* NOVO: Mapeamento de variáveis do template */}
                        {selectedTemplate && whatsappId && (
                          <Grid item xs={12}>
                            <Box mt={2} p={2} border={1} borderColor="divider" borderRadius={2}>
                              <TemplateVariableMapper
                                whatsappId={whatsappId}
                                templateName={selectedTemplate.name}
                                languageCode={selectedTemplate.language}
                                value={metaTemplateVariables}
                                onChange={(newValue) => {
                                  setMetaTemplateVariables(newValue);
                                  if (setFieldValueRef.current) {
                                    setFieldValueRef.current("metaTemplateVariables", newValue);
                                  }
                                }}
                                disabled={!campaignEditable}
                              />
                            </Box>
                          </Grid>
                        )}

                        <Grid xs={12} md={4} item>
                          <FormControl
                            variant="outlined"
                            margin="dense"
                            fullWidth
                            className={classes.formControl}
                          >
                            <InputLabel id="statusTicket-selection-label">
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                {i18n.t("campaigns.dialog.form.statusTicket")}
                                <Tooltip
                                  arrow
                                  placement="top"
                                  title={
                                    <div style={{ maxWidth: 360 }}>
                                      <Typography variant="body2" style={{ marginBottom: 6 }}>
                                        Define como o ticket nasce quando <strong>Abrir ticket</strong> estiver <strong>Habilitado</strong>.
                                      </Typography>
                                      <Typography variant="body2">
                                        <strong>Pendente</strong> não cai em Atendendo automaticamente. Quando o contato responder: <strong>BOT</strong> se a fila tiver Chatbot/RAG; senão <strong>Atendendo</strong>.
                                      </Typography>
                                    </div>
                                  }
                                >
                                  <InfoOutlinedIcon fontSize="small" style={{ opacity: 0.8 }} />
                                </Tooltip>
                              </span>
                            </InputLabel>
                            <Field
                              as={Select}
                              label={i18n.t("campaigns.dialog.form.statusTicket")}
                              placeholder={i18n.t(
                                "campaigns.dialog.form.statusTicket"
                              )}
                              labelId="statusTicket-selection-label"
                              id="statusTicket"
                              name="statusTicket"
                              error={
                                touched.statusTicket && Boolean(errors.statusTicket)
                              }
                              disabled={!campaignEditable || values.openTicket === 'disabled'}
                            >
                              <MenuItem value={"closed"}>{i18n.t("campaigns.dialog.form.closedTicketStatus")}</MenuItem>
                              <MenuItem value={"pending"}>{i18n.t("campaigns.dialog.form.pendingTicketStatus")}</MenuItem>
                              <MenuItem value={"open"}>{i18n.t("campaigns.dialog.form.openTicketStatus")}</MenuItem>
                            </Field>
                          </FormControl>
                        </Grid>

                        {/* Seletor de Templates Meta (API Oficial) */}
                        {(() => {
                          const selectedWhatsapp = whatsapps.find(w => w.id === whatsappId);
                          return selectedWhatsapp?.channelType === "official" ? (
                            <Grid xs={12} item>
                              <Alert severity="info" icon={<InfoOutlinedIcon />} style={{ marginBottom: 16 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                  <strong>✅ API Oficial detectada</strong>
                                </Typography>
                                <Typography variant="body2">
                                  Templates devem ser aprovados no Facebook Business Manager antes do uso em campanhas de marketing.
                                </Typography>
                              </Alert>

                              <FormControl fullWidth margin="dense" variant="outlined">
                                <InputLabel>Template Aprovado (Opcional)</InputLabel>
                                <Select
                                  value={selectedTemplate?.id || ""}
                                  onChange={(e) => {
                                    const template = availableTemplates.find(t => t.id === e.target.value);
                                    setSelectedTemplate(template);

                                    // Preencher primeira mensagem com corpo do template
                                    if (template?.components && setFieldValueRef.current) {
                                      const bodyComponent = template.components.find(c => c.type === "BODY");
                                      if (bodyComponent?.text) {
                                        setFieldValueRef.current("message1", bodyComponent.text);
                                      }
                                    }

                                    // Amarrar nome e idioma do template aos campos do formulário
                                    if (setFieldValueRef.current) {
                                      if (template) {
                                        setFieldValueRef.current("metaTemplateName", template.name || null);
                                        setFieldValueRef.current("metaTemplateLanguage", template.language || null);
                                      } else {
                                        // Caso selecione "Não usar template"
                                        setFieldValueRef.current("metaTemplateName", null);
                                        setFieldValueRef.current("metaTemplateLanguage", null);
                                      }
                                    }
                                  }}
                                  disabled={loadingTemplates || !campaignEditable}
                                  label="Template Aprovado (Opcional)"
                                >
                                  <MenuItem value="">
                                    <em>Não usar template (mensagem livre)</em>
                                  </MenuItem>
                                  {loadingTemplates ? (
                                    <MenuItem disabled>
                                      <CircularProgress size={20} style={{ marginRight: 8 }} />
                                      Carregando templates...
                                    </MenuItem>
                                  ) : (
                                    availableTemplates.map(template => (
                                      <MenuItem key={template.id} value={template.id}>
                                        <Box>
                                          <Typography variant="body2">
                                            <strong>{template.name}</strong> ({template.language})
                                          </Typography>
                                          <Typography variant="caption" color="textSecondary">
                                            {template.category} • Status: {template.status}
                                          </Typography>
                                        </Box>
                                      </MenuItem>
                                    ))
                                  )}
                                </Select>

                                {availableTemplates.length > 0 && (
                                  <FormHelperText style={{ color: "#4caf50" }}>
                                    ✅ {availableTemplates.length} template(s) disponível(is)
                                  </FormHelperText>
                                )}

                                {availableTemplates.length === 0 && !loadingTemplates && (
                                  <FormHelperText error>
                                    ⚠️ Nenhum template aprovado encontrado. Crie templates no Facebook Business Manager.
                                  </FormHelperText>
                                )}
                              </FormControl>

                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => window.open("https://business.facebook.com/wa/manage/message-templates", "_blank")}
                                style={{ marginTop: 8 }}
                              >
                                📝 Gerenciar Templates no Facebook
                              </Button>

                              {selectedTemplate && (
                                <Paper style={{ padding: 16, marginTop: 16, background: "#f5f5f5" }}>
                                  <Typography variant="subtitle2" gutterBottom>
                                    📄 Preview do Template Selecionado
                                  </Typography>
                                  <Divider style={{ marginBottom: 12 }} />
                                  {selectedTemplate.components.map((comp, idx) => (
                                    <Box key={idx} mb={1}>
                                      <Chip
                                        label={comp.type}
                                        size="small"
                                        style={{ marginRight: 8, marginBottom: 4 }}
                                        color={comp.type === "BODY" ? "primary" : "default"}
                                      />
                                      {comp.text && (
                                        <Typography variant="body2" style={{ fontFamily: "monospace", whiteSpace: "pre-wrap", marginTop: 4 }}>
                                          {comp.text}
                                        </Typography>
                                      )}
                                    </Box>
                                  ))}
                                </Paper>
                              )}
                            </Grid>
                          ) : null;
                        })()}

                        <Grid xs={12} item>
                          <Tabs
                            value={messageTab}
                            indicatorColor="primary"
                            textColor="primary"
                            onChange={(e, v) => setMessageTab(v)}
                            variant="fullWidth"
                            centered
                            style={{
                              background: "#f2f2f2",
                              border: "1px solid #e6e6e6",
                              borderRadius: 2,
                            }}
                          >
                            <Tab label="Msg. 1" index={0} />
                            <Tab label="Msg. 2" index={1} />
                            <Tab label="Msg. 3" index={2} />
                            <Tab label="Msg. 4" index={3} />
                            <Tab label="Msg. 5" index={4} />
                          </Tabs>
                          <Box style={{ paddingTop: 20, border: "none" }}>
                            {messageTab === 0 && (
                              <>
                                {renderTagsToolbar(values, setFieldValue, getMessageFieldByTab(0))}
                                {values.confirmation ? (
                                  <Grid spacing={2} container>
                                    <Grid xs={12} md={8} item>
                                      <>{renderMessageField("message1")}</>
                                    </Grid>
                                    <Grid xs={12} md={4} item>
                                      <>
                                        {renderConfirmationMessageField(
                                          "confirmationMessage1"
                                        )}
                                      </>
                                    </Grid>
                                  </Grid>
                                ) : (
                                  <>{renderMessageField("message1")}</>
                                )}
                                {renderTabAttachment(0, values, !campaignEditable)}
                              </>
                            )}
                            {messageTab === 1 && (
                              <>
                                {renderTagsToolbar(values, setFieldValue, getMessageFieldByTab(1))}
                                {values.confirmation ? (
                                  <Grid spacing={2} container>
                                    <Grid xs={12} md={8} item>
                                      <>{renderMessageField("message2")}</>
                                    </Grid>
                                    <Grid xs={12} md={4} item>
                                      <>
                                        {renderConfirmationMessageField(
                                          "confirmationMessage2"
                                        )}
                                      </>
                                    </Grid>
                                  </Grid>
                                ) : (
                                  <>{renderMessageField("message2")}</>
                                )}
                                {renderTabAttachment(1, values, !campaignEditable)}
                              </>
                            )}
                            {messageTab === 2 && (
                              <>
                                {renderTagsToolbar(values, setFieldValue, getMessageFieldByTab(2))}
                                {values.confirmation ? (
                                  <Grid spacing={2} container>
                                    <Grid xs={12} md={8} item>
                                      <>{renderMessageField("message3")}</>
                                    </Grid>
                                    <Grid xs={12} md={4} item>
                                      <>
                                        {renderConfirmationMessageField(
                                          "confirmationMessage3"
                                        )}
                                      </>
                                    </Grid>
                                  </Grid>
                                ) : (
                                  <>{renderMessageField("message3")}</>
                                )}
                                {renderTabAttachment(2, values, !campaignEditable)}
                              </>
                            )}
                            {messageTab === 3 && (
                              <>
                                {renderTagsToolbar(values, setFieldValue, getMessageFieldByTab(3))}
                                {values.confirmation ? (
                                  <Grid spacing={2} container>
                                    <Grid xs={12} md={8} item>
                                      <>{renderMessageField("message4")}</>
                                    </Grid>
                                    <Grid xs={12} md={4} item>
                                      <>
                                        {renderConfirmationMessageField(
                                          "confirmationMessage4"
                                        )}
                                      </>
                                    </Grid>
                                  </Grid>
                                ) : (
                                  <>{renderMessageField("message4")}</>
                                )}
                                {renderTabAttachment(3, values, !campaignEditable)}
                              </>
                            )}
                            {messageTab === 4 && (
                              <>
                                {renderTagsToolbar(values, setFieldValue, getMessageFieldByTab(4))}
                                {values.confirmation ? (
                                  <Grid spacing={2} container>
                                    <Grid xs={12} md={8} item>
                                      <>{renderMessageField("message5")}</>
                                    </Grid>
                                    <Grid xs={12} md={4} item>
                                      <>
                                        {renderConfirmationMessageField(
                                          "confirmationMessage5"
                                        )}
                                      </>
                                    </Grid>
                                  </Grid>
                                ) : (
                                  <>{renderMessageField("message5")}</>
                                )}
                                {renderTabAttachment(4, values, !campaignEditable)}
                              </>
                            )}
                          </Box>
                        </Grid>
                      </Grid>
                    </Box>

                    {/* Coluna direita - Preview */}
                    <Box
                      width={360}
                      style={{
                        borderLeft: "1px solid #e0e0e0",
                        background: "#fafafa",
                        padding: "20px",
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "center",
                        position: "sticky",
                        top: 0,
                        height: "calc(100vh - 240px)",
                        overflowY: "auto"
                      }}
                    >
                      <WhatsAppPreview
                        messages={[
                          values.message1,
                          values.message2,
                          values.message3,
                          values.message4,
                          values.message5,
                        ].filter(Boolean)}
                        mediaUrls={{
                          mediaUrl1: values.mediaUrl1,
                          mediaUrl2: values.mediaUrl2,
                          mediaUrl3: values.mediaUrl3,
                          mediaUrl4: values.mediaUrl4,
                          mediaUrl5: values.mediaUrl5,
                        }}
                        contactName="João Silva"
                        companyName={user?.company?.name || "Empresa"}
                      />
                    </Box>
                    {/* Dialog de Pré-visualização de Mídia */}
                    <Dialog open={previewOpen} onClose={closePreview} maxWidth="md" fullWidth>
                      <DialogTitle>{previewName || 'Pré-visualização'}</DialogTitle>
                      <DialogContent dividers>
                        {isImage(previewUrl) && (
                          <img src={previewUrl} alt={previewName || 'preview'} style={{ maxWidth: '100%', borderRadius: 4 }} />
                        )}
                        {isVideo(previewUrl) && (
                          <video src={previewUrl} controls style={{ width: '100%', borderRadius: 4 }} />
                        )}
                        {isAudio(previewUrl) && (
                          <audio src={previewUrl} controls style={{ width: '100%' }} />
                        )}
                        {isPdf(previewUrl) && (
                          <iframe title="pdf" src={previewUrl} style={{ width: '100%', height: '70vh', border: 'none' }} />
                        )}
                        {!isImage(previewUrl) && !isVideo(previewUrl) && !isAudio(previewUrl) && !isPdf(previewUrl) && (
                          <Typography variant="body2">Pré-visualização não disponível para este tipo de arquivo.</Typography>
                        )}
                      </DialogContent>
                      <DialogActions>
                        <Button onClick={closePreview} color="primary" variant="outlined">Fechar</Button>
                      </DialogActions>
                    </Dialog>
                    {/* Dialog Biblioteca de Arquivos (File Manager) */}
                    <Dialog
                      open={fileLibraryOpen}
                      onClose={closeLibraryPicker}
                      maxWidth="lg"
                      fullWidth
                      scroll="paper"
                    >
                      <DialogTitle>Selecionar arquivo da biblioteca</DialogTitle>
                      <DialogContent dividers style={{ padding: 0 }}>
                        <div style={{ display: "flex", height: "70vh", minHeight: 520 }}>
                          <Sidebar
                            currentFolderId={libraryCurrentFolder}
                            onFolderClick={(folder) => handleLibraryNavigateToFolder(folder)}
                          />

                          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                            <TopBar
                              searchValue={librarySearchValue}
                              onSearchChange={setLibrarySearchValue}
                              onCreateClick={() => toast.info("Criação de pastas disponível no File Manager")}
                              onUploadClick={() => setLibraryUploadOpen(true)}
                              onIndexAllClick={() => toast.info("Indexação disponível no File Manager")}
                              viewMode={libraryViewMode}
                              onViewModeChange={setLibraryViewMode}
                            />
                            <BreadcrumbNav
                              breadcrumbs={libraryBreadcrumbs}
                              onNavigate={handleLibraryNavigateBreadcrumb}
                            />
                            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                              {libraryLoading ? (
                                <div style={{ padding: 24, textAlign: "center" }}>
                                  <CircularProgress size={28} />
                                </div>
                              ) : (
                                <>
                                  {libraryViewMode === "grid" ? (
                                    <FolderGrid
                                      folders={filterItemsBySearch(libraryFolders, librarySearchValue)}
                                      files={filterItemsBySearch(libraryFiles, librarySearchValue)}
                                      onFolderClick={(folder) => handleLibraryNavigateToFolder(folder)}
                                      onFileClick={(file) => handleChooseFromLibrary(file)}
                                      onMenuAction={() => { }}
                                      selectedItems={[]}
                                      onSelectItem={() => { }}
                                    />
                                  ) : (
                                    <FolderList
                                      folders={filterItemsBySearch(libraryFolders, librarySearchValue)}
                                      files={filterItemsBySearch(libraryFiles, librarySearchValue)}
                                      onFolderClick={(folder) => handleLibraryNavigateToFolder(folder)}
                                      onFileClick={(file) => handleChooseFromLibrary(file)}
                                      onMenuAction={() => { }}
                                      selectedItems={[]}
                                      onSelectItem={() => { }}
                                      onSelectAll={() => { }}
                                    />
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                      <DialogActions>
                        <Button
                          onClick={() => setLibraryUploadOpen(true)}
                          color="primary"
                          variant="outlined"
                        >
                          Buscar do computador
                        </Button>
                        <Button onClick={closeLibraryPicker} color="primary" variant="outlined">Fechar</Button>
                      </DialogActions>
                    </Dialog>

                    <UploadModal
                      open={libraryUploadOpen}
                      onClose={() => setLibraryUploadOpen(false)}
                      currentFolder={libraryCurrentFolder}
                      user={user}
                      onUploadComplete={() => {
                        setLibraryUploadOpen(false);
                        try {
                          setLibraryLoading(true);
                          (async () => {
                            const foldersData = await libraryApi.fetchFolders(libraryCurrentFolder);
                            const filesData = libraryCurrentFolder ? await libraryApi.fetchFiles(libraryCurrentFolder) : [];
                            setLibraryFolders(Array.isArray(foldersData) ? foldersData : []);
                            setLibraryFiles(Array.isArray(filesData) ? filesData : []);
                          })().finally(() => setLibraryLoading(false));
                        } catch (_) {
                          setLibraryLoading(false);
                        }
                      }}
                    />

                  </DialogContent>
                  <DialogActions>
                    {/* Botões de controle da campanha */}
                    {campaignId && (
                      <div style={{ marginRight: 'auto', display: 'flex', gap: 8 }}>
                        {(campaign.status === "CANCELADA" || campaign.status === "PROGRAMADA") && (
                          <Button
                            color="primary"
                            onClick={() => restartCampaign()}
                            variant="outlined"
                            startIcon={<PlayCircleOutlineIcon />}
                          >
                            {campaign.status === "CANCELADA" ? "Retomar" : "Iniciar"}
                          </Button>
                        )}
                        {campaign.status === "EM_ANDAMENTO" && (
                          <Button
                            color="secondary"
                            onClick={() => cancelCampaign()}
                            variant="outlined"
                            startIcon={<PauseCircleOutlineIcon />}
                          >
                            Pausar
                          </Button>
                        )}
                      </div>
                    )}
                    {!attachment && !campaign.mediaPath && campaignEditable && (
                      <Button
                        color="primary"
                        onClick={() => setFileLibraryOpen(true)}
                        disabled={isSubmitting}
                        variant="outlined"
                      >
                        {i18n.t("campaigns.dialog.buttons.attach")}
                      </Button>
                    )}
                    <Button
                      onClick={handleClose}
                      color="primary"
                      disabled={isSubmitting}
                      variant="outlined"
                    >
                      {i18n.t("campaigns.dialog.buttons.close")}
                    </Button>
                    {(campaignEditable || campaign.status === "CANCELADA") && (
                      <>
                        {/* Botão Salvar - salva sem disparar, aguarda agendamento ou fica inativa */}
                        <Button
                          color="default"
                          disabled={isSubmitting}
                          variant="outlined"
                          onClick={() => handleSaveOnly(values, setSubmitting)}
                          style={{ marginRight: 8 }}
                        >
                          Salvar
                          {isSubmitting && (
                            <CircularProgress
                              size={20}
                              style={{ marginLeft: 8 }}
                            />
                          )}
                        </Button>
                        {/* Botão Enviar Agora - dispara imediatamente */}
                        <Button
                          type="submit"
                          color="primary"
                          disabled={isSubmitting}
                          variant="contained"
                          className={classes.btnWrapper}
                        >
                          Enviar Agora
                          {isSubmitting && (
                            <CircularProgress
                              size={24}
                              className={classes.buttonProgress}
                            />
                          )}
                        </Button>
                      </>
                    )}
                  </DialogActions>
                </Form>
              );
            }}
          </Formik>
        )}

        {assistantOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2500,
              background: 'rgba(0, 0, 0, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32
            }}
            onClick={handleCloseAssistant}
          >
            <div
              style={{
                position: 'relative',
                maxWidth: 920,
                width: '100%',
                pointerEvents: 'auto'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <ChatAssistantPanel
                open={assistantOpen}
                onClose={handleCloseAssistant}
                inputMessage={assistantDraft}
                setInputMessage={setAssistantDraft}
                queueId={assistantQueueIdRef.current}
                whatsappId={assistantWhatsappIdRef.current}
                assistantContext="campaign"
                targetField={assistantTargetField}
                actions={["replace", "append", "apply"]}
                contextSummary={assistantContextSummary}
                presets={assistantPresets}
                onApply={handleApplyAssistant}
                dialogMode
                title="Assistente de chat"
              />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};
export default CampaignModal;
