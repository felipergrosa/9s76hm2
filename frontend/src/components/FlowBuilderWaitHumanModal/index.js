import React, { useState, useEffect, useRef } from "react";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
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
  Stack,
  Typography
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

const FlowBuilderWaitHumanModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [activeModal, setActiveModal] = useState(false);

  const [message, setMessage] = useState("");
  const [queueId, setQueueId] = useState("");
  const [userId, setUserId] = useState("");
  const [queues, setQueues] = useState([]);
  const [users, setUsers] = useState([]);

  const [labels, setLabels] = useState({
    title: "Adicionar espera por atendente ao fluxo",
    btn: "Adicionar"
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // /users pode retornar array direto ou objeto paginado { users }
        const { data } = await api.get("/users");
        const list = Array.isArray(data)
          ? data
          : (data && Array.isArray(data.users) ? data.users : []);
        setUsers(list);
      } catch (err) {
        toastError(err);
      }
    };

    const fetchQueues = async () => {
      try {
        const { data } = await api.get("/queue");
        setQueues(Array.isArray(data) ? data : []);
      } catch (err) {
        toastError(err);
      }
    };

    if (open === "edit") {
      setLabels({
        title: "Editar espera por atendente",
        btn: "Salvar"
      });
      setMessage(data.data.message || "");
      setQueueId(data.data.queueId || "");
      setUserId(data.data.userId || "");
      fetchUsers();
      fetchQueues();
      setActiveModal(true);
    } else if (open === "create") {
      setLabels({
        title: "Adicionar espera por atendente ao fluxo",
        btn: "Adicionar"
      });
      setMessage("");
      setQueueId("");
      setUserId("");
      fetchUsers();
      fetchQueues();
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
    // Todos os campos são opcionais: sem fila/atendente o bloco apenas
    // pausa a automação até um humano enviar mensagem no ticket.
    // Guarda os nomes para exibição no nó sem nova consulta.
    const selectedQueue = queues.find(queue => queue.id === queueId);
    const selectedUser = users.find(user => user.id === userId);
    const payload = {
      message,
      queueId: queueId || null,
      queueName: selectedQueue ? selectedQueue.name : "",
      userId: userId || null,
      userName: selectedUser ? selectedUser.name : ""
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
                label={"Mensagem ao cliente ao pausar (opcional)"}
                name="message"
                variant="outlined"
                multiline
                rows={3}
                value={message}
                onChange={e => setMessage(e.target.value)}
                className={classes.textField}
                style={{ width: "95%" }}
                helperText="Aceita variáveis, ex.: {{name}}"
              />
              <FormControl sx={{ width: "95%" }} size="medium">
                <InputLabel sx={selectFieldStyles} id="wait-human-queue-select-label">
                  Fila (opcional)
                </InputLabel>
                <Select
                  labelId="wait-human-queue-select-label"
                  id="wait-human-queue-select"
                  value={queueId}
                  label="Fila (opcional)"
                  onChange={e => setQueueId(e.target.value)}
                  variant="outlined"
                  color="primary"
                  sx={selectFieldStyles}
                >
                  <MenuItem value="">
                    <em>Nenhuma</em>
                  </MenuItem>
                  {queues.map(queue => (
                    <MenuItem key={queue.id} value={queue.id}>
                      {queue.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl sx={{ width: "95%" }} size="medium">
                <InputLabel sx={selectFieldStyles} id="wait-human-user-select-label">
                  Atendente (opcional)
                </InputLabel>
                <Select
                  labelId="wait-human-user-select-label"
                  id="wait-human-user-select"
                  value={userId}
                  label="Atendente (opcional)"
                  onChange={e => setUserId(e.target.value)}
                  variant="outlined"
                  color="primary"
                  sx={selectFieldStyles}
                >
                  <MenuItem value="">
                    <em>Nenhum</em>
                  </MenuItem>
                  {users.map(user => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="textSecondary">
                O bot fica pausado até um atendente enviar mensagem; a próxima
                resposta do cliente retoma o fluxo.
              </Typography>
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

export default FlowBuilderWaitHumanModal;
