
import React, { useState, useCallback, useContext, useEffect } from "react";
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
  IconButton,
  Table,
  TableHead,
  Paper,
  Tooltip,
  Typography,
  CircularProgress,
  Box,
  Card,
  CardContent,
  Chip,
  Grid
} from "@material-ui/core";

import {
  Edit,
  CheckCircle,
  SignalCellularConnectedNoInternet2Bar,
  SignalCellularConnectedNoInternet0Bar,
  SignalCellular4Bar,
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
} from "@material-ui/icons";

import FacebookLogin from "react-facebook-login/dist/facebook-login-render-props";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";

import api from "../../services/api";
import WhatsAppModal from "../../components/WhatsAppModal";
import ConfirmationModal from "../../components/ConfirmationModal";
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

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    // padding: theme.spacing(1),
    padding: theme.padding,
    ...theme.scrollbarStyles,
  },
  customTableCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  tooltip: {
    backgroundColor: "#f5f5f9",
    color: "rgba(0, 0, 0, 0.87)",
    fontSize: theme.typography.pxToRem(14),
    border: "1px solid #dadde9",
    maxWidth: 450,
  },
  tooltipPopper: {
    textAlign: "center",
  },
  buttonProgress: {
    color: green[500],
  },
  mobileList: {
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
  card: {
    borderRadius: 14,
    padding: theme.spacing(2),
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
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
    gap: theme.spacing(1),
    fontWeight: 700,
    fontSize: "1.05rem",
    lineHeight: 1.2,
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

function CircularProgressWithLabel(props) {
  return (
    <Box position="relative" display="inline-flex">
      <CircularProgress variant="determinate" {...props} />
      <Box
        top={0}
        left={0}
        bottom={0}
        right={0}
        position="absolute"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Typography
          variant="caption"
          component="div"
          color="textSecondary"
        >{`${Math.round(props.value)}%`}</Typography>
      </Box>
    </Box>
  );
}

const CustomToolTip = ({ title, content, children }) => {
  const classes = useStyles();

  return (
    <Tooltip
      arrow
      classes={{
        tooltip: classes.tooltip,
        popper: classes.tooltipPopper,
      }}
      title={
        <React.Fragment>
          <Typography gutterBottom color="inherit">
            {title}
          </Typography>
          {content && <Typography>{content}</Typography>}
        </React.Fragment>
      }
    >
      {children}
    </Tooltip>
  );
};

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

const Connections = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const { whatsApps, loading } = useContext(WhatsAppsContext);

  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [statusImport, setStatusImport] = useState([]);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [metaMenuAnchorEl, setMetaMenuAnchorEl] = useState(null);
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

  const { user, socket } = useContext(AuthContext);

  const companyId = user.companyId;

  const { getPlanCompany } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const planConfigs = await getPlanCompany(undefined, companyId);
      setPlanConfig(planConfigs)
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const responseFacebook = (response) => {
    if (response.status !== "unknown") {
      const { accessToken, id } = response;

      api
        .post("/facebook", {
          facebookUserId: id,
          facebookUserToken: accessToken,
        })
        .then((response) => {
          toast.success(i18n.t("connections.facebook.success"));
        })
        .catch((error) => {
          toastError(error);
        });
    }
  };

  const responseInstagram = (response) => {
    if (response.status !== "unknown") {
      const { accessToken, id } = response;

      api
        .post("/facebook", {
          addInstagram: true,
          facebookUserId: id,
          facebookUserToken: accessToken,
        })
        .then((response) => {
          toast.success(i18n.t("connections.facebook.success"));
        })
        .catch((error) => {
          toastError(error);
        });
    }
  };

  useEffect(() => {
    socket.on(`importMessages-${user.companyId}`, (data) => {
      if (data.action === "refresh") {
        setStatusImport([]);
        history.go(0);
      }
      if (data.action === "update") {
        setStatusImport(data.status);
      }
    });

    /* return () => {
      socket.disconnect();
    }; */
  }, [whatsApps]);

  const handleStartWhatsAppSession = async (whatsAppId) => {
    if (!whatsAppId) {
      console.error("[ERRO] handleStartWhatsAppSession: ID inválido");
      return;
    }
    try {
      await api.post(`/whatsappsession/${whatsAppId}`);
    } catch (err) {
      toastError(err);
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
      toastError(err);
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

  const handleSubmitConfirmationModal = async () => {
    if (confirmModalInfo.action === "disconnect") {
      try {
        await api.delete(`/whatsappsession/${confirmModalInfo.whatsAppId}`);
      } catch (err) {
        toastError(err);
      }
    }

    if (confirmModalInfo.action === "delete") {
      try {
        await api.delete(`/whatsapp/${confirmModalInfo.whatsAppId}`);
        toast.success(i18n.t("connections.toasts.deleted"));
      } catch (err) {
        toastError(err);
      }
    }
    if (confirmModalInfo.action === "closedImported") {
      try {
        await api.post(`/closedimported/${confirmModalInfo.whatsAppId}`);
        toast.success(i18n.t("connections.toasts.closedimported"));
      } catch (err) {
        toastError(err);
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
            role={user.profile === "user" && user.allowConnections === "enabled" ? "admin" : user.profile}
            perform="connections-page:addConnection"
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
            role={user.profile === "user" && user.allowConnections === "enabled" ? "admin" : user.profile}
            perform="connections-page:addConnection"
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
              role={user.profile}
              perform="connections-page:addConnection"
              yes={() => (
                <>
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

  const renderStatusToolTips = (whatsApp) => {
    const isBaileys = !whatsApp.channelType || whatsApp.channelType === "baileys";

    return (
      <div className={classes.customTableCell}>
        {(whatsApp.status === "DISCONNECTED" ||
          (whatsApp.status === "qrcode" && !isBaileys)) && (
            <CustomToolTip
              title={i18n.t("connections.toolTips.disconnected.title")}
              content={i18n.t("connections.toolTips.disconnected.content")}
            >
              <SignalCellularConnectedNoInternet0Bar color="secondary" />
            </CustomToolTip>
          )}
        {whatsApp.status === "OPENING" && (
          <CircularProgress size={24} className={classes.buttonProgress} />
        )}
        {whatsApp.status === "qrcode" && isBaileys && (
          <CustomToolTip
            title={i18n.t("connections.toolTips.qrcode.title")}
            content={i18n.t("connections.toolTips.qrcode.content")}
          >
            <CropFree />
          </CustomToolTip>
        )}
        {whatsApp.status === "CONNECTED" && (
          <CustomToolTip title={i18n.t("connections.toolTips.connected.title")}>
            <SignalCellular4Bar style={{ color: green[500] }} />
          </CustomToolTip>
        )}
        {(whatsApp.status === "TIMEOUT" || whatsApp.status === "PAIRING") && (
          <CustomToolTip
            title={i18n.t("connections.toolTips.timeout.title")}
            content={i18n.t("connections.toolTips.timeout.content")}
          >
            <SignalCellularConnectedNoInternet2Bar color="secondary" />
          </CustomToolTip>
        )}
      </div>
    );
  };

  const restartWhatsapps = async () => {

    try {
      await api.post(`/whatsapp-restart/`);
      toast.success(i18n.t("connections.waitConnection"));
    } catch (err) {
      toastError(err);
    }
  }

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
      {user.profile === "user" && user.allowConnections === "disabled" ?
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
                            role={user.profile}
                            perform="connections-page:addConnection"
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
            {/* Mobile cards */}
            <div className={classes.mobileList}>
              {loading ? (
                <TableRowSkeleton columns={1} />
              ) : (
                whatsApps?.map((whatsApp) => (
                  <div key={whatsApp.id} className={classes.card}>
                    <div className={classes.cardHeader}>
                      <div className={classes.cardTitle}>
                        {IconChannel(whatsApp.channel, whatsApp.channelType)}
                        <span style={{ color: '#888', fontSize: '0.8rem' }}>#{whatsApp.id}</span>
                        {whatsApp.name}
                        {whatsApp.channel === 'whatsapp' && whatsApp.channelType === "official" && (
                          <Chip
                            label="API Oficial"
                            color="primary"
                            size="small"
                            style={{ fontSize: '0.7rem', height: '20px' }}
                          />
                        )}
                        {whatsApp.channel === 'whatsapp' && whatsApp.channelType === "baileys" && (
                          <Chip
                            label="Baileys"
                            size="small"
                            variant="outlined"
                            style={{ fontSize: '0.7rem', height: '20px' }}
                          />
                        )}
                      </div>
                      <div className={classes.metaValue}>{whatsApp.number && whatsApp.channel === 'whatsapp' ? formatSerializedId(whatsApp.number) : (whatsApp.number || "—")}</div>
                    </div>
                    <div className={classes.cardMeta}>
                      <div>
                        <div className={classes.metaLabel}>{i18n.t("connections.table.status")}</div>
                        <div className={classes.metaValue}>{renderStatusToolTips(whatsApp)}</div>
                      </div>
                      <div>
                        <div className={classes.metaLabel}>{i18n.t("connections.table.lastUpdate")}</div>
                        <div className={classes.metaValue}>{format(parseISO(whatsApp.updatedAt), "dd/MM/yy HH:mm")}</div>
                      </div>
                      <div>
                        <div className={classes.metaLabel}>{i18n.t("connections.table.default")}</div>
                        <div className={classes.metaValue}>{whatsApp.isDefault ? <CheckCircle style={{ color: green[500] }} /> : "—"}</div>
                      </div>
                    </div>
                    <div className={classes.cardActions}>
                      {renderActionButtons(whatsApp)}
                      <Can
                        role={user.profile}
                        perform="connections-page:addConnection"
                        yes={() => (
                          <>
                            <IconButton
                              size="small"
                              className={classes.actionButton}
                              onClick={() => handleEditWhatsApp(whatsApp)}
                            >
                              <Edit />
                            </IconButton>

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
                ))
              )}
            </div>

            {/* Desktop table */}
            <div className={classes.desktopTableWrapper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell align="center">ID</TableCell>
                    <TableCell align="center">Channel</TableCell>
                    <TableCell align="center">{i18n.t("connections.table.name")}</TableCell>
                    <TableCell align="center">{i18n.t("connections.table.number")}</TableCell>
                    <TableCell align="center">{i18n.t("connections.table.status")}</TableCell>
                    <TableCell align="center">{i18n.t("connections.table.session")}</TableCell>
                    <TableCell align="center">{i18n.t("connections.table.lastUpdate")}</TableCell>
                    <TableCell align="center">{i18n.t("connections.table.default")}</TableCell>
                    <Can
                      role={user.profile === "user" && user.allowConnections === "enabled" ? "admin" : user.profile}
                      perform="connections-page:addConnection"
                      yes={() => (
                        <TableCell align="center">{i18n.t("connections.table.actions")}</TableCell>
                      )}
                    />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRowSkeleton />
                  ) : (
                    <>
                      {whatsApps?.length > 0 &&
                        whatsApps.map((whatsApp) => (
                          <TableRow key={whatsApp.id}>
                            <TableCell align="center">
                              <Chip label={`#${whatsApp.id}`} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell align="center">{IconChannel(whatsApp.channel, whatsApp.channelType)}</TableCell>
                            <TableCell align="center">
                              <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
                                <span>{whatsApp.name}</span>
                                {whatsApp.channel === 'whatsapp' && whatsApp.channelType === "official" && (
                                  <Chip
                                    label="API Oficial"
                                    color="primary"
                                    size="small"
                                    style={{ fontSize: '0.7rem', height: '20px' }}
                                  />
                                )}
                                {whatsApp.channel === 'whatsapp' && whatsApp.channelType === "baileys" && (
                                  <Chip
                                    label="Baileys"
                                    size="small"
                                    variant="outlined"
                                    style={{ fontSize: '0.7rem', height: '20px' }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell align="center">{whatsApp.number && whatsApp.channel === 'whatsapp' ? (<>{formatSerializedId(whatsApp.number)}</>) : whatsApp.number}</TableCell>
                            <TableCell align="center">{renderStatusToolTips(whatsApp)}</TableCell>
                            <TableCell align="center">{renderActionButtons(whatsApp)}</TableCell>
                            <TableCell align="center">{format(parseISO(whatsApp.updatedAt), "dd/MM/yy HH:mm")}</TableCell>
                            <TableCell align="center">
                              {whatsApp.isDefault && (
                                <div className={classes.customTableCell}>
                                  <CheckCircle style={{ color: green[500] }} />
                                </div>
                              )}
                            </TableCell>
                            <Can
                              role={user.profile}
                              perform="connections-page:addConnection"
                              yes={() => (
                                <TableCell align="center">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleEditWhatsApp(whatsApp)}
                                  >
                                    <Edit />
                                  </IconButton>

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
                                    onClick={(e) => {
                                      handleOpenConfirmationModal("delete", whatsApp.id);
                                    }}
                                  >
                                    <DeleteOutline />
                                  </IconButton>
                                </TableCell>
                              )}
                            />
                          </TableRow>
                        ))}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </Paper>
        </>
      }
    </MainContainer >

  );
};

export default Connections;