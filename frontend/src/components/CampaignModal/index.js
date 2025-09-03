import React, { useState, useEffect, useRef, useContext } from "react";

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
import AIIntegrationSelector from "../AIIntegrationSelector";
import {
  Box,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
} from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import ConfirmationModal from "../ConfirmationModal";
import UserStatusIcon from "../UserModal/statusIcon";
import Autocomplete, { createFilterOptions } from "@material-ui/lab/Autocomplete";
import useQueues from "../../hooks/useQueues";

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
    // IA - metadados opcionais por campanha
    aiIntegrationId: null,
    aiPrompt1: "",
    aiPrompt2: "",
    aiPrompt3: "",
    aiPrompt4: "",
    aiPrompt5: ""
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
      <Button size="small" variant="outlined" onClick={(e) => { setTagsTargetField(targetField); handleOpenTags(e); }}>Inserir #Tags</Button>
      <Tooltip title="Use variáveis como {nome}, {empresa}, {ticket}. Elas serão substituídas no envio.">
        <Typography variant="body2" style={{ opacity: 0.8 }}>
          Dica: personalize sua mensagem com variáveis.
        </Typography>
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
  const [whatsapps, setWhatsapps] = useState([]);
  const [selectedWhatsapps, setSelectedWhatsapps] = useState([]);
  const [dispatchStrategy, setDispatchStrategy] = useState("single");
  const [allowedWhatsappIds, setAllowedWhatsappIds] = useState([]);
  const [whatsappId, setWhatsappId] = useState(false);

  useEffect(() => {
    if (!campaignId && defaultWhatsappId) {
      setWhatsappId(defaultWhatsappId);
    }
  }, [defaultWhatsappId, campaignId]);

  const [contactLists, setContactLists] = useState([]);
  const [tagLists, setTagLists] = useState([]);
  const [messageTab, setMessageTab] = useState(0);
  const [attachment, setAttachment] = useState(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [campaignEditable, setCampaignEditable] = useState(true);
  const attachmentFile = useRef(null);

  const [options, setOptions] = useState([]);
  const [queues, setQueues] = useState([]);
  const [allQueues, setAllQueues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const { findAll: findAllQueues } = useQueues();

  // --- IA: geração de variações ---
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiTone, setAiTone] = useState("amigável");
  const [aiNumVariations, setAiNumVariations] = useState(2);
  const [aiBusinessContext, setAiBusinessContext] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGenerated, setAiGenerated] = useState([]);
  const [aiTargetField, setAiTargetField] = useState("message1");
  // Biblioteca de arquivos (FileManager)
  const [fileLibraryOpen, setFileLibraryOpen] = useState(false);
  const [fileLists, setFileLists] = useState([]);
  const [expandedFileIds, setExpandedFileIds] = useState({});
  const [filesSearch, setFilesSearch] = useState("");
  const [fileLibraryTargetIndex, setFileLibraryTargetIndex] = useState(null); // 0..4
  const setFieldValueRef = useRef(null);

  // Tags (#tags) - semelhante ao PromptModal
  const [tagsAnchorEl, setTagsAnchorEl] = useState(null);
  const [tagsSearch, setTagsSearch] = useState("");
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
  const extractPlaceholders = (text = "") => {
    const matches = text.match(/\{[^}]+\}/g) || [];
    return Array.from(new Set(matches));
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

  useEffect(() => {
    if (searchParam.length < 3) {
      setLoading(false);
      setSelectedQueue("");
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      setLoading(true);
      const fetchUsers = async () => {
        try {
          const { data } = await api.get("/users/");
          setOptions(data.users);
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
    if (isMounted.current) {
      if (initialValues) {
        setCampaign((prevState) => {
          return { ...prevState, ...initialValues };
        });
      }

      api
        .get(`/contact-lists/list`, { params: { companyId } })
        .then(({ data }) => setContactLists(data));

      api
        .get(`/whatsapp`, { params: { companyId, session: 0 } })
        .then(({ data }) => {
          // Mapear os dados recebidos da API para adicionar a propriedade 'selected'
          const mappedWhatsapps = data.map((whatsapp) => ({
            ...whatsapp,
            selected: false,
          }));

          setWhatsapps(mappedWhatsapps);
        });

      api.get(`/tags/list`, { params: { companyId, kanban: 0 } })
        .then(({ data }) => {
          const fetchedTags = data;
          // Perform any necessary data transformation here
          const formattedTagLists = fetchedTags
            .filter(tag => tag.contacts.length > 0)  // Filtra as tags com contacts.length > 0
            .map((tag) => ({
              id: tag.id,
              name: `${tag.name} (${tag.contacts.length})`,
            }));

          setTagLists(formattedTagLists);
        })
        .catch((error) => {
          console.error("Error retrieving tags:", error);
        });

      if (!campaignId) return;

      api.get(`/campaigns/${campaignId}`).then(({ data }) => {

        if (data?.user)
          setSelectedUser(data.user);

        if (data?.queue)
          setSelectedQueue(data.queue.id)

        if (data?.whatsappId) {
          // const selectedWhatsapps = data.whatsappId.split(",");
          setWhatsappId(data.whatsappId);
        }
        if (data?.dispatchStrategy) {
          setDispatchStrategy(data.dispatchStrategy);
        }
        if (data?.allowedWhatsappIds) {
          try {
            const parsed = typeof data.allowedWhatsappIds === 'string' ? JSON.parse(data.allowedWhatsappIds) : data.allowedWhatsappIds;
            if (Array.isArray(parsed)) setAllowedWhatsappIds(parsed);
          } catch (e) {}
        }
        setCampaign((prev) => {
          let prevCampaignData = Object.assign({}, prev);

          Object.entries(data).forEach(([key, value]) => {
            if (key === "scheduledAt" && value !== "" && value !== null) {
              prevCampaignData[key] = moment(value).format("YYYY-MM-DDTHH:mm");
            } else {
              prevCampaignData[key] = value === null ? "" : value;
            }
          });

          return prevCampaignData;
        });
      });
    }
  }, [campaignId, open, initialValues, companyId]);

  // Carregar listas simples de arquivos para a biblioteca (quando abrir)
  useEffect(() => {
    if (!fileLibraryOpen) return;
    let active = true;
    (async () => {
      try {
        const { data } = await api.get(`/files/list`, { params: { searchParam: filesSearch } });
        if (active) setFileLists(Array.isArray(data) ? data : []);
      } catch (_) {}
    })();
    return () => { active = false; };
  }, [fileLibraryOpen, filesSearch]);

  useEffect(() => {
    const now = moment();
    const scheduledAt = moment(campaign.scheduledAt);
    const moreThenAnHour =
      !Number.isNaN(scheduledAt.diff(now)) && scheduledAt.diff(now, "hour") > 1;
    const isEditable =
      campaign.status === "INATIVA" ||
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
      const dataValues = {
        ...values,  // Merge the existing values object
        whatsappId: whatsappId,
        userId: selectedUser?.id || null,
        queueId: selectedQueue || null,
        dispatchStrategy,
        allowedWhatsappIds
      };

      Object.entries(values).forEach(([key, value]) => {
        if (key === "scheduledAt" && value !== "" && value !== null) {
          dataValues[key] = moment(value).format("YYYY-MM-DD HH:mm:ss");
        } else {
          dataValues[key] = value === "" ? null : value;
        }
      });

      if (campaignId) {
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

  const getCurrentAiPromptField = () => {
    switch (messageTab) {
      case 0: return "aiPrompt1";
      case 1: return "aiPrompt2";
      case 2: return "aiPrompt3";
      case 3: return "aiPrompt4";
      case 4: return "aiPrompt5";
      default: return "aiPrompt1";
    }
  };

  const handleChooseFromLibrary = async (opt) => {
    try {
      const idx = Number.isInteger(fileLibraryTargetIndex) ? fileLibraryTargetIndex : messageTab;
      const fileUrl = opt.url || opt.path;
      if (!fileUrl) {
        toast.error("Arquivo sem URL disponível");
        return;
      }
      if (!isAllowedMedia(opt)) {
        toast.error("Tipo de arquivo não suportado para envio. Permitidos: imagens, áudio, vídeo e PDF.");
        return;
      }
      const filename = opt.name || (opt.path ? opt.path.split("/").pop() : null) || "arquivo.bin";
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
        maxWidth="md"
        scroll="paper"
      >
        <DialogTitle id="form-dialog-title">
          {campaignEditable ? (
            <>
              {campaignId
                ? `${i18n.t("campaigns.dialog.update")}`
                : `${i18n.t("campaigns.dialog.new")}`}
            </>
          ) : (
            <>{`${i18n.t("campaigns.dialog.readonly")}`}</>
          )}
        </DialogTitle>
        <div style={{ display: "none" }}>
          <input
            type="file"
            ref={attachmentFile}
            onChange={(e) => handleAttachmentFile(e)}
          />
        </div>
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
          {({ values, errors, touched, isSubmitting, setFieldValue }) => (
            <Form>
              {(() => { setFieldValueRef.current = setFieldValue; return null; })()}
              <DialogContent dividers>
                <Grid spacing={2} container>
                  {/* Botão IA - aplica na mensagem da aba atual */}
                  <Grid xs={12} item>
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={() => {
                        setAiTargetField(getMessageFieldByTab(messageTab));
                        setAiGenerated([]);
                        setAiDialogOpen(true);
                      }}
                      disabled={!campaignEditable}
                    >
                      Gerar variações com IA (aba atual)
                    </Button>
                  </Grid>
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
                  {/* Integração IA (override) e Prompt por aba */}
                  <Grid xs={12} item>
                    <AIIntegrationSelector
                      value={values.aiIntegrationId}
                      onChange={(integrationId) => setFieldValue('aiIntegrationId', integrationId)}
                      helperText="Selecione uma integração IA para esta campanha (opcional)"
                    />
                  </Grid>
                  <Grid xs={12} item>
                    {renderTagsToolbar(values, setFieldValue, getCurrentAiPromptField())}
                    <TextField
                      label="Prompt da campanha (aba atual)"
                      placeholder="Descreva o contexto, objetivo e restrições para gerar as variações desta aba."
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      multiline
                      rows={4}
                      value={values[getCurrentAiPromptField()] || ""}
                      onChange={(e) => setFieldValue(getCurrentAiPromptField(), e.target.value)}
                      helperText="Dica: use variáveis como {nome}, {empresa}, {pedido}."
                      disabled={!campaignEditable}
                    />
                  </Grid>
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
                      <InputLabel id="dispatchStrategy-selection-label">
                        Estratégia de envio
                      </InputLabel>
                      <Select
                        labelId="dispatchStrategy-selection-label"
                        id="dispatchStrategy"
                        label="Estratégia de envio"
                        value={dispatchStrategy}
                        onChange={(e) => setDispatchStrategy(e.target.value)}
                        disabled={!campaignEditable}
                      >
                        <MenuItem value="single">Única conexão</MenuItem>
                        <MenuItem value="round_robin">Rodízio entre conexões</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  {dispatchStrategy === 'round_robin' && (
                    <Grid xs={12} md={8} item>
                      <Autocomplete
                        multiple
                        options={whatsapps}
                        getOptionLabel={(option) => option.name}
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
                            <Chip variant="default" label={option.name} {...getTagProps({ index })} />
                          ))
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            variant="outlined"
                            margin="dense"
                            label="Conexões (quando rodízio)"
                            placeholder="Selecione as conexões para o rodízio"
                          />
                        )}
                        disableCloseOnSelect
                        disabled={!campaignEditable}
                      />
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
                        {i18n.t("campaigns.dialog.form.openTicket")}
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
                  {/* SELECIONAR USUARIO */}
                  <Grid xs={12} md={4} item>
                    <Autocomplete
                      style={{ marginTop: '8px' }}
                      variant="outlined"
                      margin="dense"
                      className={classes.formControl}
                      getOptionLabel={(option) => `${option.name}`}
                      value={selectedUser}
                      size="small"
                      onChange={(e, newValue) => {
                        setSelectedUser(newValue);
                        if (newValue != null && Array.isArray(newValue.queues)) {
                          if (newValue.queues.length === 1) {
                            setSelectedQueue(newValue.queues[0].id);
                          }
                          setQueues(newValue.queues);

                        } else {
                          setQueues(allQueues);
                          setSelectedQueue("");
                        }
                      }}
                      options={options}
                      filterOptions={filterOptions}
                      freeSolo
                      fullWidth
                      autoHighlight
                      disabled={!campaignEditable || values.openTicket === 'disabled'}
                      noOptionsText={i18n.t("transferTicketModal.noOptions")}
                      loading={loading}
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
                        required={!isNil(selectedUser)}
                        disabled={!campaignEditable || values.openTicket === 'disabled'}
                      >
                        {queues.map((queue) => (
                          <MenuItem key={queue.id} value={queue.id}>
                            {queue.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid xs={12} md={4} item>
                    <FormControl
                      variant="outlined"
                      margin="dense"
                      fullWidth
                      className={classes.formControl}
                    >
                      <InputLabel id="statusTicket-selection-label">
                        {i18n.t("campaigns.dialog.form.statusTicket")}
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
                  {/* Dialog de IA */}
                  <Dialog open={aiDialogOpen} onClose={() => setAiDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Gerar variações com IA</DialogTitle>
                    <DialogContent dividers>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <TextField
                            select
                            SelectProps={{ native: true }}
                            label="Tom da mensagem"
                            fullWidth
                            margin="dense"
                            variant="outlined"
                            value={aiTone}
                            onChange={(e) => setAiTone(e.target.value)}
                          >
                            <option value="amigável">Amigável</option>
                            <option value="profissional">Profissional</option>
                            <option value="promocional">Promocional</option>
                          </TextField>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            type="number"
                            label="Nº de variações"
                            fullWidth
                            margin="dense"
                            variant="outlined"
                            inputProps={{ min: 1, max: 5 }}
                            value={aiNumVariations}
                            onChange={(e) => setAiNumVariations(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label="Contexto do negócio (opcional)"
                            fullWidth
                            margin="dense"
                            variant="outlined"
                            multiline
                            rows={3}
                            value={aiBusinessContext}
                            onChange={(e) => setAiBusinessContext(e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <Button
                            variant="contained"
                            color="primary"
                            onClick={async () => {
                              try {
                                setAiLoading(true);
                                setAiGenerated([]);
                                const baseText = values[aiTargetField] || "";
                                const variables = extractPlaceholders(baseText);
                                const promptExtra = values[getCurrentAiPromptField()] || "";
                                const { data } = await api.post('/ai/generate-campaign-messages', {
                                  baseText,
                                  variables,
                                  tone: aiTone,
                                  numVariations: aiNumVariations,
                                  language: 'pt-BR',
                                  businessContext: [promptExtra, aiBusinessContext].filter(Boolean).join('\n')
                                });
                                setAiGenerated(Array.isArray(data?.variations) ? data.variations : []);
                              } catch (err) {
                                toastError(err);
                              } finally {
                                setAiLoading(false);
                              }
                            }}
                            disabled={aiLoading}
                          >
                            {aiLoading ? 'Gerando...' : 'Gerar'}
                          </Button>
                        </Grid>
                        {aiGenerated.length > 0 && (
                          <Grid item xs={12}>
                            <div style={{ marginTop: 8 }}>
                              {aiGenerated.map((text, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                                  <TextField
                                    value={text}
                                    fullWidth
                                    variant="outlined"
                                    multiline
                                    rows={2}
                                  />
                                  <Button
                                    variant="outlined"
                                    color="primary"
                                    onClick={() => {
                                      // aplica no campo atual usando Formik
                                      setFieldValue(aiTargetField, text);
                                      toast.success('Variação aplicada ao campo da aba atual.');
                                    }}
                                  >
                                    Aplicar
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </Grid>
                        )}
                      </Grid>
                    </DialogContent>
                    <DialogActions>
                      <Button onClick={() => setAiDialogOpen(false)} color="primary" variant="outlined">Fechar</Button>
                    </DialogActions>
                  </Dialog>
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
                  {/* Dialog Biblioteca de Arquivos */}
                  <Dialog open={fileLibraryOpen} onClose={() => setFileLibraryOpen(false)} maxWidth="md" fullWidth scroll="paper">
                    <DialogTitle>Selecionar arquivo da biblioteca</DialogTitle>
                    <DialogContent dividers>
                      <TextField
                        value={filesSearch}
                        onChange={(e) => setFilesSearch(e.target.value)}
                        placeholder="Buscar listas de arquivos..."
                        variant="outlined"
                        size="small"
                        fullWidth
                        style={{ marginBottom: 8 }}
                      />
                      <div>
                        {(fileLists || []).map(fl => {
                          const open = !!expandedFileIds[fl.id];
                          return (
                            <div key={fl.id} style={{ border: '1px solid #eee', borderRadius: 6, marginBottom: 8 }}>
                              <div style={{ padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                   onClick={async () => {
                                     setExpandedFileIds(prev => ({ ...prev, [fl.id]: !open }));
                                     if (!open) {
                                       try {
                                         const { data } = await api.get(`/files/${fl.id}`);
                                         setExpandedFileIds(prev => ({ ...prev, [fl.id]: data }));
                                       } catch (_) {}
                                     }
                                   }}>
                                <strong>{fl.name}</strong>
                                <span style={{ fontSize: 12, opacity: 0.7 }}>{open ? 'Ocultar' : 'Mostrar'}</span>
                              </div>
                              {open && (
                                <div style={{ padding: 8 }}>
                                  {((expandedFileIds[fl.id] && expandedFileIds[fl.id].options) || []).map(opt => (
                                    <div key={opt.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px', borderBottom: '1px dashed #eee' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: 14 }}>{opt.name || opt.path || `Opção ${opt.id}`}</span>
                                        <span style={{ fontSize: 12, opacity: 0.7 }}>{opt.mediaType || ''}</span>
                                      </div>
                                      <Button size="small" variant="outlined" color="primary" onClick={() => handleChooseFromLibrary(opt)}>
                                        Usar este arquivo
                                      </Button>
                                    </div>
                                  ))}
                                  {(!expandedFileIds[fl.id] || !expandedFileIds[fl.id].options || expandedFileIds[fl.id].options.length === 0) && (
                                    <div style={{ padding: 8, fontSize: 12, opacity: 0.7 }}>Sem opções nesta lista.</div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {(!fileLists || fileLists.length === 0) && (
                          <div style={{ padding: 12, textAlign: 'center', opacity: 0.7 }}>Nenhuma lista encontrada.</div>
                        )}
                      </div>
                    </DialogContent>
                    <DialogActions>
                      <Button onClick={() => setFileLibraryOpen(false)} color="primary" variant="outlined">Fechar</Button>
                    </DialogActions>
                  </Dialog>
                  
                  {(campaign.mediaPath || attachment) && (
                    <Grid xs={12} item>
                      <Button startIcon={<AttachFileIcon />}>
                        {attachment != null
                          ? attachment.name
                          : campaign.mediaName}
                      </Button>
                      {campaignEditable && (
                        <IconButton
                          onClick={() => setConfirmationOpen(true)}
                          color="primary"
                        >
                          <DeleteOutlineIcon color="secondary" />
                        </IconButton>
                      )}
                    </Grid>
                  )}
                </Grid>
              </DialogContent>
              <DialogActions>
                {campaign.status === "CANCELADA" && (
                  <Button
                    color="primary"
                    onClick={() => restartCampaign()}
                    variant="outlined"
                  >
                    {i18n.t("campaigns.dialog.buttons.restart")}
                  </Button>
                )}
                {campaign.status === "EM_ANDAMENTO" && (
                  <Button
                    color="primary"
                    onClick={() => cancelCampaign()}
                    variant="outlined"
                  >
                    {i18n.t("campaigns.dialog.buttons.cancel")}
                  </Button>
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
                  <Button
                    type="submit"
                    color="primary"
                    disabled={isSubmitting}
                    variant="contained"
                    className={classes.btnWrapper}
                  >
                    {campaignId
                      ? `${i18n.t("campaigns.dialog.buttons.edit")}`
                      : `${i18n.t("campaigns.dialog.buttons.add")}`}
                    {isSubmitting && (
                      <CircularProgress
                        size={24}
                        className={classes.buttonProgress}
                      />
                    )}
                  </Button>
                )}
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default CampaignModal;