import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select
} from "@material-ui/core";
import { toast } from "react-toastify";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const FlowBuilderKanbanLaneModal = ({ open, onSave, onUpdate, data, close }) => {
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);
  const [laneId, setLaneId] = useState("");
  const [requireLaneId, setRequireLaneId] = useState("");
  const [lanes, setLanes] = useState([]);

  const [labels, setLabels] = useState({
    title: "Mover lead para lane",
    btn: "Adicionar"
  });

  useEffect(() => {
    const fetchLanes = async () => {
      try {
        const { data } = await api.get("/tag/kanban");
        setLanes(data?.lista || []);
      } catch (err) {
        toastError(err);
      }
    };

    if (open === "edit") {
      setLabels({ title: "Editar mover lane", btn: "Salvar" });
      setLaneId(data.data?.laneId !== undefined ? String(data.data.laneId) : "");
      setRequireLaneId(
        data.data?.requireLaneId !== undefined && data.data?.requireLaneId !== null
          ? String(data.data.requireLaneId)
          : ""
      );
      fetchLanes();
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({ title: "Mover lead para lane", btn: "Adicionar" });
      setLaneId("");
      setRequireLaneId("");
      fetchLanes();
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

  const handleSave = async () => {
    if (laneId === "") {
      return toast.error("Selecione a lane de destino");
    }
    const lane = lanes.find(l => String(l.id) === laneId);
    const reqLane = lanes.find(l => String(l.id) === requireLaneId);
    const payload = {
      laneId: Number(laneId),
      laneName: Number(laneId) === 0 ? "Em aberto" : lane?.name || "",
      requireLaneId: requireLaneId === "" ? null : Number(requireLaneId),
      requireLaneName: reqLane?.name || ""
    };
    if (open === "edit") {
      await onUpdate({ ...data, data: payload });
    } else {
      await onSave(payload);
    }
    handleClose();
  };

  return (
    <Dialog open={activeModal} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{labels.title}</DialogTitle>
      <DialogContent dividers>
        <FormControl variant="outlined" fullWidth margin="dense">
          <InputLabel>Somente se o lead estiver na lane (opcional)</InputLabel>
          <Select
            value={requireLaneId}
            onChange={(e) => setRequireLaneId(e.target.value)}
            label="Somente se o lead estiver na lane (opcional)"
          >
            <MenuItem value="">
              <em>Qualquer lane</em>
            </MenuItem>
            {lanes.map((lane) => (
              <MenuItem key={lane.id} value={String(lane.id)}>
                {lane.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl variant="outlined" fullWidth margin="dense">
          <InputLabel>Lane de destino</InputLabel>
          <Select
            value={laneId}
            onChange={(e) => setLaneId(e.target.value)}
            label="Lane de destino"
          >
            <MenuItem value="0">Em aberto (sem lane)</MenuItem>
            {lanes.map((lane) => (
              <MenuItem key={lane.id} value={String(lane.id)}>
                {lane.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="secondary" variant="outlined">
          Cancelar
        </Button>
        <Button onClick={handleSave} color="primary" variant="contained">
          {labels.btn}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FlowBuilderKanbanLaneModal;
