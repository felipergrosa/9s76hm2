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

// Modal de configuração do nó "googleCalendar" (Google Agenda).
// Campos aceitam interpolação {{var}} — resolvida no backend com dados do
// contato e variáveis do fluxo.
const FlowBuilderGoogleCalendarModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [summary, setSummary] = useState("");
  const [startAt, setStartAt] = useState("");
  const [startOffsetMinutes, setStartOffsetMinutes] = useState("60");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [attendees, setAttendees] = useState("");

  const [labels, setLabels] = useState({
    title: i18n.t("googleCalendarModal.titleAdd"),
    btn: i18n.t("googleCalendarModal.add")
  });

  useEffect(() => {
    if (open === "edit") {
      setLabels({
        title: i18n.t("googleCalendarModal.titleEdit"),
        btn: i18n.t("googleCalendarModal.save")
      });
      setSummary(data.data.summary || "");
      setStartAt(data.data.startAt || "");
      setStartOffsetMinutes(String(data.data.startOffsetMinutes ?? "60"));
      setDurationMinutes(String(data.data.durationMinutes ?? "30"));
      setDescription(data.data.description || "");
      setLocation(data.data.location || "");
      setAttendees(data.data.attendees || "");
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: i18n.t("googleCalendarModal.titleAdd"),
        btn: i18n.t("googleCalendarModal.add")
      });
      setSummary("");
      setStartAt("");
      setStartOffsetMinutes("60");
      setDurationMinutes("30");
      setDescription("");
      setLocation("");
      setAttendees("");
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
    if (!summary || !summary.trim()) {
      return toast.error(i18n.t("googleCalendarModal.errors.summaryRequired"));
    }
    const payload = {
      summary: summary.trim(),
      startAt: startAt.trim(),
      startOffsetMinutes: Number(startOffsetMinutes) || 60,
      durationMinutes: Number(durationMinutes) || 30,
      description,
      location: location.trim(),
      attendees: attendees.trim()
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
                label={i18n.t("googleCalendarModal.fields.summary")}
                name="summary"
                variant="outlined"
                value={summary}
                onChange={e => setSummary(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                helperText={i18n.t("googleCalendarModal.helpers.variables")}
                required
              />
              <TextField
                label={i18n.t("googleCalendarModal.fields.startAt")}
                name="startAt"
                variant="outlined"
                value={startAt}
                onChange={e => setStartAt(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                helperText={i18n.t("googleCalendarModal.helpers.startAt")}
              />
              <TextField
                label={i18n.t("googleCalendarModal.fields.startOffsetMinutes")}
                name="startOffsetMinutes"
                type="number"
                variant="outlined"
                value={startOffsetMinutes}
                onChange={e => setStartOffsetMinutes(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                helperText={i18n.t("googleCalendarModal.helpers.startOffset")}
              />
              <TextField
                label={i18n.t("googleCalendarModal.fields.durationMinutes")}
                name="durationMinutes"
                type="number"
                variant="outlined"
                value={durationMinutes}
                onChange={e => setDurationMinutes(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                inputProps={{ min: 5, max: 1440 }}
              />
              <TextField
                label={i18n.t("googleCalendarModal.fields.description")}
                name="description"
                variant="outlined"
                multiline
                rows={4}
                value={description}
                onChange={e => setDescription(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                helperText={i18n.t("googleCalendarModal.helpers.variables")}
              />
              <TextField
                label={i18n.t("googleCalendarModal.fields.location")}
                name="location"
                variant="outlined"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
              />
              <TextField
                label={i18n.t("googleCalendarModal.fields.attendees")}
                name="attendees"
                variant="outlined"
                value={attendees}
                onChange={e => setAttendees(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                helperText={i18n.t("googleCalendarModal.helpers.attendees")}
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

export default FlowBuilderGoogleCalendarModal;
