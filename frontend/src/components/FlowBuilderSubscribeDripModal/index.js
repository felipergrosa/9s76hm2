import React, { useState, useEffect, useRef } from "react";

import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";

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

const FlowBuilderSubscribeDripModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [dripSequenceId, setDripSequenceId] = useState("");
  const [action, setAction] = useState("subscribe");
  const [sequences, setSequences] = useState([]);

  const [labels, setLabels] = useState({
    title: "Adicionar sequência de follow-up ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    const fetchSequences = async () => {
      try {
        // /drip-sequences retorna objeto paginado { records, count, hasMore }
        const { data } = await api.get("/drip-sequences");
        const list = Array.isArray(data)
          ? data
          : (data && Array.isArray(data.records) ? data.records : []);
        setSequences(list);
      } catch (err) {
        toastError(err);
      }
    };

    if (open === "edit") {
      setLabels({
        title: "Editar sequência de follow-up",
        btn: "Salvar"
      });
      setDripSequenceId(data.data.dripSequenceId || "");
      setAction(data.data.action || "subscribe");
      fetchSequences();
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar sequência de follow-up ao fluxo",
        btn: "Adicionar"
      });
      setDripSequenceId("");
      setAction("subscribe");
      fetchSequences();
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
    if (!dripSequenceId) {
      return toast.error("Selecione uma sequência");
    }
    // Guarda o nome da sequência para exibição no nó sem nova consulta
    const selectedSequence = sequences.find(seq => seq.id === dripSequenceId);
    const payload = {
      dripSequenceId,
      dripSequenceName: selectedSequence ? selectedSequence.name : "",
      action
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
                <InputLabel sx={selectFieldStyles} id="drip-action-select-label">
                  Ação
                </InputLabel>
                <Select
                  labelId="drip-action-select-label"
                  id="drip-action-select"
                  value={action}
                  label="Ação"
                  onChange={e => setAction(e.target.value)}
                  variant="outlined"
                  color="primary"
                  sx={selectFieldStyles}
                >
                  <MenuItem value="subscribe">Inscrever</MenuItem>
                  <MenuItem value="unsubscribe">Remover inscrição</MenuItem>
                </Select>
              </FormControl>
              <FormControl sx={{ width: "95%" }} size="medium">
                <InputLabel sx={selectFieldStyles} id="drip-sequence-select-label">
                  Sequência
                </InputLabel>
                <Select
                  labelId="drip-sequence-select-label"
                  id="drip-sequence-select"
                  value={dripSequenceId}
                  label="Sequência"
                  onChange={e => setDripSequenceId(e.target.value)}
                  variant="outlined"
                  color="primary"
                  sx={selectFieldStyles}
                >
                  {sequences.map(seq => (
                    <MenuItem key={seq.id} value={seq.id}>
                      {seq.name}
                    </MenuItem>
                  ))}
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

export default FlowBuilderSubscribeDripModal;
