import React, { useState, useEffect, useRef, useContext } from "react";
import { useHistory } from "react-router-dom";

import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import Select from "@material-ui/core/Select";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import { Grid, makeStyles } from "@material-ui/core";

import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Autocomplete, {
  createFilterOptions,
} from "@material-ui/lab/Autocomplete";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import useQueues from "../../hooks/useQueues";
import UserStatusIcon from "../UserModal/statusIcon";
import { isNil } from "lodash";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  maxWidth: {
    width: "100%",
  },
  compactDialog: {
    '& .MuiDialogContent-root': {
      padding: theme.spacing(2),
    },
    '& .MuiGrid-container': {
      marginBottom: theme.spacing(1),
    },
  },
  textFieldCompact: {
    marginTop: theme.spacing(1),
  }
}));

const filterOptions = createFilterOptions({
  trim: true,
});

const TransferTicketModalCustom = ({ modalOpen, onClose, ticketid, ticket, mode }) => {
  const history = useHistory();
  const { user, socket } = useContext(AuthContext);
  const [options, setOptions] = useState([]);
  const [queues, setQueues] = useState([]);
  const [allQueues, setAllQueues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedQueue, setSelectedQueue] = useState("");
  const classes = useStyles();
  const { findAllForSelection } = useQueues();
  const isMounted = useRef(true);
  const [msgTransfer, setMsgTransfer] = useState('');

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isMounted.current) {
      const loadQueues = async () => {
        // Usa findAllForSelection - SEM permissão queues.view
        const list = mode === "bot"
          ? await findAllForSelection({ onlyWithBot: true })
          : await findAllForSelection();

        setAllQueues(list);
        setQueues(list);

      };
      loadQueues();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);


  useEffect(() => {
    if (mode === "bot") {
      return;
    }

    if (modalOpen) {
      const fetchUsers = async () => {
        setLoading(true);
        try {
          // Usa /users/available - SEM permissão users.view
          const { data } = await api.get("/users/available");
          setOptions(data);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          console.error("Erro ao buscar usuários disponíveis:", err);
          setOptions([]);
        }
      };

      fetchUsers();
    }
  }, [modalOpen, mode]);

  // Listener para atualização de status dos usuários em tempo real
  useEffect(() => {
    if (modalOpen && user?.companyId && mode !== "bot") {
      const onCompanyUser = (data) => {
        if (data.action === "update") {
          // Atualiza o usuário na lista se existir
          setOptions(prev => {
            const index = prev.findIndex(u => u.id === data.user.id);
            if (index !== -1) {
              const updated = [...prev];
              updated[index] = { ...updated[index], ...data.user };
              return updated;
            }
            return prev;
          });
        }
      };
      
      socket.on(`company-${user.companyId}-user`, onCompanyUser);
      
      return () => {
        socket.off(`company-${user.companyId}-user`, onCompanyUser);
      };
    }
  }, [modalOpen, user?.companyId, socket, mode]);

  const handleMsgTransferChange = (event) => {
    setMsgTransfer(event.target.value);
  };

  const handleClose = () => {
    onClose();
    setSearchParam("");
    setSelectedUser(null);
  };

  const handleSaveTicket = async (e) => {
    // e.preventDefault();
    if (!ticketid) return;
    if (!selectedQueue || selectedQueue === "") return;
    setLoading(true);
    try {
      if (mode === "bot") {
        await api.post(`/tickets/${ticketid}/transfer-to-bot`, {
          queueId: selectedQueue
        });
      } else {
        let data = {};

        data.userId = !selectedUser ? null : selectedUser.id;
        data.status = !selectedUser ? "pending" : ticket.isGroup ? "group" : "open";
        data.queueId = selectedQueue;
        data.msgTransfer = msgTransfer ? msgTransfer : null;
        data.isTransfered = true;

        await api.put(`/tickets/${ticketid}`, data);
      }

      setLoading(false);
      history.push(`/tickets/`);
      handleClose();
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
  };


  return (
    <Dialog 
      open={modalOpen} 
      onClose={handleClose} 
      maxWidth={false}
      PaperProps={{
        style: { maxWidth: 300, width: '100%' }
      }}
      className={classes.compactDialog}
    >
      {/* <form onSubmit={handleSaveTicket}> */}
      <DialogTitle id="form-dialog-title">
        {i18n.t("transferTicketModal.title")}
      </DialogTitle>
      <DialogContent dividers style={{ paddingBottom: 8 }}>
        <Grid container spacing={1}>
          {mode !== "bot" && (
            <Grid item xs={12}>
              <FormControl variant="outlined" fullWidth>
                <InputLabel id="user-selection-label">
                  {i18n.t("transferTicketModal.fieldLabel")}
                </InputLabel>
                <Select
                  labelId="user-selection-label"
                  label={i18n.t("transferTicketModal.fieldLabel")}
                  value={selectedUser?.id || ""}
                  onChange={(e) => {
                    const userId = e.target.value;
                    const user = options.find(u => u.id === userId);
                    setSelectedUser(user || null);

                    if (user != null && Array.isArray(user.queues)) {
                      if (user.queues.length === 1) {
                        setSelectedQueue(user.queues[0].id);
                      }
                      setQueues(user.queues);
                    } else {
                      setQueues(allQueues);
                      setSelectedQueue("");
                    }
                  }}
                  fullWidth
                >
                  <MenuItem value="">
                    <em>Nenhum</em>
                  </MenuItem>
                  {options.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
          <Grid item xs={12}>
            <FormControl variant="outlined" fullWidth>
              <InputLabel>
                {i18n.t("transferTicketModal.fieldQueueLabel")}
              </InputLabel>
              <Select
                value={selectedQueue}
                onChange={(e) => setSelectedQueue(e.target.value)}
                label={i18n.t("transferTicketModal.fieldQueuePlaceholder")}
                fullWidth
              >
                {queues.map((queue) => (
                  <MenuItem key={queue.id} value={queue.id}>
                    {queue.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
        <Grid container spacing={1} style={{ marginTop: 2 }}>
          {mode !== "bot" && (
            <Grid item xs={12} sm={12} xl={12} >
              <TextField
                label={i18n.t("transferTicketModal.msgTransfer")}
                value={msgTransfer}
                onChange={handleMsgTransferChange}
                variant="outlined"
                multiline
                maxRows={2}
                minRows={2}
                fullWidth
              />
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleClose}
          color="secondary"
          disabled={loading}
          variant="outlined"
        >
          {i18n.t("transferTicketModal.buttons.cancel")}
        </Button>
        <ButtonWithSpinner
          variant="contained"
          type="submit"
          color="primary"
          loading={loading}
          disabled={selectedQueue === ""}
          onClick={() => handleSaveTicket(selectedQueue)}

        >
          {i18n.t("transferTicketModal.buttons.ok")}
        </ButtonWithSpinner>
      </DialogActions>
      {/* </form> */}
    </Dialog>
  );
};

export default TransferTicketModalCustom;
