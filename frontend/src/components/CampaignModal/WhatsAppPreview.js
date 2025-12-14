import React from "react";
import { Paper, Typography, Box, Avatar, IconButton } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import CheckIcon from "@material-ui/icons/Check";
import DoneOutlineIcon from "@material-ui/icons/DoneOutline";
import CloseIcon from "@material-ui/icons/Close";

const useStyles = makeStyles((theme) => ({
  phoneFrame: {
    width: 320,
    height: 640,
    borderRadius: 40,
    border: "12px solid #1f1f1f",
    background: "#e5ddd5", // Fundo do WhatsApp 
    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'260\' height=\'260\'%3E%3Cpath d=\'M129.92 0c71.686 0 129.92 58.234 129.92 129.92s-58.234 129.92-129.92 129.92S0 201.606 0 129.92 58.234 0 129.92 0z\' fill=\'%23d9d9d9\' fill-opacity=\'.05\'/%3E%3C/svg%3E")',
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.1)",
  },
  notch: {
    position: "absolute",
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: 140,
    height: 28,
    background: "#1f1f1f",
    borderRadius: "0 0 20px 20px",
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 4,
  },
  camera: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#333",
  },
  speaker: {
    width: 40,
    height: 4,
    borderRadius: 2,
    background: "#333",
  },
  header: {
    background: "#075e54", // Verde cor WhatsApp
    color: "#fff",
    padding: "32px 16px 12px", // Espaço para notch
    display: "flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
  },
  chatArea: {
    flex: 1,
    padding: 16,
    overflowY: "auto",
    height: 520,
    "&::-webkit-scrollbar": {
      width: 6,
    },
    "&::-webkit-scrollbar-thumb": {
      background: "rgba(0,0,0,0.2)",
      borderRadius: 3,
    },
  },
  messageBubble: {
    background: "#dcf8c6", // Verde mensagem enviada
    padding: "8px 12px 6px",
    borderRadius: "8px 8px 2px 8px",
    maxWidth: "80%",
    marginLeft: "auto",
    marginBottom: 8,
    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
    position: "relative",
    wordBreak: "break-word",
  },
  messageBubbleReceived: {
    background: "#ffffff", // Mensagem recebida
    padding: "8px 12px 6px",
    borderRadius: "8px 8px 8px 2px",
    maxWidth: "80%",
    marginRight: "auto",
    marginBottom: 8,
    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
    position: "relative",
    wordBreak: "break-word",
  },
  messageBubbleEmpty: {
    background: "#f0f0f0",
    padding: "8px 12px 6px",
    borderRadius: "8px",
    maxWidth: "80%",
    marginLeft: "auto",
    marginBottom: 8,
    opacity: 0.5,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 1.5,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
    color: "#303030",
    marginBottom: 4,
  },
  mediaPreview: {
    width: "100%",
    maxWidth: 240,
    borderRadius: 8,
    marginBottom: 6,
    display: "block",
  },
  timestamp: {
    fontSize: 11,
    color: "#667781",
    textAlign: "right",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    marginTop: 2,
  },
  checkIcon: {
    fontSize: 16,
    color: "#4fc3f7",
  },
  emptyState: {
    textAlign: "center",
    color: "#667781",
    marginTop: 120,
    padding: "0 24px",
  },
  avatar: {
    width: 36,
    height: 36,
    background: "#25d366",
    fontSize: 16,
  },
  contactName: {
    fontWeight: 600,
    fontSize: 16,
  },
  onlineStatus: {
    fontSize: 12,
    opacity: 0.9,
  },
  ratingRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 2,
  },
  ratingIconCorrect: {
    color: "#2e7d32",
  },
  ratingIconWrong: {
    color: "#d32f2f",
  },
  improvedLabel: {
    fontSize: 12,
    fontStyle: "italic",
    color: "#667781",
    marginTop: 2,
  },
}));

const WhatsAppPreview = ({ 
  messages = [], 
  contactName = "Cliente Exemplo",
  mediaUrls = {},
  companyName = "Empresa",
  onRateMessage,
  messageRatings = {}
}) => {
  const classes = useStyles();

  const normalizeMessages = (msgs) => {
    if (!Array.isArray(msgs)) return [];
    return msgs
      .map((m, idx) => {
        if (m === null || m === undefined) return null;
        if (typeof m === "string") {
          return {
            id: idx,
            text: m,
            from: "assistant",
            mediaUrl: mediaUrls[`mediaUrl${idx + 1}`]
          };
        }
        if (typeof m === "object") {
          return {
            id: m.id ?? idx,
            text: m.text ?? m.message ?? "",
            from: m.from ?? m.side ?? "assistant",
            mediaUrl: m.mediaUrl ?? mediaUrls[`mediaUrl${idx + 1}`]
          };
        }
        return null;
      })
      .filter(Boolean);
  };

  // Processar variáveis nas mensagens
  const processMessage = (msg) => {
    if (!msg) return "";
    return msg
      .replace(/\{nome\}/gi, contactName)
      .replace(/\{numero\}/gi, "(11) 99999-9999")
      .replace(/\{email\}/gi, "cliente@exemplo.com")
      .replace(/\{empresa\}/gi, companyName);
  };

  // Verificar tipo de mídia
  const getMediaType = (url) => {
    if (!url) return null;
    const lower = url.toLowerCase();
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(lower)) return "image";
    if (/\.(mp4|webm|mov)$/i.test(lower)) return "video";
    if (/\.(mp3|wav|ogg|opus)$/i.test(lower)) return "audio";
    if (/\.pdf$/i.test(lower)) return "pdf";
    return "file";
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const normalizedMessages = normalizeMessages(messages);
  const hasMessages = normalizedMessages.some(m => (m.text && String(m.text).trim()) || m.mediaUrl);

  const canRate = typeof onRateMessage === "function";

  return (
    <Box className={classes.phoneFrame}>
      {/* Notch do iPhone */}
      <div className={classes.notch}>
        <div className={classes.camera} />
        <div className={classes.speaker} />
      </div>
      
      {/* Header do WhatsApp */}
      <Box className={classes.header}>
        <Avatar className={classes.avatar}>
          {contactName[0]?.toUpperCase() || "C"}
        </Avatar>
        <Box flex={1}>
          <Typography className={classes.contactName}>
            {contactName}
          </Typography>
          <Typography className={classes.onlineStatus}>
            online
          </Typography>
        </Box>
      </Box>
      
      {/* Área de mensagens */}
      <Box className={classes.chatArea}>
        {!hasMessages ? (
          <div className={classes.emptyState}>
            <Typography variant="body2" gutterBottom>
              📱 Prévia da Mensagem
            </Typography>
            <Typography variant="caption">
              Digite uma mensagem nas abas acima para ver como ficará no WhatsApp do cliente
            </Typography>
          </div>
        ) : (
          normalizedMessages.map((m) => {
            const isCustomer = String(m.from) === "customer";
            const ratingKey = String(m.id);
            const rating = messageRatings ? messageRatings[ratingKey] : undefined;
            const improved = Boolean(m.improved);

            const bubbleClass = isCustomer ? classes.messageBubbleReceived : classes.messageBubble;
            const text = processMessage(String(m.text || ""));

            const mediaUrl = m.mediaUrl;
            const mediaType = getMediaType(mediaUrl);
            const processedMsg = processMessage(m.text);

            if (!processedMsg?.trim() && !mediaUrl) return null;

            const isReceived = String(m.from) === "customer" || String(m.from) === "received";

            return (
              <Box key={String(m.id)} display="flex" flexDirection="column" alignItems={isCustomer ? "flex-start" : "flex-end"}>
                <Paper className={bubbleClass} elevation={0}>
                  {mediaUrl && mediaType === "image" && (
                    <img 
                      src={mediaUrl} 
                      alt="Preview" 
                      className={classes.mediaPreview}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  )}
                  
                  {mediaUrl && mediaType === "video" && (
                    <video 
                      src={mediaUrl} 
                      className={classes.mediaPreview}
                      controls
                      style={{ background: "#000" }}
                    />
                  )}
                  
                  {mediaUrl && mediaType === "audio" && (
                    <audio 
                      src={mediaUrl} 
                      controls
                      style={{ width: "100%", marginBottom: 6 }}
                    />
                  )}
                  
                  {mediaUrl && (mediaType === "pdf" || mediaType === "file") && (
                    <Box
                      style={{
                        background: "#fff",
                        padding: 8,
                        borderRadius: 4,
                        marginBottom: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Typography variant="caption">
                        📄 {mediaUrl.split('/').pop()?.substring(0, 20) || "arquivo"}...
                      </Typography>
                    </Box>
                  )}
                  
                  {/* Texto da mensagem */}
                  {processedMsg && (
                    <Typography className={classes.messageText}>
                      {processedMsg}
                    </Typography>
                  )}
                  
                  {/* Timestamp + checks */}
                  <Box className={classes.timestamp}>
                    <span>{timeStr}</span>
                    {!isReceived && (
                      <CheckIcon className={classes.checkIcon} />
                    )}
                  </Box>

                  {!isCustomer && improved && (
                    <div className={classes.improvedLabel}>(melhorada)</div>
                  )}
                </Paper>

                {!isCustomer && canRate && (
                  <Box className={classes.ratingRow}>
                    <IconButton
                      size="small"
                      onClick={() => onRateMessage({ messageId: ratingKey, rating: "correct" })}
                      disabled={Boolean(rating)}
                    >
                      <DoneOutlineIcon fontSize="small" className={classes.ratingIconCorrect} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => onRateMessage({ messageId: ratingKey, rating: "wrong" })}
                      disabled={Boolean(rating)}
                    >
                      <CloseIcon fontSize="small" className={classes.ratingIconWrong} />
                    </IconButton>
                  </Box>
                )}
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
};

export default WhatsAppPreview;
