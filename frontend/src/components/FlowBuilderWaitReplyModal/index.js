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
import Typography from "@material-ui/core/Typography";

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

const FlowBuilderWaitReplyModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [timeout, setTimeout_] = useState("");
  const [unit, setUnit] = useState("minutes");
  const [timeoutMessage, setTimeoutMessage] = useState("");

  const [labels, setLabels] = useState({
    title: "Adicionar aguardar resposta ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({
        title: "Editar aguardar resposta",
        btn: "Salvar"
      });
      setTimeout_(data.data.timeout || "");
      setUnit(data.data.unit || "minutes");
      setTimeoutMessage(data.data.timeoutMessage || "");
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar aguardar resposta ao fluxo",
        btn: "Adicionar"
      });
      setTimeout_("");
      setUnit("minutes");
      setTimeoutMessage("");
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
    const value = parseInt(timeout, 10);
    if (!timeout || isNaN(value) || value < 1) {
      return toast.error("Informe um tempo de espera válido (mínimo 1)");
    }
    const payload = {
      timeout: value,
      unit,
      timeoutMessage
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
              <Typography>
                O fluxo aguarda a resposta do contato até o tempo limite. Se o
                contato responder, segue pela saída "Respondeu"; se o tempo
                esgotar, segue pela saída "Timeout".
              </Typography>
              <TextField
                label={"Tempo de espera"}
                name="timeout"
                variant="outlined"
                type="number"
                value={timeout}
                onChange={e => setTimeout_(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                InputProps={{ inputProps: { min: 1 } }}
                required
              />
              <FormControl sx={{ width: "95%" }} size="medium">
                <InputLabel sx={selectFieldStyles} id="wait-reply-unit-select-label">
                  Unidade
                </InputLabel>
                <Select
                  labelId="wait-reply-unit-select-label"
                  id="wait-reply-unit-select"
                  value={unit}
                  label="Unidade"
                  onChange={e => setUnit(e.target.value)}
                  variant="outlined"
                  color="primary"
                  sx={selectFieldStyles}
                >
                  <MenuItem value="minutes">Minutos</MenuItem>
                  <MenuItem value="hours">Horas</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label={"Mensagem de timeout (opcional)"}
                name="timeoutMessage"
                variant="outlined"
                multiline
                rows={3}
                value={timeoutMessage}
                onChange={e => setTimeoutMessage(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                helperText="Enviada ao cliente quando o tempo esgota. Suporta {{variaveis}}"
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

export default FlowBuilderWaitReplyModal;
