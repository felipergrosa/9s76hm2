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
import "emoji-mart/css/emoji-mart.css";
import { Picker } from "emoji-mart";
import { i18n } from "../../translate/i18n";
import { head } from "lodash";
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
} from "@material-ui/core";
import ConfirmationModal from "../ConfirmationModal";
import Autocomplete, { createFilterOptions } from "@material-ui/lab/Autocomplete";
import { Tooltip, Popover } from "@material-ui/core";
import ChatAssistantPanel from "../ChatAssistantPanel";
import StarsIcon from "@material-ui/icons/Stars";


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
  colorAdorment: {
    width: 20,
    height: 20,
  },
}));

const QuickeMessageSchema = Yup.object().shape({
  shortcode: Yup.string().required("Obrigatório"),
  //   message: Yup.string().required("Obrigatório"),
});

const QuickMessageDialog = ({ open, onClose, quickemessageId, reload, initialData }) => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const messageInputRef = useRef();

  const initialState = {
    shortcode: "",
    message: "",
    geral: false,
    status: true,
    groupName: "",
    color: "#4B5563",
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
  const [attachment, setAttachment] = useState(null);
  const [optionsGroups, setOptionsGroups] = useState([]);
  const attachmentFile = useRef(null);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);

  useEffect(() => {
    try {
      (async () => {
        if (!quickemessageId) {
          if (initialData) {
            setQuickemessage((prevState) => {
              return { ...prevState, ...initialData };
            });
          }
          return;
        }

        const { data } = await api.get(`/quick-messages/${quickemessageId}`);

        setQuickemessage((prevState) => {
          return { ...prevState, ...data };
        });
      })();
    } catch (err) {
      toastError(err);
    }
  }, [quickemessageId, open]);

  useEffect(() => {
    try {
      (async () => {
        if (!open) return;
        const { data } = await api.get(`/quick-messages/list`);
        const uniqueGroups = [...new Set(data.map(item => item.groupName).filter(Boolean))];
        setOptionsGroups(uniqueGroups);
      })();
    } catch (err) {
      toastError(err);
    }
  }, [open]);

  const handleClose = () => {
    setQuickemessage(initialState);
    setAttachment(null);
    onClose();
  };

  const handleAttachmentFile = (e) => {
    const file = head(e.target.files);
    if (file) {
      setAttachment(file);
    }
  };

  const handleSaveQuickeMessage = async (values) => {

    const quickemessageData = { ...values, isMedia: true, mediaPath: attachment ? String(attachment.name).replace(/ /g, "_") : values.mediaPath ? values.mediaPath.split("/").pop().replace(/ /g, "_") : null };

    try {
      if (quickemessageId) {
        await api.put(`/quick-messages/${quickemessageId}`, quickemessageData);
        if (attachment != null) {
          const formData = new FormData();
          formData.append("typeArch", "quickMessage");
          formData.append("file", attachment);
          await api.post(
            `/quick-messages/${quickemessageId}/media-upload`,
            formData
          );
        }
      } else {
        const { data } = await api.post("/quick-messages", quickemessageData);
        if (attachment != null) {
          const formData = new FormData();
          formData.append("typeArch", "quickMessage");
          formData.append("file", attachment);
          await api.post(`/quick-messages/${data.id}/media-upload`, formData);
        }
      }
      toast.success(i18n.t("quickMessages.toasts.success"));
      if (typeof reload == "function") {
        console.log(reload);
        console.log("0");
        reload();
      }
    } catch (err) {
      toastError(err);
    }
    handleClose();
  };

  const deleteMedia = async () => {
    if (attachment) {
      setAttachment(null);
      attachmentFile.current.value = null;
    }

    if (quickemessage.mediaPath) {
      await api.delete(`/quick-messages/${quickemessage.id}/media-upload`);
      setQuickemessage((prev) => ({
        ...prev,
        mediaPath: null,
      }));
      toast.success(i18n.t("quickMessages.toasts.deleted"));
      if (typeof reload == "function") {
        console.log(reload);
        console.log("1");
        reload();
      }
    }
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

  const handleEmojiSelect = (emoji, setFieldValue, values) => {
    const firstPartValue = values.message.substring(0, messageInputRef.current.selectionStart);
    const secondPartValue = values.message.substring(messageInputRef.current.selectionEnd);

    const newCursorPos = (firstPartValue + emoji.native).length;

    setFieldValue("message", `${firstPartValue}${emoji.native}${secondPartValue}`);

    setTimeout(() => {
      messageInputRef.current.focus();
      messageInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };
  return (
    <div className={classes.root}>
      <ConfirmationModal
        title={i18n.t("quickMessages.confirmationModal.deleteTitle")}
        open={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={deleteMedia}
      >
        {i18n.t("quickMessages.confirmationModal.deleteMessage")}
      </ConfirmationModal>
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
        <div style={{ display: "none" }}>
          <input
            type="file"
            // accept="Image/*, Video/*"
            ref={attachmentFile}
            onChange={(e) => handleAttachmentFile(e)}
          />
        </div>
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
            <Form>
              <DialogContent dividers>
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
                      onChange={(e, newValue) => setFieldValue("groupName", newValue)}
                      onInputChange={(e, newInputValue) => setFieldValue("groupName", newInputValue)}
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
                        value={values.color || "#4B5563"}
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
                  <Grid xs={12} item>
                    <ChatAssistantPanel
                      open={aiAssistantOpen}
                      onClose={() => {
                        setAiAssistantOpen(false);
                        setFieldValue("aiAction", null);
                      }}
                      inputMessage={values.message}
                      setInputMessage={(val) => setFieldValue("message", val)}
                      assistantContext="general"
                      title="Assistente de Mensagens Rápidas"
                      dialogMode={true}
                    />
                  </Grid>
                  <Grid xs={12} item>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <Typography variant="caption" style={{ width: '100%', marginBottom: 4, opacity: 0.7 }}>
                        Ajustar Tom (IA):
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setFieldValue("aiAction", "formal");
                          setAiAssistantOpen(true);
                        }}
                        disabled={!values.message || aiAssistantOpen}
                        style={{ textTransform: 'none', borderRadius: 16 }}
                      >
                        👔 Formal
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setFieldValue("aiAction", "casual");
                          setAiAssistantOpen(true);
                        }}
                        disabled={!values.message || aiAssistantOpen}
                        style={{ textTransform: 'none', borderRadius: 16 }}
                      >
                        🤝 Amigável
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setFieldValue("aiAction", "persuasive");
                          setAiAssistantOpen(true);
                        }}
                        disabled={!values.message || aiAssistantOpen}
                        style={{ textTransform: 'none', borderRadius: 16 }}
                      >
                        🚀 Persuasivo
                      </Button>
                    </div>
                  </Grid>
                  <Grid xs={12} item>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: -10 }}>
                      <Typography variant="body2" color="primary" style={{ fontWeight: 500 }}>
                        {i18n.t("quickMessages.dialog.message")}
                      </Typography>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Tooltip title="Emojis">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              setEmojiAnchorEl(e.currentTarget);
                              setEmojiOpen(true);
                            }}
                            color="primary"
                            disabled={quickemessageId && values.visao && !values.geral && values.userId !== user.id}
                          >
                            <Smile size={20} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Assistente de IA">
                          <IconButton
                            size="small"
                            onClick={() => setAiAssistantOpen(true)}
                            color="primary"
                            disabled={quickemessageId && values.visao && !values.geral && values.userId !== user.id}
                          >
                            <StarsIcon />
                          </IconButton>
                        </Tooltip>
                      </div>
                    </div>
                    <Popover
                      open={emojiOpen}
                      anchorEl={emojiAnchorEl}
                      onClose={() => setEmojiOpen(false)}
                      anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                      }}
                      transformOrigin={{
                        vertical: 'bottom',
                        horizontal: 'right',
                      }}
                      PaperProps={{
                        style: { zIndex: 2000000000 }
                      }}
                    >
                      <Picker
                        set="apple"
                        onSelect={(emoji) => {
                          handleEmojiSelect(emoji, setFieldValue, values);
                          setEmojiOpen(false);
                        }}
                        title="Escolha um emoji"
                        emoji="point_up"
                      />
                    </Popover>
                    <Field
                      as={TextField}
                      name="message"
                      inputRef={messageInputRef}
                      error={touched.message && Boolean(errors.message)}
                      helperText={touched.message && errors.message}
                      variant="outlined"
                      margin="dense"
                      disabled={quickemessageId && values.visao && !values.geral && values.userId !== user.id}
                      multiline={true}
                      rows={7}
                      fullWidth
                    />
                  </Grid>
                  <Grid item>
                    <MessageVariablesPicker
                      disabled={isSubmitting || (quickemessageId && values.visao && !values.geral && values.userId !== user.id)}
                      onClick={value => handleClickMsgVar(value, setFieldValue, values)}
                    />
                  </Grid>
                  {/* {(profile === "admin" || profile === "supervisor") && ( */}
                  {/* )} */}
                  {(quickemessage.mediaPath || attachment) && (
                    <Grid xs={12} item>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        borderRadius: 8,
                        border: '1px dashed rgba(0, 0, 0, 0.12)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <AttachFileIcon color="primary" />
                          <Typography variant="body2" noWrap style={{ maxWidth: 200 }}>
                            {attachment ? attachment.name : quickemessage.mediaName || quickemessage.mediaPath.split('/').pop()}
                          </Typography>
                        </div>
                        <IconButton
                          onClick={() => setConfirmationOpen(true)}
                          size="small"
                          color="secondary"
                          disabled={quickemessageId && values.visao && !values.geral && values.userId !== user.id}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </div>
                    </Grid>
                  )}
                </Grid>
              </DialogContent>
              <DialogActions>
                {!attachment && !quickemessage.mediaPath && (
                  <Button
                    color="primary"
                    onClick={() => attachmentFile.current.click()}
                    disabled={isSubmitting || (quickemessageId && values.visao && !values.geral && values.userId !== user.id)}
                    variant="outlined"
                  >
                    {i18n.t("quickMessages.buttons.attach")}
                  </Button>
                )}
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
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default QuickMessageDialog;