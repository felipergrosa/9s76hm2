/**
 * WebChatWidget
 * 
 * Widget de chat embeddable para sites
 * Conecta via Socket.IO ao backend para comunicação em tempo real
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import {
  Box,
  Paper,
  IconButton,
  Typography,
  TextField,
  Avatar,
  Fab,
  Slide,
  Badge,
  CircularProgress,
  Tooltip,
  InputAdornment,
} from "@material-ui/core";
import {
  Chat as ChatIcon,
  Close as CloseIcon,
  Send as SendIcon,
  AttachFile as AttachIcon,
  InsertEmoticon as EmojiIcon,
  ExpandMore as MinimizeIcon,
} from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  // Container principal
  widgetContainer: {
    position: "fixed",
    bottom: 20,
    zIndex: 9999,
    fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  positionRight: {
    right: 20,
  },
  positionLeft: {
    left: 20,
  },
  
  // Botão flutuante
  fab: {
    width: 60,
    height: 60,
    boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
    transition: "transform 0.3s ease",
    "&:hover": {
      transform: "scale(1.1)",
    },
  },
  
  // Janela do chat
  chatWindow: {
    width: 380,
    height: 550,
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    borderRadius: 16,
    overflow: "hidden",
    boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
  },
  
  // Header
  header: {
    padding: theme.spacing(2),
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerInfo: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
  },
  headerAvatar: {
    width: 45,
    height: 45,
    border: "2px solid rgba(255,255,255,0.3)",
  },
  headerTitle: {
    fontWeight: 600,
    fontSize: "1.1rem",
  },
  headerSubtitle: {
    fontSize: "0.8rem",
    opacity: 0.9,
  },
  headerActions: {
    display: "flex",
    gap: theme.spacing(0.5),
  },
  headerButton: {
    color: "rgba(255,255,255,0.8)",
    "&:hover": {
      color: "#fff",
      backgroundColor: "rgba(255,255,255,0.1)",
    },
  },
  
  // Área de mensagens
  messagesArea: {
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(2),
    backgroundColor: "#f5f5f5",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
  },
  
  // Mensagens
  messageRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: theme.spacing(1),
  },
  messageRowMe: {
    justifyContent: "flex-end",
  },
  messageRowOther: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "75%",
    padding: theme.spacing(1.5, 2),
    borderRadius: 18,
    fontSize: "0.95rem",
    lineHeight: 1.4,
    wordBreak: "break-word",
  },
  messageBubbleMe: {
    backgroundColor: "#dcf8c6",
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
  },
  messageTime: {
    fontSize: "0.7rem",
    color: "#999",
    marginTop: 4,
    textAlign: "right",
  },
  messageAvatar: {
    width: 28,
    height: 28,
    marginBottom: 4,
  },
  
  // Typing indicator
  typingIndicator: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    color: "#666",
    fontSize: "0.85rem",
  },
  typingDots: {
    display: "flex",
    gap: 3,
    "& span": {
      width: 6,
      height: 6,
      borderRadius: "50%",
      backgroundColor: "#999",
      animation: "$bounce 1.4s infinite ease-in-out both",
      "&:nth-child(1)": { animationDelay: "-0.32s" },
      "&:nth-child(2)": { animationDelay: "-0.16s" },
    },
  },
  "@keyframes bounce": {
    "0%, 80%, 100%": { transform: "scale(0)" },
    "40%": { transform: "scale(1)" },
  },
  
  // Input area
  inputArea: {
    padding: theme.spacing(1.5, 2),
    backgroundColor: "#fff",
    borderTop: "1px solid #e0e0e0",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  inputField: {
    flex: 1,
    "& .MuiOutlinedInput-root": {
      borderRadius: 24,
      backgroundColor: "#f5f5f5",
      "& fieldset": {
        border: "none",
      },
    },
    "& .MuiOutlinedInput-input": {
      padding: "12px 16px",
    },
  },
  sendButton: {
    width: 44,
    height: 44,
  },
  
  // Pre-chat form
  preChatForm: {
    padding: theme.spacing(3),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  preChatTitle: {
    textAlign: "center",
    marginBottom: theme.spacing(1),
  },
  
  // Badge de mensagens não lidas
  unreadBadge: {
    "& .MuiBadge-badge": {
      backgroundColor: "#ff4444",
      color: "#fff",
      fontWeight: 600,
    },
  },
}));

const WebChatWidget = ({
  widgetId,
  backendUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:8080",
  primaryColor = "#25D366",
  position = "right",
  companyName = "Atendimento",
  companyLogo,
  greeting = "Olá! Como posso ajudar?",
  requirePreChat = true,
}) => {
  const classes = useStyles();
  
  // Estados
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [recipientId, setRecipientId] = useState(null);
  const [showPreChat, setShowPreChat] = useState(requirePreChat);
  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  
  // Refs
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Scroll para última mensagem
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);
  
  // Conectar ao Socket.IO
  useEffect(() => {
    if (!isOpen) return;
    
    const socket = io(`${backendUrl}/webchat/${widgetId}`, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    socketRef.current = socket;
    
    socket.on("connect", () => {
      console.log("[WebChat] Conectado");
      setIsConnected(true);
    });
    
    socket.on("disconnect", () => {
      console.log("[WebChat] Desconectado");
      setIsConnected(false);
    });
    
    socket.on("session:start", (data) => {
      console.log("[WebChat] Sessão iniciada:", data);
      setSessionId(data.sessionId);
      setRecipientId(data.recipientId);
      
      // Adicionar mensagem de boas-vindas
      if (data.greeting || greeting) {
        setMessages((prev) => [
          ...prev,
          {
            id: `greeting_${Date.now()}`,
            text: data.greeting || greeting,
            fromMe: false,
            timestamp: Date.now(),
          },
        ]);
      }
    });
    
    socket.on("message:new", (data) => {
      console.log("[WebChat] Nova mensagem:", data);
      setMessages((prev) => [...prev, data]);
      
      if (!isOpen) {
        setUnreadCount((prev) => prev + 1);
      }
    });
    
    socket.on("message:received", (data) => {
      console.log("[WebChat] Mensagem recebida pelo servidor:", data.messageId);
    });
    
    socket.on("agent:typing", (data) => {
      setIsTyping(data.isTyping);
    });
    
    return () => {
      socket.disconnect();
    };
  }, [isOpen, backendUrl, widgetId, greeting]);
  
  // Identificar visitante
  const handleIdentify = () => {
    if (!visitorName.trim()) return;
    
    socketRef.current?.emit("visitor:identify", {
      name: visitorName,
      email: visitorEmail,
    });
    
    setShowPreChat(false);
    inputRef.current?.focus();
  };
  
  // Enviar mensagem
  const handleSend = () => {
    if (!inputValue.trim() || !socketRef.current) return;
    
    const message = {
      id: `local_${Date.now()}`,
      text: inputValue.trim(),
      fromMe: true,
      timestamp: Date.now(),
    };
    
    // Adicionar localmente
    setMessages((prev) => [...prev, message]);
    
    // Enviar para o servidor
    socketRef.current.emit("message:send", {
      text: inputValue.trim(),
    });
    
    setInputValue("");
    inputRef.current?.focus();
  };
  
  // Abrir/fechar chat
  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setUnreadCount(0);
    }
  };
  
  // Formatar hora
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  
  return (
    <Box
      className={`${classes.widgetContainer} ${
        position === "right" ? classes.positionRight : classes.positionLeft
      }`}
    >
      {/* Janela do Chat */}
      <Slide direction="up" in={isOpen} mountOnEnter unmountOnExit>
        <Paper className={classes.chatWindow} elevation={8}>
          {/* Header */}
          <Box className={classes.header} style={{ backgroundColor: primaryColor }}>
            <Box className={classes.headerInfo}>
              <Avatar
                className={classes.headerAvatar}
                src={companyLogo}
                alt={companyName}
              >
                {companyName.charAt(0)}
              </Avatar>
              <Box>
                <Typography className={classes.headerTitle}>
                  {companyName}
                </Typography>
                <Typography className={classes.headerSubtitle}>
                  {isConnected ? "Online" : "Conectando..."}
                </Typography>
              </Box>
            </Box>
            <Box className={classes.headerActions}>
              <IconButton
                size="small"
                className={classes.headerButton}
                onClick={toggleChat}
              >
                <MinimizeIcon />
              </IconButton>
              <IconButton
                size="small"
                className={classes.headerButton}
                onClick={toggleChat}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
          
          {/* Pre-chat form */}
          {showPreChat ? (
            <Box className={classes.preChatForm}>
              <Typography variant="h6" className={classes.preChatTitle}>
                Antes de começar...
              </Typography>
              <Typography variant="body2" color="textSecondary" align="center">
                Por favor, informe seus dados para iniciar o atendimento.
              </Typography>
              <TextField
                label="Seu nome"
                variant="outlined"
                fullWidth
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                required
              />
              <TextField
                label="Seu e-mail (opcional)"
                variant="outlined"
                fullWidth
                type="email"
                value={visitorEmail}
                onChange={(e) => setVisitorEmail(e.target.value)}
              />
              <Box mt={2}>
                <Fab
                  variant="extended"
                  color="primary"
                  fullWidth
                  onClick={handleIdentify}
                  disabled={!visitorName.trim()}
                  style={{ backgroundColor: primaryColor, width: "100%" }}
                >
                  Iniciar Conversa
                </Fab>
              </Box>
            </Box>
          ) : (
            <>
              {/* Área de mensagens */}
              <Box className={classes.messagesArea}>
                {messages.map((msg) => (
                  <Box
                    key={msg.id}
                    className={`${classes.messageRow} ${
                      msg.fromMe ? classes.messageRowMe : classes.messageRowOther
                    }`}
                  >
                    {!msg.fromMe && (
                      <Avatar
                        className={classes.messageAvatar}
                        src={companyLogo}
                        alt="Agent"
                      >
                        A
                      </Avatar>
                    )}
                    <Box>
                      <Box
                        className={`${classes.messageBubble} ${
                          msg.fromMe
                            ? classes.messageBubbleMe
                            : classes.messageBubbleOther
                        }`}
                      >
                        {msg.text}
                        
                        {/* Mídia */}
                        {msg.mediaUrl && msg.mediaType === "image" && (
                          <img
                            src={msg.mediaUrl}
                            alt="Imagem"
                            style={{ maxWidth: "100%", borderRadius: 8, marginTop: 8 }}
                          />
                        )}
                        
                        {msg.mediaUrl && msg.mediaType === "document" && (
                          <a
                            href={msg.mediaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "block", marginTop: 8, color: primaryColor }}
                          >
                            📄 {msg.fileName || "Documento"}
                          </a>
                        )}
                      </Box>
                      <Typography className={classes.messageTime}>
                        {formatTime(msg.timestamp)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
                
                {/* Typing indicator */}
                {isTyping && (
                  <Box className={classes.typingIndicator}>
                    <Box className={classes.typingDots}>
                      <span />
                      <span />
                      <span />
                    </Box>
                    <span>Digitando...</span>
                  </Box>
                )}
                
                <div ref={messagesEndRef} />
              </Box>
              
              {/* Input area */}
              <Box className={classes.inputArea}>
                <TextField
                  ref={inputRef}
                  className={classes.inputField}
                  placeholder="Digite sua mensagem..."
                  variant="outlined"
                  size="small"
                  fullWidth
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Enviar">
                          <IconButton
                            size="small"
                            onClick={handleSend}
                            disabled={!inputValue.trim()}
                            style={{ color: inputValue.trim() ? primaryColor : undefined }}
                          >
                            <SendIcon />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            </>
          )}
        </Paper>
      </Slide>
      
      {/* Botão flutuante */}
      {!isOpen && (
        <Badge
          badgeContent={unreadCount}
          className={classes.unreadBadge}
          overlap="circular"
        >
          <Fab
            className={classes.fab}
            style={{ backgroundColor: primaryColor }}
            onClick={toggleChat}
          >
            <ChatIcon style={{ color: "#fff", fontSize: 28 }} />
          </Fab>
        </Badge>
      )}
    </Box>
  );
};

export default WebChatWidget;
