import React, { useEffect, useState, useContext } from "react";
import QRCode from "qrcode.react";
import toastError from "../../errors/toastError";
import { makeStyles } from "@material-ui/core/styles";
import {
  Dialog,
  DialogContent,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress
} from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";

import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  pairingCode: {
    fontFamily: "monospace",
    fontSize: 28,
    letterSpacing: 6,
    fontWeight: 600,
    textAlign: "center",
    padding: theme.spacing(2),
    border: `1px dashed ${theme.palette.divider}`,
    borderRadius: 8,
    userSelect: "all"
  },
  pairingRow: {
    display: "flex",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1)
  },
  toggleLink: {
    marginTop: theme.spacing(1),
    cursor: "pointer",
    color: theme.palette.primary.main,
    textDecoration: "underline",
    display: "inline-block"
  }
}))

const QrcodeModal = ({ open, onClose, whatsAppId }) => {
  const classes = useStyles();
  const [qrCode, setQrCode] = useState("");
  const [pairingMode, setPairingMode] = useState(false);
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingLoading, setPairingLoading] = useState(false);
  const { user, socket } = useContext(AuthContext);

  useEffect(() => {
    const fetchSession = async () => {
      if (!whatsAppId) return;

      try {
        const { data } = await api.get(`/whatsapp/${whatsAppId}`);
        setQrCode(data.qrcode);
        if (data.number) setPairingPhone(String(data.number).replace(/\D/g, ""));
      } catch (err) {
        toastError(err);
      }
    };
    fetchSession();
  }, [whatsAppId]);

  useEffect(() => {
    if (!whatsAppId) return;
    const companyId = user.companyId;
    // const socket = socketConnection({ companyId, userId: user.id });

    const onWhatsappData = (data) => {
      if (data.action === "update" && data.session.id === whatsAppId) {
        setQrCode(data.session.qrcode);
      }

      if (data.action === "update" && data.session.qrcode === "") {
        onClose();
      }
    }
    socket.on(`company-${companyId}-whatsappSession`, onWhatsappData);

    return () => {
      socket.off(`company-${companyId}-whatsappSession`, onWhatsappData);
    };
  }, [whatsAppId, onClose]);

  // O backend entrega o pairing code temporário no campo qrcode com o
  // prefixo "pairing:" para não conflitar com o payload binário do QR.
  const isPairingCode = typeof qrCode === "string" && qrCode.startsWith("pairing:");
  const pairingCode = isPairingCode ? qrCode.slice("pairing:".length) : "";

  const handleRequestPairing = async () => {
    const digits = String(pairingPhone || "").replace(/\D/g, "");
    if (digits.length < 10) {
      toastError("Informe o número com código do país (ex.: 5511999999999)");
      return;
    }
    setPairingLoading(true);
    try {
      await api.post(`/whatsappsession/${whatsAppId}/pairing-code`, {
        phoneNumber: digits
      });
      setQrCode(""); // aguarda o código chegar via socket
    } catch (err) {
      toastError(err);
    } finally {
      setPairingLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" scroll="paper">
      <DialogContent>
        <Paper elevation={0}>
          <Typography color="secondary" gutterBottom>
            {i18n.t("qrCode.message")}
          </Typography>

          {isPairingCode ? (
            <div>
              <Typography variant="body2" gutterBottom>
                No celular: WhatsApp → Aparelhos Conectados → Conectar aparelho →
                "Conectar com número de telefone", e digite:
              </Typography>
              <div className={classes.pairingCode}>{pairingCode}</div>
            </div>
          ) : (
            <div className={classes.root}>
              {qrCode ? (
                <QRCode value={qrCode} size={300} style={{ backgroundColor: "white", padding: '5px' }} />
              ) : (
                <span>Aguardando pelo QR Code</span>
              )}
            </div>
          )}

          {!isPairingCode && !pairingMode && (
            <Typography
              variant="body2"
              className={classes.toggleLink}
              onClick={() => setPairingMode(true)}
            >
              Conectar com código de pareamento (em vez do QR)
            </Typography>
          )}

          {!isPairingCode && pairingMode && (
            <div>
              <Typography variant="body2" style={{ marginTop: 8 }}>
                Informe o número com código do país (somente dígitos):
              </Typography>
              <div className={classes.pairingRow}>
                <TextField
                  variant="outlined"
                  size="small"
                  fullWidth
                  placeholder="5511999999999"
                  value={pairingPhone}
                  onChange={(e) => setPairingPhone(e.target.value)}
                  disabled={pairingLoading}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleRequestPairing}
                  disabled={pairingLoading}
                >
                  {pairingLoading ? <CircularProgress size={20} /> : "Gerar código"}
                </Button>
              </div>
            </div>
          )}
        </Paper>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(QrcodeModal);
