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
  Avatar
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import QueueSelectSingle from "../QueueSelectSingle";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

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

const StartPrivateChatModal = ({ open, onClose, participant, companyId, whatsappId, user }) => {
  const classes = useStyles();
  const [selectedQueueId, setSelectedQueueId] = useState("");
  const [loading, setLoading] = useState(false);

  // Resetar estado quando o modal abrir/fechar
  useEffect(() => {
    if (!open) {
      setSelectedQueueId("");
      setLoading(false);
    }
  }, [open]);

  const handleStartChat = async () => {
    if (!selectedQueueId) {
      alert("Por favor, selecione uma fila para iniciar a conversa.");
      return;
    }

    if (!participant?.contactId) {
      alert("Não foi possível identificar o contato deste participante.");
      return;
    }

    setLoading(true);
    try {
      // Criar novo ticket privado com o participante
      const { data: ticket } = await api.post("/tickets", {
        contactId: participant.contactId,
        queueId: selectedQueueId,
        whatsappId,
        userId: user.id,
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
            src={participant.profilePicUrl}
          >
            {participant.name?.charAt(0)?.toUpperCase() || "P"}
          </Avatar>
          
          <Box className={classes.participantDetails}>
            <Typography className={classes.participantName}>
              {participant.name || "Participante"}
            </Typography>
            <Typography className={classes.participantNumber}>
              {participant.number || participant.id}
            </Typography>
            {participant.isAdmin && (
              <Typography variant="caption" color="primary">
                Administrador do Grupo
              </Typography>
            )}
          </Box>
        </Box>

        {/* Seleção de fila */}
        <Box className={classes.queueSection}>
          <Typography className={classes.queueLabel}>
            Para qual fila deseja direcionar esta conversa?
          </Typography>
          <QueueSelectSingle
            selectedQueueId={selectedQueueId}
            onChange={setSelectedQueueId}
            label="Fila de Atendimento"
          />
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
          disabled={!selectedQueueId || loading}
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
