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

const FlowBuilderAiAgentModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [aiAgentId, setAiAgentId] = useState("");
  const [agents, setAgents] = useState([]);

  const [labels, setLabels] = useState({
    title: "Adicionar agente de IA ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        // /ai-agents retorna { agents, count } — funil/etapas ficam no detalhe
        const { data } = await api.get("/ai-agents");
        const list = Array.isArray(data)
          ? data
          : (data && Array.isArray(data.agents) ? data.agents : []);
        setAgents(list);
      } catch (err) {
        toastError(err);
      }
    };

    if (open === "edit") {
      setLabels({
        title: "Editar agente de IA",
        btn: "Salvar"
      });
      setAiAgentId(data.data.aiAgentId || "");
      fetchAgents();
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar agente de IA ao fluxo",
        btn: "Adicionar"
      });
      setAiAgentId("");
      fetchAgents();
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
    if (!aiAgentId) {
      return toast.error("Selecione um agente de IA");
    }
    // Guarda o nome do agente para exibição no nó sem nova consulta
    const selectedAgent = agents.find(agent => agent.id === aiAgentId);
    const payload = {
      aiAgentId,
      aiAgentName: selectedAgent ? selectedAgent.name : ""
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
                <InputLabel sx={selectFieldStyles} id="ai-agent-select-label">
                  Agente de IA
                </InputLabel>
                <Select
                  labelId="ai-agent-select-label"
                  id="ai-agent-select"
                  value={aiAgentId}
                  label="Agente de IA"
                  onChange={e => setAiAgentId(e.target.value)}
                  variant="outlined"
                  color="primary"
                  sx={selectFieldStyles}
                >
                  {agents.map(agent => (
                    <MenuItem key={agent.id} value={agent.id}>
                      {agent.name}
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

export default FlowBuilderAiAgentModal;
