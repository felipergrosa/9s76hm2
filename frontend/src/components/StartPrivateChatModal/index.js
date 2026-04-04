import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Avatar,
  FormControl,
  InputLabel,
  MenuItem,
  Select
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import toastError from "../../errors/toastError";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  dialogTitle: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
  dialogContent: {
    padding: theme.spacing(3),
    minWidth: 400,
  },
  participantInfo: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.grey[50],
    borderRadius: theme.spacing(1),
  },
  participantAvatar: {
    width: 48,
    height: 48,
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
  participantDetails: {
    flex: 1,
  },
  participantName: {
    fontWeight: 600,
    fontSize: "1.1rem",
    marginBottom: theme.spacing(0.5),
  },
  participantNumber: {
    color: theme.palette.text.secondary,
    fontSize: "0.9rem",
  },
  queueSection: {
    marginBottom: theme.spacing(2),
  },
  queueLabel: {
    fontWeight: 500,
    marginBottom: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
  actions: {
    padding: theme.spacing(2),
    display: "flex",
    gap: theme.spacing(1),
    justifyContent: "flex-end",
  },
  loadingButton: {
    minWidth: 120,
  },
}));

const StartPrivateChatModal = ({ open, onClose, participant, whatsappId, user }) => {
  const classes = useStyles();
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedQueueId, setSelectedQueueId] = useState("");
  const [availableQueues, setAvailableQueues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Resetar estado quando o modal abrir/fechar
  useEffect(() => {
    if (!open) {
      setAvailableUsers([]);
      setAvailableQueues([]);
      setSelectedUserId("");
      setSelectedQueueId("");
      setLoading(false);
      setLoadingUsers(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let mounted = true;

    const applyDefaultSelection = (users) => {
      const fallbackUsers = Array.isArray(users) && users.length > 0 ? users : [user].filter(Boolean);
      const defaultUser = fallbackUsers.find((entry) => entry.id === user?.id) || fallbackUsers[0] || null;
      const queues = Array.isArray(defaultUser?.queues) ? defaultUser.queues : [];

      if (!mounted) return;

      setAvailableUsers(fallbackUsers);
      setSelectedUserId(defaultUser?.id || "");
      setAvailableQueues(queues);
      setSelectedQueueId(queues.length === 1 ? queues[0].id : "");
    };

    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const { data } = await api.get("/users/available");
        applyDefaultSelection(data || []);
      } catch (err) {
        applyDefaultSelection([]);
      } finally {
        if (mounted) {
          setLoadingUsers(false);
        }
      }
    };

    loadUsers();

    return () => {
      mounted = false;
    };
  }, [open, user]);

  useEffect(() => {
    if (!selectedUserId) {
      setAvailableQueues([]);
      setSelectedQueueId("");
      return;
    }

    const selectedUser = availableUsers.find((entry) => entry.id === selectedUserId);
    const queues = Array.isArray(selectedUser?.queues) ? selectedUser.queues : [];
    setAvailableQueues(queues);

    if (!queues.some((queue) => queue.id === selectedQueueId)) {
      setSelectedQueueId(queues.length === 1 ? queues[0].id : "");
    }
  }, [availableUsers, selectedQueueId, selectedUserId]);

  const handleStartChat = async () => {
    if (!selectedUserId) {
      alert("Por favor, selecione um atendente para iniciar a conversa.");
      return;
    }

    if (!selectedQueueId) {
      alert("Por favor, selecione uma fila para iniciar a conversa.");
      return;
    }

    setLoading(true);
    try {
      let contactId = participant?.contactId;

      if (!contactId && participant?.number) {
        const { data: createdContact } = await api.post("/contacts", {
          name: participant?.name || participant?.displayNumber || participant.number,
          number: participant.number,
          email: ""
        });
        contactId = createdContact?.id;
      }

      if (!contactId) {
        alert("Não foi possível identificar o contato deste participante.");
        setLoading(false);
        return;
      }

      // Criar novo ticket privado com o participante
      const { data: ticket } = await api.post("/tickets", {
        contactId,
        queueId: selectedQueueId,
        whatsappId,
        userId: selectedUserId,
        status: "open",
      });

      // Fechar modal e passar o novo ticket para o callback
      onClose(ticket);
    } catch (err) {
      console.error("[StartPrivateChatModal] Erro ao criar ticket:", err);
      toastError(err);
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose(null);
    }
  };

  if (!participant) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle className={classes.dialogTitle}>
        Iniciar Conversa Privada
      </DialogTitle>
      
      <DialogContent className={classes.dialogContent}>
        {/* Informações do participante */}
        <Box className={classes.participantInfo}>
          <Avatar 
            className={classes.participantAvatar}
            src={participant.urlPicture || participant.profilePicUrl || participant.imgUrlBaileys || ""}
          >
            {participant.name?.charAt(0)?.toUpperCase() || "P"}
          </Avatar>
          
          <Box className={classes.participantDetails}>
            <Typography className={classes.participantName}>
              {participant.name || "Participante"}
            </Typography>
            <Typography className={classes.participantNumber}>
              {participant.displayNumber || participant.number || participant.id}
            </Typography>
            {participant.isAdmin && (
              <Typography variant="caption" color="primary">
                Administrador do Grupo
              </Typography>
            )}
          </Box>
        </Box>

        <Box className={classes.queueSection}>
          <Typography className={classes.queueLabel}>
            Qual atendente ficará responsável por esta conversa?
          </Typography>
          <FormControl variant="outlined" fullWidth size="small" disabled={loading || loadingUsers}>
            <InputLabel id="start-private-chat-user-label">Atendente</InputLabel>
            <Select
              labelId="start-private-chat-user-label"
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(Number(event.target.value) || "")}
              label="Atendente"
            >
              {availableUsers.map((availableUser) => (
                <MenuItem key={availableUser.id} value={availableUser.id}>
                  {availableUser.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Seleção de fila */}
        <Box className={classes.queueSection}>
          <Typography className={classes.queueLabel}>
            Para qual fila deseja direcionar esta conversa?
          </Typography>
          <FormControl variant="outlined" fullWidth size="small" disabled={loading || loadingUsers || !selectedUserId}>
            <InputLabel id="start-private-chat-queue-label">Fila de Atendimento</InputLabel>
            <Select
              labelId="start-private-chat-queue-label"
              value={selectedQueueId}
              onChange={(event) => setSelectedQueueId(Number(event.target.value) || "")}
              label="Fila de Atendimento"
            >
              {availableQueues.map((queue) => (
                <MenuItem key={queue.id} value={queue.id}>
                  {queue.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Typography variant="body2" color="textSecondary">
          Uma nova conversa privada será iniciada com este participante, 
          separada do grupo atual.
        </Typography>
      </DialogContent>

      <DialogActions className={classes.actions}>
        <Button 
          onClick={handleClose} 
          disabled={loading}
          color="default"
        >
          Cancelar
        </Button>
        <Button
          onClick={handleStartChat}
          variant="contained"
          color="primary"
          disabled={!selectedUserId || !selectedQueueId || loading || loadingUsers}
          className={classes.loadingButton}
        >
          {loading ? (
            <>
              <CircularProgress size={20} style={{ marginRight: 8 }} />
              Iniciando...
            </>
          ) : (
            "Iniciar Conversa"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StartPrivateChatModal;
