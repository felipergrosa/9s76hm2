
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
  Chip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
} from "@material-ui/core";

import {
  Edit,
  CheckCircle,
  CropFree,
  DeleteOutline,
  Facebook,
  Instagram,
  WhatsApp,
  MoreVert,
  Replay,
  Autorenew,
  DeleteSweep,
  PowerSettingsNew,
  Chat as WebChatIcon,
  Sync,
  Assessment,
  ArrowUpward,
  ArrowDownward,
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";

import api from "../../services/api";
import WhatsAppModal from "../../components/WhatsAppModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import MetaSelectModal from "../../components/MetaSelectModal";
import QrcodeModal from "../../components/QrcodeModal";
import { i18n } from "../../translate/i18n";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import toastError from "../../errors/toastError";
import formatSerializedId from '../../utils/formatSerializedId';
import { AuthContext } from "../../context/Auth/AuthContext";
import usePlans from "../../hooks/usePlans";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";
import ForbiddenPage from "../../components/ForbiddenPage";
import { Can } from "../../components/Can";
import usePermissions from "../../hooks/usePermissions";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    // padding: theme.spacing(1),
    padding: theme.padding,
    ...theme.scrollbarStyles,
  },
  buttonProgress: {
    color: green[500],
  },
  connectionsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: theme.spacing(2),
    [theme.breakpoints.up("sm")]: {
      display: "none",
    },
  },
  desktopTableWrapper: {
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  sortableHeader: {
    whiteSpace: "nowrap",
    fontWeight: 600,
  },
  card: {
    borderRadius: 14,
    padding: theme.spacing(2),
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    border: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.25),
    background: theme.palette.background.paper,
    transition: "box-shadow .2s ease, transform .2s ease",
    "&:hover": {
      boxShadow: "0 10px 28px rgba(0,0,0,0.14)",
      transform: "translateY(-2px)",
    },
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
  channelAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    "& svg": { fontSize: 22 },
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
  statusChip: {
    height: 24,
    fontWeight: 600,
    fontSize: "0.72rem",
    flexShrink: 0,
  },
  cardMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: theme.spacing(1),
  },
  metaLabel: {
    fontSize: "0.85rem",
    color: theme.palette.text.secondary,
  },
  metaValue: {
    fontSize: "0.95rem",
    fontWeight: 600,
    wordBreak: "break-word",
  },
  cardActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
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

// Chip de status com texto (mais legível que o ícone sozinho)
const statusInfo = (whatsApp) => {
  const isBaileys = !whatsApp.channelType || whatsApp.channelType === "baileys";
  switch (whatsApp.status) {
    case "CONNECTED":
      return { label: "Conectado", color: "#2e7d32", bg: "rgba(46,125,50,.12)" };
    case "OPENING":
      return { label: "Conectando…", color: "#1565c0", bg: "rgba(21,101,192,.12)" };
    case "qrcode":
      return isBaileys
        ? { label: "Aguardando QR Code", color: "#b26a00", bg: "rgba(255,152,0,.14)" }
        : { label: "Desconectado", color: "#c62828", bg: "rgba(198,40,40,.12)" };
    case "TIMEOUT":
      return { label: "Timeout", color: "#b26a00", bg: "rgba(255,152,0,.14)" };
    case "PAIRING":
      return { label: "Pareando", color: "#1565c0", bg: "rgba(21,101,192,.12)" };
    default:
      return { label: "Desconectado", color: "#c62828", bg: "rgba(198,40,40,.12)" };
  }
};

const Connections = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const { whatsApps, loading } = useContext(WhatsAppsContext);

  // Ordenação compartilhada (tabela desktop + cards mobile)
  const [orderBy, setOrderBy] = useState("id");
  const [orderDir, setOrderDir] = useState("asc");

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
    const list = [...(whatsApps || [])];
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
  }, [whatsApps, orderBy, orderDir]);

  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [, setStatusImport] = useState([]);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [metaMenuAnchorEl, setMetaMenuAnchorEl] = useState(null);
  const [metaSelectKey, setMetaSelectKey] = useState(null);
  // Diagnóstico Meta (token + subscribed_apps) por conexão
  const [metaHealth, setMetaHealth] = useState({ open: false, loading: false, data: null, name: "" });
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
      try {
        await api.delete(`/whatsapp/${confirmModalInfo.whatsAppId}`);
        toast.success(i18n.t("connections.toasts.deleted"));
      } catch (err) {
        // 403 = sem permissão connections.delete (admin)
        // Silencia o erro
        if (err?.response?.status !== 403) {
          toastError(err);
        }
      }
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
              <CheckCircle />
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

  const renderActionButtons = (whatsApp) => {
    const isBaileys = !whatsApp.channelType || whatsApp.channelType === "baileys";

    return (
      <>
        {whatsApp.status === "qrcode" && isBaileys && (
          <Can
            user={user}
            perform="connections.edit"
            yes={() => (
              <Tooltip title={i18n.t("connections.buttons.qrcode")}>
                <span>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => handleOpenQrModal(whatsApp)}
                  >
                    <CropFree />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          />
        )}
        {whatsApp.status === "DISCONNECTED" && (
          <Can
            user={user}
            perform="connections.edit"
            yes={() => (
              <>
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
                        <Replay />
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
                            <Autorenew />
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
                            <DeleteSweep />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </>
                  )}
                </Box>
              </>
            )}
          />
        )}
        {(whatsApp.status === "CONNECTED" ||
          whatsApp.status === "PAIRING" ||
          whatsApp.status === "TIMEOUT") && (
            <Can
              user={user}
              perform="connections.edit"
              yes={() => (
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
                            <Sync />
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
                        <PowerSettingsNew />
                      </IconButton>
                    </span>
                  </Tooltip>

                  {renderImportButton(whatsApp)}
                </>
              )}
            />
          )}
        {whatsApp.status === "OPENING" && (
          <Tooltip title={i18n.t("connections.buttons.connecting")}>
            <span>
              <IconButton size="small" disabled>
                <Autorenew />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </>
    );
  };

  // Diagnóstico de saúde da integração Meta (token + assinatura de webhook)
  const handleMetaHealth = async (whatsApp) => {
    setMetaHealth({ open: true, loading: true, data: null, name: whatsApp.name });
    try {
      const { data } = await api.get(`/whatsapp/${whatsApp.id}/meta-health`);
      setMetaHealth({ open: true, loading: false, data, name: whatsApp.name });
    } catch (err) {
      setMetaHealth({ open: false, loading: false, data: null, name: "" });
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
          <MainHeader>
            <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <Title>{i18n.t("connections.title")} ({whatsApps.length})</Title>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Grid container spacing={1} justifyContent="flex-end">
                  <Grid item xs={12} sm="auto">
                    <Button
                      fullWidth={isMobile}
                      variant="contained"
                      color="primary"
                      onClick={restartWhatsapps}
                      style={{ minHeight: 44 }}
                    >
                      {i18n.t("connections.restartConnections")}
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm="auto">
                    <Button
                      fullWidth={isMobile}
                      variant="contained"
                      color="primary"
                      onClick={() => openInNewTab(`https://wa.me/${process.env.REACT_APP_NUMBER_SUPPORT}`)}
                      style={{ minHeight: 44 }}
                    >
                      {i18n.t("connections.callSupport")}
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm="auto">
                    <PopupState variant="popover" popupId="demo-popup-menu">
                      {(popupState) => (
                        <React.Fragment>
                          <Can
                            user={user}
                            perform="connections.create"
                            yes={() => (
                              <>
                                <Button
                                  fullWidth={isMobile}
                                  variant="contained"
                                  color="primary"
                                  {...bindTrigger(popupState)}
                                  style={{ minHeight: 44 }}
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
                          />
                        </React.Fragment>
                      )}
                    </PopupState>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </MainHeader>


          <Paper className={classes.mainPaper} variant="outlined">
            {loading ? (
              <Table>
                <TableBody>
                  <TableRowSkeleton columns={1} />
                </TableBody>
              </Table>
            ) : (
              <>
              {/* Controle de ordenação — visível apenas no mobile (desktop ordena pelo cabeçalho) */}
              {isMobile && (
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="flex-end"
                  mb={1}
                  style={{ gap: 8 }}
                >
                  <Select
                    native
                    value={orderBy}
                    onChange={(e) => handleSort(e.target.value)}
                    style={{ fontSize: "0.85rem" }}
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
                    {orderDir === "asc" ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
                  </IconButton>
                </Box>
              )}

              {/* Cards — mobile */}
              <div className={classes.connectionsGrid}>
                {sortedWhatsApps?.map((whatsApp) => {
                  const info = channelInfo(whatsApp);
                  const st = statusInfo(whatsApp);
                  const isMeta = whatsApp.channel === "facebook" || whatsApp.channel === "instagram";

                  return (
                    <div key={whatsApp.id} className={classes.card}>
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
                            <div className={classes.metaLabel}>
                              {info.label} · #{whatsApp.id}
                            </div>
                          </div>
                        </div>
                        <Chip
                          label={st.label}
                          size="small"
                          className={classes.statusChip}
                          style={{ color: st.color, backgroundColor: st.bg }}
                          icon={whatsApp.status === "OPENING" ? (
                            <CircularProgress size={14} style={{ color: st.color, marginLeft: 8 }} />
                          ) : undefined}
                        />
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
                          <div className={classes.metaValue}>{whatsApp.isDefault ? <CheckCircle style={{ color: green[500] }} /> : "—"}</div>
                        </div>
                      </div>

                      <div className={classes.cardActions}>
                        {renderActionButtons(whatsApp)}
                        <Can
                          user={user}
                          perform="connections.create"
                          yes={() => (
                            <>
                              <IconButton
                                size="small"
                                className={classes.actionButton}
                                onClick={() => handleEditWhatsApp(whatsApp)}
                              >
                                <Edit />
                              </IconButton>

                              {isMeta && (
                                <Tooltip title="Diagnosticar webhook/token Meta">
                                  <IconButton
                                    size="small"
                                    className={classes.actionButton}
                                    onClick={() => handleMetaHealth(whatsApp)}
                                  >
                                    <Assessment />
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
                                  <MoreVert />
                                </IconButton>
                              )}

                              <IconButton
                                size="small"
                                className={classes.actionButton}
                                onClick={() => {
                                  handleOpenConfirmationModal("delete", whatsApp.id);
                                }}
                              >
                                <DeleteOutline />
                              </IconButton>
                            </>
                          )}
                        />
                      </div>
                    </div>
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
                          className={classes.sortableHeader}
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
                      <TableCell align="center" className={classes.sortableHeader}>
                        {i18n.t("connections.table.actions")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedWhatsApps?.map((whatsApp) => {
                      const info = channelInfo(whatsApp);
                      const st = statusInfo(whatsApp);
                      const isMeta = whatsApp.channel === "facebook" || whatsApp.channel === "instagram";

                      return (
                        <TableRow key={whatsApp.id} hover>
                          <TableCell align="center">#{whatsApp.id}</TableCell>
                          <TableCell align="center">
                            <Tooltip title={info.label}>
                              <span className={classes.channelAvatar} style={{ backgroundColor: `${info.color}1a`, width: 32, height: 32, borderRadius: 8, margin: "0 auto" }}>
                                {IconChannel(whatsApp.channel, whatsApp.channelType)}
                              </span>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="center">
                            <Box display="flex" alignItems="center" justifyContent="center" style={{ gap: 6 }}>
                              <span>{whatsApp.name}</span>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            {whatsApp.number && whatsApp.channel === 'whatsapp'
                              ? formatSerializedId(whatsApp.number)
                              : (whatsApp.number || (isMeta ? `#${whatsApp.facebookPageUserId}` : "—"))}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={st.label}
                              size="small"
                              className={classes.statusChip}
                              style={{ color: st.color, backgroundColor: st.bg }}
                              icon={whatsApp.status === "OPENING" ? (
                                <CircularProgress size={14} style={{ color: st.color, marginLeft: 8 }} />
                              ) : undefined}
                            />
                          </TableCell>
                          <TableCell align="center">{whatsApp.updatedAt ? format(parseISO(whatsApp.updatedAt), "dd/MM/yy HH:mm") : "—"}</TableCell>
                          <TableCell align="center">
                            {whatsApp.isDefault ? <CheckCircle style={{ color: green[500] }} /> : "—"}
                          </TableCell>
                          <TableCell align="center">
                            <Box display="flex" alignItems="center" justifyContent="center">
                              {renderActionButtons(whatsApp)}
                              <Can
                                user={user}
                                perform="connections.create"
                                yes={() => (
                                  <>
                                    <IconButton size="small" onClick={() => handleEditWhatsApp(whatsApp)}>
                                      <Edit />
                                    </IconButton>
                                    {isMeta && (
                                      <Tooltip title="Diagnosticar webhook/token Meta">
                                        <IconButton size="small" onClick={() => handleMetaHealth(whatsApp)}>
                                          <Assessment />
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
                                        <MoreVert />
                                      </IconButton>
                                    )}
                                    <IconButton
                                      size="small"
                                      onClick={() => handleOpenConfirmationModal("delete", whatsApp.id)}
                                    >
                                      <DeleteOutline />
                                    </IconButton>
                                  </>
                                )}
                              />
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
                        ? `Assinado (${metaHealth.data.subscribedFields.join(", ") || "messages"})`
                        : "Sem 'messages' assinado"}
                    </div>
                  </div>
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