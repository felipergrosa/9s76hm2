import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Typography,
  Link
} from "@material-ui/core";

const ConnectionLostModal = ({ open, data, onClose }) => {
  const { whatsappId, reason, qrUrl } = data || {};

  const handleReconnect = () => {
    if (qrUrl) {
      window.open(qrUrl, "_blank", "noopener,noreferrer");
    }
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Conexão perdida</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">
          <Typography variant="body2" gutterBottom>
            A sessão do WhatsApp desconectou.
          </Typography>
          {reason && (
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Motivo: {reason}
            </Typography>
          )}
          {whatsappId && (
            <Typography variant="body2" color="textSecondary" gutterBottom>
              WhatsApp ID: {whatsappId}
            </Typography>
          )}
          {qrUrl && (
            <Typography variant="body2">
              Abra a tela de reconexão e leia o QR Code:
              <br />
              <Link href={qrUrl} target="_blank" rel="noopener noreferrer">
                {qrUrl}
              </Link>
            </Typography>
          )}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="default">
          Fechar
        </Button>
        <Button onClick={handleReconnect} color="primary" variant="contained">
          Reconectar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConnectionLostModal;
