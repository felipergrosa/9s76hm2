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

import { i18n } from "../../translate/i18n";

import { Stack } from "@mui/material";

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

const FlowBuilderSendEmailModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [labels, setLabels] = useState({
    title: "Adicionar envio de e-mail ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({
        title: "Editar envio de e-mail",
        btn: "Salvar"
      });
      setTo(data.data.to || "");
      setSubject(data.data.subject || "");
      setBody(data.data.body || "");
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar envio de e-mail ao fluxo",
        btn: "Adicionar"
      });
      setTo("");
      setSubject("");
      setBody("");
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

  const handleSaveContact = async () => {
    if (!subject || !subject.trim()) {
      return toast.error("Informe o assunto do e-mail");
    }
    if (!body || !body.trim()) {
      return toast.error("Informe o corpo do e-mail");
    }
    const payload = {
      to: to.trim(),
      subject: subject.trim(),
      body
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
                label={"Destinatário (opcional)"}
                name="to"
                variant="outlined"
                value={to}
                onChange={e => setTo(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                helperText="Vazio usa o e-mail do contato"
              />
              <TextField
                label={"Assunto"}
                name="subject"
                variant="outlined"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                required
              />
              <TextField
                label={"Corpo do e-mail"}
                name="body"
                variant="outlined"
                multiline
                rows={6}
                value={body}
                onChange={e => setBody(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                helperText="Use {{variáveis}} para interpolar dados do contato (ex.: {{name}})"
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

export default FlowBuilderSendEmailModal;
