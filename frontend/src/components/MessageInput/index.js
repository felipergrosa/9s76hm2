import React, { useState, useEffect, useContext, useRef } from "react";
import "emoji-mart/css/emoji-mart.css";
import { Picker } from "emoji-mart";
import { useMediaQuery, useTheme } from '@material-ui/core';
import { isNil } from "lodash";
import {
  CircularProgress,
  ClickAwayListener,
  IconButton,
  InputBase,
  makeStyles,
  Paper,
  Hidden,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
  Fab,
} from "@material-ui/core";
import {
  blue,
  green,
  pink,
  grey,
} from "@material-ui/core/colors";
import whatsBackground from "../../assets/wa-background.png";
import whatsBackgroundDark from "../../assets/wa-background-dark.png";
import {
  Smile,
  Sparkles,
  Plus,
  Image as ImageIcon,
  Camera,
  FileText,
  UserRound,
  X,
  Check,
  Send as SendIcon,
  Mic as MicIcon,
  Reply as ReplyIcon,
  Zap,
  Clock as ClockIcon,
  Video,
  PenLine,
  MessageSquare,
  Braces,
  Paperclip,
  MoreHorizontal,
} from "lucide-react";
import MicRecorder from "mic-recorder-to-mp3";
import clsx from "clsx";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import RecordingTimer from "./RecordingTimer";

import useQuickMessages from "../../hooks/useQuickMessages";
import { isString, isEmpty } from "lodash";
import ContactSendModal from "../ContactSendModal";
import CameraModal from "../CameraModal";
import axios from "axios";
import ButtonModal from "../ButtonModal";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import { ForwardMessageContext } from "../../context/ForwarMessage/ForwardMessageContext";
import MessageUploadMedias from "../MessageUploadMedias";
import { EditMessageContext } from "../../context/EditingMessage/EditingMessageContext";
import ScheduleModal from "../ScheduleModal";
import { useParams } from "react-router-dom/cjs/react-router-dom.min";
import ChatAssistantPanel from "../ChatAssistantPanel";


const Mp3Recorder = new MicRecorder({ bitRate: 128 });

const useStyles = makeStyles((theme) => ({
  mainWrapper: {
    background: "transparent",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    borderTop: "1px solid rgba(0, 0, 0, 0.08)",
    [theme.breakpoints.down("sm")]: {
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      width: "100%",
      borderTop: 'none',
      padding: 0,
      zIndex: 10,
      backgroundColor: theme.mode === 'light' ? 'transparent' : '#0b0b0d',
      backgroundImage: theme.mode === 'light' ? `url(${whatsBackground})` : `url(${whatsBackgroundDark})`,
      backgroundRepeat: 'repeat',
      backgroundSize: '400px auto',
      backgroundPosition: 'center bottom'
    },
  },
  avatar: {
    width: "50px",
    height: "50px",
    borderRadius: "25%",
  },
  dropInfo: {
    background: "#eee",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    padding: 15,
    left: 0,
    right: 0,
  },
  dropInfoOut: {
    display: "none",
  },
  gridFiles: {
    maxHeight: "100%",
    overflow: "scroll",
  },
  newMessageBox: {
    backgroundColor: ((theme.palette.mode || theme.palette.type) === 'light') ? "#ffffff" : "#202c33",
    width: "100%",
    display: "flex",
    padding: "0px 8px",
    alignItems: "center",
    borderRadius: 40,
    border: ((theme.palette.mode || theme.palette.type) === 'light') ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.10)",
    boxShadow: ((theme.palette.mode || theme.palette.type) === 'light')
      ? "0 2px 6px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)"
      : "0 2px 6px rgba(0,0,0,0.50)",
    gap: 4,
    // Altura fixa para eliminar qualquer "salto" visual
    height: 56,
    [theme.breakpoints.down('sm')]: {
      height: 60,
    }
  },
  messageInputWrapper: {
    //padding: 10,
    //marginRight: 7,
    marginBottom: 0,
    
    backgroundImage: ((theme.palette.mode || theme.palette.type) === 'light') ? `url(${whatsBackground})` : `url(${whatsBackgroundDark})`,
    
    display: "flex",
    flexDirection: "column",
    borderRadius: 0,
    //flex: 1,
    position: "relative",
    boxShadow: "none !important",
    border: "none",
    // Container do InputBase: controla a borda e o fundo do campo de digitação
    '& .MuiInputBase-root': {
      backgroundColor: ((theme.palette.mode || theme.palette.type) === 'light') ? '#ffffff' : '#202c33',
      borderRadius: 0,
      // Para deixar sem borda depois, troque a linha abaixo por: 'border: "none"'
      border: ((theme.palette.mode || theme.palette.type) === 'light') ? '0px solid #ffffff' : '0px solid rgba(255,255,255,0.18)',
      // Garante que o input ocupe altura fixa dentro do composer
      height: 40,
      display: 'flex',
      alignItems: 'center'
    },
    // Ajuste específico para o textarea interno do InputBase multiline
    '& .MuiInputBase-multiline': {
      paddingTop: 10,
      paddingBottom: 10,
    },
    '& .MuiInputBase-inputMultiline': {
      padding: 0,
      
      maxHeight: 24,
      overflowY: 'auto',
    },
    '& .MuiInputBase-input': {
      padding: 0,
      fontSize: 14,
      lineHeight: 1.1
    },
    [theme.breakpoints.down('sm')]: {
      width: '100%',
      minWidth: '100%',
      maxWidth: '100%',
      margin: 0,
      padding: 0,
      left: 0,
      right: 0,
      position: 'relative',
      boxShadow: 'none',
    }
  },
  messageInputWrapperPrivate: {
    padding: 0,
    marginRight: 0,
    background: "#F0E68C",
    display: "flex",
    borderRadius: 22,
    flex: 1,
    position: "relative",
  },
  messageInput: {
    paddingLeft: 10,
    flex: 1,
    border: "none",
    

  },
  messageInputPrivate: {
    paddingLeft: 10,
    flex: 1,
    border: "none",
    color: grey[800],

  },
  sendMessageIcons: {
    color: grey[700],
    fontSize: 18,
  },
  // Botão de alternância de assinatura
  signatureToggle: {
    '& svg': {
      color: 'grey'
    }
  },
  signatureActive: {
    backgroundColor: theme.mode === 'light' ? 'rgba(0, 47, 94, 0.12)' : 'rgba(18, 0, 182, 0.22)',
    '& svg': {
      color: theme.palette.primary.main
    }
  },
  ForwardMessageIcons: {
    color: grey[700],
    transform: 'scaleX(-1)'
  },
  uploadInput: {
    display: "none",
  },
  viewMediaInputWrapper: {
    maxHeight: "100%",
    display: "flex",
    padding: "10px 13px",
    position: "relative",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: ((theme.palette.mode || theme.palette.type) === 'light') ? "transparent" : "#202c33",
    backgroundImage: ((theme.palette.mode || theme.palette.type) === 'light') ? `url(${whatsBackground})` : `url(${whatsBackgroundDark})`,
    backgroundRepeat: "repeat",
    backgroundSize: "400px auto",
    backgroundPosition: "center bottom",
    borderTop: "none",
  },
  emojiBox: {
    position: "absolute",
    bottom: 63,
    width: 40,
    borderTop: "1px solid #e8e8e8",
  },
  circleLoading: {
    color: green[500],
    opacity: "70%",
    position: "absolute",
    top: "20%",
    left: "50%",
    marginLeft: -12,
  },
  audioLoading: {
    color: green[500],
    opacity: "70%",
  },
  recorderWrapper: {
    display: "flex",
    alignItems: "center",
    alignContent: "middle",
  },
  waveform: {
    display: "flex",
    alignItems: "flex-end",
    height: 24,
    width: 40,
    marginLeft: 8,
    gap: 3,
  },
  waveformBar: {
    width: 3,
    backgroundColor: green[500],
    opacity: 0.85,
    borderRadius: 2,
    transition: "height 60ms linear",
  },
  cancelAudioIcon: {
    color: "red",
  },
  sendAudioIcon: {
    color: "green",
  },
  replyginMsgWrapper: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 12px",
    backgroundColor: theme.mode === "light" ? "#ffffff" : "#1f2c34",
    borderTop: theme.mode === "light" ? "1px solid #e9edef" : "1px solid #2a3942",
  },
  replyginMsgContainer: {
    flex: 1,
    marginRight: 8,
    overflowY: "hidden",
    backgroundColor: theme.mode === "light" ? "#f0f2f5" : "#1d282f",
    borderRadius: "8px",
    display: "flex",
    position: "relative",
    maxHeight: 66,
    overflow: "hidden",
  },
  replyginMsgBody: {
    padding: "8px 12px",
    height: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    whiteSpace: "pre-wrap",
    overflow: "hidden",
    fontSize: 13,
    color: theme.mode === "light" ? "#667781" : "#8696a0",
    lineHeight: 1.4,
  },
  replyginContactMsgSideColor: {
    flex: "none",
    width: "4px",
    borderRadius: "4px 0 0 4px",
    backgroundColor: "#00a884",
  },
  replyginSelfMsgSideColor: {
    flex: "none",
    width: "4px",
    borderRadius: "4px 0 0 4px",
    backgroundColor: "#53bdeb",
  },
  messageContactName: {
    display: "flex",
    color: "#00a884",
    fontWeight: 600,
    fontSize: 13,
    marginBottom: 2,
  },
  messageQuickAnswersWrapper: {
    margin: 0,
    position: "absolute",
    bottom: "64px",
    background: theme.palette.background.default,
    padding: 0,
    border: "none",
    left: 0,
    width: "100%",
    zIndex: 10,
    // Mobile: lista fixa acima do composer para não sobrepor o input
    [theme.breakpoints.down('sm')]: {
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 72,
      width: '100%',
      maxHeight: '40vh',
      overflowY: 'auto',
      zIndex: 1200,
    },
    "& li": {
      listStyle: "none",
      "& a": {
        display: "block",
        padding: "8px",
        textOverflow: "ellipsis",
        overflow: "hidden",
        maxHeight: "30px",
        "&:hover": {
          background: theme.palette.background.paper,
          cursor: "pointer",
        },
      },
    },
  },
  invertedFabMenu: {
    border: "none",
    borderRadius: 50, // Define o raio da borda para 0 para remover qualquer borda
    boxShadow: "none", // Remove a sombra
    padding: theme.spacing(1),
    backgroundColor: "transparent",
    color: "grey",
    "&:hover": {
      backgroundColor: "transparent",
    },
    "&:disabled": {
      backgroundColor: "transparent !important",
    },
  },
  invertedFabMenuMP: {
    border: "none",
    borderRadius: 0, // Define o raio da borda para 0 para remover qualquer borda
    boxShadow: "none", // Remove a sombra
    width: theme.spacing(4), // Ajuste o tamanho de acordo com suas preferências
    height: theme.spacing(4),
    backgroundColor: "transparent",
    color: blue[800],
    "&:hover": {
      backgroundColor: "transparent",
    },
  },
  invertedFabMenuCont: {
    border: "none",
    borderRadius: 0, // Define o raio da borda para 0 para remover qualquer borda
    boxShadow: "none", // Remove a sombra
    minHeight: "auto",
    width: theme.spacing(4), // Ajuste o tamanho de acordo com suas preferências
    height: theme.spacing(4),
    backgroundColor: "transparent",
    color: blue[500],
    "&:hover": {
      backgroundColor: "transparent",
    },
  },
  invertedFabMenuMeet: {
    border: "none",
    borderRadius: 0, // Define o raio da borda para 0 para remover qualquer borda
    boxShadow: "none", // Remove a sombra
    minHeight: "auto",
    width: theme.spacing(4), // Ajuste o tamanho de acordo com suas preferências
    height: theme.spacing(4),
    backgroundColor: "transparent",
    color: green[500],
    "&:hover": {
      backgroundColor: "transparent",
    },
  },
  invertedFabMenuDoc: {
    border: "none",
    borderRadius: 0, // Define o raio da borda para 0 para remover qualquer borda
    boxShadow: "none", // Remove a sombra
    width: theme.spacing(4), // Ajuste o tamanho de acordo com suas preferências
    height: theme.spacing(4),
    backgroundColor: "transparent",
    color: "#7f66ff",
    "&:hover": {
      backgroundColor: "transparent",
    },
  },
  invertedFabMenuCamera: {
    border: "none",
    borderRadius: 0, // Define o raio da borda para 0 para remover qualquer borda
    boxShadow: "none", // Remove a sombra
    width: theme.spacing(4), // Ajuste o tamanho de acordo com suas preferências
    height: theme.spacing(4),
    backgroundColor: "transparent",
    color: pink[500],
    "&:hover": {
      backgroundColor: "transparent",
    },
  },
  flexContainer: {
    display: "flex",
    flex: 1,
    flexDirection: "column",
  },
  flexItem: {
    flex: 1,
  },
  // Barra de seleção de mensagens (novo estilo WhatsApp)
  selectionBar: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    backgroundColor: theme.mode === "light" ? "#ffffff" : "#1f2c34",
    borderTop: theme.mode === "light" ? "1px solid #e9edef" : "1px solid #2a3942",
  },
  selectionBarLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  selectionBarCount: {
    fontSize: 15,
    color: theme.mode === "light" ? "#3b4a54" : "#e9edef",
    fontWeight: 400,
  },
  selectionBarCloseIcon: {
    color: theme.mode === "light" ? "#54656f" : "#aebac1",
    cursor: "pointer",
    "&:hover": {
      color: theme.mode === "light" ? "#3b4a54" : "#e9edef",
    },
  },
  selectionBarForwardIcon: {
    color: theme.mode === "light" ? "#54656f" : "#aebac1",
    cursor: "pointer",
    transform: "scaleX(-1)",
    "&:hover": {
      color: theme.mode === "light" ? "#3b4a54" : "#e9edef",
    },
  },
}));

const MessageInput = ({ ticketId, ticketStatus, droppedFiles, contactId, ticketChannel, contactData, ticketData }) => {

  const classes = useStyles();
  const theme = useTheme();
  const [mediasUpload, setMediasUpload] = useState([]);
  const isMounted = useRef(true);
  const [buttonModalOpen, setButtonModalOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [quickAnswers, setQuickAnswer] = useState([]);
  const [typeBar, setTypeBar] = useState(false);
  const inputRef = useRef();
  const [onDragEnter, setOnDragEnter] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const { setReplyingMessage, replyingMessage } = useContext(ReplyMessageContext);
  const { setEditingMessage, editingMessage } = useContext(EditMessageContext);
  const { user } = useContext(AuthContext);
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  // Menu de variáveis/Tags
  const [varsAnchorEl, setVarsAnchorEl] = useState(null);

  const [signMessagePar, setSignMessagePar] = useState(false);
  const { get: getSetting } = useCompanySettings();
  const [signMessage, setSignMessage] = useState(true);
  const [privateMessage, setPrivateMessage] = useState(false);
  const [privateMessageInputVisible, setPrivateMessageInputVisible] = useState(false);
  const [senVcardModalOpen, setSenVcardModalOpen] = useState(false);
  const [showModalMedias, setShowModalMedias] = useState(false);

  const { list: listQuickMessages } = useQuickMessages();


  const isMobile = useMediaQuery('(max-width: 767px)'); // Ajuste o valor conforme necessário
  const [placeholderText, setPlaceHolderText] = useState("");

  // Expansor de placeholders: aceita {chave}, {{chave}} e #chave
  const expandPlaceholders = (text) => {
    if (!text || typeof text !== 'string') return text;
    const c = contactData || {};
    const safe = (v) => (v === undefined || v === null ? "" : String(v));
    const fullName = safe(c.name || c.contactName || c.fantasyName);
    const firstName = fullName.split(/\s+/)[0] || "";
    const lastName = fullName.split(/\s+/).slice(1).join(' ') || "";
    const number = safe(c.number);
    const email = safe(c.email);
    const city = safe(c.city);
    const cpfCnpj = safe(c.cpfCnpj);
    const representativeCode = safe(c.representativeCode);
    const segment = safe(c.segment);
    const contactIdStr = safe(c.id);

    // Dados do atendimento/ticket
    const t = ticketData || {};
    const ticketIdStr = safe(t.id || ticketId);
    const ticketUuid = safe(t.uuid);
    const queueName = safe(t.queue?.name || t.queueName);
    const conexao = safe(t.whatsapp?.name || t.connectionName || ticketChannel);
    const protocolo = safe(t.protocol || t.uuid || t.id);

    // Dados do atendente/empresa
    const attendant = safe((user && user.name) || "");
    const companyName = safe(user?.companyName || user?.tenant?.name || "");

    // Datas/horas/saudações
    const now = new Date();
    const pad2 = (n) => String(n).padStart(2, '0');
    const data = `${pad2(now.getDate())}/${pad2(now.getMonth()+1)}/${now.getFullYear()}`;
    const hora = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    const dataHora = `${data} ${hora}`;
    const h = now.getHours();
    const periodoDia = h < 12 ? 'manhã' : (h < 18 ? 'tarde' : 'noite');
    const saudacao = h < 12 ? 'Bom dia' : (h < 18 ? 'Boa tarde' : 'Boa noite');

    const valueMap = {
      // nomes (pt e en)
      'nome': fullName,
      'name': fullName,
      'primeiro_nome': firstName,
      'first_name': firstName,
      'ultimo_nome': lastName,
      'last_name': lastName,
      // telefone/whatsapp
      'numero': number,
      'telefone': number,
      'whatsapp': number,
      'phone': number,
      // email
      'email': email,
      // cidade
      'cidade': city,
      'city': city,
      // documentos/códigos
      'cpf_cnpj': cpfCnpj,
      'cnpj_cpf': cpfCnpj,
      'representante': representativeCode,
      'representative_code': representativeCode,
      'segmento': segment,
      'segment': segment,
      // ids
      'id_contato': contactIdStr,
      'contact_id': contactIdStr,
      // atendimento
      'ticket': ticketIdStr,
      'ticket_id': ticketIdStr,
      'protocolo': protocolo,
      'queue': queueName,
      'fila': queueName,
      'conexao': conexao,
      'connection': conexao,
      'atendente': attendant,
      'agent': attendant,
      // empresa
      'empresa': companyName,
      // data/hora / contexto
      'data': data,
      'hora': hora,
      'data_hora': dataHora,
      'data-hora': dataHora,
      'periodo_dia': periodoDia,
      'periodo-dia': periodoDia,
      'saudacao': saudacao,
    };

    const normalizeKey = (k) =>
      String(k || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}+/gu, '')
        .trim();

    // 1) {chave} e {{chave}} => quando não houver valor, substitui por vazio
    let out = text
      .replace(/\{\{\s*([^}]+?)\s*\}\}|\{\s*([^}]+?)\s*\}/g, (m, k1, k2) => {
        const key = normalizeKey(k1 || k2);
        const val = valueMap[key];
        return val !== undefined ? val : "";
      });

    // 2) #chave (apenas tokens separados por não-letra ou início/fim) => sem valor vira vazio
    out = out.replace(/(^|[^\w\-])#([\w\-]+)/g, (m, prefix, key) => {
      const norm = normalizeKey(key);
      const val = valueMap[norm];
      return prefix + (val !== undefined ? val : "");
    });

    return out;
  };

  // Medidor de áudio (waveform simples)
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [waveBars, setWaveBars] = useState([6, 10, 8, 6]);

  const startAudioMeter = (stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.85;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;
      mediaStreamRef.current = stream;

      const draw = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;
        analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
        // Calcula nível médio de amplitude (RMS aproximado)
        let sum = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          const v = (dataArrayRef.current[i] - 128) / 128; // -1..1
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArrayRef.current.length); // 0..1
        const level = Math.min(1, rms * 3.5); // ganho para visual

        // Gera 4 barras com leve variação
        const bars = 4;
        const maxH = 24;
        const minH = 3;
        const arr = Array.from({ length: bars }, (_, i) => {
          const jitter = 0.85 + Math.random() * 0.3;
          return Math.max(minH, Math.min(maxH, Math.round(level * maxH * jitter * (1 + (i % 3) * 0.05))));
        });
        setWaveBars(arr);
        animationFrameRef.current = requestAnimationFrame(draw);
      };
      draw();
    } catch (e) {
      // silencioso: medidor é apenas visual
    }
  };

  const stopAudioMeter = (stopTracks = false) => {
    try {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (stopTracks && mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
      analyserRef.current = null;
      dataArrayRef.current = null;
      // Reset visual
      setWaveBars([6, 10, 8, 6]);
    } catch (_) { }
  };

  // Determine o texto do placeholder com base no ticketStatus
  useEffect(() => {
    if (ticketStatus === "open" || ticketStatus === "group") {
      setPlaceHolderText(i18n.t("messagesInput.placeholderOpen"));
    } else {
      setPlaceHolderText(i18n.t("messagesInput.placeholderClosed"));
    }

    // Limitar o comprimento do texto do placeholder apenas em ambientes mobile
    const maxLength = isMobile ? 20 : Infinity; // Define o limite apenas em mobile

    if (isMobile && placeholderText.length > maxLength) {
      setPlaceHolderText(placeholderText.substring(0, maxLength) + "...");
    }
  }, [ticketStatus])

  const {
    selectedMessages,
    setForwardMessageModalOpen,
    showSelectMessageCheckbox,
    setShowSelectMessageCheckbox,
    setSelectedMessages } = useContext(ForwardMessageContext);

  useEffect(() => {
    if (droppedFiles && droppedFiles.length > 0) {
      const selectedMedias = Array.from(droppedFiles);
      setMediasUpload(selectedMedias);
      setShowModalMedias(true);
    }
  }, [droppedFiles]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    inputRef.current.focus();
    if (editingMessage) {
      setInputMessage(editingMessage.body);
    }
  }, [replyingMessage, editingMessage]);

  useEffect(() => {
    inputRef.current.focus();
    return () => {
      setInputMessage("");
      setShowEmoji(false);
      setMediasUpload([]);
      setReplyingMessage(null);
      //setSignMessage(true);
      setPrivateMessage(false);
      setPrivateMessageInputVisible(false)
      setEditingMessage(null);
    };
  }, [ticketId, setReplyingMessage, setEditingMessage]);

  // Sinaliza para outras partes da UI (MessagesList) que o composer já foi montado,
  // permitindo rolar para o final após a estabilização do layout
  useEffect(() => {
    const notifyComposerReady = () => {
      try {
        const ev = new Event('composer-ready');
        window.dispatchEvent(ev);
      } catch {}
    };
    // dispara logo após montagem e novamente após um micro-delay
    notifyComposerReady();
    const t = setTimeout(notifyComposerReady, 120);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setTimeout(() => {
      if (isMounted.current)
        setOnDragEnter(false);
    }, 1000);
    // eslint-disable-next-line
  }, [onDragEnter === true]);

  //permitir ativar/desativar firma
  useEffect(() => {
    const fetchSettings = async () => {
      const setting = await getSetting({
        "column": "sendSignMessage"
      });

      if (isMounted.current) {
        if (setting.sendSignMessage === "enabled") {
          setSignMessagePar(true);
          const signMessageStorage = JSON.parse(
            localStorage.getItem("persistentSignMessage")
          );
          if (isNil(signMessageStorage)) {
            setSignMessage(true)
          } else {
            setSignMessage(signMessageStorage);
          }
        } else {
          setSignMessagePar(false);
        }
      }
    };
    fetchSettings();
  }, []);

  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  const handleSendLinkVideo = async () => {
    const link = `https://meet.jit.si/${ticketId}`;
    setInputMessage(link);
  }

  const handleChangeInput = (e) => {
    setInputMessage(e.target.value);
  };

  const handlePrivateMessage = (e) => {
    setPrivateMessage(!privateMessage);
    setPrivateMessageInputVisible(!privateMessageInputVisible);
  };

  const handleButtonModalOpen = () => {
    handleMenuItemClick();
    setButtonModalOpen(true); // Define o estado como true para abrir o modal
  };

  const handleQuickAnswersClick = async (value) => {
    if (value.mediaPath) {
      try {
        const { data } = await axios.get(value.mediaPath, {
          responseType: "blob",
        });

        handleUploadQuickMessageMedia(data, value.value);
        setInputMessage("");
        return;
        //  handleChangeMedias(response)
      } catch (err) {
        toastError(err);
      }
    }

    setInputMessage("");
    setInputMessage(expandPlaceholders(value.value));
    setTypeBar(false);
  };

  // Inserção no cursor atual do input
  const insertAtCursor = (text) => {
    try {
      const input = inputRef.current;
      if (!input) {
        setInputMessage((prev) => (prev || "") + text);
        return;
      }
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      const before = inputMessage.slice(0, start);
      const after = inputMessage.slice(end);
      const next = `${before}${text}${after}`;
      setInputMessage(next);
      setTimeout(() => {
        input.focus();
        const pos = start + text.length;
        input.setSelectionRange(pos, pos);
      }, 0);
    } catch {
      setInputMessage((prev) => (prev || "") + text);
    }
  };

  const handleOpenVarsMenu = (e) => setVarsAnchorEl(e.currentTarget);
  const handleCloseVarsMenu = () => setVarsAnchorEl(null);

  const varTags = [
    { group: 'Contato', items: [
      { label: 'Nome', token: '{nome}' },
      { label: 'Primeiro nome', token: '{primeiro_nome}' },
      { label: 'Último nome', token: '{ultimo_nome}' },
      { label: 'Número/WhatsApp', token: '{numero}' },
      { label: 'Email', token: '{email}' },
      { label: 'Cidade', token: '{cidade}' },
      { label: 'CPF/CNPJ', token: '{cpf_cnpj}' },
      { label: 'Cód. Representante', token: '{representante}' },
      { label: 'Segmento', token: '{segmento}' },
      { label: 'ID Contato', token: '{id_contato}' },
    ]},
    { group: 'Atendimento', items: [
      { label: 'Ticket', token: '{ticket}' },
      { label: 'Protocolo', token: '{protocolo}' },
      { label: 'Fila', token: '{fila}' },
      { label: 'Conexão', token: '{conexao}' },
      { label: 'Atendente', token: '{atendente}' },
    ]},
    { group: 'Empresa', items: [
      { label: 'Empresa', token: '{empresa}' },
    ]},
    { group: 'Data/Hora', items: [
      { label: 'Data', token: '{data}' },
      { label: 'Hora', token: '{hora}' },
      { label: 'Data/Hora', token: '{data_hora}' },
      { label: 'Período do dia', token: '{periodo_dia}' },
      { label: 'Saudação', token: '{saudacao}' },
    ]},
  ];

  const handleAddEmoji = (e) => {
    let emoji = e.native;
    setInputMessage((prevState) => prevState + emoji);
  };

  const [modalCameraOpen, setModalCameraOpen] = useState(false);

  const handleCapture = (imageData) => {
    if (imageData) {
      handleUploadCamera(imageData);
    }
  };

  const handleChangeMedias = (e) => {
    if (!e.target.files) {
      return;
    }
    const selectedMedias = Array.from(e.target.files);
    setMediasUpload(selectedMedias);
    setShowModalMedias(true);
  };

  const handleChangeSign = (e) => {
    getStatusSingMessageLocalstogare();
  };

  const handleOpenModalForward = () => {
    if (selectedMessages.length === 0) {
      setForwardMessageModalOpen(false)
      toastError(i18n.t("messagesList.header.notMessage"));
      return;
    }
    setForwardMessageModalOpen(true);
  }

  const handleCancelMessageSelection = () => {
    setShowSelectMessageCheckbox(false);
    setSelectedMessages([]);
  };

  const getStatusSingMessageLocalstogare = () => {
    const signMessageStorage = JSON.parse(
      localStorage.getItem("persistentSignMessage")
    );
    //si existe uma chave "sendSingMessage"
    if (signMessageStorage !== null) {
      if (signMessageStorage) {
        localStorage.setItem("persistentSignMessage", false);
        setSignMessage(false);
      } else {
        localStorage.setItem("persistentSignMessage", true);
        setSignMessage(true);
      }
    } else {
      localStorage.setItem("persistentSignMessage", false);
      setSignMessage(false);
    }
  };

  const handleInputPaste = (e) => {
    if (e.clipboardData.files[0]) {
      const selectedMedias = Array.from(e.clipboardData.files);
      setMediasUpload(selectedMedias);
      setShowModalMedias(true);
    }
  };

  const handleInputDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) {
      const selectedMedias = Array.from(e.dataTransfer.files);
      setMediasUpload(selectedMedias);
      setShowModalMedias(true);
    }
  };

  const handleUploadMedia = async (mediasUpload) => {
    setLoading(true);
    // e.preventDefault();

    // Certifique-se de que a variável medias esteja preenchida antes de continuar
    if (!mediasUpload.length) {
      console.log("Nenhuma mídia selecionada.");
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("fromMe", true);
    formData.append("isPrivate", privateMessage ? "true" : "false");
    mediasUpload.forEach((media) => {
      formData.append("body", media.caption);
      formData.append("medias", media.file);
    });

    try {
      await api.post(`/messages/${ticketId}`, formData);
    } catch (err) {
      toastError(err);
    }

    setLoading(false);
    setMediasUpload([]);
    setShowModalMedias(false);
    setPrivateMessage(false);
    setPrivateMessageInputVisible(false)
  };

  const handleSendContatcMessage = async (vcard) => {
    setSenVcardModalOpen(false);
    setLoading(true);

    if (isNil(vcard)) {
      setLoading(false);
      return;
    }

    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: null,
      quotedMsg: replyingMessage,
      isPrivate: privateMessage ? "true" : "false",
      vCard: vcard,
    };
    try {
      await api.post(`/messages/${ticketId}`, message);
    } catch (err) {
      toastError(err);
    }

    setInputMessage("");
    setShowEmoji(false);
    setLoading(false);
    setReplyingMessage(null);
    setEditingMessage(null);
    setPrivateMessage(false);
    setPrivateMessageInputVisible(false);
  };

  const handleSendMessage = async () => {

    if (inputMessage.trim() === "") return;
    setLoading(true);

    const userName = privateMessage
      ? `${user.name} - Mensagem Privada`
      : user.name;

    const sendMessage = expandPlaceholders(inputMessage.trim());

    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: (signMessage || privateMessage) && !editingMessage
        ? `*${userName}:*\n${sendMessage}`
        : sendMessage,
      quotedMsg: replyingMessage,
      isPrivate: privateMessage ? "true" : "false",
    };

    try {
      if (editingMessage !== null) {
        await api.post(`/messages/edit/${editingMessage.id}`, message);
      } else {
        await api.post(`/messages/${ticketId}`, message);
      }
    } catch (err) {
      toastError(err);
    }

    setInputMessage("");
    setShowEmoji(false);
    setLoading(false);
    setReplyingMessage(null);
    setPrivateMessage(false);
    setEditingMessage(null);
    setPrivateMessageInputVisible(false)
    handleMenuItemClick();
  };

  const handleStartRecording = async () => {
    setLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      startAudioMeter(stream);
      await Mp3Recorder.start();
      setRecording(true);
      setLoading(false);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const messages = await listQuickMessages({ companyId, userId: user.id });
      const options = messages.map((m) => {
        let truncatedMessage = m.message;
        if (isString(truncatedMessage) && truncatedMessage.length > 90) {
          truncatedMessage = m.message.substring(0, 90) + "...";
        }
        return {
          value: m.message,
          label: `/${m.shortcode} - ${truncatedMessage}`,
          mediaPath: m.mediaPath,
        };
      });
      if (isMounted.current) {

        setQuickAnswer(options);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      isString(inputMessage) &&
      !isEmpty(inputMessage) &&
      inputMessage.length >= 1
    ) {
      const firstWord = inputMessage.charAt(0);

      if (firstWord === "/") {
        setTypeBar(firstWord.indexOf("/") > -1);

        const filteredOptions = quickAnswers.filter(
          (m) => m.label.toLowerCase().indexOf(inputMessage.toLowerCase()) > -1
        );
        setTypeBar(filteredOptions);
      } else {
        setTypeBar(false);
      }
    } else {
      setTypeBar(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMessage]);

  const disableOption = () => {
    return (
      loading ||
      recording ||
      (ticketStatus !== "open" && ticketStatus !== "group")
    );
  };

  const handleUploadCamera = async (blob) => {
    setLoading(true);
    try {
      const formData = new FormData();
      const filename = `${new Date().getTime()}.png`;
      formData.append("medias", blob, filename);
      formData.append("body", privateMessage ? `\u200d` : "");
      formData.append("fromMe", true);

      await api.post(`/messages/${ticketId}`, formData);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
    setLoading(false);
  };

  const handleUploadQuickMessageMedia = async (blob, message) => {
    setLoading(true);
    try {
      const extension = blob.type.split("/")[1];

      const formData = new FormData();
      const filename = `${new Date().getTime()}.${extension}`;
      formData.append("medias", blob, filename);
      formData.append("body", privateMessage ? `\u200d${message}` : message);
      formData.append("fromMe", true);

      if (isMounted.current) {
        await api.post(`/messages/${ticketId}`, formData);
      }
    } catch (err) {
      toastError(err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };


  const handleUploadAudio = async () => {

    setLoading(true);
    try {
      stopAudioMeter(true);
      const [, blob] = await Mp3Recorder.stop().getMp3();
      if (blob.size < 10000) {
        setLoading(false);
        setRecording(false);
        return;
      }

      const formData = new FormData();
      const filename = ticketChannel === "whatsapp" ? `${new Date().getTime()}.mp3` : `${new Date().getTime()}.m4a`;
      formData.append("medias", blob, filename);
      formData.append("body", filename);
      formData.append("fromMe", true);

      if (isMounted.current) {
        await api.post(`/messages/${ticketId}`, formData);
      }
    } catch (err) {
      toastError(err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRecording(false);
      }
    }
  };

  const handleCloseModalMedias = () => {
    setShowModalMedias(false);
  };
  const handleCancelAudio = async () => {
    try {
      stopAudioMeter(true);
      await Mp3Recorder.stop().getMp3();
      setRecording(false);
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuItemClick = (event) => {
    setAnchorEl(null);
  };

  // Permite abrir o menu de anexos a partir do cabeçalho (botão + no topo, mobile)
  useEffect(() => {
    const onOpenAttachmentsMenu = (e) => {
      try {
        const anchorId = e?.detail?.anchorId;
        const el = anchorId ? document.getElementById(anchorId) : null;
        setAnchorEl(el || document.body);
      } catch {}
    };
    window.addEventListener('open-attachments-menu', onOpenAttachmentsMenu);
    return () => window.removeEventListener('open-attachments-menu', onOpenAttachmentsMenu);
  }, []);

  const handleSendContactModalOpen = async () => {
    handleMenuItemClick();
    setSenVcardModalOpen(true);
  };

  const handleCameraModalOpen = async () => {
    handleMenuItemClick();
    setModalCameraOpen(true);
  };

  // Ações específicas do menu no mobile
  const handleOpenAssistantFromMenu = () => {
    handleMenuItemClick();
    setAssistantOpen(prev => !prev);
  };

  const handleOpenScheduleFromMenu = () => {
    handleMenuItemClick();
    setAppointmentModalOpen(true);
  };

  const handleCancelSelection = () => {
    setMediasUpload([]);
    setShowModalMedias(false);
  };

  const renderReplyingMessage = (message) => {
    return (
      <div className={classes.replyginMsgWrapper}>
        <div className={classes.replyginMsgContainer}>
          <span
            className={clsx(classes.replyginContactMsgSideColor, {
              [classes.replyginSelfMsgSideColor]: !message.fromMe,
            })}
          ></span>
          {replyingMessage && (
            <div className={classes.replyginMsgBody}>
              {!message.fromMe && (
                <span className={classes.messageContactName}>
                  {message.contact?.name}
                </span>
              )}
              {message.body}
            </div>
          )
          }
        </div>
        <IconButton
          aria-label="showRecorder"
          component="span"
          disabled={disableOption()}
          onClick={() => {
            setReplyingMessage(null);
            setEditingMessage(null);
            setInputMessage("");
          }}
        >
          <X size={18} className={classes.sendMessageIcons} />
        </IconButton>
      </div>
    );
  };

  if (mediasUpload.length > 0) {
    return (

      <Paper
        elevation={0}
        square
        className={classes.viewMediaInputWrapper}
        onDragEnter={() => setOnDragEnter(true)}
        onDrop={(e) => handleInputDrop(e)}
      >
        {showModalMedias && (
          <MessageUploadMedias
            isOpen={showModalMedias}
            files={mediasUpload}
            onClose={handleCloseModalMedias}
            onSend={handleUploadMedia}
            onCancelSelection={handleCancelSelection}
          />
        )}

      </Paper>
    )
  }
  else {
    return (
      <>
        {assistantOpen && (
          <div style={{ width: '100%' }}>
            <ChatAssistantPanel 
              open={assistantOpen}
              inputMessage={inputMessage}
              setInputMessage={setInputMessage}
              queueId={ticketData?.queue?.id || ticketData?.queueId || null}
              whatsappId={ticketData?.whatsapp?.id || ticketData?.whatsappId || null}
              onClose={() => setAssistantOpen(false)}
            />
          </div>
        )}
        {modalCameraOpen && (
          <CameraModal
            isOpen={modalCameraOpen}
            onRequestClose={() => setModalCameraOpen(false)}
            onCapture={handleCapture}
          />
        )}
        {senVcardModalOpen && (
          <ContactSendModal
            modalOpen={senVcardModalOpen}
            onClose={(c) => {
              handleSendContatcMessage(c);
            }}
          />
        )}
        <Paper
          square
          elevation={0}
          className={classes.messageInputWrapper}
          onDrop={(e) => handleInputDrop(e)}
        >
          {/* Barra de seleção de mensagens (novo estilo WhatsApp) */}
          {showSelectMessageCheckbox && (
            <div className={classes.selectionBar}>
              <div className={classes.selectionBarLeft}>
                <X 
                  size={20} 
                  className={classes.selectionBarCloseIcon} 
                  onClick={handleCancelMessageSelection}
                />
                <span className={classes.selectionBarCount}>
                  {selectedMessages.length} selecionada{selectedMessages.length !== 1 ? 's' : ''}
                </span>
              </div>
              <ReplyIcon 
                size={22} 
                className={classes.selectionBarForwardIcon} 
                onClick={handleOpenModalForward}
              />
            </div>
          )}
          {!showSelectMessageCheckbox && (replyingMessage && renderReplyingMessage(replyingMessage)) || (editingMessage && renderReplyingMessage(editingMessage))}
          <div className={classes.newMessageBox} style={{ display: showSelectMessageCheckbox ? 'none' : 'flex' }}>
            <Hidden only={["sm", "xs"]}>
              <IconButton
                aria-label="emojiPicker"
                component="span"
                disabled={disableOption()}
                onClick={(e) => setShowEmoji((prevState) => !prevState)}
              >
                <Smile size={18} className={classes.sendMessageIcons} />
              </IconButton>
              <Tooltip title="Assistente de Chat">
                <span>
                  <IconButton
                    aria-label="assistant"
                    component="span"
                    disabled={disableOption()}
                    onClick={() => {
                      console.log('Clicou no assistente, alterando estado para:', !assistantOpen);
                      setAssistantOpen(prev => !prev);
                    }}
                  >
                    <Sparkles size={18} className={classes.sendMessageIcons} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={i18n.t("tickets.buttons.scredule")}>
                <IconButton
                  aria-label="scheduleMessage"
                  component="span"
                  onClick={() => setAppointmentModalOpen(true)}
                  disabled={loading}
                >
                  <ClockIcon size={18} className={classes.sendMessageIcons} />
                </IconButton>
              </Tooltip>
              {showEmoji ? (
                <div className={classes.emojiBox}>
                  <ClickAwayListener onClickAway={(e) => setShowEmoji(true)}>
                    <Picker
                      perLine={16}
                      theme={"dark"}
                      i18n={i18n}
                      showPreview={true}
                      showSkinTones={false}
                      onSelect={handleAddEmoji}
                    />
                  </ClickAwayListener>
                </div>
              ) : null}

              <Fab
                disabled={disableOption()}
                aria-label="uploadMedias"
                component="span"
                className={classes.invertedFabMenu}
                onClick={handleOpenMenuClick}
              >
                <Plus size={18} />
              </Fab>
              
              {/* <IconButton
				  aria-label="upload"
				  component="span"
				  disabled={disableOption()}
				  onMouseOver={() => setOnDragEnter(true)}
				>
				  <AttachFile className={classes.sendMessageIcons} />
				</IconButton> */}

              {/* </label> */}
              {signMessagePar && (
                <Tooltip title={i18n.t("messageInput.tooltip.signature")}>
                  <IconButton
                    className={clsx(classes.signatureToggle, { [classes.signatureActive]: signMessage })}
                    aria-label="send-upload"
                    component="span"
                    onClick={handleChangeSign}
                  >
                    {signMessage === true ? (
                    <PenLine size={18} style={{ color: theme.mode === "light" ? theme.palette.primary.main : "#EEE" }} />
                  ) : (
                    <PenLine size={18} style={{ color: "grey" }} />
                  )}
                  </IconButton>
                </Tooltip>
            )}
            </Hidden>
            {/* Botão + para mobile */}
            <Hidden only={["md", "lg", "xl"]}>
              <IconButton
                aria-label="uploadMediasMobile"
                component="span"
                disabled={disableOption()}
                onClick={handleOpenMenuClick}
                style={{ padding: 8 }}
              >
                <Plus size={18} className={classes.sendMessageIcons} />
              </IconButton>
            </Hidden>
            {/* Menu de anexos (disponível em todos os tamanhos) */}
            <Menu
              anchorEl={anchorEl}
              keepMounted
              open={Boolean(anchorEl)}
              onClose={handleMenuItemClick}
              id="simple-menu"
              anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              style={{ zIndex: 1600 }}
            >
              {/* Itens mobile movidos para o final do menu, abaixo de "Botões" */}
              <MenuItem onClick={handleMenuItemClick}>
                <input
                  multiple
                  type="file"
                  id="upload-img-button"
                  accept="image/*, video/*, audio/* "
                  className={classes.uploadInput}
                  onChange={handleChangeMedias}
                />
                <label htmlFor="upload-img-button">
                  <Fab
                    aria-label="upload-img"
                    component="span"
                    className={classes.invertedFabMenuMP}
                  >
                    <ImageIcon size={18} />
                  </Fab>
                  {i18n.t("messageInput.type.imageVideo")}
                </label>
              </MenuItem>
              <MenuItem onClick={handleCameraModalOpen}>
                <Fab className={classes.invertedFabMenuCamera}>
                  <Camera size={18} />
                </Fab>
                {i18n.t("messageInput.type.cam")}
              </MenuItem>
              <MenuItem onClick={handleMenuItemClick}>
                <input
                  multiple
                  type="file"
                  id="upload-doc-button"
                  accept="application/*, text/*"
                  className={classes.uploadInput}
                  onChange={handleChangeMedias}
                />
                <label htmlFor="upload-doc-button">
                  <Fab aria-label="upload-img"
                    component="span" className={classes.invertedFabMenuDoc}>
                    <FileText size={18} />
                  </Fab>
                  Documento
                </label>
              </MenuItem>
              <MenuItem onClick={handleSendContactModalOpen}>
                <Fab className={classes.invertedFabMenuCont}>
                  <UserRound size={18} />
                </Fab>
                {i18n.t("messageInput.type.contact")}
              </MenuItem>
              <MenuItem onClick={handleSendLinkVideo}>
                <Fab className={classes.invertedFabMenuMeet}>
                  <Video size={18} />
                </Fab>
                {i18n.t("messageInput.type.meet")}
              </MenuItem>
              {buttonModalOpen && (
                <ButtonModal
                  modalOpen={buttonModalOpen}
                  onClose={() => setButtonModalOpen(false)}
                  ticketId={ticketId}
                />
              )}
              <MenuItem onClick={handleButtonModalOpen}>
                <Fab className={classes.invertedFabMenuCont}>
                  <MoreHorizontal size={18} />
                </Fab>
                Botões
              </MenuItem>
              {isMobile && (
                <>
                  <Divider />
                  <MenuItem onClick={handleOpenAssistantFromMenu}>
                    <Fab className={classes.invertedFabMenuCont}>
                      <Sparkles size={18} />
                    </Fab>
                    Assistente de Chat
                  </MenuItem>
                  <MenuItem onClick={handleOpenScheduleFromMenu}>
                    <Fab className={classes.invertedFabMenuCont}>
                      <ClockIcon size={16} />
                    </Fab>
                    {i18n.t('tickets.buttons.scredule')}
                  </MenuItem>
                </>
              )}
            </Menu>
            <div className={classes.flexContainer}>
              {privateMessageInputVisible && (
                <div className={classes.flexItem}>
                  <div className={classes.messageInputWrapperPrivate}>
                    <InputBase
                      inputRef={(input) => {
                        input && input.focus();
                        input && (inputRef.current = input);
                      }}
                      className={classes.messageInputPrivate}
                      placeholder={
                        ticketStatus === "open" || ticketStatus === "group"
                          ? i18n.t("messagesInput.placeholderPrivateMessage")
                          : i18n.t("messagesInput.placeholderClosed")
                      }
                      multiline
                      rowsMin={1}
                      maxRows={isMobile ? 3 : 5}
                      value={inputMessage}
                      onChange={handleChangeInput}
                      disabled={disableOption()}
                      onPaste={(e) => {
                        (ticketStatus === "open" || ticketStatus === "group") &&
                          handleInputPaste(e);
                      }}
                      onKeyPress={(e) => {
                        if (loading || e.shiftKey) return;
                        else if (e.key === "Enter") {
                          handleSendMessage();
                        }
                      }}

                    />
                    {typeBar ? (
                      <ul className={classes.messageQuickAnswersWrapper}>
                        {typeBar.map((value, index) => {
                          return (
                            <li
                              className={classes.messageQuickAnswersWrapperItem}
                              key={index}
                            >
                              {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                              <a onClick={() => handleQuickAnswersClick(value)}>
                                {`${value.label} - ${value.value}`}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div></div>
                    )}
                  </div>
                </div>
              )}
              {!privateMessageInputVisible && (
                <div className={classes.flexItem}>
                  <div className={classes.messageInputWrapper}>
                    <InputBase
                      inputRef={(input) => {
                        input && input.focus();
                        input && (inputRef.current = input);
                      }}
                      className={classes.messageInput}
                      placeholder={placeholderText}
                      multiline
                      rowsMin={1}
                      maxRows={isMobile ? 3 : 5}
                      value={inputMessage}
                      onChange={handleChangeInput}
                      disabled={disableOption()}
                      onPaste={(e) => {
                        (ticketStatus === "open" || ticketStatus === "group") &&
                          handleInputPaste(e);
                      }}
                      onKeyPress={(e) => {
                        if (loading || e.shiftKey) return;
                        else if (e.key === "Enter") {
                          handleSendMessage();
                        }
                      }}
                    />
                    {typeBar ? (
                      <ul className={classes.messageQuickAnswersWrapper}>
                        {typeBar.map((value, index) => {
                          return (
                            <li
                              className={classes.messageQuickAnswersWrapperItem}
                              key={index}
                            >
                              {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                              <a onClick={() => handleQuickAnswersClick(value)}>
                                {`${value.label} - ${value.value}`}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div></div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {!privateMessageInputVisible && (
              <>
                <Tooltip title="Variáveis">
                  <IconButton
                    aria-label="variables"
                    component="span"
                    onClick={handleOpenVarsMenu}
                  >
                    <Braces size={18} className={classes.sendMessageIcons} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Mensagem rápida">
                  <IconButton
                    aria-label="flash"
                    component="span"
                    onClick={() => setInputMessage('/')}
                  >
                    <Zap size={18} className={classes.sendMessageIcons} />
                  </IconButton>
                </Tooltip>
                <Menu
                  anchorEl={varsAnchorEl}
                  keepMounted
                  open={Boolean(varsAnchorEl)}
                  onClose={handleCloseVarsMenu}
                  id="vars-menu"
                  anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                  transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                  style={{ zIndex: 1700, maxHeight: 360 }}
                >
                  {varTags.map((grp, gi) => (
                    <div key={`grp-${gi}`}>
                      <MenuItem disabled style={{ opacity: 0.7, fontWeight: 600 }}>{grp.group}</MenuItem>
                      {grp.items.map((it, ii) => (
                        <MenuItem key={`it-${gi}-${ii}`} onClick={() => { insertAtCursor(it.token); handleCloseVarsMenu(); }}>
                          {it.label} <span style={{ opacity: 0.6, marginLeft: 6 }}>{it.token}</span>
                        </MenuItem>
                      ))}
                      {gi < varTags.length - 1 && <Divider />}
                    </div>
                  ))}
                </Menu>
                {inputMessage || showSelectMessageCheckbox ? (
                  <>
                    <IconButton
                      aria-label="sendMessage"
                      component="span"
                      onClick={showSelectMessageCheckbox ? handleOpenModalForward : handleSendMessage}
                      disabled={loading}
                    >
                      {showSelectMessageCheckbox ?
                        <ReplyIcon size={18} className={classes.ForwardMessageIcons} /> : <SendIcon size={18} className={classes.sendMessageIcons} />}
                    </IconButton>
                  </>
                ) : recording ? (
                  <div className={classes.recorderWrapper}>
                    <IconButton
                      aria-label="cancelRecording"
                      component="span"
                      fontSize="large"
                      disabled={loading}
                      onClick={handleCancelAudio}
                    >
                      <X size={18} className={classes.cancelAudioIcon} />
                    </IconButton>
                    {loading ? (
                      <div>
                        <CircularProgress className={classes.audioLoading} />
                      </div>
                    ) : (
                      <RecordingTimer />
                    )}

                    {/* Waveform live */}
                    <div className={classes.waveform} aria-label="audio-waveform">
                      {waveBars.map((h, idx) => (
                        <div key={idx} className={classes.waveformBar} style={{ height: `${h}px` }} />
                      ))}
                    </div>

                    <IconButton
                      aria-label="sendRecordedAudio"
                      component="span"
                      onClick={handleUploadAudio}
                      disabled={loading}
                    >
                      <Check size={18} className={classes.sendAudioIcon} />
                    </IconButton>
                  </div>
                ) : (
                  <IconButton
                    aria-label="showRecorder"
                    component="span"
                    disabled={disableOption()}
                    onClick={handleStartRecording}
                  >
                    <MicIcon size={18} className={classes.sendMessageIcons} />
                  </IconButton>
                )}
              </>
            )}

            {privateMessageInputVisible && (
              <>
                <IconButton
                  aria-label="sendMessage"
                  component="span"
                  onClick={showSelectMessageCheckbox ? handleOpenModalForward : handleSendMessage}
                  disabled={loading}
                >
                  {showSelectMessageCheckbox ?
                    <ReplyIcon size={18} className={classes.ForwardMessageIcons} /> : <SendIcon size={18} className={classes.sendMessageIcons} />}
                </IconButton>
              </>
            )}
            {appointmentModalOpen && (
              <ScheduleModal
                open={appointmentModalOpen}
                onClose={() => setAppointmentModalOpen(false)}
                ticketId={ticketId}
              />
            )}
          </div>
        </Paper>
      </>
    );
  }
};

export default MessageInput;

