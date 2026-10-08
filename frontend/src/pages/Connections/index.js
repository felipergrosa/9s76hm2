
import React, { useState, useCallback, useContext, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import { add, format, parseISO } from "date-fns";

import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import PopupState, { bindTrigger, bindMenu } from "material-ui-popup-state";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import { green } from "@material-ui/core/colors";
import {
  Button,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  TableSortLabel,
  IconButton,
  Table,
  Paper,
  Tooltip,
  CircularProgress,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  TextField,
  InputAdornment,
  FormControl,
} from "@material-ui/core";

import {
  Facebook,
  Instagram,
  WhatsApp,
  Chat as WebChatIcon,
} from "@material-ui/icons";
import {
  Search as SearchIcon,
  Pencil as EditIcon,
  Trash2 as DeleteIcon,
  QrCode as QrIcon,
  RefreshCw as ReconnectIcon,
  RotateCcw as NewQrIcon,
  Eraser as ClearSessionIcon,
  Power as DisconnectIcon,
  RefreshCcw as SyncIcon,
  CheckCircle2 as CheckIcon,
  MoreVertical as MoreIcon,
  Activity as HealthIcon,
  ArrowUp as SortAscIcon,
  ArrowDown as SortDescIcon,
  Plus as AddIcon,
  LifeBuoy as SupportIcon,
  RotateCw as RestartIcon,
  Link2 as LinkIcon,
  ArrowLeftRight as TransferIcon,
} from "lucide-react";

import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";

import api from "../../services/api";
import WhatsAppModal from "../../components/WhatsAppModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import MetaSelectModal from "../../components/MetaSelectModal";
import QrcodeModal from "../../components/QrcodeModal";
import TransferTicketsModal from "../../components/TransferTicketsModal";
import { i18n } from "../../translate/i18n";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import toastError from "../../errors/toastError";
import formatSerializedId from '../../utils/formatSerializedId';
import { AuthContext } from "../../context/Auth/AuthContext";
import usePlans from "../../hooks/usePlans";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";
import ForbiddenPage from "../../components/ForbiddenPage";
import usePermissions from "../../hooks/usePermissions";
import { motion, useReducedMotion } from "framer-motion";
import StatCard from "../../components/bento/StatCard";
import { bentoContainer, bentoItem, bentoItemReduced } from "../../components/bento/motionPresets";
import "../../components/bento/bento.css";

// ===== Estilos no padrão do gerenciador de Campanhas/Templates Meta =====
const useStyles = makeStyles((theme) => ({
  paper: {
    flex: 1,
    padding: 0,
    // overflowY auto: lista de conexões rola dentro do Paper (o MainContainer não usa useWindowScroll)
    overflowY: "auto",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    ...theme.scrollbarStyles,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    padding: theme.spacing(2, 2.5),
  },
  headerText: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: "0.85rem",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
    padding: theme.spacing(1.5, 2.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    borderBottom: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : "#fafafa",
  },
  searchField: {
    minWidth: 220,
    flex: "1 1 280px",
    maxWidth: 380,
  },
  filterSelect: {
    minWidth: 150,
  },
  headCell: {
    fontWeight: 600,
    fontSize: "0.72rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    borderBottom: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : "#fafafa",
    whiteSpace: "nowrap",
  },
  bodyCell: {
    fontSize: "0.85rem",
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
    borderBottom: `1px solid ${theme.palette.divider}`,
    verticalAlign: "middle",
  },
  rowHover: {
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    transition: "background-color 120ms ease",
  },
  connName: {
    fontWeight: 600,
    fontSize: "0.9rem",
    lineHeight: 1.35,
  },
  mutedText: {
    color: theme.palette.text.secondary,
    fontSize: "0.78rem",
    marginTop: 2,
  },
  actionsCell: {
    whiteSpace: "nowrap",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(8, 2),
    color: theme.palette.text.secondary,
    textAlign: "center",
  },
  buttonProgress: {
    color: green[500],
  },
  channelAvatar: {
    width: 34,
    height: 34,
    borderRadius: 9,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    "& svg": { fontSize: 18 },
  },
  // Cards mobile
  mobileList: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    [theme.breakpoints.up("sm")]: {
      display: "none",
    },
  },
  desktopTableWrapper: {
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  card: {
    borderRadius: 12,
    padding: theme.spacing(1.75),
    border: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.25),
    background: theme.palette.background.paper,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
  },
  cardTitle: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
    minWidth: 0,
  },
  cardName: {
    fontWeight: 700,
    fontSize: "1rem",
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 190,
  },
  cardMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: theme.spacing(1),
  },
  metaLabel: {
    fontSize: "0.72rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: theme.palette.text.secondary,
  },
  metaValue: {
    fontSize: "0.9rem",
    fontWeight: 600,
    wordBreak: "break-word",
  },
  cardActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    flexWrap: "wrap",
  },
  actionButton: {
    minWidth: 44,
    minHeight: 44,
  },
}));

const IconChannel = (channel, channelType) => {
  // Garante compatibilidade com conexões antigas onde apenas channelType foi salvo
  if (channel === "facebook" || channelType === "facebook") {
    return <Facebook style={{ color: "#3b5998" }} />;
  }

  if (channel === "instagram" || channelType === "instagram") {
    return <Instagram style={{ color: "#e1306c" }} />;
  }

  if (channel === "webchat" || channelType === "webchat") {
    return <WebChatIcon style={{ color: "#6B46C1" }} />;
  }

  // Padrão: WhatsApp (Baileys ou Oficial)
  return <WhatsApp style={{ color: "#25d366" }} />;
};

// Rótulo + cor de destaque por tipo de conexão (usado no card modernizado)
const channelInfo = (whatsApp) => {
  const { channel, channelType } = whatsApp;
  if (channel === "facebook" || channelType === "facebook") {
    return { label: "Facebook", color: "#1877F2" };
  }
  if (channel === "instagram" || channelType === "instagram") {
    return { label: "Instagram", color: "#E1306C" };
  }
  if (channel === "webchat" || channelType === "webchat") {
    return { label: "WebChat", color: "#6B46C1" };
  }
  if (channelType === "official") {
    return { label: "WhatsApp · API Oficial", color: "#075E54" };
  }
  return { label: "WhatsApp · Baileys", color: "#25D366" };
};

// Status → chip tailwind (padrão das telas de Campanhas/Templates Meta)
const statusInfo = (whatsApp) => {
  const isBaileys = !whatsApp.channelType || whatsApp.channelType === "baileys";
  switch (whatsApp.status) {
    case "CONNECTED":
      return {
        label: "Conectado",
        cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
      };
    case "OPENING":
      return {
        label: "Conectando…",
        cls: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      };
    case "qrcode":
      return isBaileys
        ? {
            label: "Aguardando QR Code",
            cls: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
          }
        : {
            label: "Desconectado",
            cls: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
          };
    case "TIMEOUT":
      return {
        label: "Timeout",
        cls: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      };
    case "PAIRING":
      return {
        label: "Pareando",
        cls: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      };
    default:
      return {
        label: "Desconectado",
        cls: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      };
  }
};

const ConnectionStatusChip = ({ whatsApp }) => {
  const st = statusInfo(whatsApp);
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
      {st.label}
    </span>
  );
};

// Badge "#id" com a cor configurada na conexão (whatsApp.color)
const ConnectionIdBadge = ({ whatsApp }) => {
  const theme = useTheme();
  const color = whatsApp.color;
  const style = color
    ? { backgroundColor: color, color: theme.palette.getContrastText(color) }
    : {
        backgroundColor: "transparent",
        color: theme.palette.text.secondary,
        border: `1px solid ${theme.palette.divider}`,
      };
  return (
    <span
      style={{
        ...style,
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: "0.72rem",
        fontWeight: 700,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      #{whatsApp.id}
    </span>
  );
};

// Chip pequeno com o tipo da conexão WhatsApp (API Oficial / Baileys)
const ChannelTypeTag = ({ whatsApp }) => {
  if (whatsApp.channel !== "whatsapp") return null;
  if (whatsApp.channelType === "official") {
    return (
      <span className="px-1.5 py-0.5 rounded text-[0.65rem] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
        API Oficial
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 rounded text-[0.65rem] font-semibold border border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300">
      Baileys
    </span>
  );
};

const Connections = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const { whatsApps, loading } = useContext(WhatsAppsContext);

  // Ordenação compartilhada (tabela desktop + cards mobile)
  const [orderBy, setOrderBy] = useState("id");
  const [orderDir, setOrderDir] = useState("asc");

  // Busca + filtros da toolbar (padrão /campaigns) — precisam ser declarados
  // ANTES do useMemo abaixo, senão o factory acessa const em TDZ e a página quebra
  const [searchParam, setSearchParam] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const handleSort = useCallback((key) => {
    setOrderBy(prev => {
      if (prev === key) {
        setOrderDir(d => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setOrderDir("asc");
      return key;
    });
  }, []);

  const sortedWhatsApps = useMemo(() => {
    // Filtros da toolbar + ordenação compartilhada
    const search = searchParam.trim().toLowerCase();
    let list = (whatsApps || []).filter((w) => {
      if (search) {
        const hay = `${w.id} ${w.name || ""} ${w.number || ""} ${channelInfo(w).label}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      if (channelFilter) {
        const ch = w.channel || (w.channelType === "official" || w.channelType === "baileys" || !w.channelType ? "whatsapp" : w.channelType);
        if (ch !== channelFilter) return false;
      }
      if (statusFilter && (w.status || "") !== statusFilter) return false;
      return true;
    });
    const dir = orderDir === "asc" ? 1 : -1;
    const val = (w) => {
      switch (orderBy) {
        case "id": return Number(w.id) || 0;
        case "channel": return channelInfo(w).label.toLowerCase();
        case "name": return (w.name || "").toLowerCase();
        case "number": return String(w.number || w.facebookPageUserId || "").toLowerCase();
        case "status": return statusInfo(w).label.toLowerCase();
        case "updatedAt": return w.updatedAt ? new Date(w.updatedAt).getTime() : 0;
        case "isDefault": return w.isDefault ? 1 : 0;
        default: return 0;
      }
    };
    list.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return list;
  }, [whatsApps, orderBy, orderDir, searchParam, channelFilter, statusFilter]);

  // KPIs do strip bento — derivados da mesma lista (socket já atualiza em tempo real)
  const connStats = useMemo(() => {
    const list = whatsApps || [];
    const live = ["CONNECTED", "OPENING", "PAIRING", "qrcode"];
    return {
      total: list.length,
      connected: list.filter(w => w.status === "CONNECTED").length,
      connecting: list.filter(w => ["OPENING", "PAIRING", "qrcode"].includes(w.status)).length,
      disconnected: list.filter(w => !live.includes(w.status || "")).length,
    };
  }, [whatsApps]);

  const reducedMotion = useReducedMotion();
  const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [, setStatusImport] = useState([]);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [metaMenuAnchorEl, setMetaMenuAnchorEl] = useState(null);
  const [metaSelectKey, setMetaSelectKey] = useState(null);
  // Diagnóstico Meta (token + subscribed_apps) por conexão
  const [metaHealth, setMetaHealth] = useState({ open: false, loading: false, data: null, name: "", whatsappId: null, resubscribing: false });
  const history = useHistory();

  const confirmationModalInitialState = {
    action: "",
    title: "",
    message: "",
    whatsAppId: "",
    open: false,
  };
  const [confirmModalInfo, setConfirmModalInfo] = useState(confirmationModalInitialState);
  const [planConfig, setPlanConfig] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  // Guarda de exclusão: conexão com tickets ativos abre modal de
  // transferência antes de permitir apagar (evita tickets órfãos)
  const [deleteGuard, setDeleteGuard] = useState({ open: false, whatsApp: null, count: 0 });
  const [clearAuthById, setClearAuthById] = useState({});
  const [syncingById, setSyncingById] = useState({}); // Rastreia sync em andamento por ID

  const { user, socket } = useContext(AuthContext);

  const companyId = user.companyId;
  const { hasPermission } = usePermissions();

  const { getPlanCompany } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const planConfigs = await getPlanCompany(undefined, companyId);
      setPlanConfig(planConfigs)
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const metaSuccess = params.get("meta_success");
    const metaError = params.get("meta_error");
    const metaSelect = params.get("meta_select");
    // meta_select: retorno do OAuth Meta pedindo para o usuário escolher
    // quais páginas/contas conectar — abre o modal de seleção
    if (metaSelect) {
      setMetaSelectKey(metaSelect);
    }
    if (metaSuccess) {
      toast.success(`${metaSuccess} conexão(ões) Meta criada(s) com sucesso!`);
    } else if (metaError) {
      toast.error(`Erro na conexão com a Meta: ${decodeURIComponent(metaError)}`);
    }
    if (metaSuccess || metaError || metaSelect) {
      // Limpa os query params do retorno OAuth da Meta da URL
      history.replace("/connections");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Handler nomeado para permitir remocao correta do listener no cleanup
    const onImportMessages = (data) => {
      if (data.action === "refresh") {
        setStatusImport([]);
        history.go(0);
      }
      if (data.action === "update") {
        setStatusImport(data.status);
      }
    };

    socket.on(`importMessages-${user.companyId}`, onImportMessages);

    return () => {
      socket.off(`importMessages-${user.companyId}`, onImportMessages);
    };
  }, [socket, user.companyId, history]);

  const handleStartWhatsAppSession = async (whatsAppId) => {
    if (!whatsAppId) {
      console.error("[ERRO] handleStartWhatsAppSession: ID inválido");
      return;
    }
    try {
      await api.post(`/whatsappsession/${whatsAppId}`);
    } catch (err) {
      // 403 = sem permissão connections.update (admin)
      // Silencia o erro
      if (err?.response?.status !== 403) {
        toastError(err);
      }
    }
  };

  const handleRequestNewQrCode = async (whatsAppId) => {
    if (!whatsAppId) {
      console.error("[ERRO] handleRequestNewQrCode: ID inválido");
      return;
    }
    try {
      const clearAuth = !!clearAuthById?.[whatsAppId];
      await api.put(`/whatsappsession/${whatsAppId}`, { clearAuth });
      setClearAuthById(prev => ({ ...prev, [whatsAppId]: false }));
    } catch (err) {
      // 403 = sem permissão connections.update (admin)
      // Silencia o erro
      if (err?.response?.status !== 403) {
        toastError(err);
      }
    }
  };

  const handleOpenWhatsAppModal = () => {
    // Apenas abre o modal; quem chama é responsável por ajustar selectedWhatsApp
    setWhatsAppModalOpen(true);
  };

  const handleCloseWhatsAppModal = useCallback(() => {
    setWhatsAppModalOpen(false);
    setSelectedWhatsApp(null);
  }, [setSelectedWhatsApp, setWhatsAppModalOpen]);

  const handleOpenQrModal = (whatsApp) => {
    setSelectedWhatsApp(whatsApp);
    setQrModalOpen(true);
  };

  const handleCloseQrModal = useCallback(() => {
    setSelectedWhatsApp(null);
    setQrModalOpen(false);
  }, [setQrModalOpen, setSelectedWhatsApp]);

  const handleEditWhatsApp = (whatsApp) => {
    setSelectedWhatsApp(whatsApp);
    setWhatsAppModalOpen(true);
  };

  const handleOpenMetaMenu = (event) => {
    setMetaMenuAnchorEl(event.currentTarget);
  };

  const handleCloseMetaMenu = () => {
    setMetaMenuAnchorEl(null);
  };

  const handleCloseMetaSelect = useCallback(() => {
    setMetaSelectKey(null);
  }, []);

  const handleMetaSelectConnected = useCallback(() => {
    // O backend emite `company-<id>-whatsapp` (action=update) por conexão
    // criada — o hook useWhatsApps já insere na lista em tempo real.
    // Não é mais necessário recarregar a página.
  }, []);

  const openInNewTab = url => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleOpenConfirmationModal = (action, whatsAppId) => {
    if (action === "disconnect") {
      setConfirmModalInfo({
        action: action,
        title: i18n.t("connections.confirmationModal.disconnectTitle"),
        message: i18n.t("connections.confirmationModal.disconnectMessage"),
        whatsAppId: whatsAppId,
      });
    }

    if (action === "delete") {
      setConfirmModalInfo({
        action: action,
        title: i18n.t("connections.confirmationModal.deleteTitle"),
        message: i18n.t("connections.confirmationModal.deleteMessage"),
        whatsAppId: whatsAppId,
      });
    }
    if (action === "closedImported") {
      setConfirmModalInfo({
        action: action,
        title: i18n.t("connections.confirmationModal.closedImportedTitle"),
        message: i18n.t("connections.confirmationModal.closedImportedMessage"),
        whatsAppId: whatsAppId,
      });
    }
    setConfirmModalOpen(true);
  };

  // Exclusão com guarda de tickets: se a conexão tem atendimentos ativos
  // e existe outra conexão de destino, abre o modal de transferência;
  // senão segue o fluxo normal de confirmação.
  const handleDeleteConnection = async (whatsApp) => {
    try {
      const { data } = await api.get(`/whatsapp/${whatsApp.id}/active-tickets-count`);
      const hasTarget = (whatsApps || []).some((w) => w.id !== whatsApp.id);
      if (data.count > 0 && hasTarget) {
        setDeleteGuard({ open: true, whatsApp, count: data.count });
      } else {
        handleOpenConfirmationModal("delete", whatsApp.id);
      }
    } catch (err) {
      toastError(err);
    }
  };

  const deleteConnectionById = async (whatsAppId) => {
    try {
      await api.delete(`/whatsapp/${whatsAppId}`);
      toast.success(i18n.t("connections.toasts.deleted"));
    } catch (err) {
      // 403 = sem permissão connections.delete (admin)
      if (err?.response?.status !== 403) {
        toastError(err);
      }
    }
  };

  // Sincronização completa de histórico (organizada, ticket a ticket)
  const handleSyncFullHistory = async (whatsAppId) => {
    if (syncingById[whatsAppId]) {
      toast.warn("Sincronização já em andamento para esta conexão");
      return;
    }

    const isBaileys = !whatsApps.find(w => w.id === whatsAppId)?.channelType || 
                      whatsApps.find(w => w.id === whatsAppId)?.channelType === "baileys";
    
    if (!isBaileys) {
      toast.error("Sincronização de histórico não disponível para API Oficial");
      return;
    }

    try {
      setSyncingById(prev => ({ ...prev, [whatsAppId]: true }));
      
      const { data } = await api.post(`/whatsapp/${whatsAppId}/sync-full-history`, {
        periodMonths: 0,
        downloadMedia: false
      });
      
      toast.success(data.message || "Sincronização iniciada");
    } catch (err) {
      toastError(err);
    } finally {
      // Libera após 5 segundos para evitar cliques duplicados
      setTimeout(() => {
        setSyncingById(prev => ({ ...prev, [whatsAppId]: false }));
      }, 5000);
    }
  };

  const handleSubmitConfirmationModal = async () => {
    if (confirmModalInfo.action === "disconnect") {
      try {
        await api.delete(`/whatsappsession/${confirmModalInfo.whatsAppId}`);
      } catch (err) {
        // 403 = sem permissão connections.delete (admin)
        // Silencia o erro
        if (err?.response?.status !== 403) {
          toastError(err);
        }
      }
    }

    if (confirmModalInfo.action === "delete") {
      await deleteConnectionById(confirmModalInfo.whatsAppId);
    }
    if (confirmModalInfo.action === "closedImported") {
      try {
        await api.post(`/closedimported/${confirmModalInfo.whatsAppId}`);
        toast.success(i18n.t("connections.toasts.closedimported"));
      } catch (err) {
        // 403 = sem permissão connections.update (admin)
        // Silencia o erro
        if (err?.response?.status !== 403) {
          toastError(err);
        }
      }
    }

    setConfirmModalInfo(confirmationModalInitialState);
  };


  const renderImportButton = (whatsApp) => {
    if (whatsApp?.statusImportMessages === "renderButtonCloseTickets") {
      return (
        <Tooltip title={i18n.t("connections.buttons.closedImported")}>
          <span>
            <IconButton
              size="small"
              color="primary"
              onClick={() => {
                handleOpenConfirmationModal("closedImported", whatsApp.id);
              }}
            >
              <CheckIcon size={18} />
            </IconButton>
          </span>
        </Tooltip>
      );
    }

    if (whatsApp?.importOldMessages) {
      let isTimeStamp = !isNaN(
        new Date(Math.floor(whatsApp?.statusImportMessages)).getTime()
      );

      if (isTimeStamp) {
        const ultimoStatus = new Date(
          Math.floor(whatsApp?.statusImportMessages)
        ).getTime();
        const dataLimite = +add(ultimoStatus, { seconds: +35 }).getTime();
        if (dataLimite > new Date().getTime()) {
          return (
            <>
              <Tooltip title={i18n.t("connections.buttons.preparing")}>
                <span>
                  <IconButton size="small" disabled>
                    <CircularProgress size={18} className={classes.buttonProgress} />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          );
        }
      }
    }
  };

  // Gera/recupera o token público da conexão webchat e copia a URL /webchat/:token
  const handleCopyWebchatLink = async (whatsApp) => {
    try {
      const { data } = await api.post(`/whatsapp/${whatsApp.id}/webchat-token`);
      const url = data.webchatUrl || `${window.location.origin}/webchat/${data.webchatToken}`;
      await navigator.clipboard.writeText(url);
      toast.success(i18n.t("publicWebchat.linkCopied"));
    } catch (err) {
      toastError(err);
    }
  };

  const renderActionButtons = (whatsApp) => {
    const isBaileys = !whatsApp.channelType || whatsApp.channelType === "baileys";
    const isWebchat = whatsApp.channel === "webchat" || whatsApp.channelType === "webchat";

    return (
      <>
        {whatsApp.status === "qrcode" && isBaileys && hasPermission("connections.edit") && (
          <Tooltip title={i18n.t("connections.buttons.qrcode")}>
            <span>
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleOpenQrModal(whatsApp)}
              >
                <QrIcon size={18} />
              </IconButton>
            </span>
          </Tooltip>
        )}
        {whatsApp.status === "DISCONNECTED" && hasPermission("connections.edit") && (
          <Box display="flex" alignItems="center" style={{ gap: 4, flexWrap: "wrap" }}>
            <Tooltip
              title={isBaileys ? i18n.t("connections.buttons.tryAgain") : "Recarregar Conexão"}
            >
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => handleStartWhatsAppSession(whatsApp.id)}
                >
                  <ReconnectIcon size={18} />
                </IconButton>
              </span>
            </Tooltip>

            {isBaileys && (
              <>
                <Tooltip title={i18n.t("connections.buttons.newQr")}>
                  <span>
                    <IconButton
                      size="small"
                      color="secondary"
                      onClick={() => handleRequestNewQrCode(whatsApp.id)}
                    >
                      <NewQrIcon size={18} />
                    </IconButton>
                  </span>
                </Tooltip>

                <Tooltip
                  title={
                    clearAuthById?.[whatsApp.id]
                      ? "Limpar sessão: ATIVO"
                      : "Limpar sessão: inativo"
                  }
                >
                  <span>
                    <IconButton
                      size="small"
                      color={clearAuthById?.[whatsApp.id] ? "secondary" : "default"}
                      onClick={() =>
                        setClearAuthById(prev => ({
                          ...prev,
                          [whatsApp.id]: !prev?.[whatsApp.id]
                        }))
                      }
                    >
                      <ClearSessionIcon size={18} />
                    </IconButton>
                  </span>
                </Tooltip>
              </>
            )}
          </Box>
        )}
        {(whatsApp.status === "CONNECTED" ||
          whatsApp.status === "PAIRING" ||
          whatsApp.status === "TIMEOUT") && hasPermission("connections.edit") && (
            <>
              {/* Botão de Sincronização de Histórico - só para Baileys */}
              {isBaileys && (
                <Tooltip title={syncingById[whatsApp.id] ? "Sincronizando..." : "Sincronizar Histórico"}>
                  <span>
                    <IconButton
                      size="small"
                      style={{ color: syncingById[whatsApp.id] ? green[500] : "#25D366" }}
                      onClick={() => handleSyncFullHistory(whatsApp.id)}
                      disabled={syncingById[whatsApp.id]}
                    >
                      {syncingById[whatsApp.id] ? (
                        <CircularProgress size={18} className={classes.buttonProgress} />
                      ) : (
                        <SyncIcon size={18} />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              )}

              <Tooltip title={i18n.t("connections.buttons.disconnect")}>
                <span>
                  <IconButton
                    size="small"
                    color="secondary"
                    onClick={() => {
                      handleOpenConfirmationModal("disconnect", whatsApp.id);
                    }}
                  >
                    <DisconnectIcon size={18} />
                  </IconButton>
                </span>
              </Tooltip>

              {renderImportButton(whatsApp)}
            </>
          )}
        {whatsApp.status === "OPENING" && (
          <Tooltip title={i18n.t("connections.buttons.connecting")}>
            <span>
              <IconButton size="small" disabled>
                <CircularProgress size={18} className={classes.buttonProgress} />
              </IconButton>
            </span>
          </Tooltip>
        )}
        {/* Conexões webchat não têm QR/sessão: ação é gerar e copiar o link público */}
        {isWebchat && hasPermission("connections.edit") && (
          <Tooltip title={i18n.t("publicWebchat.copyLink")}>
            <span>
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleCopyWebchatLink(whatsApp)}
              >
                <LinkIcon size={18} />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </>
    );
  };

  // Diagnóstico de saúde da integração Meta (token + assinatura de webhook)
  const handleMetaHealth = async (whatsApp) => {
    setMetaHealth({ open: true, loading: true, data: null, name: whatsApp.name, whatsappId: whatsApp.id, resubscribing: false });
    try {
      const { data } = await api.get(`/whatsapp/${whatsApp.id}/meta-health`);
      setMetaHealth({ open: true, loading: false, data, name: whatsApp.name, whatsappId: whatsApp.id, resubscribing: false });
    } catch (err) {
      setMetaHealth({ open: false, loading: false, data: null, name: "", whatsappId: null, resubscribing: false });
      toastError(err);
    }
  };

  // Reassina o webhook da página Meta (subscribed_apps) — auto-cura quando
  // a conexão existe mas a Meta não está entregando eventos de mensagens.
  const handleMetaResubscribe = async () => {
    if (!metaHealth.whatsappId) return;
    setMetaHealth(prev => ({ ...prev, resubscribing: true }));
    try {
      const { data } = await api.post(`/whatsapp/${metaHealth.whatsappId}/meta-resubscribe`);
      setMetaHealth(prev => ({
        ...prev,
        resubscribing: false,
        data: {
          ...prev.data,
          subscribed: data.subscribed,
          subscribedFields: data.subscribedFields || [],
          pageName: data.pageName || prev.data?.pageName,
          resubscribeError: data.success ? undefined : data.error,
        },
      }));
      if (data.success && data.subscribed) {
        toast.success("Webhook da página reassinado com sucesso!");
      } else {
        toast.warn(data.error || "Reassinatura executada, mas 'messages' ainda não consta como assinado");
      }
    } catch (err) {
      setMetaHealth(prev => ({ ...prev, resubscribing: false }));
      toastError(err);
    }
  };

  const restartWhatsapps = async () => {

    try {
      await api.post(`/whatsapp-restart/`);
      toast.success(i18n.t("connections.waitConnection"));
    } catch (err) {
      // 403 = sem permissão connections.update (admin)
      // Silencia o erro
      if (err?.response?.status !== 403) {
        toastError(err);
      }
    }
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={confirmModalInfo.title}
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={handleSubmitConfirmationModal}
      >
        {confirmModalInfo.message}
      </ConfirmationModal>
      {qrModalOpen && (
        <QrcodeModal
          open={qrModalOpen}
          onClose={handleCloseQrModal}
          whatsAppId={!whatsAppModalOpen && selectedWhatsApp?.id}
        />
      )}
      <TransferTicketsModal
        open={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        connections={whatsApps || []}
        mode="transfer"
      />
      <TransferTicketsModal
        open={deleteGuard.open}
        onClose={() => setDeleteGuard({ open: false, whatsApp: null, count: 0 })}
        connections={whatsApps || []}
        initialSourceId={deleteGuard.whatsApp?.id}
        mode="beforeDelete"
        activeCount={deleteGuard.count}
        onTransferAndDelete={async () => {
          const id = deleteGuard.whatsApp?.id;
          setDeleteGuard({ open: false, whatsApp: null, count: 0 });
          if (id) await deleteConnectionById(id);
        }}
        onDeleteOnly={async () => {
          const id = deleteGuard.whatsApp?.id;
          setDeleteGuard({ open: false, whatsApp: null, count: 0 });
          if (id) await deleteConnectionById(id);
        }}
      />
      {metaSelectKey && (
        <MetaSelectModal
          open
          selectionKey={metaSelectKey}
          onClose={handleCloseMetaSelect}
          onConnected={handleMetaSelectConnected}
        />
      )}
      <WhatsAppModal
        open={whatsAppModalOpen}
        onClose={handleCloseWhatsAppModal}
        whatsAppId={!qrModalOpen && selectedWhatsApp?.id}
        initialChannelType={selectedWhatsApp?.channelType}
      />
      <Menu
        anchorEl={metaMenuAnchorEl}
        open={Boolean(metaMenuAnchorEl)}
        onClose={handleCloseMetaMenu}
      >
        <MenuItem
          onClick={() => {
            openInNewTab("https://business.facebook.com/");
            handleCloseMetaMenu();
          }}
        >
          Meta Business Manager
        </MenuItem>
        <MenuItem
          onClick={() => {
            openInNewTab("https://business.facebook.com/settings");
            handleCloseMetaMenu();
          }}
        >
          Configurações do Business Manager
        </MenuItem>
        <MenuItem
          onClick={() => {
            openInNewTab("https://developers.facebook.com/apps");
            handleCloseMetaMenu();
          }}
        >
          Meta for Developers (Apps)
        </MenuItem>
        <MenuItem
          onClick={() => {
            openInNewTab("https://business.facebook.com/wa/manage/phone-numbers/");
            handleCloseMetaMenu();
          }}
        >
          Gestor do WhatsApp - Números de telefone
        </MenuItem>
        <MenuItem
          onClick={() => {
            openInNewTab("https://business.facebook.com/wa/manage/home");
            handleCloseMetaMenu();
          }}
        >
          Gestor do WhatsApp (Home)
        </MenuItem>
        <MenuItem
          onClick={() => {
            openInNewTab("https://developers.facebook.com/docs/whatsapp/cloud-api/get-started");
            handleCloseMetaMenu();
          }}
        >
          Documentação Oficial da WhatsApp Cloud API
        </MenuItem>
        <MenuItem
          onClick={() => {
            openInNewTab("https://developers.facebook.com/docs/whatsapp/pricing");
            handleCloseMetaMenu();
          }}
        >
          Preços da WhatsApp Cloud API
        </MenuItem>
        <MenuItem
          onClick={() => {
            openInNewTab("https://business.facebook.com/wa/manage/message-templates");
            handleCloseMetaMenu();
          }}
        >
          Gerenciar Templates de Mensagem
        </MenuItem>
      </Menu>
      {!hasPermission("connections.view") ?
        <ForbiddenPage />
        :
        <>
        <motion.div
          variants={bentoContainer}
          initial="hidden"
          animate="show"
          style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 12 }}
        >
          {/* Strip de KPIs bento — espelha os status da lista em tempo real */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard label="Conexões" value={connStats.total} icon={<LinkIcon size={20} />} accent="var(--primary-color)" loading={loading} />
            <StatCard label="Conectadas" value={connStats.connected} icon={<CheckIcon size={20} />} accent="#26c281" loading={loading} />
            <StatCard label="Conectando / QR" value={connStats.connecting} icon={<QrIcon size={20} />} accent="#f39c12" loading={loading} />
            <StatCard label="Desconectadas" value={connStats.disconnected} icon={<DisconnectIcon size={20} />} accent="#e7505a" loading={loading} />
          </div>

        <motion.div variants={itemVariant} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <Paper className={`${classes.paper} bento-panel`} variant="outlined">
          {/* Cabeçalho no padrão /campaigns: título + subtítulo + ações */}
          <div className={classes.header}>
            <div className={classes.headerText}>
              <Title>{i18n.t("connections.title")} ({sortedWhatsApps.length})</Title>
              <span className={classes.subtitle}>
                Gerencie os canais de atendimento da empresa — WhatsApp, Facebook, Instagram e WebChat.
              </span>
            </div>
            <div className={classes.headerActions}>
              {hasPermission("connections.edit") && (whatsApps || []).length > 1 && (
                <Tooltip title={i18n.t("connections.transferTickets")}>
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    onClick={() => setTransferModalOpen(true)}
                    startIcon={<TransferIcon size={16} />}
                    style={{ minHeight: 36 }}
                  >
                    {i18n.t("connections.transferTickets")}
                  </Button>
                </Tooltip>
              )}
              <Tooltip title={i18n.t("connections.restartConnections")}>
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  onClick={restartWhatsapps}
                  startIcon={<RestartIcon size={16} />}
                  style={{ minHeight: 36 }}
                >
                  {i18n.t("connections.restartConnections")}
                </Button>
              </Tooltip>
              <Tooltip title={i18n.t("connections.callSupport")}>
                <IconButton
                  size="small"
                  onClick={() => openInNewTab(`https://wa.me/${process.env.REACT_APP_NUMBER_SUPPORT}`)}
                  style={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 8, padding: 8 }}
                >
                  <SupportIcon size={16} />
                </IconButton>
              </Tooltip>
              <PopupState variant="popover" popupId="demo-popup-menu">
                {(popupState) => (
                  <React.Fragment>
                    {hasPermission("connections.create") && (
                      <>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          startIcon={<AddIcon size={16} />}
                          {...bindTrigger(popupState)}
                          style={{ minHeight: 36 }}
                        >
                          {i18n.t("connections.newConnection")}
                        </Button>
                                <Menu
                                  {...bindMenu(popupState)}
                                  anchorOrigin={{
                                    vertical: 'bottom',
                                    horizontal: 'right',
                                  }}
                                  transformOrigin={{
                                    vertical: 'top',
                                    horizontal: 'right',
                                  }}
                                  getContentAnchorEl={null}
                                >
                                  {/* WHATSAPP */}
                                  <MenuItem
                                    disabled={planConfig?.plan?.useWhatsapp ? false : true}
                                    onClick={() => {
                                      setSelectedWhatsApp(null);
                                      handleOpenWhatsAppModal();
                                      popupState.close();
                                    }}
                                  >
                                    <WhatsApp
                                      fontSize="small"
                                      style={{
                                        marginRight: "10px",
                                        color: "#25D366",
                                      }}
                                    />
                                    WhatsApp
                                  </MenuItem>
                                  {/* FACEBOOK */}
                                  <MenuItem
                                    disabled={planConfig?.plan?.useFacebook ? false : true}
                                    onClick={() => {
                                      setSelectedWhatsApp({ channel: "facebook", channelType: "facebook" });
                                      handleOpenWhatsAppModal();
                                      popupState.close();
                                    }}
                                  >
                                    <Facebook
                                      fontSize="small"
                                      style={{
                                        marginRight: "10px",
                                        color: "#3b5998",
                                      }}
                                    />
                                    Facebook
                                  </MenuItem>
                                  {/* INSTAGRAM */}
                                  <MenuItem
                                    disabled={planConfig?.plan?.useInstagram ? false : true}
                                    onClick={() => {
                                      setSelectedWhatsApp({ channel: "instagram", channelType: "instagram" });
                                      handleOpenWhatsAppModal();
                                      popupState.close();
                                    }}
                                  >
                                    <Instagram
                                      fontSize="small"
                                      style={{
                                        marginRight: "10px",
                                        color: "#e1306c",
                                      }}
                                    />
                                    Instagram
                                  </MenuItem>
                                  {/* WEBCHAT */}
                                  <MenuItem
                                    onClick={() => {
                                      setSelectedWhatsApp({ channel: "webchat", channelType: "webchat" });
                                      handleOpenWhatsAppModal();
                                      popupState.close();
                                    }}
                                  >
                                    <WebChatIcon
                                      fontSize="small"
                                      style={{
                                        marginRight: "10px",
                                        color: "#6B46C1",
                                      }}
                                    />
                                    WebChat
                                  </MenuItem>
                                </Menu>
                      </>
                    )}
                      </React.Fragment>
                    )}
                  </PopupState>
            </div>
          </div>

          {/* Toolbar: busca + filtro de canal + filtro de status (+ ordenação no mobile) */}
          <div className={classes.toolbar}>
            <TextField
              className={classes.searchField}
              size="small"
              variant="outlined"
              placeholder="Buscar por nome, número, canal ou ID…"
              value={searchParam}
              onChange={(e) => setSearchParam(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon size={16} />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" variant="outlined" className={classes.filterSelect}>
              <Select
                native
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                displayEmpty
              >
                <option value="">Todos os canais</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="webchat">WebChat</option>
              </Select>
            </FormControl>
            <FormControl size="small" variant="outlined" className={classes.filterSelect}>
              <Select
                native
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                displayEmpty
              >
                <option value="">Todos os status</option>
                <option value="CONNECTED">Conectado</option>
                <option value="OPENING">Conectando</option>
                <option value="qrcode">Aguardando QR</option>
                <option value="DISCONNECTED">Desconectado</option>
                <option value="TIMEOUT">Timeout</option>
                <option value="PAIRING">Pareando</option>
              </Select>
            </FormControl>
            {/* Controle de ordenação — visível apenas no mobile (desktop ordena pelo cabeçalho) */}
            {isMobile && (
              <>
                <Select
                  native
                  value={orderBy}
                  onChange={(e) => handleSort(e.target.value)}
                  style={{ fontSize: "0.85rem", marginLeft: "auto" }}
                >
                  <option value="id">ID</option>
                  <option value="channel">Canal</option>
                  <option value="name">{i18n.t("connections.table.name")}</option>
                  <option value="number">{i18n.t("connections.table.number")}</option>
                  <option value="status">{i18n.t("connections.table.status")}</option>
                  <option value="updatedAt">{i18n.t("connections.table.lastUpdate")}</option>
                </Select>
                <IconButton
                  size="small"
                  onClick={() => setOrderDir(d => (d === "asc" ? "desc" : "asc"))}
                >
                  {orderDir === "asc" ? <SortAscIcon size={16} /> : <SortDescIcon size={16} />}
                </IconButton>
              </>
            )}
          </div>

          {loading ? (
            <Table>
              <TableBody>
                <TableRowSkeleton columns={1} />
              </TableBody>
            </Table>
          ) : sortedWhatsApps.length === 0 ? (
            <div className={classes.emptyState}>
              <WhatsApp style={{ fontSize: 44, color: theme.palette.text.disabled }} />
              <div>Nenhuma conexão encontrada.</div>
            </div>
          ) : (
            <>

              {/* Cards — mobile */}
              <div className={classes.mobileList}>
                {sortedWhatsApps?.map((whatsApp) => {
                  const info = channelInfo(whatsApp);
                  const isMeta = whatsApp.channel === "facebook" || whatsApp.channel === "instagram";

                  return (
                    <motion.div key={whatsApp.id} className={classes.card} variants={itemVariant}>
                      <div className={classes.cardHeader}>
                        <div className={classes.cardTitle}>
                          <span
                            className={classes.channelAvatar}
                            style={{ backgroundColor: `${info.color}1a` }}
                          >
                            {IconChannel(whatsApp.channel, whatsApp.channelType)}
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div className={classes.cardName} title={whatsApp.name}>
                              {whatsApp.name}
                            </div>
                            <Box display="flex" alignItems="center" style={{ gap: 6, marginTop: 2 }}>
                              <ConnectionIdBadge whatsApp={whatsApp} />
                              <ChannelTypeTag whatsApp={whatsApp} />
                            </Box>
                          </div>
                        </div>
                        <Box display="flex" alignItems="center" style={{ gap: 6 }}>
                          {whatsApp.status === "OPENING" && (
                            <CircularProgress size={12} className={classes.buttonProgress} />
                          )}
                          <ConnectionStatusChip whatsApp={whatsApp} />
                        </Box>
                      </div>

                      <div className={classes.cardMeta}>
                        <div>
                          <div className={classes.metaLabel}>
                            {isMeta ? "Página/Conta" : i18n.t("connections.table.number")}
                          </div>
                          <div className={classes.metaValue}>
                            {whatsApp.number && whatsApp.channel === 'whatsapp'
                              ? formatSerializedId(whatsApp.number)
                              : (whatsApp.number || (isMeta ? `#${whatsApp.facebookPageUserId}` : "—"))}
                          </div>
                        </div>
                        <div>
                          <div className={classes.metaLabel}>{i18n.t("connections.table.lastUpdate")}</div>
                          <div className={classes.metaValue}>{whatsApp.updatedAt ? format(parseISO(whatsApp.updatedAt), "dd/MM/yy HH:mm") : "—"}</div>
                        </div>
                        <div>
                          <div className={classes.metaLabel}>{i18n.t("connections.table.default")}</div>
                          <div className={classes.metaValue}>{whatsApp.isDefault ? <CheckIcon size={18} style={{ color: green[500] }} /> : "—"}</div>
                        </div>
                      </div>

                      <div className={classes.cardActions}>
                        {renderActionButtons(whatsApp)}
                        {hasPermission("connections.create") && (
                          <>
                            <IconButton
                              size="small"
                              className={classes.actionButton}
                              onClick={() => handleEditWhatsApp(whatsApp)}
                            >
                              <EditIcon size={18} />
                            </IconButton>

                            {isMeta && (
                              <Tooltip title="Diagnosticar webhook/token Meta">
                                <IconButton
                                  size="small"
                                  className={classes.actionButton}
                                  onClick={() => handleMetaHealth(whatsApp)}
                                >
                                  <HealthIcon size={18} />
                                </IconButton>
                              </Tooltip>
                            )}

                            {whatsApp.channel === 'whatsapp' && whatsApp.channelType === "official" && (
                              <IconButton
                                size="small"
                                className={classes.actionButton}
                                onClick={(e) => {
                                  e.stopPropagation && e.stopPropagation();
                                  handleOpenMetaMenu(e);
                                }}
                              >
                                <MoreIcon size={18} />
                              </IconButton>
                            )}

                            <IconButton
                              size="small"
                              className={classes.actionButton}
                              onClick={() => handleDeleteConnection(whatsApp)}
                            >
                              <DeleteIcon size={18} />
                            </IconButton>
                          </>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Tabela — desktop, colunas ordenáveis */}
              <div className={classes.desktopTableWrapper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {[
                        { key: "id", label: "ID" },
                        { key: "channel", label: "Channel" },
                        { key: "name", label: i18n.t("connections.table.name") },
                        { key: "number", label: i18n.t("connections.table.number") },
                        { key: "status", label: i18n.t("connections.table.status") },
                        { key: "updatedAt", label: i18n.t("connections.table.lastUpdate") },
                        { key: "isDefault", label: i18n.t("connections.table.default") },
                      ].map(col => (
                        <TableCell
                          key={col.key}
                          align="center"
                          className={classes.headCell}
                          sortDirection={orderBy === col.key ? orderDir : false}
                        >
                          <TableSortLabel
                            active={orderBy === col.key}
                            direction={orderBy === col.key ? orderDir : "asc"}
                            onClick={() => handleSort(col.key)}
                          >
                            {col.label}
                          </TableSortLabel>
                        </TableCell>
                      ))}
                      <TableCell align="center" className={classes.headCell}>
                        {i18n.t("connections.table.actions")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedWhatsApps?.map((whatsApp) => {
                      const info = channelInfo(whatsApp);
                      const isMeta = whatsApp.channel === "facebook" || whatsApp.channel === "instagram";

                      return (
                        <TableRow key={whatsApp.id} className={classes.rowHover}>
                          <TableCell align="center" className={classes.bodyCell}>
                            <ConnectionIdBadge whatsApp={whatsApp} />
                          </TableCell>
                          <TableCell align="center" className={classes.bodyCell}>
                            <Tooltip title={info.label}>
                              <span className={classes.channelAvatar} style={{ backgroundColor: `${info.color}1a`, margin: "0 auto" }}>
                                {IconChannel(whatsApp.channel, whatsApp.channelType)}
                              </span>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="center" className={classes.bodyCell}>
                            <Box display="flex" alignItems="center" justifyContent="center" style={{ gap: 6 }}>
                              <span className={classes.connName}>{whatsApp.name}</span>
                              <ChannelTypeTag whatsApp={whatsApp} />
                            </Box>
                          </TableCell>
                          <TableCell align="center" className={classes.bodyCell}>
                            {whatsApp.number && whatsApp.channel === 'whatsapp'
                              ? formatSerializedId(whatsApp.number)
                              : (whatsApp.number || (isMeta ? `#${whatsApp.facebookPageUserId}` : "—"))}
                          </TableCell>
                          <TableCell align="center" className={classes.bodyCell}>
                            <Box display="flex" alignItems="center" justifyContent="center" style={{ gap: 6 }}>
                              {whatsApp.status === "OPENING" && (
                                <CircularProgress size={12} className={classes.buttonProgress} />
                              )}
                              <ConnectionStatusChip whatsApp={whatsApp} />
                            </Box>
                          </TableCell>
                          <TableCell align="center" className={classes.bodyCell}>
                            {whatsApp.updatedAt ? format(parseISO(whatsApp.updatedAt), "dd/MM/yy HH:mm") : "—"}
                          </TableCell>
                          <TableCell align="center" className={classes.bodyCell}>
                            {whatsApp.isDefault ? <CheckIcon size={18} style={{ color: green[500] }} /> : "—"}
                          </TableCell>
                          <TableCell align="center" className={`${classes.bodyCell} ${classes.actionsCell}`}>
                            <Box display="flex" alignItems="center" justifyContent="center">
                              {renderActionButtons(whatsApp)}
                              {hasPermission("connections.create") && (
                                <>
                                  <IconButton size="small" onClick={() => handleEditWhatsApp(whatsApp)}>
                                    <EditIcon size={18} />
                                  </IconButton>
                                  {isMeta && (
                                    <Tooltip title="Diagnosticar webhook/token Meta">
                                      <IconButton size="small" onClick={() => handleMetaHealth(whatsApp)}>
                                        <HealthIcon size={18} />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                  {whatsApp.channel === 'whatsapp' && whatsApp.channelType === "official" && (
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation && e.stopPropagation();
                                        handleOpenMetaMenu(e);
                                      }}
                                    >
                                      <MoreIcon size={18} />
                                    </IconButton>
                                  )}
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteConnection(whatsApp)}
                                  >
                                    <DeleteIcon size={18} />
                                  </IconButton>
                                </>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              </>
            )}
          </Paper>
        </motion.div>
        </motion.div>

          {/* Diagnóstico Meta — token, assinatura da página e dicas */}
          <Dialog
            open={metaHealth.open}
            onClose={() => setMetaHealth({ open: false, loading: false, data: null, name: "" })}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Diagnóstico Meta — {metaHealth.name}</DialogTitle>
            <DialogContent dividers>
              {metaHealth.loading && (
                <Box display="flex" justifyContent="center" py={3}>
                  <CircularProgress size={28} />
                </Box>
              )}
              {metaHealth.data && (
                <Box display="flex" flexDirection="column" style={{ gap: 12 }}>
                  <div>
                    <div className={classes.metaLabel}>Canal / Página</div>
                    <div className={classes.metaValue}>
                      {metaHealth.data.channel} · {metaHealth.data.pageName || ""} ({metaHealth.data.pageId})
                    </div>
                  </div>
                  <div>
                    <div className={classes.metaLabel}>Token da página</div>
                    <div className={classes.metaValue} style={{ color: metaHealth.data.tokenValid ? green[500] : "#c62828" }}>
                      {metaHealth.data.tokenValid ? "Válido" : `Inválido${metaHealth.data.tokenError ? ` — ${metaHealth.data.tokenError}` : ""}`}
                    </div>
                  </div>
                  <div>
                    <div className={classes.metaLabel}>Assinatura de webhook na página</div>
                    <div className={classes.metaValue} style={{ color: metaHealth.data.subscribed ? green[500] : "#b26a00" }}>
                      {metaHealth.data.subscribed
                        ? `Assinado (${(metaHealth.data.subscribedFields || []).join(", ") || "messages"})`
                        : "Sem 'messages' assinado"}
                    </div>
                  </div>
                  {metaHealth.data.resubscribeError && (
                    <div className={classes.metaValue} style={{ color: "#c62828" }}>
                      Erro ao reassinar: {metaHealth.data.resubscribeError}
                    </div>
                  )}
                  {metaHealth.data.hints?.length > 0 && (
                    <div>
                      <div className={classes.metaLabel}>Recomendações</div>
                      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                        {metaHealth.data.hints.map((h, i) => (
                          <li key={i} style={{ fontSize: "0.85rem" }}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              {hasPermission("connections.edit") && (
                <Button
                  color="primary"
                  variant="outlined"
                  disabled={metaHealth.loading || metaHealth.resubscribing}
                  onClick={handleMetaResubscribe}
                  startIcon={metaHealth.resubscribing ? <CircularProgress size={14} /> : <SyncIcon size={16} />}
                >
                  {metaHealth.resubscribing ? "Reassinando…" : "Reassinar webhook"}
                </Button>
              )}
              <Button onClick={() => setMetaHealth({ open: false, loading: false, data: null, name: "" })}>
                Fechar
              </Button>
            </DialogActions>
          </Dialog>
        </>
      }
    </MainContainer >

  );
};

export default Connections;