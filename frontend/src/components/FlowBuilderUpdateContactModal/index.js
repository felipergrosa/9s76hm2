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

const FlowBuilderUpdateContactModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [field, setField] = useState("name");
  const [customKey, setCustomKey] = useState("");
  const [value, setValue] = useState("");

  const [labels, setLabels] = useState({
    title: "Adicionar atualização de contato ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({
        title: "Editar atualização de contato",
        btn: "Salvar"
      });
      setField(data.data.field || "name");
      setCustomKey(data.data.customKey || "");
      setValue(data.data.value || "");
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar atualização de contato ao fluxo",
        btn: "Adicionar"
      });
      setField("name");
      setCustomKey("");
      setValue("");
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
    if (field === "custom" && !customKey.trim()) {
      return toast.error("Informe o nome do campo personalizado");
    }
    const payload = { field, customKey, value };
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
                <InputLabel sx={selectFieldStyles} id="contact-field-select-label">
                  Campo
                </InputLabel>
                <Select
                  labelId="contact-field-select-label"
                  id="contact-field-select"
                  value={field}
                  label="Campo"
                  onChange={e => setField(e.target.value)}
                  variant="outlined"
                  color="primary"
                  sx={selectFieldStyles}
                >
                  <MenuItem value="name">Nome</MenuItem>
                  <MenuItem value="email">E-mail</MenuItem>
                  <MenuItem value="custom">Campo personalizado</MenuItem>
                </Select>
              </FormControl>
              {field === "custom" && (
                <TextField
                  label={"Nome do campo personalizado"}
                  name="customKey"
                  variant="outlined"
                  value={customKey}
                  onChange={e => setCustomKey(e.target.value)}
                  className={classes.textField}
                  style={{ width: "95%" }}
                  required
                />
              )}
              <TextField
                label={"Valor"}
                name="value"
                variant="outlined"
                value={value}
                onChange={e => setValue(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                helperText="Suporta {{variaveis}}"
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

export default FlowBuilderUpdateContactModal;
