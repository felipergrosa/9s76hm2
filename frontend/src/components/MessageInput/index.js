import React, { useState, useEffect, useContext, useRef, lazy, Suspense } from "react";
import { useMediaQuery, useTheme } from '@material-ui/core';
import { isNil } from "lodash";
import {
  CircularProgress,
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
  LinearProgress,
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
  SpellCheck2,
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
// OTIMIZAÇÃO: Lazy loading de modais pesados para evitar 24s de travamento
const ContactSendModal = lazy(() => import("../ContactSendModal"));
const CameraModal = lazy(() => import("../CameraModal"));
const ButtonModal = lazy(() => import("../ButtonModal"));
const MessageUploadMedias = lazy(() => import("../MessageUploadMedias"));
const ScheduleModal = lazy(() => import("../ScheduleModal"));
const ChatAssistantPanel = lazy(() => import("../ChatAssistantPanel"));
const WhatsAppPopover = lazy(() => import("../WhatsAppPopover"));
import axios from "axios";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import { ForwardMessageContext } from "../../context/ForwarMessage/ForwardMessageContext";
import { EditMessageContext } from "../../context/EditingMessage/EditingMessageContext";
import { OptimisticMessageContext } from "../../context/OptimisticMessage/OptimisticMessageContext";
import { useParams } from "react-router-dom/cjs/react-router-dom.min";
// OTIMIZAÇÃO: ACCENT_MAP básico inline para correções imediatas (não carrega chunk de 22s)
const ACCENT_MAP_BASIC = {
  'nao': 'não', 'sim': 'sim', 'esta': 'está', 'tambem': 'também', 'ja': 'já',
  'voce': 'você', 'voces': 'vocês', 'nos': 'nós', 'sao': 'são', 'entao': 'então',
  'ate': 'até', 'apos': 'após', 'so': 'só', 'mae': 'mãe', 'mes': 'mês',
  'pais': 'país', 'numero': 'número', 'informacao': 'informação', 'solucao': 'solução',
  'duvida': 'dúvida', 'endereco': 'endereço', 'servico': 'serviço', 'preco': 'preço',
  'proximo': 'próximo', 'ultimo': 'último', 'necessario': 'necessário', 'possivel': 'possível',
  'amanha': 'amanhã', 'ola': 'olá', 'vc': 'você', 'vcs': 'vocês', 'pq': 'porque',
  'tb': 'também', 'tbm': 'também', 'td': 'tudo', 'hj': 'hoje', 'msg': 'mensagem',
  'msn': 'mensagem', 'qdo': 'quando', 'qnd': 'quando', 'oq': 'o que', 'oque': 'o que',
  'pra': 'para', 'pro': 'para o', 'ta': 'está', 'tao': 'tão', 'to': 'estou', 'tou': 'estou',
  'minimo': 'mínimo', 'maximo': 'máximo', 'atencao': 'atenção', 'agencia': 'agência',
  'usuario': 'usuário', 'usuarios': 'usuários', 'funcao': 'função', 'opcao': 'opção',
  'configuracao': 'configuração', 'aplicacao': 'aplicação', 'versao': 'versão',
  'licenca': 'licença', 'renovacao': 'renovação', 'atualizacao': 'atualização',
  'correcao': 'correção', 'manutencao': 'manutenção', 'documentacao': 'documentação',
  'orcamento': 'orçamento', 'vencimento': 'vencimento', 'urgente': 'urgente',
  'prioridade': 'prioridade', 'importancia': 'importância', 'referencia': 'referência',
  'diferenca': 'diferença', 'sequencia': 'sequência', 'frequencia': 'frequência',
  'consequencia': 'consequência', 'presenca': 'presença', 'ausencia': 'ausência',
  'experiencia': 'experiência', 'ciencia': 'ciência', 'excelencia': 'excelência',
  'potencia': 'potência', 'transparencia': 'transparência', 'eficiencia': 'eficiência',
  'coerencia': 'coerência', 'admissao': 'admissão', 'comissao': 'comissão',
  'demissao': 'demissão', 'discussao': 'discussão', 'expressao': 'expressão',
  'impressao': 'impressão', 'profissao': 'profissão', 'permissao': 'permissão',
  'transmissao': 'transmissão', 'conexao': 'conexão', 'direcao': 'direção',
  'eleicao': 'eleição', 'selecao': 'seleção', 'infeccao': 'infecção',
  'construcao': 'construção', 'producao': 'produção', 'reducao': 'redução',
  'introducao': 'introdução', 'educacao': 'educação', 'traducao': 'tradução',
  'formacao': 'formação', 'transformacao': 'transformação', 'comunicacao': 'comunicação',
  'apresentacao': 'apresentação', 'operacao': 'operação', 'transacao': 'transação',
  'condicao': 'condição', 'solicitacao': 'solicitação', 'autorizacao': 'autorização',
  'avaliacao': 'avaliação', 'relacao': 'relação', 'organizacao': 'organização',
  'negocio': 'negócio', 'proposito': 'propósito', 'publico': 'público',
  'politica': 'política', 'logistica': 'logística', 'comunicacao': 'comunicação',
};

// Auto-correção básica inline (instantânea, sem carregar chunk)
const autoCorrectTextBasic = (text) => {
  if (!text) return text;
  const words = text.split(/(\s+)/);
  return words.map(word => {
    if (/^\s+$/.test(word)) return word;
    const lower = word.toLowerCase();
    const cleanWord = lower.replace(/[.,!?;:]+$/, '');
    const punctuation = lower.slice(cleanWord.length);
    if (ACCENT_MAP_BASIC[cleanWord]) {
      let correction = ACCENT_MAP_BASIC[cleanWord];
      if (word[0] === word[0].toUpperCase()) {
        correction = correction.charAt(0).toUpperCase() + correction.slice(1);
      }
      return correction + punctuation;
    }
    return word;
  }).join('');
};

// SpellChecker completo carregado sob demanda
let spellCheckerModule = null;
const loadSpellChecker = async () => {
  if (!spellCheckerModule) {
    const module = await import("../../hooks/useSpellChecker");
    spellCheckerModule = module;
  }
  return spellCheckerModule;
};

import SpellCheckSuggestions from "./SpellCheckSuggestions";
import FormatToolbar from "./FormatToolbar";
import useTextSelection from "../../hooks/useTextSelection";
import { expandPlaceholders } from "../../utils/expandPlaceholders";


const Mp3Recorder = new MicRecorder({ bitRate: 128 });

const useStyles = makeStyles((theme) => ({
  mainWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    borderTop: "none",
    padding: "8px 12px",
    backgroundImage: ((theme.palette.mode || theme.palette.type) === 'light') 
      ? `url(${whatsBackground})` 
      : `url(${whatsBackgroundDark})`,
    backgroundRepeat: 'repeat',
    backgroundSize: '400px auto',
    backgroundPosition: 'center',
    [theme.breakpoints.down("sm")]: {
      position: "relative",
      width: "100%",
      maxWidth: "100vw",
      borderTop: 'none',
      padding: '6px 8px',
      zIndex: 10,
      boxSizing: 'border-box',
      overflowX: 'hidden',
      flexShrink: 0,
      alignItems: 'stretch',
    },
  },
  avatar: {
    width: "50px",
    height: "50px",
    borderRadius: "25%",
  },
  attachBox: {
    position: "absolute",
    top: 0,
    left: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: "100%",
    cursor: "pointer",
    color: "#000000",
    fontSize: 20,
    fontWeight: "bold",
  },
  emojiBox: {
    position: "absolute",
    top: 0,
    right: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: "100%",
    cursor: "pointer",
    color: "#000000",
    fontSize: 28,
    fontWeight: "bold",
  },
  gridFiles: {
    maxHeight: "100%",
    overflow: "scroll",
  },
  newMessageBox: {
    backgroundColor: ((theme.palette.mode || theme.palette.type) === 'light') ? "#ffffff" : "#202c33",
    width: "100%",
    maxWidth: "100%",
    display: "flex",
    padding: "2px 4px",
    alignItems: "center",
    borderRadius: 32, // 20% a mais arredondado
    border: "none",
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    gap: 5, // Mais 30% menor
    minHeight: 10,
    maxHeight: 'none',
    boxSizing: 'border-box',
    [theme.breakpoints.down('sm')]: {
      minHeight: 10,
      maxHeight: 'none',
      width: '100%',
      maxWidth: '100vw',
      boxSizing: 'border-box',
      padding: '2px 4px',
      gap: 2, // Mais 30% menor
      borderRadius: 24,
    }
    ,
    '& .MuiFab-root': {
      
    },
    '& .MuiIconButton-root': {
      padding: 5,
      
    }
  },
  messageInputWrapper: {
    marginBottom: 0,
    backgroundColor: "transparent",
    backgroundImage: "none",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    borderRadius: 0,
    position: "relative",
    boxShadow: "none !important",
    border: "none",
    width: "100%",
    flex: 1,
    '& .MuiInputBase-root': {
      backgroundColor: "transparent",
      borderRadius: 0,
      border: "none",
      minHeight: 14,
      maxHeight: 'none',
      display: 'flex',
      alignItems: 'center',
      paddingTop: 0,
      paddingBottom: 0,
      flex: 1,
      width: '100%',
      color: ((theme.palette.mode || theme.palette.type) === 'light') ? "#111b21" : "#e9edef",
    },
    '& .MuiInputBase-multiline': {
      paddingTop: 2, // Mínimo para não cortar letras
      paddingBottom: 2,
      height: 'auto',
    },
    '& .MuiInputBase-inputMultiline': {
      padding: 0,
      maxHeight: 'none',
      overflowY: 'auto',
      lineHeight: 1.3,
      fontSize: 14,
      color: ((theme.palette.mode || theme.palette.type) === 'light') ? "#111b21" : "#e9edef",
    },
    '& .MuiInputBase-input': {
      padding: 0,
      fontSize: 14,
      lineHeight: 1.4,
      color: ((theme.palette.mode || theme.palette.type) === 'light') ? "#111b21" : "#e9edef",
      '&::placeholder': {
        color: ((theme.palette.mode || theme.palette.type) === 'light') ? "#8696a0" : "#667781",
        opacity: 1,
      },
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
      '& .MuiInputBase-root': {
        maxHeight: 'none',
        alignItems: 'flex-start',
        width: '100%',
      },
      '& .MuiInputBase-inputMultiline': {
        maxHeight: 'none',
        fontSize: 14,
      },
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
    position: 'relative',
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  // Overlay para sublinhado - deve ter mesmos valores do input
  spellCheckOverlay: {
    position: 'absolute',
    top: 8,
    left: 10,
    right: 0,
    bottom: 8,
    pointerEvents: 'none',
    zIndex: 10,
    padding: 0,
    fontSize: 14,
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    overflow: 'visible',
    userSelect: 'none',
    maxHeight: 100,
  },
  misspelledWord: {
    color: 'rgba(0,0,0,0.01)',
    position: 'relative',
    display: 'inline-block',
    pointerEvents: 'auto',
    cursor: 'pointer',
    textDecoration: 'underline wavy #ff0000',
    textDecorationThickness: '1px',
    textUnderlineOffset: '1px',
  },
  grammarError: {
    color: 'rgba(0, 0, 0, 0)',
    position: 'relative',
    display: 'inline-block',
    pointerEvents: 'auto',
    cursor: 'pointer',
    textDecoration: 'underline wavy #0066cc',
    textDecorationThickness: '1px',
    textUnderlineOffset: '1px',
  },
  normalWord: {
    color: 'rgba(0,0,0,0.01)',
  },
  spellContextMenu: {
    position: 'fixed',
    backgroundColor: '#fff',
    border: '1px solid #ccc',
    borderRadius: 4,
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
    zIndex: 9999,
    minWidth: 150,
    maxWidth: 250,
    '& ul': {
      listStyle: 'none',
      margin: 0,
      padding: 0,
    },
    '& li': {
      padding: '8px 12px',
      cursor: 'pointer',
      fontSize: 14,
      '&:hover': {
        backgroundColor: '#f0f0f0',
      },
    },
    '& li.suggestion': {
      color: '#1976d2',
      fontWeight: 500,
    },
    '& li.divider': {
      borderTop: '1px solid #eee',
      padding: 0,
      margin: '4px 0',
    },
  },
  messageInputPrivate: {
    paddingLeft: 10,
    flex: 1,
    border: "none",
    color: grey[800],

  },
  sendMessageIcons: {
    color: "#000000",
    fontSize: 28,
    fontWeight: "bold",
  },
  sendMessageIconsActive: {
    color: "#ffffff", // Ícone branco
    fontSize: 28,
    fontWeight: "bold",
  },
  sendButtonActive: {
    backgroundColor: "#00a884", // Fundo verde circular
    borderRadius: "50%",
    width: 42,
    height: 42,
    padding: 8,
    "&:hover": {
      backgroundColor: "#008c6f", // Verde mais escuro no hover
    },
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
    color: "#000000",
    fontSize: 28,
    fontWeight: "bold",
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
    backgroundColor: "transparent", // Fundo transparente
    backgroundImage: "none", // Remove imagem de fundo
    borderTop: "none",
  },
  emojiBox: {
    position: "absolute",
    bottom: 63,
    width: 40,
    borderTop: "1px solid #e8e8e8",
    color: grey[700],
    fontSize: 24,
    fontWeight: "bold",
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
  uploadProgressContainer: {
    position: "absolute",
    top: -3, // Colada no topo do input
    left: 0,
    right: 0,
    zIndex: 1,
  },
  uploadProgressBar: {
    height: 3, // Barra fina de 3px
    borderRadius: 0,
    backgroundColor: "transparent", // Sem fundo
    boxShadow: "none",
    "& .MuiLinearProgress-bar": {
      borderRadius: "2px 2px 0 0",
      backgroundColor: theme.palette.primary.main, // Cor primária do tema
      transition: "transform 0.2s ease",
    },
    "&.MuiLinearProgress-root": {
      backgroundColor: "rgba(0,0,0,0.05)", // Fundo quase transparente
    },
  },
  uploadProgressText: {
    fontSize: 12,
    fontWeight: 600,
    color: "#666",
    minWidth: 40,
    textAlign: "right",
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
    padding: '4px !important',
    width: '42px !important',
    height: '42px !important',
    minHeight: '42px !important',
    backgroundColor: "transparent",
    color: "black",
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
    width: '32px !important',
    height: '32px !important',
    minHeight: '32px !important',
    padding: '4px !important',
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
    minHeight: '32px !important',
    width: '32px !important', // Ajuste o tamanho de acordo com suas preferências
    height: '32px !important',
    padding: '4px !important',
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
    minHeight: '32px !important',
    width: '32px !important', // Ajuste o tamanho de acordo com suas preferências
    height: '32px !important',
    padding: '4px !important',
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
    width: '32px !important', // Ajuste o tamanho de acordo com suas preferências
    height: '32px !important',
    minHeight: '32px !important',
    padding: '4px !important',
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
    width: '32px !important', // Ajuste o tamanho de acordo com suas preferências
    height: '32px !important',
    minHeight: '32px !important',
    padding: '4px !important',
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
    width: "100%",
    minWidth: 0,
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

const MessageInput = ({ 
  ticketId, 
  ticketStatus, 
  droppedFiles, 
  contactId, 
  ticketChannel, 
  contactData, 
  ticketData,
  quickMessagesOpen,
  onToggleQuickMessages
}) => {

  const classes = useStyles();
  const theme = useTheme();
  const [mediasUpload, setMediasUpload] = useState([]);
  const isMounted = useRef(true);
  const [buttonModalOpen, setButtonModalOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false); // true apenas para upload de arquivos
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recording, setRecording] = useState(false);
  const [quickAnswers, setQuickAnswer] = useState([]);
  const [typeBar, setTypeBar] = useState(false);
  const inputRef = useRef();
  const uploadInputRef = useRef();
  const uploadDocRef = useRef();
  const [onDragEnter, setOnDragEnter] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const { setReplyingMessage, replyingMessage } = useContext(ReplyMessageContext);
  const { setEditingMessage, editingMessage } = useContext(EditMessageContext);
  const { addOptimisticMessage, confirmOptimisticMessage, failOptimisticMessage } = useContext(OptimisticMessageContext);
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

  // Corretor ortográfico (AUTO-CORREÇÃO INSTANTÂNEA + módulo completo sob demanda)
  const [spellCheckEnabled, setSpellCheckEnabled] = useState(() => {
    const saved = localStorage.getItem('spellCheckEnabled');
    return saved !== null ? JSON.parse(saved) : true; // HABILITADO por padrão
  });
  const [spellCheckLoaded, setSpellCheckLoaded] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [currentWord, setCurrentWord] = useState('');
  const [isFullDictLoaded, setIsFullDictLoaded] = useState(false);
  
  // Carregar módulo completo sob demanda (quando usuário precisa de sugestões avançadas)
  useEffect(() => {
    if (spellCheckEnabled && !spellCheckLoaded) {
      loadSpellChecker().then(module => {
        setSpellCheckLoaded(true);
      });
    }
  }, [spellCheckEnabled, spellCheckLoaded]);
  
  // Hook dummy para compatibilidade (valores vazios, auto-correção já funciona inline)
  const analyzeText = () => {};
  const replaceWord = (text, suggestion, word) => text.replace(word, suggestion);
  const checkGrammar = async () => [];
  const [showSpellSuggestions, setShowSpellSuggestions] = useState(false);
  const [inputCursorPosition, setInputCursorPosition] = useState(0);
  // Lista de palavras erradas para sublinhado vermelho (ortografia)
  const [misspelledWords, setMisspelledWords] = useState([]);
  // Lista de erros gramaticais do LanguageTool
  const [grammarErrors, setGrammarErrors] = useState([]);
  // Menu de contexto (right-click) para sugestões
  const [contextMenu, setContextMenu] = useState(null); // { x, y, word, suggestions, message, type }

  // Hook para gerenciar seleção de texto
  const { selection, updateSelection, clearSelection } = useTextSelection(inputRef);

  // Estado para a toolbar de formatação
  const [formatToolbar, setFormatToolbar] = useState({
    visible: false,
    position: { x: 0, y: 0 }
  });

  // Debounce para análise ortográfica pesada
  const spellCheckTimeoutRef = useRef(null);

  const { list: listQuickMessages } = useQuickMessages();


  const isMobile = useMediaQuery('(max-width: 767px)'); // Ajuste o valor conforme necessário
  const [placeholderText, setPlaceHolderText] = useState("");

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
      } catch { }
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
      try {
        const setting = await getSetting({
          "column": "sendSignMessage"
        });

        if (isMounted.current && setting && typeof setting === 'object') {
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
      } catch (err) {
        console.error("Erro ao buscar configurações em MessageInput:", err);
      }
    };
    fetchSettings();
  }, []);

  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  const handleApplySpellSuggestion = (suggestion) => {
    const newText = replaceWord(inputMessage, suggestion, currentWord);
    setInputMessage(newText);
    setShowSpellSuggestions(false);
    
    // Focar no input após aplicar correção
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
  };

  const handleToggleSpellCheck = () => {
    const newValue = !spellCheckEnabled;
    setSpellCheckEnabled(newValue);
    localStorage.setItem('spellCheckEnabled', JSON.stringify(newValue));
    if (!newValue) {
      setShowSpellSuggestions(false);
    }
  };

  const handleSendLinkVideo = async () => {
    const link = `https://meet.jit.si/${ticketId}`;
    setInputMessage(link);
  };

  const handleChangeInput = (e) => {
    let value = e.target.value;
    let cursorPos = e.target.selectionStart;
    
    // Auto-correção de acentuação ao digitar espaço/pontuação
    const lastChar = value.slice(-1);
    const triggerChars = [' ', '.', ',', ';', ':', '!', '?', '\n'];
    
    if (spellCheckEnabled && value.length > 1 && triggerChars.includes(lastChar)) {
      const originalLength = value.length;
      const correctedText = autoCorrectTextBasic(value);
      if (correctedText !== value) {
        value = correctedText;
        cursorPos = cursorPos + (correctedText.length - originalLength);
      }
    }
    
    setInputMessage(value);
    setInputCursorPosition(cursorPos);
    
    // Verificação ortográfica/gramatical apenas via LanguageTool (API)
    if (spellCheckEnabled) {
      // debounce feito via useEffect
      setMisspelledWords([]); // Desabilitado: corretor local estava com dicionário corrompido
    } else {
      setMisspelledWords([]);
      setGrammarErrors([]);
    }
  };

  // Debounce da chamada analyzeText (ortografia via LanguageTool)
  useEffect(() => {
    if (!spellCheckEnabled || !inputMessage) {
      if (spellCheckTimeoutRef.current) {
        clearTimeout(spellCheckTimeoutRef.current);
      }
      return;
    }

    if (spellCheckTimeoutRef.current) {
      clearTimeout(spellCheckTimeoutRef.current);
    }

    spellCheckTimeoutRef.current = setTimeout(() => {
      analyzeText(inputMessage, inputCursorPosition);
    }, 300);

    return () => {
      if (spellCheckTimeoutRef.current) {
        clearTimeout(spellCheckTimeoutRef.current);
      }
    };
  }, [inputMessage, inputCursorPosition, spellCheckEnabled, analyzeText]);

  // Verificação gramatical com LanguageTool (debounced)
  const grammarTimeoutRef = useRef(null);
  useEffect(() => {
    if (!spellCheckEnabled || !inputMessage || inputMessage.length < 5) {
      setGrammarErrors([]);
      return;
    }
    
    // Debounce de 500ms após parar de digitar
    if (grammarTimeoutRef.current) {
      clearTimeout(grammarTimeoutRef.current);
    }
    
    grammarTimeoutRef.current = setTimeout(async () => {
      const errors = await checkGrammar(inputMessage);
      setGrammarErrors(errors);
    }, 500);
    
    return () => {
      if (grammarTimeoutRef.current) {
        clearTimeout(grammarTimeoutRef.current);
      }
    };
  }, [inputMessage, spellCheckEnabled]);

  // Corretor ortográfico local desabilitado (dicionário corrompido)
  // LanguageTool API faz verificação ortográfica + gramatical

  // Handler para menu de contexto (right-click) em palavra/erro
  const handleSpellContextMenu = (e, word, wordSuggestions, message = null, errorType = 'spelling') => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      word,
      suggestions: wordSuggestions || [],
      message,
      type: errorType
    });
  };

  // Fechar menu de contexto
  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // Aplicar correção do menu de contexto
  const handleContextMenuCorrection = (correction) => {
    if (!contextMenu) return;
    const newText = inputMessage.replace(new RegExp(`\\b${contextMenu.word}\\b`, 'i'), correction);
    setInputMessage(newText);
    setContextMenu(null);
    
    // Re-verificar texto após correção (remove sublinhado automaticamente)
    if (spellCheckEnabled) {
      // Aguarda um tick para o estado atualizar
      setTimeout(async () => {
        if (newText.length >= 5) {
          const grammarErrs = await checkGrammar(newText);
          setGrammarErrors(grammarErrs);
        } else {
          setGrammarErrors([]);
        }
      }, 50);
    }
  };

  // Fechar menu de contexto ao clicar fora
  React.useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  // Funções para a toolbar de formatação
  const handleTextSelection = () => {
    if (!inputRef.current) return;
    
    const input = inputRef.current;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selectedText = input.value.substring(start, end);
    
    // Atualizar seleção
    updateSelection();
    
    // Mostrar toolbar apenas se houver texto selecionado
    if (start !== end && selectedText.trim().length > 0) {
      // Obter posição do input relativo à viewport
      const inputRect = input.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      // Posicionar toolbar acima do input, centralizada
      let toolbarX = inputRect.left + (inputRect.width / 3);
      let toolbarY = inputRect.top - 50; // 50px acima do input
      
      // Garantir que não saia da tela horizontalmente
      const toolbarWidth = 280; // largura aproximada da toolbar
      if (toolbarX - toolbarWidth / 2 < 10) {
        toolbarX = toolbarWidth / 2 + 10;
      } else if (toolbarX + toolbarWidth / 2 > viewportWidth - 10) {
        toolbarX = viewportWidth - toolbarWidth / 2 - 10;
      }
      
      // Garantir que não saia da tela verticalmente (mostrar abaixo se necessário)
      if (toolbarY < 10) {
        toolbarY = inputRect.bottom + 10; // Mostrar abaixo do input
      }
      
      setFormatToolbar({
        visible: true,
        position: { x: toolbarX, y: toolbarY }
      });
    } else {
      setFormatToolbar(prev => ({ ...prev, visible: false }));
    }
  };

  const handleCloseFormatToolbar = () => {
    setFormatToolbar(prev => ({ ...prev, visible: false }));
  };

  const handleApplyFormat = (newText, newStart, newEnd) => {
    setInputMessage(newText);
    
    // Restaurar o foco e a seleção após aplicar formatação
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newStart, newEnd);
      }
    }, 0);
  };

  // Detectar atalhos de teclado para formatação
  const handleKeyDown = (e) => {
    const input = inputRef.current;
    if (!input) return;
    
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selectedText = input.value.substring(start, end);
    
    // Ctrl+B para negrito
    if (e.ctrlKey && e.key === 'b' && selectedText.trim()) {
      e.preventDefault();
      const formattedText = `*${selectedText}*`;
      const newText = input.value.substring(0, start) + formattedText + input.value.substring(end);
      handleApplyFormat(newText, start, start + formattedText.length);
    }
    
    // Ctrl+I para itálico
    if (e.ctrlKey && e.key === 'i' && selectedText.trim()) {
      e.preventDefault();
      const formattedText = `_${selectedText}_`;
      const newText = input.value.substring(0, start) + formattedText + input.value.substring(end);
      handleApplyFormat(newText, start, start + formattedText.length);
    }
    
    // Esc para fechar toolbar
    if (e.key === 'Escape' && formatToolbar.visible) {
      e.preventDefault();
      handleCloseFormatToolbar();
    }
  };

  // Atualizar exibição de sugestões quando mudam
  React.useEffect(() => {
    if (spellCheckEnabled && spellCheckLoaded && suggestions.length > 0 && currentWord.length >= 2) {
      setShowSpellSuggestions(true);
    } else {
      setShowSpellSuggestions(false);
    }
  }, [suggestions, currentWord, spellCheckEnabled, spellCheckLoaded]);

  // Fechar toolbar de formatação quando o input perde foco ou texto muda
  React.useEffect(() => {
    if (!inputMessage) {
      handleCloseFormatToolbar();
    }
  }, [inputMessage]);

  const handlePrivateMessage = (e) => {
    setPrivateMessage(!privateMessage);
    setPrivateMessageInputVisible(!privateMessageInputVisible);
  };

  const handleButtonModalOpen = () => {
    handleMenuItemClick();
    setButtonModalOpen(true); // Define o estado como true para abrir o modal
  };

  const buildQuickMessageMediaUrl = (mediaValue) => {
    if (!mediaValue || typeof mediaValue !== "string") {
      return mediaValue;
    }

    if (mediaValue.startsWith("http") || mediaValue.startsWith("blob:") || mediaValue.startsWith("data:")) {
      return mediaValue;
    }

    return `${process.env.REACT_APP_BACKEND_URL}/public/company${user.companyId}/quickMessage/${mediaValue}`;
  };

  const handleQuickAnswersClick = async (value) => {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    let flow = [];
    if (value.flow) {
      try {
        flow = typeof value.flow === 'string' ? JSON.parse(value.flow) : value.flow;
      } catch (e) {
        flow = [{ type: 'text', value: value.message || value.value }];
      }
    } else {
      // Compatibilidade com mensagens antigas
      flow = [{ type: 'text', value: value.message || value.value }];
      if (value.mediaPath) {
        let paths = [];
        try {
          paths = typeof value.mediaPath === 'string' ? JSON.parse(value.mediaPath) : value.mediaPath;
          if (!Array.isArray(paths)) paths = [value.mediaPath];
        } catch (e) {
          paths = [value.mediaPath];
        }
        paths.forEach(p => flow.push({ type: 'media', value: p }));
      }
    }

    const executeFlow = async () => {
      setLoading(true);
      for (let i = 0; i < flow.length; i++) {
        const item = flow[i];

        if (item.type === 'text') {
          const message = expandPlaceholders(item.value, contactData, ticketData, user);
          
          // Lógica de Legenda: se este é o primeiro texto e o próximo item é mídia e sendAsCaption está ativo
          if (i === 0 && flow[i+1]?.type === 'media' && value.sendAsCaption) {
            // Não envia agora, enviaremos junto com a mídia abaixo
            continue;
          }
          
          if (message) {
            await handleSendMessage(message);
          }
        } 
        else if (item.type === 'delay') {
          await sleep((item.value || 1) * 1000);
        } 
        else if (item.type === 'media') {
          const mediaUrl = buildQuickMessageMediaUrl(item.serverFilename || item.value);
          const caption = (i === 1 && flow[0]?.type === 'text' && value.sendAsCaption) 
            ? expandPlaceholders(flow[0].value, contactData, ticketData, user) 
            : "";

          try {
            const { data } = await axios.get(mediaUrl, { responseType: "blob" });
            await handleUploadQuickMessageMedia(data, caption);
          } catch (err) {
            console.error("Erro ao enviar mídia do fluxo:", err);
            toastError(err);
          }
        }
      }
      setLoading(false);
    };

    executeFlow();
    setTypeBar(false);
    setInputMessage("");
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
    {
      group: 'Contato', items: [
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
      ]
    },
    {
      group: 'Atendimento', items: [
        { label: 'Ticket', token: '{ticket}' },
        { label: 'Protocolo', token: '{protocolo}' },
        { label: 'Fila', token: '{fila}' },
        { label: 'Conexão', token: '{conexao}' },
        { label: 'Atendente', token: '{atendente}' },
      ]
    },
    {
      group: 'Empresa', items: [
        { label: 'Empresa', token: '{empresa}' },
      ]
    },
    {
      group: 'Data/Hora', items: [
        { label: 'Data', token: '{data}' },
        { label: 'Hora', token: '{hora}' },
        { label: 'Data/Hora', token: '{data_hora}' },
        { label: 'Período do dia', token: '{periodo_dia}' },
      ]
    },
  ];

  const [modalCameraOpen, setModalCameraOpen] = useState(false);
  useEffect(() => {
    const handleInsertQuickMessage = (e) => {
      if (e?.detail) {
        if (e.detail.mediaPath) {
          // Lida com media se necessário (neste caso, fazemos de conta simulando a ação de Mídia Rápida ou só texto)
          handleQuickAnswersClick(e.detail);
        } else {
          insertAtCursor(expandPlaceholders(e.detail.message, contactData, ticketData, user));
        }
      }
    };
    window.addEventListener('insert-quick-message', handleInsertQuickMessage);
    return () => {
      window.removeEventListener('insert-quick-message', handleInsertQuickMessage);
    };
  }, [contactData, ticketData, expandPlaceholders]);

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
    // e.preventDefault();

    // Certifique-se de que a variável medias esteja preenchida antes de continuar
    if (!mediasUpload.length) {
      console.log("Nenhuma mídia selecionada.");
      return;
    }

    // ===== OPTIMISTIC UI: Adicionar mensagem visual imediatamente =====
    // Criar mensagens otimísticas para cada mídia
    const optimisticTempIds = [];
    
    mediasUpload.forEach((media) => {
      const mediaType = media.file.type.startsWith('image') ? 'image'
        : media.file.type.startsWith('video') ? 'video'
        : media.file.type.startsWith('audio') ? 'audio'
        : 'document';
      
      // Criar preview URL para imagens
      const previewUrl = mediaType === 'image' ? URL.createObjectURL(media.file) : null;
      
      const tempId = addOptimisticMessage(ticketId, {
        body: media.caption || media.file.name,
        fromMe: true,
        read: 1,
        mediaType,
        mediaUrl: previewUrl,
        _pendingMedia: true,
        _fileName: media.file.name,
        _fileSize: media.file.size,
        contactId,
      });
      
      optimisticTempIds.push(tempId);
    });

    // Ativar loading ANTES de fechar o modal - só para upload de arquivo
    setLoading(true);
    setUploadingFile(true); // Indica que é upload de arquivo (para mostrar progress bar)
    setUploadProgress(0);

    // Fechar modal imediatamente (UX responsiva)
    setMediasUpload([]);
    setShowModalMedias(false);
    setPrivateMessage(false);
    setPrivateMessageInputVisible(false);

    // ===== ENVIAR PARA O SERVIDOR (em background) =====
    const formData = new FormData();
    formData.append("fromMe", true);
    formData.append("isPrivate", privateMessage ? "true" : "false");
    mediasUpload.forEach((media) => {
      formData.append("body", media.caption);
      formData.append("medias", media.file);
    });

    try {
      
      const { data } = await api.post(`/messages/${ticketId}`, formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
          console.log(`[Upload] Progresso: ${percentCompleted}%`);
        }
      });
      
      setUploadProgress(100);
      
      // Confirmar mensagens otimísticas (remover do estado pendente)
      // O servidor vai emitir a mensagem real via socket, então removemos as otimísticas
      optimisticTempIds.forEach(tempId => {
        confirmOptimisticMessage(ticketId, tempId, null);
      });
      
    } catch (err) {
      toastError(err);
      // Marcar mensagens como falha
      optimisticTempIds.forEach(tempId => {
        failOptimisticMessage(ticketId, tempId, err.message);
      });
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setUploadingFile(false); // Reset do flag de upload de arquivo
        setUploadProgress(0);
      }
    }
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
    setLoading(false);
    setReplyingMessage(null);
    setEditingMessage(null);
    setPrivateMessage(false);
    setPrivateMessageInputVisible(false);
  };

  const handleSendMessage = async (customMessage) => {
    const messageBodyText = customMessage || inputMessage;

    if (messageBodyText.trim() === "") return;
    setLoading(true);

    const userName = privateMessage
      ? `${user.name} - Mensagem Privada`
      : user.name;

    const sendMessage = expandPlaceholders(messageBodyText.trim());

    const messageBody = (signMessage || privateMessage) && !editingMessage
      ? `*${userName}:*\n${sendMessage}`
      : sendMessage;

    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: messageBody,
      quotedMsg: replyingMessage,
      isPrivate: privateMessage ? "true" : "false",
    };

    // Optimistic UI: adicionar mensagem imediatamente (só para novas mensagens, não edições)
    let tempId = null;
    if (editingMessage === null && addOptimisticMessage) {
      tempId = addOptimisticMessage(ticketId, {
        body: messageBody,
        fromMe: true,
        read: 1,
        mediaUrl: "",
        quotedMsg: replyingMessage,
        isPrivate: privateMessage,
        contact: { name: user.name },
        ticketId: ticketId,
      });
      console.log("[OptimisticUI] Mensagem adicionada otimisticamente:", tempId);
    }

    // Limpar input imediatamente para UX fluida se for a mensagem do input
    const savedInput = inputMessage;
    if (!customMessage) {
      setInputMessage("");
    }
    setReplyingMessage(null);
    setPrivateMessage(false);
    setPrivateMessageInputVisible(false);
    handleMenuItemClick();

    try {
      if (editingMessage !== null) {
        await api.post(`/messages/edit/${editingMessage.id}`, message);
        setEditingMessage(null);
      } else {
        const { data } = await api.post(`/messages/${ticketId}`, message);
        // Confirmar mensagem otimística com a mensagem real do servidor
        if (tempId && confirmOptimisticMessage && data?.message) {
          confirmOptimisticMessage(ticketId, tempId, data.message);
          console.log("[OptimisticUI] Mensagem confirmada pelo servidor:", data.message?.id);
        }
      }
    } catch (err) {
      // Marcar mensagem otimística como falha
      if (tempId && failOptimisticMessage) {
        failOptimisticMessage(ticketId, tempId, err?.message || "Erro ao enviar");
        console.error("[OptimisticUI] Falha ao enviar mensagem:", err);
      }
      toastError(err);
      // Restaurar input em caso de erro para que usuário possa tentar novamente
      if (!customMessage) {
        setInputMessage(savedInput);
      }
    }

    setLoading(false);
    setEditingMessage(null);
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
          flow: m.flow,
          sendAsCaption: m.sendAsCaption
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

  const handleChangeMedias = (e) => {
    if (!e.target.files) {
      return;
    }
    handleMenuItemClick();
    const selectedMedias = Array.from(e.target.files);
    setMediasUpload(selectedMedias);
    setShowModalMedias(true);
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
      } catch { }
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
          <X size={20} className={classes.sendMessageIcons} />
        </IconButton>
      </div>
    );
  };

  if (mediasUpload.length > 0) {
    return (
      <div
        className={classes.viewMediaInputWrapper}
        onDragEnter={() => setOnDragEnter(true)}
        onDrop={(e) => handleInputDrop(e)}
      >
        {showModalMedias && (
          <Suspense fallback={<CircularProgress />}>
            <MessageUploadMedias
              isOpen={showModalMedias}
              files={mediasUpload}
              onClose={handleCloseModalMedias}
              onSend={handleUploadMedia}
              onCancelSelection={handleCancelSelection}
            />
          </Suspense>
        )}
      </div>
    )
  }
  else {
    return (
      <div className={classes.mainWrapper}>
        {assistantOpen && (
          <div style={{ width: '100%' }}>
            <Suspense fallback={<CircularProgress />}>
              <ChatAssistantPanel
                open={assistantOpen}
                inputMessage={inputMessage}
                setInputMessage={setInputMessage}
                queueId={ticketData?.queue?.id || ticketData?.queueId || null}
                whatsappId={ticketData?.whatsapp?.id || ticketData?.whatsappId || null}
                onClose={() => setAssistantOpen(false)}
              />
            </Suspense>
          </div>
        )}
        {modalCameraOpen && (
          <Suspense fallback={<CircularProgress />}>
            <CameraModal
              isOpen={modalCameraOpen}
              onRequestClose={() => setModalCameraOpen(false)}
              onCapture={handleCapture}
            />
          </Suspense>
        )}
        {senVcardModalOpen && (
          <Suspense fallback={<CircularProgress />}>
            <ContactSendModal
              modalOpen={senVcardModalOpen}
              onClose={(c) => {
                handleSendContatcMessage(c);
              }}
            />
          </Suspense>
        )}
        <div
          className={classes.messageInputWrapper}
          onDrop={(e) => handleInputDrop(e)}
        >
          {/* Barra de progresso de upload - minimalista, apenas para arquivos */}
          {uploadingFile && (
            <div className={classes.uploadProgressContainer}>
              <LinearProgress 
                variant={uploadProgress > 0 ? "determinate" : "indeterminate"}
                value={uploadProgress > 0 ? uploadProgress : undefined} 
                className={classes.uploadProgressBar}
              />
            </div>
          )}
          <input
            multiple
            type="file"
            id="upload-img-button"
            style={{ display: "none" }}
            ref={uploadInputRef}
            accept="image/*,video/*,audio/*"
            onChange={handleChangeMedias}
          />
          <input
            multiple
            type="file"
            id="upload-doc-button"
            style={{ display: "none" }}
            ref={uploadDocRef}
            onChange={handleChangeMedias}
          />
          {/* Barra de seleção de mensagens (novo estilo WhatsApp) */}
          {showSelectMessageCheckbox && (
            <div className={classes.selectionBar}>
              <div className={classes.selectionBarLeft}>
                <X
                  size={15}
                  className={classes.selectionBarCloseIcon}
                  onClick={handleCancelMessageSelection}
                />
                <span className={classes.selectionBarCount}>
                  {selectedMessages.length} selecionada{selectedMessages.length !== 1 ? 's' : ''}
                </span>
              </div>
              <ReplyIcon
                size={15}
                className={classes.selectionBarForwardIcon}
                onClick={handleOpenModalForward}
              />
            </div>
          )}
          {!showSelectMessageCheckbox && (replyingMessage && renderReplyingMessage(replyingMessage)) || (editingMessage && renderReplyingMessage(editingMessage))}
          <div className={classes.newMessageBox} style={{ display: showSelectMessageCheckbox ? 'none' : 'flex' }}>
            <Hidden only={["sm", "xs"]}>
              <Suspense fallback={<div style={{ width: 40, height: 40 }} />}>
                <WhatsAppPopover
                  onSelectEmoji={(emoji) => setInputMessage((prev) => prev + emoji)}
                  onSelectGif={(gifUrl) => {
                  // Enviar GIF como imagem
                  const message = {
                    read: 1,
                    fromMe: true,
                    mediaUrl: gifUrl,
                    body: "",
                    quotedMsg: replyingMessage,
                    isPrivate: privateMessage ? "true" : "false",
                  };
                  api.post(`/messages/${ticketId}`, message).catch(toastError);
                  setReplyingMessage(null);
                  setPrivateMessage(false);
                  setPrivateMessageInputVisible(false);
                }}
                onSelectSticker={(stickerUrl) => {
                  // Enviar figurinha como imagem
                  const message = {
                    read: 1,
                    fromMe: true,
                    mediaUrl: stickerUrl,
                    body: "",
                    quotedMsg: replyingMessage,
                    isPrivate: privateMessage ? "true" : "false",
                  };
                  api.post(`/messages/${ticketId}`, message).catch(toastError);
                  setReplyingMessage(null);
                  setPrivateMessage(false);
                  setPrivateMessageInputVisible(false);
                }}
                disabled={disableOption()}
              />
              </Suspense>
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
                    <Sparkles size={20} className={classes.sendMessageIcons} />
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
                  <ClockIcon size={20} className={classes.sendMessageIcons} />
                </IconButton>
              </Tooltip>

              <Fab
                disabled={disableOption()}
                aria-label="uploadMedias"
                component="span"
                className={classes.invertedFabMenu}
                size="small"
                onClick={handleOpenMenuClick}
                tabIndex={-1}
              >
                <Plus size={20} />
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
                    tabIndex={-1}
                  >
                    {signMessage === true ? (
                      <PenLine size={20} style={{ color: theme.mode === "light" ? theme.palette.primary.main : "#EEE" }} />
                    ) : (
                      <PenLine size={20} style={{ color: "grey" }} />
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
                tabIndex={-1}
              >
                <Plus size={20} className={classes.sendMessageIcons} />
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
              <MenuItem onClick={() => uploadInputRef.current.click()}>
                <Fab
                  aria-label="upload-img"
                  component="span"
                  className={classes.invertedFabMenuMP}
                  size="small"
                >
                  <ImageIcon size={20} />
                </Fab>
                {i18n.t("messageInput.type.imageVideo")}
              </MenuItem>
              <MenuItem onClick={handleCameraModalOpen}>
                <Fab className={classes.invertedFabMenuCamera} size="small">
                  <Camera size={20} />
                </Fab>
                {i18n.t("messageInput.type.cam")}
              </MenuItem>
              <MenuItem onClick={() => uploadDocRef.current.click()}>
                <Fab aria-label="upload-img"
                  component="span" className={classes.invertedFabMenuDoc} size="small">
                  <FileText size={20} />
                </Fab>
                Documento
              </MenuItem>
              <MenuItem onClick={handleSendContactModalOpen}>
                <Fab className={classes.invertedFabMenuCont} size="small">
                  <UserRound size={20} />
                </Fab>
                {i18n.t("messageInput.type.contact")}
              </MenuItem>
              <MenuItem onClick={handleSendLinkVideo}>
                <Fab className={classes.invertedFabMenuMeet} size="small">
                  <Video size={20} />
                </Fab>
                {i18n.t("messageInput.type.meet")}
              </MenuItem>
              {buttonModalOpen && (
                <Suspense fallback={<CircularProgress />}>
                  <ButtonModal
                    modalOpen={buttonModalOpen}
                    onClose={() => setButtonModalOpen(false)}
                    ticketId={ticketId}
                  />
                </Suspense>
              )}
              <MenuItem onClick={handleButtonModalOpen}>
                <Fab className={classes.invertedFabMenuCont} size="small">
                  <MoreHorizontal size={20} />
                </Fab>
                Botões
              </MenuItem>
              <Divider />
              <MenuItem onClick={(e) => { handleMenuItemClick(); handleOpenVarsMenu(e); }}>
                <Fab className={classes.invertedFabMenuCont} size="small">
                  <Braces size={20} />
                </Fab>
                Variáveis
              </MenuItem>
              <MenuItem onClick={() => { handleMenuItemClick(); handleToggleSpellCheck(); }}>
                <Fab className={classes.invertedFabMenuCont} size="small">
                  <SpellCheck2 size={20} style={{ color: spellCheckEnabled ? green[500] : undefined }} />
                </Fab>
                {spellCheckEnabled ? "Desativar Corretor" : "Ativar Corretor"}
              </MenuItem>
              {isMobile && (
                <>
                  <Divider />
                  <MenuItem onClick={handleOpenAssistantFromMenu}>
                    <Fab className={classes.invertedFabMenuCont} size="small">
                      <Sparkles size={20} />
                    </Fab>
                    Assistente de Chat
                  </MenuItem>
                  <MenuItem onClick={handleOpenScheduleFromMenu}>
                    <Fab className={classes.invertedFabMenuCont} size="small">
                      <ClockIcon size={20} />
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
                      minRows={1}
                      maxRows={isMobile ? 8 : 10}
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
                  <div className={classes.messageInputWrapper} style={{ position: 'relative' }}>
                    {/* Corretor ortográfico nativo do navegador habilitado */}
                    {/* Overlay customizado removido - causava problemas de alinhamento */}
                    <InputBase
                      inputRef={(input) => {
                        input && input.focus();
                        input && (inputRef.current = input);
                      }}
                      className={classes.messageInput}
                      placeholder={placeholderText}
                      multiline
                      minRows={1}
                      maxRows={isMobile ? 8 : 10}
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
                      onMouseUp={handleTextSelection}
                      onKeyDown={handleKeyDown}
                      onSelect={handleTextSelection}
                      onContextMenu={(e) => {
                        // Verificar se o cursor está sobre uma palavra errada
                        if (spellCheckEnabled && misspelledWords.length > 0) {
                          const cursorPos = e.target.selectionStart;
                          const wordAtCursor = misspelledWords.find(
                            w => cursorPos >= w.start && cursorPos <= w.end
                          );
                          if (wordAtCursor) {
                            handleSpellContextMenu(e, wordAtCursor.word, wordAtCursor.suggestions);
                          }
                        }
                      }}
                      inputProps={{
                        inputMode: 'text',
                        autoComplete: 'off',
                        autoCorrect: 'off',
                        autoCapitalize: 'off',
                        spellCheck: 'true',
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
                <Tooltip title="Mensagem rápida">
                  <IconButton
                    aria-label="flash"
                    component="span"
                    onClick={() => {
                      if (onToggleQuickMessages) {
                        onToggleQuickMessages();
                      } else {
                        window.dispatchEvent(new CustomEvent('open-contact-drawer', {
                          detail: { tab: 'quickMessages' }
                        }));
                      }
                    }}
                    color={quickMessagesOpen ? "primary" : "inherit"}
                    tabIndex={-1}
                  >
                    <Zap size={20} style={{ color: quickMessagesOpen ? theme.palette.primary.main : "inherit" }} />
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
                      tabIndex={-1}
                      className={inputMessage.trim() && !showSelectMessageCheckbox ? classes.sendButtonActive : ""}
                    >
                      {loading ? (
                        <CircularProgress className={classes.circleLoading} size={24} />
                      ) : showSelectMessageCheckbox ? (
                        <ReplyIcon size={20} className={classes.ForwardMessageIcons} />
                      ) : (
                        <SendIcon size={20} className={inputMessage.trim() ? classes.sendMessageIconsActive : classes.sendMessageIcons} />
                      )}
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
                      tabIndex={-1}
                    >
                      <X size={20} className={classes.cancelAudioIcon} />
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
                      tabIndex={-1}
                    >
                      <Check size={20} className={classes.sendAudioIcon} />
                    </IconButton>
                  </div>
                ) : (
                  <IconButton
                    aria-label="showRecorder"
                    component="span"
                    disabled={disableOption()}
                    onClick={handleStartRecording}
                    tabIndex={-1}
                  >
                    <MicIcon size={20} className={classes.sendMessageIcons} />
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
                  {loading ? (
                    <CircularProgress className={classes.circleLoading} size={24} />
                  ) : showSelectMessageCheckbox ? (
                    <ReplyIcon size={15} className={classes.ForwardMessageIcons} />
                  ) : (
                    <SendIcon size={15} className={classes.sendMessageIcons} />
                  )}
                </IconButton>
              </>
            )}
            {appointmentModalOpen && (
              <Suspense fallback={<CircularProgress />}>
                <ScheduleModal
                  open={appointmentModalOpen}
                  onClose={() => setAppointmentModalOpen(false)}
                  contactId={contactId}
                />
              </Suspense>
            )}
          </div>
        </div>
        {/* Popup de sugestões - só aparece se tiver mais de 2 opções */}
        {showSpellSuggestions && spellCheckEnabled && suggestions.length > 2 && (
          <SpellCheckSuggestions
            suggestions={suggestions}
            currentWord={currentWord}
            onSelect={handleApplySpellSuggestion}
            onClose={() => setShowSpellSuggestions(false)}
            isMobile={isMobile}
          />
        )}
        {/* Menu de contexto (right-click) para correção ortográfica/gramatical */}
        {contextMenu && (
          <div
            className={classes.spellContextMenu}
            style={{ 
              left: contextMenu.x, 
              top: contextMenu.y,
              transform: 'translateY(-100%) translateY(-8px)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ul>
              {/* Mostrar mensagem de erro gramatical */}
              {contextMenu.message && (
                <>
                  <li style={{ 
                    color: '#666', 
                    fontSize: 12, 
                    backgroundColor: '#f5f5f5',
                    borderLeft: `3px solid ${contextMenu.type === 'grammar' ? '#0066cc' : '#ff0000'}`
                  }}>
                    {contextMenu.message}
                  </li>
                  <li className="divider" />
                </>
              )}
              {contextMenu.suggestions.length > 0 ? (
                contextMenu.suggestions.map((sug, idx) => (
                  <li
                    key={idx}
                    className="suggestion"
                    onClick={() => handleContextMenuCorrection(sug)}
                  >
                    {sug}
                  </li>
                ))
              ) : (
                <li style={{ color: '#999', fontStyle: 'italic' }}>
                  Sem sugestões
                </li>
              )}
              <li className="divider" />
              <li onClick={handleCloseContextMenu}>Ignorar</li>
            </ul>
          </div>
        )}
        {/* Toolbar de formatação de texto */}
        <FormatToolbar
          visible={formatToolbar.visible}
          position={formatToolbar.position}
          onClose={handleCloseFormatToolbar}
          onFormat={handleApplyFormat}
          inputRef={inputRef}
          selection={selection}
        />
      </div>
    );
  }
};

export default MessageInput;
