import React, { useState, useEffect } from "react";

import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  CircularProgress
} from "@mui/material";
import { Alert } from "@material-ui/lab";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexWrap: "wrap"
  },
  selectField: {
    ".MuiOutlinedInput-notchedOutline": {
      borderColor: "#909090"
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: theme.palette.primary.main
    }
  }
}));

/**
 * Modal "Disparar Fluxo": lista os fluxos ativos do FlowBuilder da empresa
 * e dispara o selecionado no ticket aberto (POST /tickets/:id/trigger-flow).
 * Se o ticket já estiver executando um fluxo, o back responde 409 e o modal
 * pede confirmação antes de sobrescrever (reenvia com force=true).
 */
const TriggerFlowModal = ({ open, onClose, ticket }) => {
  const classes = useStyles();

  const [flowId, setFlowId] = useState("");
  const [flows, setFlows] = useState([]);
  const [loadingFlows, setLoadingFlows] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Ticket já está dentro de um fluxo — sobrescrita exige confirmação
  const [needsForceConfirm, setNeedsForceConfirm] = useState(false);
  const [currentFlowName, setCurrentFlowName] = useState("");

  useEffect(() => {
    const fetchFlows = async () => {
      setLoadingFlows(true);
      try {
        const { data } = await api.get(`/tickets/${ticket.id}/flows`);
        const list = Array.isArray(data?.flows) ? data.flows : [];
        setFlows(list);
        if (data?.inFlow) {
          // Avisa desde a abertura que o ticket já executa um fluxo
          setNeedsForceConfirm(true);
          const current = list.find(f => Number(f.id) === Number(data.currentFlowId));
          setCurrentFlowName(current?.name || `#${data.currentFlowId}`);
        }
      } catch (err) {
        toastError(err);
      } finally {
        setLoadingFlows(false);
      }
    };

    if (open && ticket?.id) {
      setFlowId("");
      setNeedsForceConfirm(false);
      setCurrentFlowName("");
      fetchFlows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticket?.id]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleTrigger = async (force = false) => {
    if (!flowId) {
      return toast.warning(i18n.t("triggerFlowModal.selectRequired"));
    }
    setSubmitting(true);
    try {
      await api.post(`/tickets/${ticket.id}/trigger-flow`, {
        flowId,
        force
      });
      toast.success(i18n.t("triggerFlowModal.success"));
      setSubmitting(false);
      onClose();
    } catch (err) {
      setSubmitting(false);
      // 409: ticket já está em um fluxo — o modal pede confirmação para
      // sobrescrever em vez de apenas exibir o erro genérico.
      if (err?.response?.data?.error === "ERR_TICKET_ALREADY_IN_FLOW") {
        setNeedsForceConfirm(true);
        return;
      }
      toastError(err);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      scroll="paper"
    >
      <DialogTitle>{i18n.t("triggerFlowModal.title")}</DialogTitle>
      <Stack>
        <DialogContent dividers>
          {loadingFlows ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
              <CircularProgress size={28} />
            </div>
          ) : flows.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              {i18n.t("triggerFlowModal.empty")}
            </Typography>
          ) : (
            <>
              {needsForceConfirm && (
                <Alert severity="warning" style={{ marginBottom: 16 }}>
                  {i18n.t("triggerFlowModal.alreadyInFlow", {
                    flow: currentFlowName || "-"
                  })}
                </Alert>
              )}
              <FormControl
                className={classes.selectField}
                fullWidth
                size="medium"
                variant="outlined"
              >
                <InputLabel id="trigger-flow-select-label">
                  {i18n.t("triggerFlowModal.selectLabel")}
                </InputLabel>
                <Select
                  labelId="trigger-flow-select-label"
                  id="trigger-flow-select"
                  value={flowId}
                  label={i18n.t("triggerFlowModal.selectLabel")}
                  onChange={e => setFlowId(e.target.value)}
                >
                  {flows.map(flow => (
                    <MenuItem key={flow.id} value={flow.id}>
                      {flow.name}
                      {flow.status === "draft"
                        ? ` (${i18n.t("triggerFlowModal.draft")})`
                        : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="secondary" variant="outlined">
            {i18n.t("triggerFlowModal.cancel")}
          </Button>
          <Button
            color="primary"
            variant="contained"
            disabled={submitting || loadingFlows || flows.length === 0}
            onClick={() => handleTrigger(needsForceConfirm)}
          >
            {needsForceConfirm
              ? i18n.t("triggerFlowModal.confirmOverwrite")
              : i18n.t("triggerFlowModal.confirm")}
          </Button>
        </DialogActions>
      </Stack>
    </Dialog>
  );
};

export default TriggerFlowModal;
