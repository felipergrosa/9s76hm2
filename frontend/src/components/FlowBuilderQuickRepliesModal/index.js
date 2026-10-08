import React, { useState, useEffect, useRef } from "react";

import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";

import { i18n } from "../../translate/i18n";

import { Stack } from "@mui/material";
import { AddCircle, Delete } from "@mui/icons-material";

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

const emptyOption = () => ({ label: "", payload: "" });

const FlowBuilderQuickRepliesModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [message, setMessage] = useState("");
  const [options, setOptions] = useState([emptyOption()]);

  const [labels, setLabels] = useState({
    title: "Adicionar respostas rápidas ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({
        title: "Editar respostas rápidas",
        btn: "Salvar"
      });
      setMessage(data.data.message || "");
      setOptions(
        Array.isArray(data.data.options) && data.data.options.length > 0
          ? data.data.options
          : [emptyOption()]
      );
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar respostas rápidas ao fluxo",
        btn: "Adicionar"
      });
      setMessage("");
      setOptions([emptyOption()]);
      setActiveModal(true);
    } else {
      setActiveModal(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleClose = () => {
    close(null);
    setActiveModal(false);
  };

  const updateOption = (index, field, value) => {
    setOptions(old =>
      old.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const removeOption = index => {
    setOptions(old => old.filter((_, i) => i !== index));
  };

  const handleSaveContact = async () => {
    if (!message || !message.trim()) {
      return toast.error("Informe a mensagem das respostas rápidas");
    }
    if (options.length < 1) {
      return toast.error("Adicione ao menos uma opção");
    }
    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      if (!opt.label || !opt.label.trim()) {
        return toast.error(`Informe o texto da opção ${i + 1}`);
      }
      if (opt.label.trim().length > 20) {
        return toast.error(`A opção ${i + 1} deve ter no máximo 20 caracteres`);
      }
    }
    const payload = {
      message: message.trim(),
      options: options.map(opt => ({
        label: opt.label.trim(),
        payload: (opt.payload || "").trim()
      }))
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
              <TextField
                label={"Mensagem"}
                name="message"
                variant="outlined"
                multiline
                rows={3}
                value={message}
                onChange={e => setMessage(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                required
              />
              <Stack direction={"row"} justifyContent={"space-between"} alignItems={"center"}>
                <Typography>Opções ({options.length}/13)</Typography>
                <Button
                  onClick={() => setOptions(old => [...old, emptyOption()])}
                  color="primary"
                  variant="contained"
                  disabled={options.length >= 13}
                >
                  <AddCircle />
                </Button>
              </Stack>
              {options.map((item, index) => (
                <Stack
                  direction={"row"}
                  width={"100%"}
                  style={{ gap: "8px" }}
                  key={`opt-${index}`}
                  alignItems={"center"}
                >
                  <TextField
                    label={`Opção ${index + 1}`}
                    variant="outlined"
                    value={item.label}
                    inputProps={{ maxLength: 20 }}
                    style={{ flex: 1 }}
                    onChange={e => updateOption(index, "label", e.target.value)}
                    required
                  />
                  <TextField
                    label={"Payload (opcional)"}
                    variant="outlined"
                    value={item.payload}
                    style={{ flex: 1 }}
                    onChange={e => updateOption(index, "payload", e.target.value)}
                  />
                  {options.length > 1 && (
                    <IconButton onClick={() => removeOption(index)}>
                      <Delete />
                    </IconButton>
                  )}
                </Stack>
              ))}
              <Typography variant="caption" style={{ color: "#667085" }}>
                No WhatsApp, os botões são exibidos como opções numeradas — o
                contato responde 1, 2, 3... Cada opção gera uma saída própria no
                bloco.
              </Typography>
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

export default FlowBuilderQuickRepliesModal;
