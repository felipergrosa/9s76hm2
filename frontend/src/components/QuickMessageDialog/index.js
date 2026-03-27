import React, { useContext, useState, useEffect, useRef } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import CircularProgress from "@material-ui/core/CircularProgress";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import IconButton from "@material-ui/core/IconButton";
import ClickAwayListener from "@material-ui/core/ClickAwayListener";
import { Smile } from "lucide-react";
import WhatsAppPopover from "../WhatsAppPopover";
import { i18n } from "../../translate/i18n";
import { head, cloneDeep } from "lodash";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import MessageVariablesPicker from "../MessageVariablesPicker";
import ButtonWithSpinner from "../ButtonWithSpinner";

import {
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  Menu,
} from "@material-ui/core";
import ConfirmationModal from "../ConfirmationModal";
import Autocomplete, { createFilterOptions } from "@material-ui/lab/Autocomplete";
import { Tooltip, Popover, Box, Paper } from "@material-ui/core";
import ChatAssistantPanel from "../ChatAssistantPanel";
import StarsIcon from "@material-ui/icons/Stars";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import AddIcon from "@material-ui/icons/Add";
import AccessTimeIcon from "@material-ui/icons/AccessTime";
import TextFieldsIcon from "@material-ui/icons/TextFields";
import CloseIcon from "@material-ui/icons/Close";
import MoreVertIcon from "@material-ui/icons/MoreVert";


const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  multFieldLine: {
    display: "flex",
    "& > *:not(:last-child)": {
      marginRight: theme.spacing(1),
    },
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
  attachmentCard: {
    display: "flex",
    alignItems: "center",
    padding: "8px",
    borderRadius: "8px",
    border: "1px solid rgba(0, 0, 0, 0.12)",
    backgroundColor: theme.palette.background.paper,
    transition: "all 0.2s",
    "&:hover": {
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      borderColor: theme.palette.primary.main,
    },
  },
  attachmentThumb: {
    width: 48,
    height: 48,
    borderRadius: 4,
    objectFit: "cover",
    marginRight: 12,
  },
  attachmentIcon: {
    width: 48,
    height: 48,
    borderRadius: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    marginRight: 12,
    color: theme.palette.text.secondary,
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
  delayCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2px 12px",
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderRadius: "16px",
    border: "1px solid rgba(245, 158, 11, 0.2)",
    width: "fit-content",
    margin: "0 auto",
  },
  delayInput: {
    "& .MuiInputBase-input": {
      textAlign: "center",
      fontSize: "1.5rem",
      fontWeight: "bold",
      color: theme.palette.primary.main,
    },
    "& .MuiOutlinedInput-notchedOutline": {
      border: "none",
    },
    width: "80px",
  },
  attachmentCardCompact: {
    display: "flex",
    alignItems: "center",
    padding: "6px 12px",
    borderRadius: "10px",
    border: "1px solid rgba(0, 0, 0, 0.08)",
    backgroundColor: theme.palette.background.paper,
  },
  flowContainer: {
    position: "relative",
    paddingLeft: "32px",
    "&::before": {
      content: '""',
      position: "absolute",
      left: "14px",
      top: "10px",
      bottom: "40px",
      width: "2px",
      backgroundColor: "rgba(0, 0, 0, 0.1)",
      zIndex: 0,
    }
  },
  lastNodeItem: {
    "&::after": {
       content: '""',
       position: "absolute",
       left: "-18px",
       top: "12px",
       bottom: 0,
       width: "2px",
       backgroundColor: "#fff", // Esconde a linha que sobra
       zIndex: 1,
    }
  },
  nodeItem: {
    position: "relative",
    marginBottom: "16px",
    "&::before": {
      content: '""',
      position: "absolute",
      left: "-23px",
      top: "12px",
      width: "12px",
      height: "12px",
      borderRadius: "50%",
      backgroundColor: "#fff",
      border: `2px solid ${theme.palette.primary.main}`,
      zIndex: 2,
    }
  },
  nodeCard: {
    padding: "16px 20px 16px 24px", // Padding ajustado para borda menos pronunciada
    borderRadius: "20px",
    transition: "all 0.2s",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
    border: "none",
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#fff",
    "&:hover": {
      boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
    }
  },
  flowAddButton: {
    borderRadius: 20, 
    textTransform: 'none', 
    backgroundColor: 'white',
    transition: 'all 0.15s ease-in-out',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    '&:hover': {
      transform: 'scale(1.05)',
      boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
      backgroundColor: 'white'
    },
    '&:active': {
      transform: 'scale(0.95)'
    }
  },
  uploadInput: {
    display: "none",
  },
}));

const QuickeMessageSchema = Yup.object().shape({
  shortcode: Yup.string().required("Obrigatório"),
  //   message: Yup.string().required("Obrigatório"),
});

const parseStoredArray = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [value];
    } catch (error) {
      return value ? [value] : [];
    }
  }

  return [];
};

const hydrateFlowItems = (data) => {
  const mediaPaths = parseStoredArray(data?.mediaPath);
  const mediaNames = parseStoredArray(data?.mediaName);
  const fallbackText = { type: "text", value: data?.message || "" };

  if (!data?.flow) {
    return [
      fallbackText,
      ...mediaPaths.map((file, index) => ({
        type: "media",
        value: file,
        serverFilename: file,
        filename: mediaNames[index] || file,
        filenameOriginal: mediaNames[index] || file,
        createdAt: data?.updatedAt || data?.createdAt || new Date().toISOString(),
      })),
    ];
  }

  try {
    const parsedFlow = typeof data.flow === "string" ? JSON.parse(data.flow) : data.flow;
    if (!Array.isArray(parsedFlow) || parsedFlow.length === 0) {
      return [fallbackText];
    }

    let mediaIndex = 0;
    return parsedFlow.map((item) => {
      const baseItem = {
        ...item,
        createdAt: item.createdAt || data?.updatedAt || data?.createdAt || new Date().toISOString()
      };

      if (baseItem.type !== "media") {
        return baseItem;
      }

      const rawValue = baseItem.serverFilename || baseItem.value || mediaPaths[mediaIndex];
      const originalName =
        baseItem.filenameOriginal ||
        baseItem.filename ||
        mediaNames[mediaIndex] ||
        rawValue;

      mediaIndex += 1;

      return {
        ...baseItem,
        value: rawValue,
        serverFilename: rawValue,
        filename: originalName,
        filenameOriginal: originalName,
      };
    });
  } catch (error) {
    return [fallbackText];
  }
};

const QuickMessageDialog = ({ open, onClose, quickemessageId, reload, initialData }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const messageInputRef = useRef();

  const initialState = {
    shortcode: "",
    message: "",
    geral: true,
    status: true,
    visao: true,
    groupName: "",
    color: "#4B5563",
    delay: 0,
    sendAsCaption: true,
    flow: null
  };

  const colors = [
    { label: "Cinza", value: "#4B5563" },
    { label: "Vermelho", value: "#EF4444" },
    { label: "Amarelo", value: "#F59E0B" },
    { label: "Verde", value: "#10B981" },
    { label: "Azul", value: "#3B82F6" },
    { label: "Roxo", value: "#8B5CF6" },
  ];

  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [quickemessage, setQuickemessage] = useState(initialState);
  const [attachments, setAttachments] = useState([]);
  const [optionsGroups, setOptionsGroups] = useState([]);
  const attachmentFile = useRef(null);
  const [deletingFile, setDeletingFile] = useState(null);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const [tagAnchorEl, setTagAnchorEl] = useState(null);
  const [addMenuAnchorEl, setAddMenuAnchorEl] = useState(null);
  const [flowItems, setFlowItems] = useState([]);
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [quickMessages, setQuickMessages] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);

  useEffect(() => {
    if (!open) return;

    try {
      (async () => {
        if (!quickemessageId) {
          // Reset para novo item ou clonagem
          const baseData = initialData ? { ...initialState, ...initialData } : initialState;
          setQuickemessage(baseData);
          setFlowItems(initialData ? hydrateFlowItems(initialData) : []);
          return;
        }

        const { data } = await api.get(`/quick-messages/${quickemessageId}`);

        setQuickemessage((prevState) => {
          return { ...prevState, ...data };
        });

        setFlowItems(hydrateFlowItems(data));
      })();
    } catch (err) {
      toastError(err);
    }
  }, [quickemessageId, open, initialData]);

  useEffect(() => {
    try {
      (async () => {
        if (!open) return;
        const { data } = await api.get(`/quick-messages/list`);
        setQuickMessages(data); // Novo state para guardar a lista completa
        const uniqueGroups = [...new Set(data.map(item => item.groupName).filter(Boolean))];
        setOptionsGroups(uniqueGroups);
      })();
    } catch (err) {
      toastError(err);
    }
  }, [open]);

  // Efeito para sincronizar cor ao mudar categoria
  useEffect(() => {
    if (quickMessages.length > 0 && quickemessage.groupName) {
      const categoryMsg = quickMessages.find(msg => msg.groupName === quickemessage.groupName);
      if (categoryMsg && categoryMsg.color && categoryMsg.color !== quickemessage.color) {
        setQuickemessage(prev => ({ ...prev, color: categoryMsg.color }));
      }
    }
  }, [quickemessage.groupName, quickMessages]);

  const handleClose = () => {
    setQuickemessage(initialState);
    setFlowItems([]);
    setAttachments([]);
    onClose();
  };

  const handleAttachmentFile = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      const newItems = files.map(file => ({
        type: 'media',
        value: null,
        filename: file.name,
        file: file, // Objeto File para upload posterior
        createdAt: new Date().toISOString(),
        size: file.size
      }));
      setFlowItems(prev => [...prev, ...newItems]);
    }
  };

  const handleSaveQuickeMessage = async (values) => {
    try {
      let recordId = quickemessageId;
      const newFlowItems = [...flowItems];

      // 1. Se for novo, cria primeiro para obter ID (necessário para upload de arquivos)
      if (!recordId) {
        const { data } = await api.post("/quick-messages", {
          ...values,
          flow: JSON.stringify([]),
          message: flowItems.find(i => i.type === 'text')?.value || ""
        });
        recordId = data.id;
      }

      // Validação crítica: garantir que recordId existe antes de fazer upload
      if (!recordId) {
        throw new Error("Erro ao obter ID da mensagem rápida");
      }

      // 2. Upload de arquivos pendentes
      for (let i = 0; i < newFlowItems.length; i++) {
        const item = newFlowItems[i];
        if (item.type === 'media' && item.file) {
          const formData = new FormData();
          formData.append("medias", item.file);
          
          const { data: uploadData } = await api.post(`/quick-messages/${recordId}/media-upload`, formData);
          
          if (!uploadData || !uploadData.filenames || uploadData.filenames.length === 0) {
            throw new Error("Erro ao fazer upload do arquivo");
          }
          
          const filename = uploadData.filenames[0];
          
          item.value = filename;
          item.serverFilename = filename;
          item.filename = uploadData.files[0];
          item.filenameOriginal = uploadData.files[0];
          item.size = item.size || item.file?.size;
          delete item.file;
        }
      }

      // 3. Montar arrays de mediaPath e mediaName baseados no fluxo atual
      const mediaPaths = [];
      const mediaNames = [];
      newFlowItems.forEach(item => {
        if (item.type === 'media') {
          // O item.value (ou serverFilename) contém o nome do arquivo gerado pelo servidor
          if (item.serverFilename || item.value) {
            mediaPaths.push(item.serverFilename || item.value);
            mediaNames.push(item.filenameOriginal || item.filename || item.value);
          }
        }
      });

      // 4. Atualizar registro final com o fluxo completo
      const normalizedFlowItems = newFlowItems.map((item) => {
        if (item.type !== "media") {
          return item;
        }

        const serverFilename = item.serverFilename || item.value;
        const originalName = item.filenameOriginal || item.filename || serverFilename;

        return {
          ...item,
          value: serverFilename,
          serverFilename,
          filename: originalName,
          filenameOriginal: originalName
        };
      });

      const dataToSave = {
        ...values,
        flow: JSON.stringify(normalizedFlowItems),
        message: normalizedFlowItems.find(i => i.type === 'text')?.value || "",
        mediaPath: mediaPaths.length > 0 ? JSON.stringify(mediaPaths) : null,
        mediaName: mediaNames.length > 0 ? JSON.stringify(mediaNames) : null
      };

      await api.put(`/quick-messages/${recordId}`, dataToSave);

      toast.success(i18n.t("quickMessages.toasts.success"));
      if (typeof reload == "function") {
        reload();
      }
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  const deleteMedia = async (filename) => {
    if (filename instanceof File) {
      setAttachments(prev => prev.filter(f => f !== filename));
      return;
    }

    const fileToDelete = filename || deletingFile;

    try {
      await api.delete(`/quick-messages/${quickemessage.id}/media-upload`, {
        params: { filename: fileToDelete }
      });
      
      const { data } = await api.get(`/quick-messages/${quickemessage.id}`);
      setQuickemessage(data);
      
      toast.success(i18n.t("quickMessages.toasts.deleted"));
      if (typeof reload == "function") {
        reload();
      }
    } catch (err) {
      toastError(err);
    }
    setDeletingFile(null);
  };

  const handleClickMsgVar = (variable, setFieldValue, values) => {
    const firstPartValue = values.message.substring(0, messageInputRef.current.selectionStart);
    const secondPartValue = values.message.substring(messageInputRef.current.selectionEnd);

    const newCursorPos = (firstPartValue + variable).length;

    setFieldValue("message", `${firstPartValue}${variable}${secondPartValue}`);

    setTimeout(() => {
      messageInputRef.current.focus();
      messageInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleEmojiSelect = (emoji, index) => {
    const items = [...flowItems];
    const currentText = items[index].value || "";
    const input = document.getElementById(`flow-item-${index}`);
    const start = input?.selectionStart || currentText.length;
    const end = input?.selectionEnd || currentText.length;

    const newValue = currentText.substring(0, start) + emoji + currentText.substring(end);
    items[index].value = newValue;
    setFlowItems(items);

    setTimeout(() => {
      input?.focus();
      const newPos = start + emoji.length;
      input?.setSelectionRange(newPos, newPos);
    }, 0);
    setEmojiAnchorEl(null);
  };

  const handleTagSelect = (variable, index) => {
    const items = [...flowItems];
    const currentText = items[index].value || "";
    const input = document.getElementById(`flow-item-${index}`);
    const start = input?.selectionStart || currentText.length;
    const end = input?.selectionEnd || currentText.length;

    const newValue = currentText.substring(0, start) + variable + currentText.substring(end);
    items[index].value = newValue;
    setFlowItems(items);

    setTimeout(() => {
      input?.focus();
      const newPos = start + variable.length;
      input?.setSelectionRange(newPos, newPos);
    }, 0);
    setTagAnchorEl(null);
  };

  const addFlowItem = (type) => {
    const items = [...flowItems];
    if (type === 'text') items.push({ type: 'text', value: '', createdAt: new Date().toISOString() });
    else if (type === 'delay') items.push({ type: 'delay', value: 3, createdAt: new Date().toISOString() });
    else if (type === 'media') attachmentFile.current.click();
    
    if (type !== 'media') setFlowItems(items);
    setAddMenuAnchorEl(null);
  };

  const removeFlowItem = (index) => {
    const items = [...flowItems];
    items.splice(index, 1);
    setFlowItems(items);
  };

  const updateFlowItem = (index, value) => {
    const items = [...flowItems];
    items[index].value = value;
    setFlowItems(items);
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const getFileIcon = (filename) => {
    if (!filename) return <AttachFileIcon />;
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return null; 
    if (['mp4', 'mov', 'avi'].includes(ext)) return null; 
    if (['mp3', 'wav', 'ogg'].includes(ext)) return <AttachFileIcon style={{ color: '#8B5CF6', fontSize: 24 }} />;
    if (['pdf'].includes(ext)) return <Typography variant="h6" style={{ color: '#EF4444', fontWeight: 900, fontSize: '0.8rem' }}>PDF</Typography>;
    return <AttachFileIcon style={{ fontSize: 24 }} />;
  };

  const MediaPreviewModal = ({ item, onClose }) => {
    if (!item) return null;

    const fileLabel = item.filenameOriginal || item.filename || item.value?.split('/').pop() || "Arquivo";
    const isImage = item.file?.type.startsWith('image/') || (item.value && item.value.match(/\.(jpeg|jpg|gif|png|webp)$/i));
    const isVideo = item.file?.type.startsWith('video/') || (item.value && item.value.match(/\.(mp4|mov|avi)$/i));
    const isAudio = item.file?.type.startsWith('audio/') || (item.value && item.value.match(/\.(mp3|wav|ogg|m4a|aac|opus)$/i));
    const isPdf = item.file?.type === 'application/pdf' || (item.value && item.value.match(/\.pdf$/i));
    const isText =
      item.file?.type?.startsWith('text/') ||
      item.file?.type === 'application/json' ||
      (item.value && item.value.match(/\.(txt|csv|json|xml|html|md)$/i));

    const mediaUrl = item.file 
      ? URL.createObjectURL(item.file) 
      : (item.value?.startsWith('http') 
          ? item.value 
          : `${process.env.REACT_APP_BACKEND_URL}/public/company${user.companyId}/quickMessage/${item.serverFilename || item.filename || item.value}`);

    const renderPreviewContent = () => {
      if (isImage) {
        return <img src={mediaUrl} alt="preview" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />;
      }

      if (isVideo) {
        return <video src={mediaUrl} controls style={{ maxWidth: '100%', maxHeight: '80vh' }} />;
      }

      if (isAudio) {
        return (
          <Box display="flex" flexDirection="column" alignItems="center" width="100%" p={4}>
            <Box
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                backgroundColor: 'rgba(139, 92, 246, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16
              }}
            >
              <AttachFileIcon style={{ color: '#8B5CF6', fontSize: 32 }} />
            </Box>
            <audio controls style={{ width: '100%', maxWidth: 520 }}>
              <source src={mediaUrl} />
              Seu navegador nao suporta reproducao de audio.
            </audio>
            <Typography variant="body2" color="textSecondary" style={{ marginTop: 12 }}>
              {fileLabel}
            </Typography>
          </Box>
        );
      }

      if (isPdf) {
        return (
          <Box width="100%" height="80vh">
            <iframe
              title={fileLabel}
              src={mediaUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </Box>
        );
      }

      if (isText) {
        return (
          <Box width="100%" height="80vh">
            <iframe
              title={fileLabel}
              src={mediaUrl}
              style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' }}
            />
          </Box>
        );
      }

      return (
        <Box display="flex" flexDirection="column" alignItems="center" p={4}>
          {getFileIcon(fileLabel)}
          <Typography variant="h6" style={{ marginTop: 16 }}>
            Pre-visualizacao direta indisponivel para este tipo de arquivo.
          </Typography>
          <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16 }}>
            {fileLabel}
          </Typography>
          <Button
            component="a"
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            color="primary"
          >
            Abrir arquivo
          </Button>
        </Box>
      );
    };

    return (
      <Dialog open={Boolean(item)} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          Pré-visualização: {fileLabel}
          <IconButton aria-label="close" onClick={onClose} style={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          {renderPreviewContent()}
        </DialogContent>
      </Dialog>
    );
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
        <DialogTitle id="form-dialog-title">
          {quickemessageId
            ? `${i18n.t("quickMessages.dialog.edit")}`
            : `${i18n.t("quickMessages.dialog.add")}`}
        </DialogTitle>
        <input
          type="file"
          ref={attachmentFile}
          className={classes.uploadInput}
          onChange={(e) => handleAttachmentFile(e)}
        />
        <Formik
          initialValues={quickemessage}
          enableReinitialize={true}
          validationSchema={QuickeMessageSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveQuickeMessage(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ touched, errors, isSubmitting, setFieldValue, values }) => (
            <Form style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              <Box px={3} pt={2} pb={1} flexShrink={0}>
                <Grid spacing={2} container>
                  <Grid xs={6} item>
                    <Field
                      as={TextField}
                      autoFocus
                      label="Nome"
                      name="shortcode"
                      disabled={quickemessageId && values.visao && !values.geral && values.userId !== user.id}
                      error={touched.shortcode && Boolean(errors.shortcode)}
                      helperText={touched.shortcode && errors.shortcode}
                      variant="outlined"
                      margin="dense"
                      fullWidth
                    />
                  </Grid>
                  <Grid xs={3} item>
                    <FormControl variant="outlined" margin="dense" fullWidth>
                      <InputLabel id="geral-selection-label">
                        {i18n.t("quickMessages.dialog.visao")}
                      </InputLabel>
                      <Field
                        as={Select}
                        label={i18n.t("quickMessages.dialog.visao")}
                        placeholder={i18n.t("quickMessages.dialog.visao")}
                        labelId="visao-selection-label"
                        id="visao"
                        disabled={quickemessageId && values.visao && !values.geral && values.userId !== user.id}
                        name="visao"
                        onChange={(e) => {
                          setFieldValue("visao", e.target.value === "true");
                        }}
                        error={touched.visao && Boolean(errors.visao)}
                        value={values.visao ? "true" : "false"}
                      >
                        <MenuItem value={"true"}>{i18n.t("announcements.active")}</MenuItem>
                        <MenuItem value={"false"}>{i18n.t("announcements.inactive")}</MenuItem>
                      </Field>
                    </FormControl>
                  </Grid>
                  <Grid xs={3} item>
                    <FormControl variant="outlined" margin="dense" fullWidth>
                      <InputLabel id="geral-selection-label">
                        {i18n.t("quickMessages.dialog.geral")}
                      </InputLabel>
                      <Field
                        as={Select}
                        label={i18n.t("quickMessages.dialog.geral")}
                        placeholder={i18n.t("quickMessages.dialog.geral")}
                        labelId="novo-item-selection-label"
                        id="geral"
                        name="geral"
                        disabled={quickemessageId && values.visao && !values.geral && values.userId !== user.id}
                        value={values.geral ? "true" : "false"}
                        error={touched.geral && Boolean(errors.geral)}
                        onChange={(e) => {
                          setFieldValue("geral", e.target.value === "true");
                        }}
                      >
                        <MenuItem value={"true"}>{i18n.t("announcements.active")}</MenuItem>
                        <MenuItem value={"false"}>{i18n.t("announcements.inactive")}</MenuItem>
                      </Field>
                    </FormControl>
                  </Grid>
                  <Grid xs={6} item>
                    <Autocomplete
                      freeSolo
                      options={optionsGroups}
                      disabled={quickemessageId && values.visao && !values.geral && values.userId !== user.id}
                      value={values.groupName || ""}
                       onChange={(e, newValue) => {
                         setFieldValue("groupName", newValue);
                         const categoryMsg = quickMessages.find(msg => msg.groupName === newValue);
                         if (categoryMsg && categoryMsg.color) {
                           setFieldValue("color", categoryMsg.color);
                         }
                         setQuickemessage(prev => ({ ...prev, groupName: newValue }));
                       }}
                       onInputChange={(e, newInputValue) => {
                         setFieldValue("groupName", newInputValue);
                         const categoryMsg = quickMessages.find(msg => msg.groupName === newInputValue);
                         if (categoryMsg && categoryMsg.color) {
                           setFieldValue("color", categoryMsg.color);
                         }
                         setQuickemessage(prev => ({ ...prev, groupName: newInputValue }));
                       }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Categoria / Grupo"
                          variant="outlined"
                          margin="dense"
                          fullWidth
                        />
                      )}
                    />
                  </Grid>
                  <Grid xs={6} item>
                    <FormControl variant="outlined" margin="dense" fullWidth disabled={quickemessageId && values.visao && !values.geral && values.userId !== user.id}>
                      <InputLabel id="color-label">Cor</InputLabel>
                      <Field
                        as={Select}
                        label="Cor"
                        labelId="color-label"
                        id="color"
                        name="color"
                        disabled={optionsGroups.includes(values.groupName)}
                        value={values.color || "#4B5563"}
                        onChange={(e) => {
                          const newColor = e.target.value;
                          setFieldValue("color", newColor);
                          setQuickemessage(prev => ({ ...prev, color: newColor }));
                        }}
                      >
                        {colors.map((c) => (
                          <MenuItem key={c.value} value={c.value}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: c.value }}></div>
                              {c.label}
                            </div>
                          </MenuItem>
                        ))}
                      </Field>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>
              <DialogContent dividers style={{ overflowY: "auto", flexGrow: 1, padding: "8px 24px" }}>
                <Grid spacing={2} container>
                  <Grid xs={12} item>
                    <Box mb={1}>
                      <Typography variant="subtitle2" color="textSecondary">CONSTRUTOR DE FLUXO</Typography>
                    </Box>
                      <ChatAssistantPanel
                        open={aiAssistantOpen}
                        onClose={() => setAiAssistantOpen(false)}
                        inputMessage={flowItems[activeItemIndex]?.value || ""}
                        setInputMessage={(val) => updateFlowItem(activeItemIndex, val)}
                        assistantContext="general"
                        title="Assistente de Mensagens Rápidas"
                        dialogMode={true}
                        presets={[
                          { label: "👔 Formal", prompt: "Reescreva este texto de forma formal e profissional." },
                          { label: "🤝 Amigável", prompt: "Reescreva este texto de forma amigável e próxima." },
                          { label: "🚀 Persuasivo", prompt: "Reescreva este texto de forma persuasiva e atraente para vendas." },
                        ]}
                      />
                    <Box className={classes.flowContainer}>
                      {flowItems.map((item, index) => (
                        <div key={index} className={`${classes.nodeItem} ${index === flowItems.length - 1 ? classes.lastNodeItem : ''}`}>
                           <Paper 
                             elevation={0}
                             className={`${classes.nodeCard} qm-node-card`}
                             style={{ 
                               backgroundColor: item.type === 'delay' ? 'rgba(245, 158, 11, 0.02)' : 'white',
                               '--node-color': item.type === 'text' ? '#002d6e' : item.type === 'delay' ? '#F59E0B' : '#10B981'
                             }}
                           >
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                              <Box display="flex" alignItems="center" gap={1}>
                                {item.type === 'text' && <TextFieldsIcon fontSize="small" color="primary" />}
                                {item.type === 'delay' && <AccessTimeIcon fontSize="small" style={{ color: '#F59E0B' }} />}
                                {item.type === 'media' && <AttachFileIcon fontSize="small" style={{ color: '#10B981' }} />}
                                <Typography variant="caption" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                                  {item.type === 'text' ? `Texto (${flowItems.filter((it, idx) => it.type === 'text' && idx <= index).length})` : item.type === 'delay' ? 'Esperar' : `Anexo (${flowItems.filter((it, idx) => it.type === 'media' && idx <= index).length})`}
                                </Typography>
                              </Box>
                              <Box>
                                {item.type === 'text' && (
                                  <IconButton size="small" onClick={() => { setActiveItemIndex(index); setAiAssistantOpen(true); }} color="primary" style={{ padding: 4 }}>
                                    <StarsIcon style={{ fontSize: 18 }} />
                                  </IconButton>
                                )}
                                {item.type === 'text' && (
                                  <>
                                    <IconButton size="small" onClick={(e) => { setTagAnchorEl(e.currentTarget); setActiveItemIndex(index); }} style={{ padding: 4 }}>
                                      <LocalOfferIcon style={{ fontSize: 18 }} />
                                    </IconButton>
                                    <WhatsAppPopover
                                      onSelectEmoji={(emoji) => handleEmojiSelect(emoji, index)}
                                      disabled={false}
                                    />
                                  </>
                                )}
                                <IconButton size="small" onClick={() => removeFlowItem(index)} color="secondary" style={{ padding: 4 }}>
                                  <DeleteOutlineIcon style={{ fontSize: 18 }} />
                                </IconButton>
                              </Box>
                            </Box>

                            {item.type === 'text' && (
                              <>
                                <TextField
                                  id={`flow-item-${index}`}
                                  fullWidth
                                  multiline
                                  rows={3}
                                  variant="outlined"
                                  margin="dense"
                                  value={item.value}
                                  onChange={(e) => updateFlowItem(index, e.target.value)}
                                  placeholder="Digite sua mensagem..."
                                  size="small"
                                />
                                <Box mt={0.5} display="flex" justifyContent="space-between" alignItems="center">
                                  <Box>
                                    {index === 0 && (
                                      <Box display="flex" alignItems="center" gap={1}>
                                         <Field
                                          type="checkbox"
                                          name="sendAsCaption"
                                          id="sendAsCaption"
                                        />
                                        <label htmlFor="sendAsCaption" style={{ cursor: 'pointer', fontSize: 11, opacity: 0.7 }}>
                                          Enviar esta mensagem como legenda do arquivo
                                        </label>
                                      </Box>
                                    )}
                                  </Box>
                                  <Box display="flex" alignItems="center" gap={1} ml="auto">
                                    {item.createdAt && (
                                      <Typography variant="caption" color="textSecondary" style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                                        Salvo em: {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </Typography>
                                    )}
                                    <Typography variant="caption" style={{ fontSize: '0.65rem', color: '#10B981', fontWeight: 800 }}>
                                      SALVO
                                    </Typography>
                                  </Box>
                                </Box>
                               </>
                            )}

                            {item.type === 'delay' && (
                              <Box display="flex" justifyContent="center">
                                <Box className={classes.delayCard}>
                                  <Typography variant="caption" style={{ marginRight: 8, fontSize: '0.65rem', fontWeight: 800, color: '#F59E0B' }}>
                                    PAUSA DE
                                  </Typography>
                                  <Box display="flex" alignItems="baseline">
                                    <TextField
                                      type="number"
                                      variant="outlined"
                                      margin="dense"
                                      value={item.value}
                                      onChange={(e) => updateFlowItem(index, parseInt(e.target.value) || 0)}
                                      className={classes.delayInput}
                                      style={{ width: 30 }}
                                      inputProps={{ style: { fontSize: '1rem', padding: 0, height: 'auto' } }}
                                    />
                                    <Typography variant="body2" style={{ fontWeight: 800, color: '#F59E0B', marginLeft: 2, fontSize: '0.75rem' }}>segundos</Typography>
                                  </Box>
                                </Box>
                              </Box>
                            )}

                            {item.type === 'media' && (
                              <Box className={classes.attachmentCardCompact} style={{ border: 'none', padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.03)', position: 'relative' }}>
                                 {/* Área da Miniatura / Ícone */}
                                 <Box 
                                   onClick={() => setPreviewItem(item)}
                                   style={{ cursor: 'pointer', position: 'relative' }}
                                 >
                                   {(item.file || item.value) && ( 
                                     (item.file?.type.startsWith('image/') || item.file?.type.startsWith('video/')) || 
                                     (item.value && (item.value.match(/\.(jpeg|jpg|gif|png|webp|mp4|mov|avi)$/i)))
                                   ) ? (
                                       (item.file?.type.startsWith('video/') || (item.value && item.value.match(/\.(mp4|mov|avi)$/i))) ? (
                                         <video 
                                           src={item.file ? URL.createObjectURL(item.file) : (item.value?.startsWith('http') ? item.value : `${process.env.REACT_APP_BACKEND_URL}/public/company${user.companyId}/quickMessage/${item.serverFilename || item.filename || item.value}`)} 
                                           muted 
                                           style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', marginRight: 12 }} 
                                         />
                                       ) : (
                                         <img 
                                           src={item.file ? URL.createObjectURL(item.file) : (item.value?.startsWith('http') ? item.value : `${process.env.REACT_APP_BACKEND_URL}/public/company${user.companyId}/quickMessage/${item.serverFilename || item.filename || item.value}`)} 
                                           alt="preview" 
                                           style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', marginRight: 12 }} 
                                           onError={(e) => {
                                             e.target.style.display = 'none';
                                             e.target.nextSibling.style.display = 'flex';
                                           }}
                                         />
                                       )
                                     ) : (
                                       <Box 
                                         style={{ 
                                           width: 48, 
                                           height: 48, 
                                           borderRadius: 8, 
                                           backgroundColor: (item.filenameOriginal || item.filename || "").toLowerCase().endsWith('.pdf') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(139, 92, 246, 0.1)', 
                                           display: 'flex', 
                                           alignItems: 'center', 
                                           justifyContent: 'center', 
                                           marginRight: 12,
                                           border: '1px solid rgba(0,0,0,0.05)'
                                         }}
                                       >
                                         {getFileIcon(item.filenameOriginal || item.filename || item.value)}
                                       </Box>
                                     )}
                                     {/* Fallback Box oculto para erros de imagem - ID fixo para referência */}
                                     <Box 
                                       id={`fallback-${index}`}
                                       style={{ 
                                         display: 'none',
                                         width: 48, 
                                         height: 48, 
                                         borderRadius: 8, 
                                         backgroundColor: 'rgba(0,0,0,0.05)', 
                                         alignItems: 'center', 
                                         justifyContent: 'center', 
                                         marginRight: 12
                                       }}
                                     >
                                       <AttachFileIcon />
                                     </Box>
                                 </Box>

                                 {/* Informações do Arquivo */}
                                 <Box style={{ flex: 1, minWidth: 0 }}>
                                     <Typography 
                                       variant="caption" 
                                       noWrap 
                                       style={{ fontWeight: 700, display: 'block', fontSize: '0.75rem', cursor: 'pointer' }}
                                       onClick={() => setPreviewItem(item)}
                                     >
                                       {item.filenameOriginal || item.filename || item.value?.split('/').pop() || "Arquivo"}
                                     </Typography>
                                     <Box display="flex" gap={1} alignItems="center">
                                       <Typography variant="caption" color="textSecondary" style={{ fontSize: '0.65rem' }}>
                                         {item.size ? formatBytes(item.size) : (item.file ? formatBytes(item.file.size) : '---')}
                                       </Typography>
                                       {item.createdAt && (
                                         <Typography variant="caption" color="textSecondary" style={{ fontSize: '0.65rem' }}>
                                           • {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                         </Typography>
                                       )}
                                       <Typography variant="caption" style={{ fontSize: '0.65rem', color: item.file ? '#3B82F6' : '#10B981', fontWeight: 800, marginLeft: 'auto' }}>
                                         {item.file ? "PENDENTE" : "SALVO"}
                                       </Typography>
                                     </Box>
                                 </Box>
                              </Box>
                            )}
                          </Paper>
                        </div>
                      ))}

                      <Box display="flex" justifyContent="center" mt={2} mb={2} style={{ gap: '16px', position: 'relative', zIndex: 1, flexWrap: 'wrap' }}>
                        <Button
                          startIcon={<TextFieldsIcon />}
                          variant="outlined"
                          onClick={() => addFlowItem('text')}
                          className={classes.flowAddButton}
                          style={{ borderColor: '#002d6e', color: '#002d6e' }}
                        >
                          Texto
                        </Button>
                        <Button
                          startIcon={<AccessTimeIcon />}
                          variant="outlined"
                          onClick={() => addFlowItem('delay')}
                          className={classes.flowAddButton}
                          style={{ borderColor: '#F59E0B', color: '#F59E0B' }}
                        >
                          Intervalo
                        </Button>
                        <Button
                          startIcon={<AttachFileIcon />}
                          variant="outlined"
                          onClick={() => addFlowItem('media')}
                          className={classes.flowAddButton}
                          style={{ borderColor: '#10B981', color: '#10B981' }}
                        >
                          Anexo
                        </Button>
                      </Box>
                    </Box>
                  </Grid>

                  {/* Popover de Tags */}
                  <Popover
                    open={Boolean(tagAnchorEl)}
                    anchorEl={tagAnchorEl}
                    onClose={() => setTagAnchorEl(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                  >
                    <Box p={1} style={{ maxWidth: 300 }}>
                      <MessageVariablesPicker onClick={(val) => handleTagSelect(val, activeItemIndex)} />
                    </Box>
                  </Popover>
                </Grid>
              </DialogContent>
              <DialogActions style={{ flexShrink: 0 }}>
                <input
                  type="file"
                  multiple
                  style={{ display: "none" }}
                  ref={attachmentFile}
                  onChange={handleAttachmentFile}
                />
                <Button
                  color="primary"
                  onClick={() => attachmentFile.current.click()}
                  disabled={isSubmitting || (quickemessageId && values.visao && !values.geral && values.userId !== user.id)}
                  variant="outlined"
                >
                  {i18n.t("quickMessages.buttons.attach")}
                </Button>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("quickMessages.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting || (quickemessageId && values.visao && !values.geral && values.userId !== user.id)}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {quickemessageId
                    ? "Salvar"
                    : i18n.t("quickMessages.buttons.add")}
                  {isSubmitting && (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  )}
                </Button>
              </DialogActions>
               <MediaPreviewModal 
                 item={previewItem} 
                 onClose={() => setPreviewItem(null)} 
               />
             </Form>
           )}
         </Formik>
       </Dialog>
     </div>
  );
};

export default QuickMessageDialog;
