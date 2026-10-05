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

const FlowBuilderSmartDelayModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("minutes");

  const [labels, setLabels] = useState({
    title: "Adicionar espera inteligente ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({
        title: "Editar espera inteligente",
        btn: "Salvar"
      });
      setAmount(data.data.amount || "");
      setUnit(data.data.unit || "minutes");
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar espera inteligente ao fluxo",
        btn: "Adicionar"
      });
      setAmount("");
      setUnit("minutes");
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
    const value = parseInt(amount, 10);
    if (!amount || isNaN(value) || value < 1) {
      return toast.error("Informe um tempo válido (mínimo 1)");
    }
    if (value > 43200) {
      return toast.error("O tempo máximo é 43200");
    }
    if (unit === "days" && value > 30) {
      return toast.error("O tempo máximo em dias é 30");
    }
    const payload = {
      amount: value,
      unit
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
                label={"Tempo"}
                name="amount"
                variant="outlined"
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                InputProps={{ inputProps: { min: 1, max: 43200 } }}
                required
              />
              <FormControl sx={{ width: "95%" }} size="medium">
                <InputLabel sx={selectFieldStyles} id="smart-delay-unit-select-label">
                  Unidade
                </InputLabel>
                <Select
                  labelId="smart-delay-unit-select-label"
                  id="smart-delay-unit-select"
                  value={unit}
                  label="Unidade"
                  onChange={e => setUnit(e.target.value)}
                  variant="outlined"
                  color="primary"
                  sx={selectFieldStyles}
                >
                  <MenuItem value="minutes">Minutos</MenuItem>
                  <MenuItem value="hours">Horas</MenuItem>
                  <MenuItem value="days">Dias (máx. 30)</MenuItem>
                </Select>
              </FormControl>
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

export default FlowBuilderSmartDelayModal;
