import React, { useContext, useState, useEffect, useReducer, useRef, useCallback } from "react";
import { isSameDay, parseISO, format } from "date-fns";
import clsx from "clsx";
import { isNil } from "lodash";
import { blue, green } from "@material-ui/core/colors";
import {
  Button,
  CircularProgress,
  Divider,
  IconButton,
  makeStyles,
  Dialog,
  DialogContent,
} from "@material-ui/core";

import {
  AccessTime,
  Done,
  DoneAll,
  ExpandMore,
  GetApp,
  Facebook,
  Instagram,
  Reply,
  RecordVoiceOver,
} from "@material-ui/icons";

import MarkdownWrapper from "../MarkdownWrapper";
import VcardPreview from "../VcardPreview";
import LocationPreview from "../LocationPreview";
import ModalImageCors from "../ModalImageCors";
import MediaModal from "../MediaModal";
import MessageOptionsMenu from "../MessageOptionsMenu";
import whatsBackground from "../../assets/wa-background.png";
import whatsBackgroundDark from "../../assets/wa-background-dark.png";
import YouTubePreview from "../ModalYoutubeCors";

import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { ForwardMessageContext } from "../../context/ForwarMessage/ForwardMessageContext";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import SelectMessageCheckbox from "./SelectMessageCheckbox";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import { AuthContext } from "../../context/Auth/AuthContext";
import { QueueSelectedContext } from "../../context/QueuesSelected/QueuesSelectedContext";
import AudioModal from "../AudioModal";
import AdMetaPreview from "../AdMetaPreview";
import ButtonsPreview from "../ButtonsPreview";
// import PdfModal from "../PdfModal";
// import LinkPreview from "../LinkPreview";

import { useParams, useHistory } from 'react-router-dom';
import { getBackendUrl } from "../../config";

const useStyles = makeStyles((theme) => ({
  messagesListWrapper: {
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    width: "100%",
    // Evita overflow horizontal no mobile
    overflowX: 'hidden',
    // Remover restrição que causava barra horizontal
    // minWidth: 300,
    minHeight: 200,
  },
  loadingCenter: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 2,
  },
  fadeHidden: {
    opacity: 0,
    transition: 'opacity 180ms ease',
    pointerEvents: 'none',
  },
  fadeShown: {
    opacity: 1,
    transition: 'opacity 180ms ease',
  },

  currentTick: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    width: "95%",
    backgroundColor: "transparent",
    margin: "10px",
    borderRadius: "10px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    '&:before': {
      content: '""',
      flex: 1,
      display: 'block',
      height: 'calc(var(--b) + var(--s)/(2*tan(var(--a)/2)))',
      margin: '0 10px',
      background: theme.mode === 'light' ? '#A9A9A9' : '#444',
      '--a': '90deg',
      '--s': '10px',
      '--b': '3px',
      '--_g': 'var(--s) repeat-x conic-gradient(from calc(var(--a)/-2) at bottom, #0000, #000 1deg calc(var(--a) - 1deg), #0000 var(--a))',
      mask: '50% calc(-1*var(--b))/var(--_g) exclude, 50%/var(--_g)',
      WebkitMask: '50% calc(-1*var(--b))/var(--_g) exclude, 50%/var(--_g)',
    },
    '&:after': {
      content: '""',
      flex: 1,
      display: 'block',
      height: 'calc(var(--b) + var(--s)/(2*tan(var(--a)/2)))',
      margin: '0 10px',
      background: theme.mode === 'light' ? '#A9A9A9' : '#444',
      '--a': '90deg',
      '--s': '10px',
      '--b': '3px',
      '--_g': 'var(--s) repeat-x conic-gradient(from calc(var(--a)/-2) at bottom, #0000, #000 1deg calc(var(--a) - 1deg), #0000 var(--a))',
      mask: '50% calc(-1*var(--b))/var(--_g) exclude, 50%/var(--_g)',
      WebkitMask: '50% calc(-1*var(--b))/var(--_g) exclude, 50%/var(--_g)',
    },
  },

  currentTicktText: {
    display: "inline-block",
    fontWeight: 'bold',
    padding: "0 8px",
    alignSelf: "center",
    marginLeft: "0px",
    backgroundColor: "transparent",
  },

  currentTickContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    lineHeight: 1.1,
  },

  currentTickSubText: {
    fontSize: 11,
    color: "#000",
    marginTop: 2,
  },

  // Wrapper para linha de mensagem com checkbox de seleção
  messageRowWrapper: {
    display: "flex",
    alignItems: "flex-start",
    width: "100%",
    padding: "0 8px",
    transition: "background-color 0.15s ease",
  },
  messageRowWrapperSelected: {
    backgroundColor: "rgba(0, 168, 132, 0.12)",
  },
  messageRowCheckbox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 40,
    paddingTop: 8,
  },
  messageRowContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  messagesList: {
    backgroundImage: theme.mode === 'light' ? `url(${whatsBackground})` : `url(${whatsBackgroundDark})`,
    backgroundColor: theme.mode === 'light' ? "transparent" : "#0b0b0d",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    padding: "20px 20px 20px 20px",
    overflowY: "auto",
    overflowX: "hidden", // CRÍTICO: Evita overflow horizontal
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    ...theme.scrollbarStyles,
    // Força contenção dentro do viewport
    maxWidth: "100%",
    boxSizing: "border-box",
    [theme.breakpoints.down('sm')]: {
      // Mais espaço inferior para não ficar encoberto pelo composer
      padding: '8px 12px 20px 12px',
      overflowX: 'hidden',
      overscrollBehavior: 'contain',
    }
  },
  dragElement: {
    background: 'rgba(255, 255, 255, 0.8)',
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: 999999,
    textAlign: "center",
    fontSize: "3em",
    border: "5px dashed #333",
    color: '#333',
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },
  circleLoading: {
    color: blue[500],
    position: "absolute",
    opacity: "70%",
    top: 0,
    left: "50%",
    marginTop: 12,
  },

  messageLeft: {
    marginRight: 20,
    marginTop: 2,
    minWidth: 150,
    maxWidth: 350, // Mesmo tamanho que messageRight
    height: "auto",
    display: "block",
    position: "relative",
    wordWrap: "break-word",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    backgroundColor: theme.mode === 'light' ? "#ffffff" : "#202c33",
    color: theme.mode === 'light' ? "#303030" : "#ffffff",
    alignSelf: "flex-start",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: theme.mode === 'light' ? "0 1px 1px #b3b3b3" : "0 1px 1px #000000",
    [theme.breakpoints.down('sm')]: {
      marginRight: 10,
      maxWidth: 280,
    },
  },

  // Balão maior apenas para áudios recebidos
  messageLeftAudio: {
    // largura responsiva: cresce até ~760px, respeitando viewport e sidebars
    width: "min(760px, calc(100vw - 220px))",
    maxWidth: 400,
    minWidth: 120,
  },

  // Balão maior para áudios enviados
  messageRightAudio: {
    // espelha o comportamento do lado esquerdo
    width: "min(760px, calc(100vw - 220px)) !important",
    maxWidth: "400px !important",
    minWidth: "120px !important",
  },

  quotedContainerLeft: {
    margin: "-3px -80px 6px -6px",
    overflow: "hidden",
    backgroundColor: theme.mode === 'light' ? "#f0f0f0" : "#1d282f",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  quotedMsg: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  },

  quotedSideColorLeft: {
    flex: "none",
    width: "4px",
    backgroundColor: "#388aff",
  },

  messageRight: {
    marginLeft: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 350, // Mesmo tamanho que messageLeft
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },
    whiteSpace: "pre-wrap",
    backgroundColor: theme.mode === 'light' ? "#dcf8c6" : "#005c4b",
    color: theme.mode === 'light' ? "#303030" : "#ffffff",
    alignSelf: "flex-end",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 0,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: theme.mode === 'light' ? "0 1px 1px #b3b3b3" : "0 1px 1px #000000",
    [theme.breakpoints.down('sm')]: {
      marginLeft: 10,
      maxWidth: 280,
    },
  },

  messageRightPrivate: {
    marginLeft: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },
    whiteSpace: "pre-wrap",
    backgroundColor: "#F0E68C",
    color: "#303030",
    alignSelf: "flex-end",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 0,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: theme.mode === 'light' ? "0 1px 1px #b3b3b3" : "0 1px 1px #000000"
  },

  quotedContainerRight: {
    margin: "-3px -80px 6px -6px",
    overflowY: "hidden",
    backgroundColor: theme.mode === 'light' ? "#cfe9ba" : "#025144",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  quotedMsgRight: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    whiteSpace: "pre-wrap",
  },

  quotedSideColorRight: {
    flex: "none",
    width: "4px",
    backgroundColor: "#35cd96",
  },

  messageActionsButton: {
    display: "none",
    position: "relative",
    color: "#999",
    zIndex: 1,
    backgroundColor: "inherit",
    opacity: "90%",
    "&:hover, &.Mui-focusVisible": { backgroundColor: "inherit" },
  },

  messageContactName: {
    display: "flex",
    color: "#6bcbef",
    fontWeight: 500,
  },

  textContentItem: {
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },

  // Versão compacta do balão quando não há texto exibido (ex.: PDF sem legenda)
  textContentItemCompact: {
    padding: "3px 10px 6px 6px",
  },

  textContentItemDeleted: {
    fontStyle: "italic",
    color: "rgba(0, 0, 0, 0.36)",
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },

  messageMedia: {
    objectFit: "cover",
    width: "256px !important",
    height: "256px !important",
    marginBottom: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    display: "block",
    [theme.breakpoints.down('sm')]: {
      width: "220px !important",
      height: "220px !important",
    },
  },

  fileFrame: {
    width: 256,
    height: 256,
    maxWidth: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: theme.mode === 'light' ? '#f0f0f0' : '#2a2f32',
    overflow: 'hidden',
    textAlign: 'center',
    padding: 12,
  },
  fileName: {
    fontSize: 13,
    fontWeight: 500,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginTop: 6,
    marginBottom: 8,
  },

  // Classe específica para stickers/GIFs - tamanho pequeno fixo
  stickerMedia: {
    objectFit: "contain",
    maxWidth: "150px !important",
    maxHeight: "150px !important",
    backgroundColor: "transparent",
  },
  // Balão transparente para stickers (sem fundo)
  messageStickerLeft: {
    marginRight: 20,
    marginTop: 2,
    display: "block",
    position: "relative",
    alignSelf: "flex-start",
    backgroundColor: "transparent !important",
    boxShadow: "none !important",
    padding: 0,
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },
  },
  messageStickerRight: {
    marginLeft: 20,
    marginTop: 2,
    display: "block",
    position: "relative",
    alignSelf: "flex-end",
    backgroundColor: "transparent !important",
    boxShadow: "none !important",
    padding: 0,
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },
  },
  stickerTimestamp: {
    display: "block",
    textAlign: "right",
    fontSize: 11,
    color: theme.mode === 'light' ? "#667781" : "#8696a0",
    marginTop: 2,
    width: "auto !important",
    height: "auto !important",
    marginBottom: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    display: "block",
    [theme.breakpoints.down('sm')]: {
      maxWidth: "100px !important",
      maxHeight: "100px !important",
    },
  },

  mediaWrapper: {
    position: "relative",
    display: "inline-block",
    maxWidth: "100%",
    overflow: "hidden",
  },

  hdBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    color: "#fff",
    fontWeight: 700,
    fontSize: 10,
    padding: "2px 4px",
    borderRadius: 3,
    lineHeight: 1,
    zIndex: 2,
    border: theme.mode === 'light' ? "1px solid rgba(255,255,255,0.8)" : "1px solid rgba(255,255,255,0.5)",
    letterSpacing: 0.5,
    userSelect: "none",
    pointerEvents: "none",
  },

  timestamp: {
    fontSize: 11,
    position: "absolute",
    bottom: 0,
    right: 8,
    color: "#999",
  },

  audioDuration: {
    fontSize: 11,
    position: "absolute",
    bottom: 0,
    left: 80,
    color: "#999",
  },

  forwardMessage: {
    fontSize: 12,
    fontStyle: "italic",
    position: "absolute",
    top: 0,
    left: 5,
    color: "#999",
    display: "flex",
    alignItems: "center"
  },

  dailyTimestamp: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    width: "110px",
    backgroundColor: "#e1f3fb",
    margin: "10px",
    borderRadius: "10px",
    boxShadow: "0 1px 1px #b3b3b3",
  },

  dailyTimestampText: {
    color: "#808888",
    padding: 8,
    alignSelf: "center",
    marginLeft: "0px",
  },

  ackIcons: {
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  deletedIcon: {
    fontSize: 18,
    verticalAlign: "middle",
    marginRight: 4,
  },

  ackDoneAllIcon: {
    color: blue[500],
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  ackPlayedIcon: {
    color: green[500],
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },
  downloadMedia: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "inherit",
    padding: 10,
    color: theme.mode === "light" ? theme.palette.light : theme.palette.dark,
    width: "100%",
  },

  messageCenter: {
    marginTop: 5,
    alignItems: "center",
    verticalAlign: "center",
    alignContent: "center",
    backgroundColor: "#E1F5FEEB",
    fontSize: "12px",
    minWidth: 100,
    maxWidth: 270,
    color: "#272727",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: "0 1px 1px #b3b3b3",
  },

  deletedMessage: {
    color: '#f55d65'
  }
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_MESSAGES") {
    const messages = action.payload;
    const newMessages = [];

    messages.forEach((message) => {

      const messageIndex = state.findIndex((m) => m.id === message.id);
      if (messageIndex !== -1) {
        state[messageIndex] = message;
      } else {
        newMessages.push(message);
      }
    });

    return [...newMessages, ...state];
  }

  if (action.type === "ADD_MESSAGE") {
    const newMessage = action.payload;
    const messageIndex = state.findIndex((m) => m.id === newMessage.id);

    if (messageIndex !== -1) {
      state[messageIndex] = newMessage;
    } else {
      state.push(newMessage);
    }

    return [...state];
  }

  if (action.type === "UPDATE_MESSAGE") {
    const messageToUpdate = action.payload;
    const messageIndex = state.findIndex((m) => m.id === messageToUpdate.id);

    if (messageIndex !== -1) {
      state[messageIndex] = messageToUpdate;
    } else {
      // Upsert: se não existe ainda (ex.: recebemos UPDATE antes do CREATE), adiciona
      state.push(messageToUpdate);
    }

    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }

  if (action.type === "DELETE_MESSAGE") {
    const idToRemove = action.payload;
    const filtered = state.filter((m) => m.id !== idToRemove);
    return [...filtered];
  }
};

const MessagesList = ({
  isGroup,
  onDrop,
  whatsappId,
  queueId,
  channel
}) => {
  const classes = useStyles();
  const [messagesList, dispatch] = useReducer(reducer, []);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const history = useHistory();
  const lastMessageRef = useRef();

  const [selectedMessage, setSelectedMessage] = useState({});
  const { setReplyingMessage } = useContext(ReplyMessageContext);
  const [anchorEl, setAnchorEl] = useState(null);
  const messageOptionsMenuOpen = Boolean(anchorEl);
  const { ticketId } = useParams();

  const currentTicketId = useRef(ticketId);
  const { getAll } = useCompanySettings();
  const [dragActive, setDragActive] = useState(false);

  const [lgpdDeleteMessage, setLGPDDeleteMessage] = useState(false);
  const { selectedQueuesMessage } = useContext(QueueSelectedContext);

  const { user, socket } = useContext(AuthContext);
  // Armazena a sala atual (idealmente ticket.uuid). Antes de sabermos o uuid, usa-se ticketId como fallback.
  const currentRoomIdRef = useRef(null);

  const { showSelectMessageCheckbox, selectedMessages } = useContext(ForwardMessageContext);

  const companyId = user.companyId;

  const [videoDialog, setVideoDialog] = useState({ open: false, url: null });
  const [pdfDialog, setPdfDialog] = useState({ open: false, url: null });
  
  // Estado para o modal de mídia (estilo WhatsApp)
  const [mediaModal, setMediaModal] = useState({ 
    open: false, 
    mediaUrl: null, 
    mediaType: "image",
    message: null 
  });

  // Função para obter todas as mídias (imagens e vídeos) da conversa
  const getAllMediaFromConversation = useCallback(() => {
    return messagesList
      .filter(m => m.mediaType === "image" || m.mediaType === "video")
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [messagesList]);

  // Função para abrir o modal de mídia
  const handleOpenMediaModal = useCallback((message) => {
    setMediaModal({
      open: true,
      mediaUrl: message.mediaUrl,
      mediaType: message.mediaType,
      message: message
    });
  }, []);

  // Função para fechar o modal de mídia
  const handleCloseMediaModal = useCallback(() => {
    setMediaModal({ open: false, mediaUrl: null, mediaType: "image", message: null });
  }, []);
  
  // Estado para transcrições de áudio
  const [transcriptions, setTranscriptions] = useState({}); // { messageId: { loading, text, error } }

  // Função para transcrever áudio
  const handleTranscribeAudio = async (message) => {
    if (!message?.mediaUrl) return;
    
    const messageId = message.id;
    
    // Se já está carregando ou já tem transcrição, não faz nada
    if (transcriptions[messageId]?.loading || transcriptions[messageId]?.text) return;
    
    // Extrair nome do arquivo da URL
    const fileName = message.mediaUrl.split('/').pop();
    if (!fileName) return;
    
    setTranscriptions(prev => ({
      ...prev,
      [messageId]: { loading: true, text: null, error: null }
    }));
    
    try {
      const { data } = await api.get(`/messages/transcribeAudio/${encodeURIComponent(fileName)}`, {
        params: { ticketId: message.ticketId }
      });
      
      setTranscriptions(prev => ({
        ...prev,
        [messageId]: { 
          loading: false, 
          text: data?.transcribedText?.transcribedText || data?.transcribedText || "Transcrição não disponível",
          error: null 
        }
      }));
    } catch (err) {
      console.error("Erro ao transcrever áudio:", err);
      const errorMessage = err?.response?.data?.error || err?.message || "Erro ao transcrever";
      setTranscriptions(prev => ({
        ...prev,
        [messageId]: { 
          loading: false, 
          text: null, 
          error: errorMessage
        }
      }));
      toastError(errorMessage);
    }
  };

  // Helper para decidir qual contato exibir no avatar do áudio
  const backendUrl = getBackendUrl();
  const getAvatarContactForMessage = (msg, fallbackTicketContact = null) => {
    try {
      // Mensagens enviadas por mim: usar avatar do usuário logado
      if (msg?.fromMe) {
        const imageName = user?.profileImage;
        const url = imageName
          ? `${backendUrl}/public/company${companyId}/${imageName}`
          : `${process.env.FRONTEND_URL}/nopicture.png`;
        return { name: user?.name, urlPicture: url };
      }

      // Mensagens recebidas: preferir contact com imagem; caso não tenha, usar ticket.contact
      const c = msg?.contact;
      const hasPic = !!(c?.urlPicture || c?.profilePicUrl || c?.contact?.urlPicture || c?.contact?.profilePicUrl);
      if (hasPic) return c;

      // tenta pegar do próprio msg.ticket ou do fallback informado
      const ticketContact = msg?.ticket?.contact || fallbackTicketContact;
      if (ticketContact) return ticketContact;

      return c;
    } catch (e) {
      return msg?.contact || fallbackTicketContact || null;
    }
  };

  // Helper para extrair nome do arquivo no browser
  const getFileNameFromUrl = (url = "") => {
    try {
      const u = new URL(url, window.location.href);
      return u.pathname.split("/").pop() || "";
    } catch (e) {
      return (url || "").split("/").pop() || "";
    }
  };

  // Força download via fetch+blob para evitar abrir na mesma aba
  const handleDirectDownload = async (url) => {
    try {
      if (!url) return;
      const response = await fetch(url);
      if (!response.ok) return;
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = getFileNameFromUrl(url) || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {}
  };

  // Exibe duração do áudio (mm:ss) usando apenas metadata do arquivo
  const AudioDurationTag = ({ src }) => {
    const audioRef = useRef(null);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
      const a = audioRef.current;
      if (!a) return;
      const onLoaded = () => setDuration(a.duration || 0);
      const onDurationChange = () => setDuration(a.duration || 0);
      a.addEventListener("loadedmetadata", onLoaded);
      a.addEventListener("durationchange", onDurationChange);
      return () => {
        a.removeEventListener("loadedmetadata", onLoaded);
        a.removeEventListener("durationchange", onDurationChange);
      };
    }, []);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const sourceUrl = isIOS ? (src || "").replace(".ogg", ".mp3") : src;

    const formatTime = (s) => {
      if (!isFinite(s) || s <= 0) return "";
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60).toString().padStart(2, "0");
      return `${m}:${sec}`;
    };

    return (
      <>
        {formatTime(duration)}
        <audio ref={audioRef} preload="metadata" style={{ display: "none" }}>
          <source src={sourceUrl} type={isIOS ? "audio/mp3" : "audio/ogg"} />
        </audio>
      </>
    );
  };

  // Componente de vídeo com selo HD
  const VideoWithHdBadge = ({ src, className, isGif }) => {
    const [isHd, setIsHd] = useState(false);
    const videoRef = useRef(null);

    const handleLoadedMetadata = useCallback(() => {
      const v = videoRef.current;
      if (!v) return;
      const w = v.videoWidth || 0;
      const h = v.videoHeight || 0;
      setIsHd(w >= 1280 && h >= 720);
    }, []);

    return (
      <div className={classes.mediaWrapper}>
        {!isGif && isHd && <span className={classes.hdBadge}>HD</span>}
        <video
              className={`${classes.messageMedia} ${className || ''}`}
          src={src}
          controls
          ref={videoRef}
          onLoadedMetadata={handleLoadedMetadata}
        />
      </div>
    );
  };

  useEffect(() => {

    async function fetchData() {

      const settings = await getAll(companyId);

      let settinglgpdDeleteMessage;
      let settingEnableLGPD;

      for (const [key, value] of Object.entries(settings)) {

        if (key === "lgpdDeleteMessage") settinglgpdDeleteMessage = value
        if (key === "enableLGPD") settingEnableLGPD = value
      }
      if (settingEnableLGPD === "enabled" && settinglgpdDeleteMessage === "enabled") {
        setLGPDDeleteMessage(true);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);

    currentTicketId.current = ticketId;
    setUiReady(false);
  }, [ticketId, selectedQueuesMessage]);

  const [uiReady, setUiReady] = useState(false);
  const composerReadyRef = useRef(false);

  useEffect(() => {
    setLoading(true);
    const fetchMessages = async () => {
        if (!ticketId || ticketId === "undefined") {
          history.push("/tickets");
          return;
        }
        if (isNil(ticketId)) return;
        try {
          const { data } = await api.get("/messages/" + ticketId, {
            params: { pageNumber, selectedQueues: JSON.stringify(selectedQueuesMessage) },
          });

          if (currentTicketId.current === ticketId) {
            dispatch({ type: "LOAD_MESSAGES", payload: data.messages });
            setHasMore(data.hasMore);
            setLoading(false);
            setLoadingMore(false);

            // Descobre o UUID do ticket diretamente do payload (mais confiável)
            const ticketUuid = data?.ticket?.uuid || null;
            // Fallback: tenta pegar da primeira mensagem caso necessário
            const firstMsg = data?.messages?.[0];
            const firstMsgUuid = firstMsg?.ticket?.uuid || null;
            const newRoomId = ticketUuid || firstMsgUuid || null;
            if (newRoomId) {
              try {
                const prevRoom = currentRoomIdRef.current;
                if (prevRoom && prevRoom !== newRoomId) {
                  if (typeof socket.leaveRoom === "function") {
                    socket.leaveRoom(prevRoom, (err) => {
                      if (err) console.log("[MessagesList] leave prev room ack error", err);
                      else console.log("[MessagesList] left prev room", { room: prevRoom });
                    });
                  } else {
                    socket.emit("joinChatBoxLeave", prevRoom, (err) => {
                      if (err) console.log("[MessagesList] leave prev room ack error", err);
                      else console.log("[MessagesList] left prev room", { room: prevRoom });
                    });
                  }
                }
                if (prevRoom !== newRoomId) {
                  currentRoomIdRef.current = newRoomId;
                  if (typeof socket.joinRoom === "function") {
                    socket.joinRoom(newRoomId, (err) => {
                      if (err) console.log("[MessagesList] join after fetch ack error", err);
                      else {
                        console.log("[MessagesList] joined room by uuid after fetch", { room: newRoomId });
                        if (typeof socket.checkRoom === "function") {
                          socket.checkRoom(newRoomId, (res) => console.log("[MessagesList] checkRoom after fetch join", res));
                        }
                      }
                    });
                  } else {
                    socket.emit("joinChatBox", newRoomId, (err) => {
                      if (err) console.log("[MessagesList] join after fetch ack error", err);
                      else {
                        console.log("[MessagesList] joined room by uuid after fetch", { room: newRoomId });
                        if (typeof socket.checkRoom === "function") {
                          socket.checkRoom(newRoomId, (res) => console.log("[MessagesList] checkRoom after fetch join", res));
                        }
                      }
                    });
                  }
                }
              } catch {}
            }
          }

          if (pageNumber === 1) {
            // aguarda composer e layout
            const doReady = () => {
              scrollToBottom();
              setUiReady(true);
              try { window.dispatchEvent(new Event('messages-ready')); } catch {}
            };
            if (composerReadyRef.current) {
              setTimeout(doReady, 30);
            } else {
              // fallback: garante readiness mesmo sem evento
              setTimeout(doReady, 180);
            }
          }
        } catch (err) {
          setLoading(false);
          toastError(err);
          setLoadingMore(false);
        }
    };

    fetchMessages();
  }, [pageNumber, ticketId, selectedQueuesMessage]);

  // Garante que, quando o composer sinalizar que está pronto, a lista role ao final
  useEffect(() => {
    const onComposerReady = () => {
      composerReadyRef.current = true;
      setTimeout(() => {
        scrollToBottom();
        setUiReady(true);
        try { window.dispatchEvent(new Event('messages-ready')); } catch {}
      }, 60);
    };
    window.addEventListener('composer-ready', onComposerReady);
    return () => window.removeEventListener('composer-ready', onComposerReady);
  }, []);

  useEffect(() => {
    if (!ticketId || ticketId === "undefined") {
      return;
    }

    // Aguarda socket e user.companyId disponíveis
    if (!socket || typeof socket.on !== "function") {
      return;
    }
    if (!user || !user.companyId) {
      return;
    }

    const companyId = user.companyId;

    const connectEventMessagesList = () => {
      try {
        // Prioriza entrar pela sala UUID se já conhecida
        const normalizedId = (ticketId ?? "").toString().trim();
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const candidateFromUrl = uuidRegex.test(normalizedId) ? normalizedId : "";
        const roomToJoin = (currentRoomIdRef.current || candidateFromUrl || "").toString().trim();
        if (!roomToJoin || roomToJoin === "undefined") {
          console.debug("[MessagesList] skip joinChatBox - invalid ticketId", { ticketId });
          return;
        }
        console.log("[MessagesList] socket connect - joinChatBox", { room: roomToJoin, hasJoinRoom: typeof socket.joinRoom === "function", connected: !!socket.connected });
        if (typeof socket.joinRoom === "function") {
          socket.joinRoom(roomToJoin, (err) => {
            if (err) console.log("[MessagesList] joinChatBox ack error", err);
            else {
              console.log("[MessagesList] joinChatBox ok", { room: roomToJoin });
              if (typeof socket.checkRoom === "function") {
                socket.checkRoom(roomToJoin, (res) => console.log("[MessagesList] checkRoom after connect join", res));
              }
            }
          });
        } else {
          socket.emit("joinChatBox", roomToJoin, (err) => {
            if (err) console.log("[MessagesList] joinChatBox ack error", err);
            else {
              console.log("[MessagesList] joinChatBox ok", { room: roomToJoin });
              if (typeof socket.checkRoom === "function") {
                socket.checkRoom(roomToJoin, (res) => console.log("[MessagesList] checkRoom after connect join", res));
              }
            }
          });
        }
      } catch (e) {
        console.debug("[MessagesList] error emitting joinChatBox", e);
      }
    };

    const onAppMessageMessagesList = (data) => {
      try {
        const evtUuid = data?.message?.ticket?.uuid || data?.ticket?.uuid;
        const evtTicketId = data?.message?.ticketId || data?.ticket?.id;
        const hasUuid = Boolean(evtUuid);
        
        console.debug("[MessagesList] appMessage", {
          action: data?.action,
          evtUuid,
          evtTicketId,
          hasUuid,
          currentRoom: currentRoomIdRef.current,
          currentTicketId: ticketId,
          msgId: data?.message?.id,
        });

        // CRÍTICO: Sempre verificar se a mensagem pertence ao ticket atual
        // Se não houver UUID, verificar pelo ticketId
        // Se nenhum dos dois bater, REJEITAR a mensagem
        let shouldHandle = false;
        if (hasUuid && evtUuid === currentRoomIdRef.current) {
          shouldHandle = true;
        } else if (evtTicketId && String(evtTicketId) === String(ticketId)) {
          // Comparar como string para evitar problemas de tipo (number vs string)
          shouldHandle = true;
        }

        if (!shouldHandle) {
          console.debug("[MessagesList] Rejeitando mensagem de outro ticket", { evtUuid, evtTicketId, currentRoom: currentRoomIdRef.current, ticketId });
          return;
        }

        if (data.action === "create") {
          dispatch({ type: "ADD_MESSAGE", payload: data.message });
          scrollToBottom();
        }

        if (data.action === "update") {
          dispatch({ type: "UPDATE_MESSAGE", payload: data.message });
        }

        if (data.action == "delete") {
          dispatch({ type: "DELETE_MESSAGE", payload: data.messageId });
        }
      } catch (e) {
        console.debug("[MessagesList] error handling appMessage", e, data);
      }
    };

    socket.on("connect", connectEventMessagesList);
    socket.on(`company-${companyId}-appMessage`, onAppMessageMessagesList);

    // Se já estiver conectado, entra na sala imediatamente
    try {
      if (socket && socket.connected) {
        connectEventMessagesList();
      }
    } catch {}

    // Logs auxiliares de conexão
    socket.on("disconnect", (reason) => console.debug("[MessagesList] disconnect", reason));
    socket.on("reconnect", (attempt) => console.debug("[MessagesList] reconnect", attempt));
    socket.on("reconnect_attempt", (attempt) => console.debug("[MessagesList] reconnect_attempt", attempt));
    socket.on("connect_error", (err) => console.debug("[MessagesList] connect_error", err?.message || err));

    return () => {
      try {
        const roomToLeave = (currentRoomIdRef.current || (ticketId ?? "")).toString().trim();
        if (!roomToLeave || roomToLeave === "undefined") {
          console.debug("[MessagesList] skip leave room - invalid ticketId", { ticketId });
        } else {
          console.debug("[MessagesList] cleanup - leave room", { room: roomToLeave });
          if (typeof socket.leaveRoom === "function") {
            socket.leaveRoom(roomToLeave, (err) => {
              if (err) console.debug("[MessagesList] joinChatBoxLeave ack error", err);
              else console.debug("[MessagesList] joinChatBoxLeave ok", { room: roomToLeave });
            });
          } else {
            socket.emit("joinChatBoxLeave", roomToLeave, (err) => {
              if (err) console.debug("[MessagesList] joinChatBoxLeave ack error", err);
              else console.debug("[MessagesList] joinChatBoxLeave ok", { room: roomToLeave });
            });
          }
        }
      } catch {}

      socket.off("connect", connectEventMessagesList);
      socket.off(`company-${companyId}-appMessage`, onAppMessageMessagesList);
      socket.off("disconnect");
      socket.off("reconnect");
      socket.off("reconnect_attempt");
      socket.off("connect_error");
    };
  }, [ticketId, socket, user?.companyId]);

  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setPageNumber((prevPageNumber) => prevPageNumber + 1);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (lastMessageRef.current) {
        lastMessageRef.current.scrollIntoView({});
      }
    }, 100);
  };

  const handleScroll = (e) => {
    if (!hasMore) return;
    const { scrollTop } = e.currentTarget;

    if (scrollTop === 0) {
      document.getElementById("messagesList").scrollTop = 1;
    }

    if (loading) {
      return;
    }

    if (scrollTop < 50) {
      loadMore();
    }
  };

  const handleOpenMessageOptionsMenu = (e, message) => {
    setAnchorEl(e.currentTarget);
    setSelectedMessage(message);
  };

  const handleCloseMessageOptionsMenu = (e) => {
    setAnchorEl(null);
  };

  const hanldeReplyMessage = (e, message) => {
    setAnchorEl(null);
    setReplyingMessage(message);
  };

  const checkMessageMedia = (message) => {
    if (message.mediaType === "locationMessage" && message.body.split('|').length >= 2) {
      let locationParts = message.body.split('|')
      let imageLocation = locationParts[0]
      let linkLocation = locationParts[1]

      let descriptionLocation = null

      if (locationParts.length > 2)
        descriptionLocation = message.body.split('|')[2]

      return <LocationPreview image={imageLocation} link={linkLocation} description={descriptionLocation} />
    } else if (message.mediaType === "contactMessage") {
      let array = message.body.split("\n");
      let obj = [];
      let contact = "";
      for (let index = 0; index < array.length; index++) {
        const v = array[index];
        let values = v.split(":");
        for (let ind = 0; ind < values.length; ind++) {
          if (values[ind].indexOf("+") !== -1) {
            obj.push({ number: values[ind] });
          }
          if (values[ind].indexOf("FN") !== -1) {
            contact = values[ind + 1];
          }
        }
      }
      return <VcardPreview contact={contact} numbers={obj[0]?.number} queueId={message?.ticket?.queueId} whatsappId={message?.ticket?.whatsappId} />
    } else if (message.mediaType === "adMetaPreview") {
      let [image, sourceUrl, title, body] = message.body.split('|');
      let messageUser = "Olá! Tenho interesse e queria mais informações, por favor.";
      return <AdMetaPreview image={image} sourceUrl={sourceUrl} title={title} body={body} messageUser={messageUser} />;
    } else if (message.mediaType === "sticker" || message.mediaType === "gif") {
      // Stickers e GIFs - exibir como imagem animada sem fundo
      return (
        <img
          src={message.mediaUrl}
          alt=""
          className={classes.stickerMedia}
        />
      );
    } else if (message.mediaType === "reactionMessage") {
      // Reações - exibir emoji grande
      return (
        <span style={{ fontSize: 32 }}>
          {message.body}
        </span>
      );
    } else if (message.mediaType === "image") {
      return (
        <div 
          style={{ cursor: "pointer" }} 
          onClick={() => handleOpenMediaModal(message)}
        >
          <ModalImageCors imageUrl={message.mediaUrl} />
        </div>
      );
    } else if (message.mediaType === "audio") {
      const transcription = transcriptions[message.id];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <AudioModal url={message.mediaUrl} contact={getAvatarContactForMessage(message, message?.ticket?.contact)} fromMe={message.fromMe} />
          
          {/* Botão de transcrição */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <Button
              size="small"
              variant="text"
              color="primary"
              startIcon={transcription?.loading ? <CircularProgress size={14} /> : <RecordVoiceOver fontSize="small" />}
              onClick={() => handleTranscribeAudio(message)}
              disabled={transcription?.loading || !!transcription?.text}
              style={{ fontSize: 11, padding: '2px 8px', minWidth: 'auto' }}
            >
              {transcription?.loading ? "Transcrevendo..." : transcription?.text ? "Transcrito" : "Transcrever"}
            </Button>
          </div>
          
          {/* Exibir transcrição */}
          {transcription?.text && (
            <div style={{ 
              backgroundColor: 'rgba(0,0,0,0.05)', 
              borderRadius: 4, 
              padding: '6px 8px', 
              fontSize: 12,
              fontStyle: 'italic',
              maxWidth: 280,
              wordBreak: 'break-word'
            }}>
              📝 {transcription.text}
            </div>
          )}
          
          {/* Exibir erro */}
          {transcription?.error && (
            <div style={{ 
              color: '#d32f2f', 
              fontSize: 11,
              padding: '4px 8px'
            }}>
              ⚠️ {transcription.error}
            </div>
          )}
        </div>
      );
    } else if (message.mediaType === "video") {
      return (
        <div onClick={(e) => { e.preventDefault(); handleOpenMediaModal(message); }} style={{ display: 'inline-block', cursor: 'pointer' }}>
          <VideoWithHdBadge
            className={classes.messageMedia}
            src={message.mediaUrl}
            isGif={/\.gif(\?.*)?$/i.test(message.mediaUrl || "")}
          />
        </div>
      );
    } else if ((message.mediaType === "application" || message.mediaType === "document") && /\.pdf($|\?)/i.test(message.mediaUrl)) {
      const pdfThumbUrl = message.mediaUrl
        ? message.mediaUrl.replace(/(\.pdf)(\?.*)?$/i, '-thumb.png$2')
        : null;
      const pdfThumbUrlAlt = message.mediaUrl
        ? message.mediaUrl.replace(/(\.pdf)(\?.*)?$/i, '-thumb.1.png$2')
        : null;

      return (
        <div
          className={classes.fileFrame}
          onClick={(e) => { e.preventDefault(); setPdfDialog({ open: true, url: message.mediaUrl }); }}
          style={{ cursor: 'pointer' }}
        >
          <div>
            {pdfThumbUrl && (
              <img
                src={pdfThumbUrl}
                alt="PDF preview"
                style={{ maxWidth: 180, maxHeight: 180, display: 'block', marginBottom: 6, borderRadius: 4 }}
                data-fallback-step="0"
                onError={(e) => {
                  const el = e.currentTarget;
                  const step = el?.dataset?.fallbackStep || "0";
                  if (step === "0" && pdfThumbUrlAlt) {
                    el.dataset.fallbackStep = "1";
                    el.src = pdfThumbUrlAlt;
                    return;
                  }
                  el.style.display = "none";
                }}
              />
            )}
            <div style={{ fontWeight: 700, fontSize: 14 }}>PDF</div>
            <div className={classes.fileName}>{getFileNameFromUrl(message.mediaUrl) || 'arquivo.pdf'}</div>
            <Button
              startIcon={<GetApp />}
              variant="outlined"
              href={message.mediaUrl}
              onClick={(e) => { e.preventDefault(); handleDirectDownload(message.mediaUrl); }}
            >
              Baixar
            </Button>
          </div>
        </div>
      );
    } else if (message.mediaType === "application" || message.mediaType === "document") {
      return (
        <>
          <div className={classes.fileFrame}>
            <div>
              <GetApp color="primary" />
              <div className={classes.fileName}>{getFileNameFromUrl(message.mediaUrl) || 'arquivo'}</div>
              <Button
                startIcon={<GetApp />}
                variant="outlined"
                href={message.mediaUrl}
                onClick={(e) => { e.preventDefault(); handleDirectDownload(message.mediaUrl); }}
              >
                Download
              </Button>
            </div>
          </div>
          <Divider />
        </>
      );
    } else {
      return null;
    }
  };

  const renderMessageAck = (message) => {
    if (message.ack === 0) {
      return <AccessTime fontSize="small" className={classes.ackIcons} />;
    } else if (message.ack === 1) {
      return <Done fontSize="small" className={classes.ackIcons} />;
    } else if (message.ack === 2) {
      return <DoneAll fontSize="small" className={classes.ackIcons} />;
    } else if (message.ack === 3 || message.ack === 4) {
      return <DoneAll fontSize="small" className={message.mediaType === "audio" ? classes.ackPlayedIcon : classes.ackDoneAllIcon} />;
    } else if (message.ack === 5) {
      return <DoneAll fontSize="small" className={classes.ackDoneAllIcon} />
    }
  };

  const renderDailyTimestamps = (message, index) => {
    const today = format(new Date(), "dd/MM/yyyy")

    if (index === 0) {
      return (
        <span
          className={classes.dailyTimestamp}
          key={`timestamp-${message.id}`}
        >
          <div className={classes.dailyTimestampText}>
            {today === format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy") ? "HOJE" : format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
          </div>
        </span>
      );
    } else if (index < messagesList.length - 1) {
      let messageDay = parseISO(messagesList[index].createdAt);
      let previousMessageDay = parseISO(messagesList[index - 1].createdAt);

      if (!isSameDay(messageDay, previousMessageDay)) {
        return (
          <span
            className={classes.dailyTimestamp}
            key={`timestamp-${message.id}`}
          >
            <div className={classes.dailyTimestampText}>
              {today === format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy") ? "HOJE" : format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
            </div>
          </span>
        );
      }
    } else if (index === messagesList.length - 1) {
      return (
        <div
          key={`ref-${message.id}`}
          ref={lastMessageRef}
          style={{ float: "left", clear: "both" }}
        />
      );
    }
  };


  const renderTicketsSeparator = (message, index) => {
    let lastTicket = messagesList[index - 1]?.ticketId;
    let currentTicket = message.ticketId;

    if (lastTicket !== currentTicket && lastTicket !== undefined) {
      if (message?.ticket?.queue) {
        return (
          <span
            className={classes.currentTick}
            key={`timestamp-${message.id}a`}
          >
            <div className={classes.currentTickContent}>
              <div
                className={classes.currentTicktText}
                style={{ color: message?.ticket?.queue?.color || "#666" }}
              >
                #{i18n.t("ticketsList.called")} {message?.ticketId} - {message?.ticket?.queue?.name}
              </div>
              <div className={classes.currentTickSubText}>
                {format(parseISO(message?.ticket?.createdAt || message.createdAt), "dd/MM/yy - HH'h'mm")}
              </div>
            </div>

          </span>
        );
      } else {
        return (
          <span
            className={classes.currentTick}
            key={`timestamp-${message.id}b`}
          >
            <div className={classes.currentTickContent}>
              <div
                className={classes.currentTicktText}
                style={{ color: "#666" }}
              >
                #{i18n.t("ticketsList.called")} {message.ticketId} - {i18n.t("ticketsList.noQueue")}
              </div>
              <div className={classes.currentTickSubText}>
                {format(parseISO(message?.ticket?.createdAt || message.createdAt), "dd/MM/yyyy HH:mm")}
              </div>
            </div>

          </span>
        );
      }
    }

  };

  const renderMessageDivider = (message, index) => {
    if (index < messagesList.length && index > 0) {
      let messageUser = messagesList[index].fromMe;
      let previousMessageUser = messagesList[index - 1].fromMe;
      if (messageUser !== previousMessageUser) {
        return (

          <span style={{ marginTop: 16 }} key={`divider-${message.id}`}></span>
        );
      }
    }
  };

  const renderQuotedMessage = (message) => {

    return (
      <div
        className={clsx(classes.quotedContainerLeft, {
          [classes.quotedContainerRight]: message.fromMe,
        })}
      >
        <span
          className={clsx(classes.quotedSideColorLeft, {
            [classes.quotedSideColorRight]: message.quotedMsg?.fromMe,
          })}
        ></span>
        <div className={classes.quotedMsg}>
          {!message.quotedMsg?.fromMe && (
            <span className={classes.messageContactName}>
              {message.quotedMsg?.contact?.name}
            </span>
          )}

          {message.quotedMsg.mediaType === "audio"
            && (
              <div className={classes.downloadMedia}>
                <AudioModal url={message.quotedMsg.mediaUrl} contact={getAvatarContactForMessage(message.quotedMsg, message?.ticket?.contact)} fromMe={message.quotedMsg?.fromMe} />
              </div>
            )
          }
          {message.quotedMsg.mediaType === "video"
            && (
              <VideoWithHdBadge
                className={classes.messageMedia}
                src={message.quotedMsg.mediaUrl}
                isGif={/\.gif(\?.*)?$/i.test(message.quotedMsg.mediaUrl || "")}
              />
            )
          }
          {message.quotedMsg.mediaType === "contactMessage"
            && (
              "Contato"
            )
          }
          {message.quotedMsg.mediaType === "application" && /\.pdf($|\?)/i.test(message.quotedMsg.mediaUrl)
            && (
              <div className={classes.fileFrame} onClick={(e) => { e.preventDefault(); setPdfDialog({ open: true, url: message.quotedMsg.mediaUrl }); }} style={{ cursor: 'pointer' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>PDF</div>
                  <div className={classes.fileName}>{getFileNameFromUrl(message.quotedMsg.mediaUrl) || 'arquivo.pdf'}</div>
                  <Button
                    startIcon={<GetApp />}
                    variant="outlined"
                    href={message.quotedMsg.mediaUrl}
                    onClick={(e) => { e.preventDefault(); handleDirectDownload(message.quotedMsg.mediaUrl); }}
                  >
                    Baixar
                  </Button>
                </div>
              </div>
            )
          }
          {message.quotedMsg.mediaType === "application" && !/\.pdf($|\?)/i.test(message.quotedMsg.mediaUrl)
            && (
              <div className={classes.downloadMedia}>
                <Button
                  startIcon={<GetApp />}
                  variant="outlined"
                  href={message.quotedMsg.mediaUrl}
                  onClick={(e) => { e.preventDefault(); handleDirectDownload(message.quotedMsg.mediaUrl); }}
                >
                  Download
                </Button>
              </div>
            )
          }

          {message.quotedMsg.mediaType === "image"
            && (
              <ModalImageCors imageUrl={message.quotedMsg.mediaUrl} />)
            || message.quotedMsg?.body}

          {!message.quotedMsg.mediaType === "image" && message.quotedMsg?.body}


        </div>
      </div>
    );
  };

  const handleDrag = event => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === "dragenter" || event.type === "dragover") {
      setDragActive(true);
    } else if (event.type === "dragleave") {
      setDragActive(false);
    }
  }

  const isYouTubeLink = (url) => {
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    return youtubeRegex.test(url);
  };

  const urlRegex = /https?:\/\/[^\s]+/gi;
  const extractFirstUrl = (text = "") => {
    try {
      const m = text.match(urlRegex);
      return m && m.length ? m[0] : "";
    } catch { return ""; }
  };

  const handleDrop = event => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      if (onDrop) {
        onDrop(event.dataTransfer.files);
      }
    }
  }
  const xmlRegex = /<([^>]+)>/g;
  const boldRegex = /\*(.*?)\*/g;

  const formatXml = (xmlString) => {
    if (boldRegex.test(xmlString)) {
      xmlString = xmlString.replace(boldRegex, "**$1**");
    }
    return xmlString;
  };

  // Verifica se a mensagem tem botões no dataJson
  const hasButtonsInDataJson = (message) => {
    if (!message?.dataJson) return false;
    try {
      const data = typeof message.dataJson === "string" 
        ? JSON.parse(message.dataJson) 
        : message.dataJson;
      return !!(
        data?.message?.buttonsMessage?.buttons?.length ||
        data?.message?.interactiveMessage?.nativeFlowMessage?.buttons?.length ||
        data?.message?.viewOnceMessage?.message?.interactiveMessage?.nativeFlowMessage?.buttons?.length ||
        data?.message?.listMessage?.sections?.length
      );
    } catch {
      return false;
    }
  };

  // Limpa o corpo da mensagem removendo marcadores de botão quando há botões visuais
  const cleanButtonMarkers = (body, message) => {
    if (!hasButtonsInDataJson(message)) return body;
    // Remove [BUTTON], [BOTOES], [LIST] e linhas numeradas de opções
    let cleaned = (body || "")
      .replace(/^\[BUTTON\]\s*/i, "")
      .replace(/^\[BOTOES\]\s*/i, "")
      .replace(/^\[LIST\]\s*/i, "")
      .replace(/\n\*?\d+\*?\s*-\s*[^\n]+/g, "") // Remove linhas tipo "1 - Opção"
      .trim();
    return cleaned;
  };

  const renderMessages = () => {
    if (!messagesList || messagesList.length === 0) {
      return <div>Diga olá para seu novo contato!</div>;
    }
    const view = messagesList.map((message, index) => {
      if (message.mediaType === "call_log") {
        return (
          <React.Fragment key={message.id}>
            {renderDailyTimestamps(message, index)}
            {renderTicketsSeparator(message, index)}
            {renderMessageDivider(message, index)}
            <div className={classes.messageCenter}>
              {isGroup && (<span className={classes.messageContactName}>{message.contact?.name}</span>)}
              <div>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 17" width="20" height="17"><path fill="#df3333" d="M18.2 12.1c-1.5-1.8-5-2.7-8.2-2.7s-6.7 1-8.2 2.7c-.7.8-.3 2.3.2 2.8.2.2.3.3.5.3 1.4 0 3.6-.7 3.6-.7.5-.2.8-.5.8-1v-1.3c.7-1.2 5.4-1.2 6.4-.1l.1.1v1.3c0 .2.1.4.2.6.1.2.3.3.5.4 0 0 2.2.7 3.6.7.2 0 1.4-2 .5-3.1zM5.4 3.2l4.7 4.6 5.8-5.7-.9-.8L10.1 6 6.4 2.3h2.5V1H4.1v4.8h1.3V3.2z"></path></svg>
                <span>{i18n.t("ticketsList.missedCall")} {format(parseISO(message.createdAt), "HH:mm")}</span>
              </div>
            </div>
          </React.Fragment>
        );
      }

      const isLeft = !message.fromMe;
      const isSticker = message.mediaType === "sticker" || message.mediaType === "gif";
      const bubbleClass = clsx(
        isSticker 
          ? (isLeft ? classes.messageStickerLeft : classes.messageStickerRight)
          : (isLeft ? classes.messageLeft : (message.isPrivate ? classes.messageRightPrivate : classes.messageRight)),
        { [isLeft ? classes.messageLeftAudio : classes.messageRightAudio]: message.mediaType === "audio" }
      );

      // Verifica se a mensagem está selecionada
      const isMessageSelected = showSelectMessageCheckbox && selectedMessages.some((m) => m.id === message.id);

      return (
        <React.Fragment key={message.id}>
          {renderDailyTimestamps(message, index)}
          {renderTicketsSeparator(message, index)}
          {renderMessageDivider(message, index)}
          <div 
            className={clsx(
              classes.messageRowWrapper,
              { [classes.messageRowWrapperSelected]: isMessageSelected }
            )}
          >
            {showSelectMessageCheckbox && (
              <div className={classes.messageRowCheckbox}>
                <SelectMessageCheckbox message={message} />
              </div>
            )}
            <div className={classes.messageRowContent}>
              <div
                className={bubbleClass}
                title={message.queueId && message.queue?.name}
                onDoubleClick={(e) => hanldeReplyMessage(e, message)}
              >
                <IconButton
              variant="contained"
              size="small"
              id="messageActionsButton"
              disabled={message.isDeleted}
              className={classes.messageActionsButton}
              onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
            >
              <ExpandMore />
            </IconButton>

            {(message.mediaUrl || message.mediaType === "locationMessage" || message.mediaType === "contactMessage" || message.mediaType === "template" || message.mediaType === "adMetaPreview") && checkMessageMedia(message)}

            <div className={clsx(
              classes.textContentItem,
              {
                [classes.textContentItemDeleted]: message.isDeleted,
                [classes.textContentItemCompact]: (
                  // PDFs: compacta quando body == nome do arquivo
                  (message.mediaType === "application" && /\.pdf($|\?)/i.test(message.mediaUrl || "") &&
                   (getFileNameFromUrl(message.mediaUrl) || "").trim() === (message.body || "").trim())
                  ||
                  // Imagens/Vídeos: compacta quando não há legenda ou quando body == nome do arquivo
                  ((message.mediaType === "image" || message.mediaType === "video") && (
                    ((message.body || "").trim() === "") ||
                    ((getFileNameFromUrl(message.mediaUrl) || "").trim() === (message.body || "").trim())
                  ))
                )
              }
            )}>
              {message.quotedMsg && renderQuotedMessage(message)}
              {message.mediaType !== "adMetaPreview" && (
                (
                  ((message.mediaType === "image" || message.mediaType === "video") && (getFileNameFromUrl(message.mediaUrl) || "").trim() !== (message.body || "").trim()) ||
                  (
                    message.mediaType !== "audio" &&
                    message.mediaType != "reactionMessage" &&
                    message.mediaType != "locationMessage" &&
                    message.mediaType !== "contactMessage" &&
                    !(message.mediaType === "application" && /\.pdf($|\?)/i.test(message.mediaUrl || "") && (getFileNameFromUrl(message.mediaUrl) || "").trim() === (message.body || "").trim())
                  )
                ) && (xmlRegex.test(message.body) ? <span>{formatXml(cleanButtonMarkers(message.body, message))}</span> : <MarkdownWrapper>{(lgpdDeleteMessage && message.isDeleted) ? "🚫 _Mensagem apagada_ " : cleanButtonMarkers(message.body, message)}</MarkdownWrapper>)
              )}

              {/* Renderiza botões interativos se houver dataJson com botões */}
              <ButtonsPreview message={message} />

              {message.mediaType === "audio" && (
                <span className={classes.audioDuration}>
                  <AudioDurationTag src={message.mediaUrl} />
                </span>
              )}

              <span className={classes.timestamp}>
                {message.isEdited ? "Editada " + format(parseISO(message.createdAt), "HH:mm") : format(parseISO(message.createdAt), "HH:mm")}
                {!isLeft && renderMessageAck(message)}
              </span>
            </div>
              </div>
            </div>
          </div>
        </React.Fragment>
      );
    });
    return view;
  };

  return (
    <div className={classes.messagesListWrapper} onDragEnter={handleDrag}>
      {dragActive && <div className={classes.dragElement} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>Solte o arquivo aqui</div>}

      <MessageOptionsMenu
        message={selectedMessage}
        anchorEl={anchorEl}
        menuOpen={messageOptionsMenuOpen}
        handleClose={handleCloseMessageOptionsMenu}
        isGroup={isGroup}
        whatsappId={whatsappId}
        queueId={queueId}
      />
      <div
        id="messagesList"
        className={classes.messagesList}
        onScroll={handleScroll}
      >
        {uiReady && (messagesList.length > 0 ?
          renderMessages()
          : [])}
      </div>
      {!uiReady && (
        <div className={classes.messagesList} style={{ position: 'absolute', inset: 0, padding: 20, pointerEvents: 'none' }}>
          <div className={classes.skelBubbleLeft}>
            <div className={classes.skelLine} style={{ width: 220 }} />
            <div className={classes.skelLine} style={{ width: 180 }} />
            <div className={classes.skelLine} style={{ width: 140 }} />
          </div>
          <div className={classes.skelBubbleRight}>
            <div className={classes.skelLine} style={{ width: 200 }} />
            <div className={classes.skelLine} style={{ width: 160 }} />
          </div>
          <div className={classes.skelBubbleLeft}>
            <div className={classes.skelLine} style={{ width: 260 }} />
          </div>
        </div>
      )}

      {(channel !== "whatsapp" && channel !== undefined) && (
        <div
          style={{
            width: "100%",
            display: "flex",
            padding: "10px",
            alignItems: "center",
            backgroundColor: "#E1F3FB",
          }}
        >
          {channel === "facebook" ? (
            <Facebook />
          ) : (
            <Instagram />
          )}

          <span>
            Você tem 24h para responder após receber uma mensagem, de acordo
            com as políticas do Facebook.
          </span>
        </div>
      )}
      {loading && (
        <div>
          <CircularProgress className={classes.circleLoading} />
        </div>
      )}

      <Dialog open={videoDialog.open} onClose={() => setVideoDialog({ open: false, url: null })} maxWidth="md">
        <DialogContent style={{ padding: 0 }}>
          {videoDialog.url && (
            <video src={videoDialog.url} controls style={{ maxWidth: '90vw', maxHeight: '85vh', display: 'block' }} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={pdfDialog.open} onClose={() => setPdfDialog({ open: false, url: null })} maxWidth="lg" fullWidth>
        <DialogContent style={{ padding: 0 }}>
          {pdfDialog.url && (
            <iframe title="PDF" src={pdfDialog.url} style={{ width: '100%', height: '85vh', border: 'none' }} />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de mídia estilo WhatsApp */}
      <MediaModal
        open={mediaModal.open}
        onClose={handleCloseMediaModal}
        mediaUrl={mediaModal.mediaUrl}
        mediaType={mediaModal.mediaType}
        message={mediaModal.message}
        allMedia={getAllMediaFromConversation()}
        contactName={mediaModal.message?.contact?.name || mediaModal.message?.ticket?.contact?.name || ""}
        contactAvatar={mediaModal.message?.contact?.profilePicUrl || mediaModal.message?.ticket?.contact?.profilePicUrl || ""}
        mediaDate={mediaModal.message?.createdAt ? new Date(mediaModal.message.createdAt).toLocaleString('pt-BR') : ""}
      />
    </div>
  );
};

export default MessagesList;
