import React, { useEffect, useRef, useState, useContext } from "react";
import QRCode from "qrcode.react";
import toastError from "../../errors/toastError";
import { makeStyles } from "@material-ui/core/styles";
import {
  Dialog,
  DialogContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  IconButton
} from "@material-ui/core";
import { WhatsApp as WhatsAppIcon } from "@material-ui/icons";
import { X as CloseIcon, RefreshCw as RefreshIcon } from "lucide-react";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";

import { AuthContext } from "../../context/Auth/AuthContext";

// QR do Baileys rotaciona em ciclos curtos (~20-60s). O countdown é
// reiniciado a cada novo qrcode recebido via socket.
const QR_REFRESH_SECONDS = 45;

const useStyles = makeStyles((theme) => ({
  paper: {
    overflow: "hidden",
    borderRadius: 16
  },
  header: {
    background: "linear-gradient(135deg, #075E54 0%, #128C7E 55%, #25D366 100%)",
    color: "#fff",
    padding: theme.spacing(3, 3, 3.5, 3),
    textAlign: "center",
    position: "relative"
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    backgroundColor: "rgba(255,255,255,0.18)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 12px",
    "& svg": { fontSize: 30, color: "#fff" }
  },
  closeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    color: "rgba(255,255,255,0.85)",
    padding: 6
  },
  headerTitle: {
    fontWeight: 700,
    fontSize: "1.25rem",
    lineHeight: 1.3
  },
  headerSubtitle: {
    fontSize: "0.85rem",
    opacity: 0.9,
    marginTop: 4
  },
  body: {
    padding: theme.spacing(3),
    backgroundColor:
      theme.palette.type === "dark" ? theme.palette.background.default : "#f6f7f9"
  },
  qrCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: theme.spacing(2.5),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 12px rgba(16,24,40,0.10)",
    minHeight: 240
  },
  steps: {
    marginTop: theme.spacing(3),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.75)
  },
  step: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1.5)
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    backgroundColor: "#25D366",
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1
  },
  stepText: {
    fontSize: "0.875rem",
    color: theme.palette.text.secondary,
    lineHeight: 1.45,
    "& b": { color: theme.palette.text.primary, fontWeight: 600 }
  },
  refreshInfo: {
    marginTop: theme.spacing(3),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    color: theme.palette.text.secondary,
    fontSize: "0.8rem"
  },
  pairingCode: {
    fontFamily: "monospace",
    fontSize: 30,
    letterSpacing: 6,
    fontWeight: 600,
    textAlign: "center",
    padding: theme.spacing(2.5),
    backgroundColor: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 12px rgba(16,24,40,0.10)",
    userSelect: "all"
  },
  pairingRow: {
    display: "flex",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5)
  },
  toggleLink: {
    marginTop: theme.spacing(2),
    cursor: "pointer",
    color: theme.palette.primary.main,
    textDecoration: "underline",
    display: "inline-block",
    fontSize: "0.85rem"
  }
}));

const Step = ({ n, children }) => {
  const classes = useStyles();
  return (
    <div className={classes.step}>
      <div className={classes.stepNumber}>{n}</div>
      <div className={classes.stepText}>{children}</div>
    </div>
  );
};

const QrcodeModal = ({ open, onClose, whatsAppId }) => {
  const classes = useStyles();
  const [qrCode, setQrCode] = useState("");
  const [pairingMode, setPairingMode] = useState(false);
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingLoading, setPairingLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(QR_REFRESH_SECONDS);
  const countdownRef = useRef(null);
  const { user, socket } = useContext(AuthContext);

  // Reinicia o countdown toda vez que um novo QR chega
  const resetCountdown = () => setSecondsLeft(QR_REFRESH_SECONDS);

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, []);

  useEffect(() => {
    const fetchSession = async () => {
      if (!whatsAppId) return;

      try {
        const { data } = await api.get(`/whatsapp/${whatsAppId}`);
        setQrCode(data.qrcode);
        resetCountdown();
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

    const onWhatsappData = (data) => {
      if (data.action === "update" && data.session.id === whatsAppId) {
        setQrCode(data.session.qrcode);
        resetCountdown();
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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ className: classes.paper }}
    >
      <div className={classes.header}>
        <IconButton className={classes.closeButton} onClick={onClose} size="small">
          <CloseIcon size={18} />
        </IconButton>
        <div className={classes.headerIcon}>
          <WhatsAppIcon />
        </div>
        <Typography className={classes.headerTitle}>
          Conectar ao WhatsApp
        </Typography>
        <Typography className={classes.headerSubtitle}>
          {isPairingCode
            ? "Digite o código no seu celular para iniciar a sessão"
            : pairingMode
              ? "Informe o número para gerar o código de pareamento"
              : "Escaneie o QR Code com seu celular para iniciar a sessão"}
        </Typography>
      </div>

      <DialogContent className={classes.body}>
        {isPairingCode ? (
          <>
            <div className={classes.pairingCode}>{pairingCode}</div>
            <div className={classes.steps}>
              <Step n={1}>
                No celular, abra o <b>WhatsApp</b>
              </Step>
              <Step n={2}>
                Toque em <b>Mais opções</b> ou <b>Configurações</b> e selecione{" "}
                <b>Aparelhos conectados</b>
              </Step>
              <Step n={3}>
                Toque em <b>Conectar um aparelho</b> →{" "}
                <b>Conectar com número de telefone</b> e digite o código acima
              </Step>
            </div>
          </>
        ) : (
          <>
            <div className={classes.qrCard}>
              {qrCode ? (
                <QRCode value={qrCode} size={220} />
              ) : (
                <CircularProgress size={32} style={{ color: "#25D366" }} />
              )}
            </div>

            {!pairingMode ? (
              <>
                <div className={classes.steps}>
                  <Step n={1}>
                    Abra o <b>WhatsApp</b> no seu celular
                  </Step>
                  <Step n={2}>
                    Toque em <b>Mais opções</b> ou <b>Configurações</b> e
                    selecione <b>Aparelhos conectados</b>
                  </Step>
                  <Step n={3}>
                    Toque em <b>Conectar um aparelho</b> e aponte a câmera para
                    este QR Code
                  </Step>
                </div>

                <div className={classes.refreshInfo}>
                  <RefreshIcon size={13} />
                  {qrCode
                    ? `QR Code atualiza em ${secondsLeft}s`
                    : "Aguardando QR Code…"}
                </div>

                <Typography
                  variant="body2"
                  className={classes.toggleLink}
                  onClick={() => setPairingMode(true)}
                >
                  Conectar com código de pareamento (em vez do QR)
                </Typography>
              </>
            ) : (
              <>
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
                <Typography
                  variant="body2"
                  className={classes.toggleLink}
                  onClick={() => setPairingMode(false)}
                >
                  Voltar para o QR Code
                </Typography>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(QrcodeModal);
