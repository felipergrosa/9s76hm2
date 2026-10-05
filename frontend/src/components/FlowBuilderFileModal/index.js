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
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
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

const FlowBuilderFileModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [caption, setCaption] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");

  const [labels, setLabels] = useState({
    title: "Adicionar arquivo ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({
        title: "Editar arquivo",
        btn: "Salvar"
      });
      setUrl(data.data.url || "");
      setFileName(data.data.fileName || "");
      setCaption(data.data.caption || "");
      setSelectedFileName("");
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar arquivo ao fluxo",
        btn: "Adicionar"
      });
      setUrl("");
      setFileName("");
      setCaption("");
      setSelectedFileName("");
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

  // Upload reutiliza o mesmo endpoint do modal de imagem (/flowbuilder/img)
  const handleChangeFile = async e => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    if (file.size > 20000000) {
      toast.error("Arquivo é muito grande! 20MB máximo");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("fromMe", true);
      formData.append("medias", file);
      const { data: res } = await api.post("/flowbuilder/img", formData);
      // O endpoint retorna o nome do arquivo salvo na pasta pública
      setUrl(res.name);
      setSelectedFileName(file.name);
      if (!fileName) {
        setFileName(file.name);
      }
      toast.success("Arquivo enviado com sucesso!");
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
      e.target.value = null;
    }
  };

  const handleSaveContact = async () => {
    if (!url || !url.trim()) {
      return toast.error("Informe a URL do arquivo ou envie um arquivo");
    }
    const payload = {
      url: url.trim(),
      fileName,
      caption
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
              {!loading && (
                <Button variant="contained" component="label">
                  Enviar arquivo
                  <input
                    type="file"
                    accept="application/*"
                    hidden
                    disabled={loading}
                    onChange={handleChangeFile}
                  />
                </Button>
              )}
              {loading && (
                <Stack justifyContent="center" alignSelf="center">
                  <CircularProgress />
                </Stack>
              )}
              {selectedFileName && (
                <TextField
                  label={"Arquivo enviado"}
                  variant="outlined"
                  value={selectedFileName}
                  className={classes.textField}
                  style={{ width: "95%" }}
                  InputProps={{ readOnly: true }}
                />
              )}
              <TextField
                label={"URL do arquivo"}
                name="url"
                variant="outlined"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                helperText="URL pública do arquivo ou nome retornado pelo upload"
                required
              />
              <TextField
                label={"Nome do arquivo"}
                name="fileName"
                variant="outlined"
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
              />
              <TextField
                label={"Legenda (opcional)"}
                name="caption"
                variant="outlined"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
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

export default FlowBuilderFileModal;
