import React, { useState, useEffect, useRef } from "react";

import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import TextField from "@material-ui/core/TextField";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack
} from "@mui/material";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexWrap: "wrap"
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1
  },

  extraAttr: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },

  btnWrapper: {
    position: "relative"
  },

  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12
  }
}));

const selectFieldStyles = {
  ".MuiOutlinedInput-notchedOutline": {
    borderColor: "#909090"
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: "#000000",
    borderWidth: "thin"
  },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "#0000FF",
    borderWidth: "thin"
  }
};

const FlowBuilderSendTemplateModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [whatsappId, setWhatsappId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [languageCode, setLanguageCode] = useState("pt_BR");
  const [whatsapps, setWhatsapps] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [labels, setLabels] = useState({
    title: "Adicionar envio de template ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    const fetchWhatsapps = async () => {
      try {
        // /whatsapp pode retornar array direto ou objeto paginado { whatsapps }
        const { data } = await api.get("/whatsapp");
        const list = Array.isArray(data)
          ? data
          : (data && Array.isArray(data.whatsapps) ? data.whatsapps : []);
        // Templates da Meta só existem em conexões oficiais (API oficial)
        setWhatsapps(
          list.filter(
            w => w.channelType === "official" && w.channel === "whatsapp"
          )
        );
      } catch (err) {
        toastError(err);
      }
    };

    if (open === "edit") {
      setLabels({
        title: "Editar envio de template",
        btn: "Salvar"
      });
      setWhatsappId(data.data.whatsappId || "");
      setTemplateName(data.data.templateName || "");
      setLanguageCode(data.data.languageCode || "pt_BR");
      fetchWhatsapps();
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar envio de template ao fluxo",
        btn: "Adicionar"
      });
      setWhatsappId("");
      setTemplateName("");
      setLanguageCode("pt_BR");
      fetchWhatsapps();
      setActiveModal(true);
    } else {
      setActiveModal(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Carrega os templates da Meta sempre que a conexão oficial muda
  useEffect(() => {
    const fetchTemplates = async () => {
      if (!whatsappId) {
        setTemplates([]);
        return;
      }
      try {
        // O GET já dispara a sincronização com a Meta no backend
        const { data } = await api.get(`/meta-templates/${whatsappId}`);
        setTemplates(Array.isArray(data.templates) ? data.templates : []);
      } catch (err) {
        toastError(err);
      }
    };

    fetchTemplates();
  }, [whatsappId]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  // Ao escolher o template, preenche o idioma com o language declarado na Meta
  const handleChangeTemplate = e => {
    const name = e.target.value;
    setTemplateName(name);
    const selected = templates.find(t => t.name === name);
    if (selected && selected.language) {
      setLanguageCode(selected.language);
    }
  };

  const handleSaveContact = async () => {
    if (!whatsappId) {
      return toast.error("Selecione uma conexão WhatsApp oficial");
    }
    if (!templateName) {
      return toast.error("Selecione um template");
    }
    if (!languageCode || !languageCode.trim()) {
      return toast.error("Informe o código do idioma");
    }
    // Guarda o nome da conexão para exibição no nó sem nova consulta
    const selectedWhatsapp = whatsapps.find(w => w.id === whatsappId);
    const payload = {
      whatsappId,
      whatsappName: selectedWhatsapp ? selectedWhatsapp.name : "",
      templateName,
      languageCode: languageCode.trim()
    };
    if (open === "edit") {
      handleClose();
      onUpdate({
        ...data,
        data: { ...payload }
      });
      return;
    } else if (open === "create") {
      handleClose();
      onSave(payload);
    }
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={activeModal}
        onClose={handleClose}
        fullWidth="md"
        scroll="paper"
      >
        <DialogTitle id="form-dialog-title">{labels.title}</DialogTitle>
        <Stack>
          <DialogContent dividers>
            <Stack style={{ gap: "16px" }}>
              <FormControl sx={{ width: "95%" }} size="medium">
                <InputLabel sx={selectFieldStyles} id="template-whatsapp-select-label">
                  Conexão WhatsApp (oficial)
                </InputLabel>
                <Select
                  labelId="template-whatsapp-select-label"
                  id="template-whatsapp-select"
                  value={whatsappId}
                  label="Conexão WhatsApp (oficial)"
                  onChange={e => {
                    setWhatsappId(e.target.value);
                    setTemplateName("");
                  }}
                  variant="outlined"
                  color="primary"
                  sx={selectFieldStyles}
                >
                  {whatsapps.map(w => (
                    <MenuItem key={w.id} value={w.id}>
                      {w.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl sx={{ width: "95%" }} size="medium">
                <InputLabel sx={selectFieldStyles} id="template-name-select-label">
                  Template
                </InputLabel>
                <Select
                  labelId="template-name-select-label"
                  id="template-name-select"
                  value={templateName}
                  label="Template"
                  onChange={handleChangeTemplate}
                  variant="outlined"
                  color="primary"
                  sx={selectFieldStyles}
                  disabled={!whatsappId}
                >
                  {templates.map(t => (
                    <MenuItem key={`${t.name}-${t.language}`} value={t.name}>
                      {t.name} ({t.language})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label={"Código do idioma"}
                name="languageCode"
                variant="outlined"
                value={languageCode}
                onChange={e => setLanguageCode(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                helperText="Ex.: pt_BR, en_US, es_ES"
                required
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} color="secondary" variant="outlined">
              {i18n.t("contactModal.buttons.cancel")}
            </Button>
            <Button
              type="submit"
              color="primary"
              variant="contained"
              className={classes.btnWrapper}
              onClick={() => handleSaveContact()}
            >
              {`${labels.btn}`}
            </Button>
          </DialogActions>
        </Stack>
      </Dialog>
    </div>
  );
};

export default FlowBuilderSendTemplateModal;
