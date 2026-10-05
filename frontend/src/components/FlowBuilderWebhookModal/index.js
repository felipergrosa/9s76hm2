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

const FlowBuilderWebhookModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [name, setName] = useState("");
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [responseVariable, setResponseVariable] = useState("");
  const [body, setBody] = useState("");

  const [labels, setLabels] = useState({
    title: "Adicionar webhook ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({
        title: "Editar webhook",
        btn: "Salvar"
      });
      setName(data.data.name || "");
      setMethod(data.data.method || "GET");
      setUrl(data.data.url || "");
      setResponseVariable(data.data.responseVariable || "");
      setBody(data.data.body || "");
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar webhook ao fluxo",
        btn: "Adicionar"
      });
      setName("");
      setMethod("GET");
      setUrl("");
      setResponseVariable("");
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
    if (!url || !url.trim()) {
      return toast.error("Informe a URL do webhook");
    }
    const payload = {
      name,
      method,
      url: url.trim(),
      responseVariable,
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

  // Corpo JSON só faz sentido em métodos que enviam payload
  const hasBody = method === "POST" || method === "PUT";

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
                label={"Nome (opcional)"}
                name="name"
                variant="outlined"
                value={name}
                onChange={e => setName(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
              />
              <FormControl sx={{ width: "95%" }} size="medium">
                <InputLabel sx={selectFieldStyles} id="webhook-method-select-label">
                  Método
                </InputLabel>
                <Select
                  labelId="webhook-method-select-label"
                  id="webhook-method-select"
                  value={method}
                  label="Método"
                  onChange={e => setMethod(e.target.value)}
                  variant="outlined"
                  color="primary"
                  sx={selectFieldStyles}
                >
                  <MenuItem value="GET">GET</MenuItem>
                  <MenuItem value="POST">POST</MenuItem>
                  <MenuItem value="PUT">PUT</MenuItem>
                  <MenuItem value="DELETE">DELETE</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label={"URL"}
                name="url"
                variant="outlined"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                required
              />
              <TextField
                label={"Variável de resposta (ex.: retorno_api)"}
                name="responseVariable"
                variant="outlined"
                value={responseVariable}
                onChange={e => setResponseVariable(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
              />
              {hasBody && (
                <TextField
                  label={"Corpo (JSON)"}
                  name="body"
                  variant="outlined"
                  multiline
                  rows={5}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  className={classes.textField}
                  style={{ width: "95%" }}
                />
              )}
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

export default FlowBuilderWebhookModal;
