import React, { useState, useEffect, useRef } from "react";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import TextField from "@material-ui/core/TextField";

import { i18n } from "../../translate/i18n";

import { Checkbox, FormControlLabel, Stack } from "@mui/material";

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

// Rótulos curtos exibidos no corpo do nó (join(", "))
const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const FlowBuilderBusinessHoursModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [days, setDays] = useState(WEEK_DAYS);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("18:00");

  const [labels, setLabels] = useState({
    title: "Adicionar horário comercial ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({
        title: "Editar horário comercial",
        btn: "Salvar"
      });
      setDays(Array.isArray(data.data.days) && data.data.days.length ? data.data.days : WEEK_DAYS);
      setStart(data.data.start || "08:00");
      setEnd(data.data.end || "18:00");
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar horário comercial ao fluxo",
        btn: "Adicionar"
      });
      setDays(WEEK_DAYS);
      setStart("08:00");
      setEnd("18:00");
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

  const toggleDay = day => {
    setDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSaveContact = async () => {
    const payload = {
      days: WEEK_DAYS.filter(d => days.includes(d)),
      start,
      end
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
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#344054", marginBottom: 4 }}>
                  Dias de atendimento
                </div>
                <div style={{ display: "flex", flexWrap: "wrap" }}>
                  {WEEK_DAYS.map(day => (
                    <FormControlLabel
                      key={day}
                      control={
                        <Checkbox
                          checked={days.includes(day)}
                          onChange={() => toggleDay(day)}
                          color="primary"
                        />
                      }
                      label={day}
                    />
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: "16px", width: "95%" }}>
                <TextField
                  label={"Início"}
                  name="start"
                  type="time"
                  variant="outlined"
                  value={start}
                  onChange={e => setStart(e.target.value)}
                  className={classes.textField}
                  InputLabelProps={{ shrink: true }}
                  required
                />
                <TextField
                  label={"Fim"}
                  name="end"
                  type="time"
                  variant="outlined"
                  value={end}
                  onChange={e => setEnd(e.target.value)}
                  className={classes.textField}
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </div>
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

export default FlowBuilderBusinessHoursModal;
