import React, { useEffect, useRef } from "react";
import { Avatar, Box, IconButton, Paper, TextField, Typography, makeStyles } from "@material-ui/core";
import CheckIcon from "@material-ui/icons/Check";
import DoneAllIcon from "@material-ui/icons/DoneAll";
import DoneOutlineIcon from "@material-ui/icons/DoneOutline";
import CloseIcon from "@material-ui/icons/Close";
import ArrowBackIosIcon from "@material-ui/icons/ArrowBackIos";
import VideocamIcon from "@material-ui/icons/Videocam";
import CallIcon from "@material-ui/icons/Call";
import InsertEmoticonIcon from "@material-ui/icons/InsertEmoticon";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import CameraAltIcon from "@material-ui/icons/CameraAlt";
import MicIcon from "@material-ui/icons/Mic";
import SendIcon from "@material-ui/icons/Send";
import SignalCellularAltIcon from "@material-ui/icons/SignalCellularAlt";
import WifiIcon from "@material-ui/icons/Wifi";
import BatteryFullIcon from "@material-ui/icons/BatteryFull";
import PictureAsPdfIcon from "@material-ui/icons/PictureAsPdf";
import InsertDriveFileIcon from "@material-ui/icons/InsertDriveFile";

// Preview estilo iPhone/WhatsApp iOS para o sandbox de treinamento.
// Renderiza a conversa como no celular real: bolhas iOS, mídia,
// documentos, botões de resposta rápida, "digitando..." e banner de
// transferência para humano quando o agente chama função de transferir.

const IOS_GREEN = "#d9fdd3";
const IOS_BG = "#efeae2";
const IOS_LINK = "#53bdeb";

const useStyles = makeStyles(() => ({
  phoneFrame: {
    width: "100%",
    maxWidth: 400,
    height: "100%",
    minHeight: 560,
    margin: "0 auto",
    background: "#000",
    borderRadius: 44,
    padding: "10px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.35), inset 0 0 0 2px #2a2a2a",
    display: "flex",
    flexDirection: "column",
  },
  screen: {
    flex: 1,
    borderRadius: 34,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    background: IOS_BG,
    minHeight: 0,
    position: "relative",
  },
  dynamicIsland: {
    position: "absolute",
    top: 8,
    left: "50%",
    transform: "translateX(-50%)",
    width: 110,
    height: 26,
    background: "#000",
    borderRadius: 20,
    zIndex: 30,
  },
  statusBar: {
    height: 44,
    background: "#075e54",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 22px 0 22px",
    fontSize: 13,
    fontWeight: 600,
    flexShrink: 0,
    position: "relative",
    zIndex: 20,
  },
  statusIcons: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    "& svg": { fontSize: 14 },
  },
  waHeader: {
    background: "#075e54",
    color: "#fff",
    padding: "4px 8px 10px 4px",
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    position: "relative",
    zIndex: 20,
  },
  waAvatar: {
    width: 34,
    height: 34,
    background: "#25d366",
    fontSize: 15,
  },
  waContactName: {
    fontWeight: 600,
    fontSize: 15,
    lineHeight: 1.2,
  },
  waStatus: {
    fontSize: 11.5,
    opacity: 0.85,
    lineHeight: 1.1,
  },
  waHeaderIcons: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    "& svg": { fontSize: 20 },
  },
  chatArea: {
    flex: 1,
    overflowY: "auto",
    padding: "10px 10px 12px",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' opacity='0.06'%3E%3Cpath d='M30 5l5 15 15 5-15 5-5 15-5-15-15-5 15-5z' fill='%23888888'/%3E%3C/svg%3E\")",
    "&::-webkit-scrollbar": { width: 5 },
    "&::-webkit-scrollbar-thumb": { background: "rgba(0,0,0,0.15)", borderRadius: 3 },
  },
  bubbleIn: {
    background: "#fff",
    padding: "7px 9px 4px",
    borderRadius: "12px 12px 12px 3px",
    maxWidth: "78%",
    marginBottom: 6,
    boxShadow: "0 1px 1px rgba(0,0,0,0.12)",
    wordBreak: "break-word",
    alignSelf: "flex-start",
  },
  bubbleOut: {
    background: IOS_GREEN,
    padding: "7px 9px 4px",
    borderRadius: "12px 12px 3px 12px",
    maxWidth: "78%",
    marginBottom: 6,
    boxShadow: "0 1px 1px rgba(0,0,0,0.12)",
    wordBreak: "break-word",
    alignSelf: "flex-end",
  },
  msgText: {
    fontSize: 14.5,
    lineHeight: 1.42,
    color: "#111",
    whiteSpace: "pre-wrap",
  },
  timeRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    marginTop: 1,
    fontSize: 10.5,
    color: "#667781",
  },
  ticks: { fontSize: 14, color: IOS_LINK },
  systemBanner: {
    alignSelf: "center",
    background: "#fdf3c7",
    color: "#5a4a00",
    fontSize: 11.5,
    padding: "5px 12px",
    borderRadius: 8,
    marginBottom: 8,
    maxWidth: "88%",
    textAlign: "center",
    boxShadow: "0 1px 1px rgba(0,0,0,0.08)",
  },
  dateChip: {
    alignSelf: "center",
    background: "#e1f3fb",
    color: "#4a4a4a",
    fontSize: 11,
    padding: "4px 10px",
    borderRadius: 7,
    marginBottom: 10,
  },
  docCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "rgba(0,0,0,0.05)",
    borderRadius: 8,
    padding: "8px 10px",
    marginBottom: 4,
    minWidth: 180,
  },
  docIcon: {
    color: "#d32f2f",
    fontSize: 30,
  },
  mediaImg: {
    width: "100%",
    maxWidth: 220,
    borderRadius: 8,
    marginBottom: 4,
    display: "block",
  },
  quickReplyWrap: {
    alignSelf: "flex-end",
    maxWidth: "78%",
    marginTop: -4,
    marginBottom: 6,
    display: "flex",
    flexDirection: "column",
    gap: 4,
    width: "fit-content",
  },
  quickReplyBtn: {
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 8,
    padding: "7px 12px",
    textAlign: "center",
    color: IOS_LINK,
    fontSize: 13.5,
    fontWeight: 500,
    cursor: "pointer",
    boxShadow: "0 1px 1px rgba(0,0,0,0.08)",
    "&:hover": { background: "#f2fbff" },
  },
  typingBubble: {
    display: "flex",
    gap: 4,
    alignItems: "center",
    padding: "10px 14px",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#90a4ae",
    animation: "$bounce 1.2s infinite ease-in-out",
  },
  dot2: { animationDelay: "0.15s" },
  dot3: { animationDelay: "0.3s" },
  "@keyframes bounce": {
    "0%, 60%, 100%": { transform: "translateY(0)", opacity: 0.5 },
    "30%": { transform: "translateY(-4px)", opacity: 1 },
  },
  inputBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 8px",
    background: "#f0f2f5",
    flexShrink: 0,
  },
  inputField: {
    flex: 1,
    background: "#fff",
    borderRadius: 20,
    "& .MuiOutlinedInput-root": {
      borderRadius: 20,
      fontSize: 14,
      "& fieldset": { border: "none" },
    },
    "& .MuiOutlinedInput-input": { padding: "8px 12px" },
  },
  sendBtn: {
    background: "#075e54",
    color: "#fff",
    width: 40,
    height: 40,
    "&:hover": { background: "#0a7568" },
  },
  ratingRow: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 6,
  },
  improved: {
    fontSize: 11,
    fontStyle: "italic",
    color: "#667781",
  },
  emptyState: {
    margin: "auto",
    textAlign: "center",
    color: "#667781",
    padding: "0 28px",
  },
  homeIndicator: {
    width: 130,
    height: 4,
    borderRadius: 2,
    background: "#000",
    opacity: 0.25,
    margin: "4px auto 6px",
  },
}));

const isImage = (url) => /\.(jpe?g|png|webp|gif)$/i.test(url || "");
const isVideo = (url) => /\.(mp4|webm|mov)$/i.test(url || "");
const isAudio = (url) => /\.(mp3|wav|ogg|opus|m4a)$/i.test(url || "");

// Nome amigável do "documento" simulado a partir do toolCall de envio
const docNameFromToolCall = (tc) => {
  const p = tc?.parameters || {};
  const base =
    p.tipo || p.termo_busca || p.nome_produto || tc?.name || "documento";
  const slug = String(base)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "documento";
  return `${slug}.pdf`;
};

const FILE_TOOL_CALLS = new Set([
  "enviar_catalogo",
  "enviar_tabela_precos",
  "enviar_informativo",
  "buscar_e_enviar_arquivo",
]);

const TRANSFER_TOOL_CALLS = new Set([
  "transferir_para_atendente",
  "transferir_para_vendedor_responsavel",
  "transferir_para_closer",
]);

const TRANSFER_LABELS = {
  transferir_para_atendente: "atendimento humano",
  transferir_para_vendedor_responsavel: "vendedor responsável",
  transferir_para_closer: "closer/vendedor",
};

// Extrai opções numeradas do fim de uma resposta para renderizar como
// botões de resposta rápida (simula interactive buttons do WhatsApp)
const extractQuickReplies = (text) => {
  if (!text) return [];
  const lines = String(text).split("\n");
  const replies = [];
  for (const line of lines) {
    const m = line.match(/^\s*(?:\d+[.)]|[-•])\s+(.{2,60}?)\s*$/);
    if (m) replies.push(m[1]);
  }
  return replies.length >= 2 && replies.length <= 6 ? replies.slice(0, 3) : [];
};

const MobileChatPreview = ({
  messages = [],
  sending = false,
  inputValue = "",
  onInputChange,
  onSend,
  onQuickReply,
  contactName = "Cliente",
  agentName = "Atendente Virtual",
  onRateMessage,
  messageRatings = {},
}) => {
  const classes = useStyles();
  const chatRef = useRef(null);
  const prevLen = useRef(messages.length);
  const userScrolledUp = useRef(false);

  // Auto-scroll ao chegar mensagem nova, salvo se o usuário rolou pra cima
  useEffect(() => {
    const hasNew = messages.length > prevLen.current;
    prevLen.current = messages.length;
    if (chatRef.current && hasNew && !userScrolledUp.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // Scroll automático também quando entra/sai o indicador "digitando..."
  useEffect(() => {
    if (chatRef.current && !userScrolledUp.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [sending]);

  const handleScroll = (e) => {
    const el = e.target;
    userScrolledUp.current = el.scrollHeight - el.scrollTop - el.clientHeight > 60;
  };

  const canRate = typeof onRateMessage === "function";
  const lastAssistantId = [...messages].reverse().find((m) => m.from === "assistant")?.id;

  const renderAttachment = (tc, key) => {
    const url = tc?.result?.url || tc?.result?.fileUrl || tc?.result?.mediaUrl;
    const name = tc?.result?.fileName || tc?.result?.title || docNameFromToolCall(tc);
    if (url && isImage(url)) {
      return <img key={key} src={url} alt={name} className={classes.mediaImg} onError={(e) => (e.target.style.display = "none")} />;
    }
    if (url && isVideo(url)) {
      return <video key={key} src={url} controls className={classes.mediaImg} />;
    }
    if (url && isAudio(url)) {
      return <audio key={key} src={url} controls style={{ width: "100%", marginBottom: 4 }} />;
    }
    return (
      <Box key={key} className={classes.docCard}>
        {/\.pdf$/i.test(name) ? (
          <PictureAsPdfIcon className={classes.docIcon} />
        ) : (
          <InsertDriveFileIcon className={classes.docIcon} style={{ color: "#54656f" }} />
        )}
        <Box>
          <Typography style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>{name}</Typography>
          <Typography style={{ fontSize: 11, color: "#667781" }}>
            {/\.pdf$/i.test(name) ? "PDF" : "Documento"} · toque para abrir
          </Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Box className={classes.phoneFrame}>
      <Box className={classes.screen}>
        <Box className={classes.dynamicIsland} />

        {/* Status bar iOS */}
        <Box className={classes.statusBar}>
          <span>9:41</span>
          <Box className={classes.statusIcons}>
            <SignalCellularAltIcon />
            <WifiIcon />
            <BatteryFullIcon />
          </Box>
        </Box>

        {/* Header do WhatsApp */}
        <Box className={classes.waHeader}>
          <IconButton size="small" style={{ color: "#fff" }}>
            <ArrowBackIosIcon style={{ fontSize: 16 }} />
          </IconButton>
          <Avatar className={classes.waAvatar}>{contactName[0]?.toUpperCase() || "C"}</Avatar>
          <Box flex={1} ml={0.5}>
            <Typography className={classes.waContactName}>{contactName}</Typography>
            <Typography className={classes.waStatus}>
              {sending ? "online" : "online"}
            </Typography>
          </Box>
          <Box className={classes.waHeaderIcons}>
            <IconButton size="small" style={{ color: "#fff" }}>
              <VideocamIcon />
            </IconButton>
            <IconButton size="small" style={{ color: "#fff" }}>
              <CallIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Área de mensagens */}
        <Box ref={chatRef} className={classes.chatArea} onScroll={handleScroll}>
          {messages.length === 0 ? (
            <Box className={classes.emptyState}>
              <Typography variant="body2" gutterBottom>🔒 Mensagens criptografadas de ponta a ponta</Typography>
              <Typography variant="caption">
                Envie uma mensagem como o cliente para iniciar a simulação — o agente responde como faria no WhatsApp real.
              </Typography>
            </Box>
          ) : (
            <>
              <Box className={classes.dateChip}>Hoje</Box>
              {messages.map((m) => {
                const isCustomer = m.from === "customer";
                const rating = messageRatings[String(m.id)];
                const toolCalls = Array.isArray(m.toolCalls) ? m.toolCalls : [];
                const fileCalls = toolCalls.filter((tc) => FILE_TOOL_CALLS.has(tc?.name));
                const transferCall = toolCalls.find((tc) => TRANSFER_TOOL_CALLS.has(tc?.name));
                const quickReplies =
                  !isCustomer && m.id === lastAssistantId ? extractQuickReplies(m.text) : [];

                return (
                  <React.Fragment key={String(m.id)}>
                    <Paper elevation={0} className={isCustomer ? classes.bubbleIn : classes.bubbleOut}>
                      {m.mediaUrl && isImage(m.mediaUrl) && (
                        <img src={m.mediaUrl} alt="" className={classes.mediaImg} onError={(e) => (e.target.style.display = "none")} />
                      )}
                      {m.mediaUrl && isVideo(m.mediaUrl) && <video src={m.mediaUrl} controls className={classes.mediaImg} />}
                      {m.mediaUrl && isAudio(m.mediaUrl) && <audio src={m.mediaUrl} controls style={{ width: "100%", marginBottom: 4 }} />}

                      {fileCalls.map((tc, i) => renderAttachment(tc, `f-${i}`))}

                      {m.text ? <Typography className={classes.msgText}>{m.text}</Typography> : null}

                      <Box className={classes.timeRow}>
                        <span>{new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        {!isCustomer && <DoneAllIcon className={classes.ticks} />}
                      </Box>
                      {m.improved && <div className={classes.improved}>(melhorada)</div>}
                    </Paper>

                    {/* Botões de resposta rápida — simula interactive buttons */}
                    {quickReplies.map((opt, i) => (
                      <Box key={`qr-${i}`} className={classes.quickReplyWrap}>
                        <Box
                          className={classes.quickReplyBtn}
                          onClick={() => onQuickReply && onQuickReply(opt)}
                          role="button"
                          tabIndex={0}
                        >
                          {opt}
                        </Box>
                      </Box>
                    ))}

                    {/* Banner de transferência para humano */}
                    {transferCall && (
                      <Box className={classes.systemBanner}>
                        🔄 Conversa transferida para o {TRANSFER_LABELS[transferCall.name] || "atendimento humano"}
                      </Box>
                    )}

                    {/* Avaliação da resposta (treinamento) */}
                    {!isCustomer && canRate && !m.improved && (
                      <Box className={classes.ratingRow}>
                        <IconButton
                          size="small"
                          onClick={() => onRateMessage({ messageId: String(m.id), rating: "correct" })}
                          disabled={Boolean(rating)}
                          title="Resposta correta"
                        >
                          <DoneOutlineIcon fontSize="small" style={{ color: rating === "correct" ? "#2e7d32" : "#8a8a8a" }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => onRateMessage({ messageId: String(m.id), rating: "wrong" })}
                          disabled={Boolean(rating)}
                          title="Resposta errada — corrigir"
                        >
                          <CloseIcon fontSize="small" style={{ color: rating === "wrong" ? "#d32f2f" : "#8a8a8a" }} />
                        </IconButton>
                      </Box>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Indicador "digitando..." do agente */}
              {sending && (
                <Paper elevation={0} className={`${classes.bubbleOut} ${classes.typingBubble}`} style={{ alignSelf: "flex-start", background: "#fff" }}>
                  <span className={classes.dot} />
                  <span className={`${classes.dot} ${classes.dot2}`} />
                  <span className={`${classes.dot} ${classes.dot3}`} />
                </Paper>
              )}
            </>
          )}
        </Box>

        {/* Barra de input estilo WhatsApp dentro do frame */}
        <Box className={classes.inputBar}>
          <IconButton size="small" style={{ color: "#54656f" }}>
            <InsertEmoticonIcon />
          </IconButton>
          <TextField
            className={classes.inputField}
            variant="outlined"
            size="small"
            placeholder="Mensagem"
            value={inputValue}
            onChange={(e) => onInputChange && onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend && onSend();
              }
            }}
          />
          {inputValue.trim() ? (
            <IconButton className={classes.sendBtn} size="small" onClick={() => onSend && onSend()} disabled={sending}>
              <SendIcon style={{ fontSize: 18 }} />
            </IconButton>
          ) : (
            <>
              <IconButton size="small" style={{ color: "#54656f" }}>
                <AttachFileIcon />
              </IconButton>
              <IconButton size="small" style={{ color: "#54656f" }}>
                <CameraAltIcon />
              </IconButton>
              <IconButton size="small" style={{ color: "#54656f" }}>
                <MicIcon />
              </IconButton>
            </>
          )}
        </Box>
        <Box className={classes.homeIndicator} />
      </Box>
    </Box>
  );
};

export default MobileChatPreview;
