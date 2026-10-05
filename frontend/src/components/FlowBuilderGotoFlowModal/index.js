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

const FlowBuilderGotoFlowModal = ({ open, onSave, onUpdate, data, close, currentFlowId }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [flowId, setFlowId] = useState("");
  const [flows, setFlows] = useState([]);

  const [labels, setLabels] = useState({
    title: "Adicionar ir para fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    const fetchFlows = async () => {
      try {
        const { data: response } = await api.get("/flowbuilder");
        let list = Array.isArray(response && response.flows) ? response.flows : [];
        // Exclui o fluxo atual (id da rota via currentFlowId, ou o id já
        // salvo no nó em edição) para não permitir auto-referência.
        const excludeId = (data && data.flowId) || (currentFlowId ? Number(currentFlowId) : null);
        if (excludeId) {
          list = list.filter(flow => flow.id !== excludeId);
        }
        setFlows(list);
      } catch (err) {
        toastError(err);
      }
    };

    if (open === "edit") {
      setLabels({
        title: "Editar ir para fluxo",
        btn: "Salvar"
      });
      setFlowId(data.data.flowId || "");
      fetchFlows();
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar ir para fluxo",
        btn: "Adicionar"
      });
      setFlowId("");
      fetchFlows();
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
    if (!flowId) {
      return toast.error("Selecione o fluxo de destino");
    }
    // Guarda o nome do fluxo para exibição no nó sem nova consulta
    const selectedFlow = flows.find(flow => flow.id === flowId);
    const payload = {
      flowId,
      flowName: selectedFlow ? selectedFlow.name : ""
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
            <FormControl sx={{ width: "95%" }} size="medium">
              <InputLabel sx={selectFieldStyles} id="goto-flow-select-label">
                Fluxo de destino
              </InputLabel>
              <Select
                labelId="goto-flow-select-label"
                id="goto-flow-select"
                value={flowId}
                label="Fluxo de destino"
                onChange={e => setFlowId(e.target.value)}
                variant="outlined"
                color="primary"
                sx={selectFieldStyles}
              >
                {flows.map(flow => (
                  <MenuItem key={flow.id} value={flow.id}>
                    {flow.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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

export default FlowBuilderGotoFlowModal;
