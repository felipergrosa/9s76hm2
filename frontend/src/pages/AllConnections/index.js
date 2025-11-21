import React, { useState, useCallback, useContext, useEffect } from "react";
import { toast } from "react-toastify";
import { format, parseISO, set } from "date-fns";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import PopupState, { bindTrigger, bindMenu } from "material-ui-popup-state";
import { Stack } from "@mui/material";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { useHistory } from "react-router-dom";
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
  Divider,
  Box,
  Grid,
  useMediaQuery
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
  WhatsApp
} from "@material-ui/icons";

import FacebookLogin from "react-facebook-login/dist/facebook-login-render-props";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import { AuthContext } from "../../context/Auth/AuthContext";
import useCompanies from "../../hooks/useCompanies";
import api from "../../services/api";
import WhatsAppModal from "../../components/WhatsAppModal";
import WhatsAppModalCompany from "../../components/CompanyWhatsapps";
import ConfirmationModal from "../../components/ConfirmationModal";
import QrcodeModal from "../../components/QrcodeModal";
import { i18n } from "../../translate/i18n";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import toastError from "../../errors/toastError";
import ForbiddenPage from "../../components/ForbiddenPage";

const useStyles = makeStyles(theme => ({
  root: {
    flex: 1,
    backgroundColor: theme.palette.background.default,
    minHeight: "100%",
    padding: theme.spacing(2),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },
  container: {
    width: "100%",
    padding: theme.spacing(2),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    borderRadius: "10px",
    boxShadow: "rgba(0, 0, 0, 0.1) 0px 4px 12px",
    ...theme.scrollbarStyles
  },
  customTableCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  tooltip: {
    backgroundColor: "#f5f5f9",
    color: "rgba(0, 0, 0, 0.87)",
    fontSize: theme.typography.pxToRem(14),
    border: "1px solid #dadde9",
    maxWidth: 450
  },
  tooltipPopper: {
    textAlign: "center"
  },
  buttonProgress: {
    color: green[500]
  },
  TableHead: {
    backgroundColor: theme.palette.barraSuperior || "#3d3d3d",
    color: "textSecondary",
    borderRadius: "5px"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableBody: {
    "& tr": {
      borderBottom: `1px solid ${theme.palette.divider}`,
      transition: "background-color 0.2s",
      "&:hover": {
        backgroundColor: theme.palette.action.hover,
      },
      "&:last-child": {
        borderBottom: "none",
      },
    },
    "& td": {
      padding: theme.spacing(1.5),
      fontSize: "0.875rem",
      color: theme.palette.text.primary,
    },
  },
  emptyState: {
    padding: theme.spacing(4),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
}));

const CustomTooltipProps = {
  arrow: true,
  enterTouchDelay: 0,
  leaveTouchDelay: 5000,
  enterDelay: 300,
  leaveDelay: 100,
};

const CustomToolTip = ({ title, content, children }) => {
  const classes = useStyles();

  return (
    <Tooltip
      arrow
      classes={{
        tooltip: classes.tooltip,
        popper: classes.tooltipPopper
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

const IconChannel = channel => {
  switch (channel) {
    case "facebook":
      return <Facebook />;
    case "instagram":
      return <Instagram />;
    case "whatsapp":
      return <WhatsApp />;
    default:
      return "error";
  }
};

const AllConnections = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up(1200));
  const { user, socket } = useContext(AuthContext);
  const { list } = useCompanies();
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(true);
  const [loadingComp, setLoadingComp] = useState(false);
  const [whats, setWhats] = useState([]);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [filterConnections, setFilterConnections] = useState([]);
  const [companyWhatsApps, setCompanyWhatsApps] = useState(null);
  const confirmationModalInitialState = {
    action: "",
    title: "",
    message: "",
    whatsAppId: "",
    open: false
  };
  const [confirmModalInfo, setConfirmModalInfo] = useState(
    confirmationModalInitialState
  );

  const history = useHistory();
  if (!user.super) {
    history.push("/tickets")
  }


  useEffect(() => {
    setLoadingWhatsapp(true);
    const fetchSession = async () => {
      try {
        const { data } = await api.get("/whatsapp/all/?session=0");
        setWhats(data);
        setLoadingWhatsapp(false);
      } catch (err) {
        setLoadingWhatsapp(false);
        toastError(err);
      }
    };
    fetchSession();
  }, []);

  const responseFacebook = response => {
    if (response.status !== "unknown") {
      const { accessToken, id } = response;

      api
        .post("/facebook", {
          facebookUserId: id,
          facebookUserToken: accessToken
        })
        .then(response => {
          toast.success(i18n.t("connections.facebook.success"));
        })
        .catch(error => {
          toastError(error);
        });
    }
  };
  useEffect(() => {
    loadCompanies();
  }, []);
  const loadCompanies = async () => {
    setLoadingComp(true);
    try {
      const companyList = await list();
      setCompanies(companyList);
    } catch (e) {
      toast.error("Não foi possível carregar a lista de registros");
    }
    setLoadingComp(false);
  }

  const responseInstagram = response => {
    if (response.status !== "unknown") {
      const { accessToken, id } = response;

      api
        .post("/facebook", {
          addInstagram: true,
          facebookUserId: id,
          facebookUserToken: accessToken
        })
        .then(response => {
          toast.success(i18n.t("connections.facebook.success"));
        })
        .catch(error => {
          toastError(error);
        });
    }
  };

  const handleStartWhatsAppSession = async whatsAppId => {
    try {
      await api.post(`/whatsappsession/${whatsAppId}`);
    } catch (err) {
      toastError(err);
    }
  };

  const handleRequestNewQrCode = async whatsAppId => {
    try {
      await api.put(`/whatsappsession/${whatsAppId}`);
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenWhatsAppModal = (whatsappsFilter, comp) => {
    setSelectedWhatsApp(null);
    setWhatsAppModalOpen(true);
    if (whatsappsFilter?.length > 0) {
      setFilterConnections(whatsappsFilter);
      setCompanyWhatsApps(comp);
    }
  };



  const handleCloseWhatsAppModal = useCallback(() => {
    setWhatsAppModalOpen(false);
    setSelectedWhatsApp(null);
    setFilterConnections([]);
    setCompanyWhatsApps(null);
  }, [setSelectedWhatsApp, setWhatsAppModalOpen]);

  const handleOpenQrModal = whatsApp => {
    setSelectedWhatsApp(whatsApp);
    setQrModalOpen(true);
  };

  const handleCloseQrModal = useCallback(() => {
    setSelectedWhatsApp(null);
    setQrModalOpen(false);
  }, [setQrModalOpen, setSelectedWhatsApp]);

  const handleEditWhatsApp = whatsApp => {
    setSelectedWhatsApp(whatsApp);
    setWhatsAppModalOpen(true);
  };

  const handleOpenConfirmationModal = (action, whatsAppId) => {
    if (action === "disconnect") {
      setConfirmModalInfo({
        action: action,
        title: i18n.t("connections.confirmationModal.disconnectTitle"),
        message: i18n.t("connections.confirmationModal.disconnectMessage"),
        whatsAppId: whatsAppId
      });
    }

    if (action === "delete") {
      setConfirmModalInfo({
        action: action,
        title: i18n.t("connections.confirmationModal.deleteTitle"),
        message: i18n.t("connections.confirmationModal.deleteMessage"),
        whatsAppId: whatsAppId
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

    setConfirmModalInfo(confirmationModalInitialState);
  };

  const renderActionButtons = whatsApp => {
    const isBaileys = !whatsApp.channelType || whatsApp.channelType === "baileys";
    
    return (
      <>
        {whatsApp.status === "qrcode" && isBaileys && (
          <Button
            size="small"
            variant="contained"
            color="primary"
            onClick={() => handleOpenQrModal(whatsApp)}
          >
            {i18n.t("connections.buttons.qrcode")}
          </Button>
        )}
        {whatsApp.status === "DISCONNECTED" && (
          <>
            <Button
              size="small"
              variant="outlined"
              color="primary"
              onClick={() => handleStartWhatsAppSession(whatsApp.id)}
            >
              {isBaileys ? i18n.t("connections.buttons.tryAgain") : "Recarregar Conexão"}
            </Button>{" "}
            {isBaileys && (
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                onClick={() => handleRequestNewQrCode(whatsApp.id)}
              >
                {i18n.t("connections.buttons.newQr")}
              </Button>
            )}
          </>
        )}
        {(whatsApp.status === "CONNECTED" ||
          whatsApp.status === "PAIRING" ||
          whatsApp.status === "TIMEOUT") && (
            <Button
              size="small"
              variant="outlined"
              color="secondary"
              onClick={() => {
                handleOpenConfirmationModal("disconnect", whatsApp.id);
              }}
            >
              {i18n.t("connections.buttons.disconnect")}
            </Button>
          )}
        {whatsApp.status === "OPENING" && (
          <Button size="small" variant="outlined" disabled color="default">
            {i18n.t("connections.buttons.connecting")}
          </Button>
        )}
      </>
    );
  };

  const renderStatusToolTips = whatsApp => {
    return (
      <div className={classes.customTableCell}>
        {whatsApp.status === "DISCONNECTED" && (
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
        {whatsApp.status === "qrcode" && (
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
  return (
    <Box className={classes.root}>
      <MainContainer useWindowScroll>
        <Box className={classes.container}>
      <ConfirmationModal
        title={confirmModalInfo.title}
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={handleSubmitConfirmationModal}
      >
        {confirmModalInfo.message}
      </ConfirmationModal>
      <QrcodeModal
        open={qrModalOpen}
        onClose={handleCloseQrModal}
        whatsAppId={!whatsAppModalOpen && selectedWhatsApp?.id}
      />
      <WhatsAppModalCompany
        open={whatsAppModalOpen}
        onClose={handleCloseWhatsAppModal}
        filteredWhatsapps={filterConnections}
        companyInfos={companyWhatsApps}
        whatsAppId={!qrModalOpen && selectedWhatsApp?.id}
      />

      {user.profile === "user" ?
        <ForbiddenPage />
        :
        <>
          <Paper className={classes.mainPaper} style={{ overflow: "hidden" }} variant="outlined">
            <MainHeader>
                  <Grid style={{ width: "99.6%" }} container>
                    <Grid xs={12} sm={8} item>
              <Stack>
                <Typography variant="h5" color="textPrimary" style={{ fontWeight: "bold", marginLeft: "10px", marginTop: "10px" }} gutterBottom>
                  {i18n.t("connections.title")}
                </Typography>
                <Typography style={{ marginTop: "-10px", marginLeft: "10px" }} variant="caption" color="textSecondary">
                  Conecte seus canais de atendimento para receber mensagens e iniciar conversas com seus clientes.
                </Typography>
              </Stack>
                    </Grid>
                    <Grid xs={12} sm={4} item>
                      <Grid container alignItems="center" spacing={2} justifyContent="flex-end">
                        <Grid item>
                <PopupState variant="popover" popupId="demo-popup-menu">
                  {popupState => (
                    <React.Fragment>
                                <Button
                                  variant="contained"
                                  size="small"
                                  {...bindTrigger(popupState)}
                                  style={{ 
                                    backgroundColor: "#4ade80",
                                    color: "#ffffff",
                                    textTransform: "uppercase",
                                    fontWeight: 600,
                                    borderRadius: "8px"
                                  }}
                                >
                                  {i18n.t("connections.newConnection")}
                                </Button>
                      <Menu {...bindMenu(popupState)}>
                        <MenuItem
                          onClick={() => {
                            handleOpenWhatsAppModal();
                            popupState.close();
                          }}
                        >
                          <WhatsApp
                            fontSize="small"
                            style={{
                              marginRight: "10px"
                            }}
                          />
                          WhatsApp
                        </MenuItem>
                        <FacebookLogin
                          appId={process.env.REACT_APP_FACEBOOK_APP_ID}
                          autoLoad={false}
                          fields="name,email,picture"
                          version="13.0"
                          scope="public_profile,pages_messaging,pages_show_list,pages_manage_metadata,pages_read_engagement,business_management"
                          callback={responseFacebook}
                          render={renderProps => (
                            <MenuItem onClick={renderProps.onClick}>
                              <Facebook
                                fontSize="small"
                                style={{
                                  marginRight: "10px"
                                }}
                              />
                              Facebook
                            </MenuItem>
                          )}
                        />

                        <FacebookLogin
                          appId={process.env.REACT_APP_FACEBOOK_APP_ID}
                          autoLoad={false}
                          fields="name,email,picture"
                          version="13.0"
                          scope="public_profile,instagram_basic,instagram_manage_messages,pages_messaging,pages_show_list,pages_manage_metadata,pages_read_engagement,business_management"
                          callback={responseInstagram}
                          render={renderProps => (
                            <MenuItem onClick={renderProps.onClick}>
                              <Instagram
                                fontSize="small"
                                style={{
                                  marginRight: "10px"
                                }}
                              />
                              Instagram
                            </MenuItem>
                          )}
                        />
                      </Menu>
                    </React.Fragment>
                  )}
                </PopupState>
                        </Grid>
                      </Grid>
                    </Grid>
                  </Grid>
            </MainHeader>
            <Stack
              style={{
                overflowY: "auto",
                padding: "20px",
                backgroundColor: "rgb(244 244 244 / 53%)",
                borderRadius: "5px",
                height: "93%"
              }}
            >
                  <Paper>
                    {isDesktop ? (
                      <Box style={{ overflowX: "auto" }}>
                        <table className={classes.table}>
                          <thead className={classes.TableHead}>
                            <tr style={{ color: "#fff" }}>
                              <th scope="col" style={{ color: "#fff", textAlign: "center" }}>
                                {i18n.t("Cliente").toUpperCase()}
                              </th>
                              <th scope="col" style={{ color: "#fff", textAlign: "center" }}>
                                {i18n.t("Conexões conectadas").toUpperCase()}
                              </th>
                              <th scope="col" style={{ color: "#fff", textAlign: "center" }}>
                                {i18n.t("Conexões desconectadas").toUpperCase()}
                              </th>
                              <th scope="col" style={{ color: "#fff", textAlign: "center" }}>
                                {i18n.t("Total de Conexões").toUpperCase()}
                              </th>
                      {user.profile === "admin" && (
                                <th scope="col" style={{ color: "#fff", textAlign: "center" }}>
                                  {i18n.t("connections.table.actions").toUpperCase()}
                                </th>
                      )}
                            </tr>
                          </thead>
                          <tbody className={classes.tableBody}>
                    {loadingWhatsapp ? (
                              <tr>
                                <td colSpan={user.profile === "admin" ? 5 : 4}>
                      <TableRowSkeleton />
                                </td>
                              </tr>
                    ) : (
                      <>
                                {!loadingWhatsapp && companies?.length === 0 && (
                                  <tr>
                                    <td colSpan={user.profile === "admin" ? 5 : 4} className={classes.emptyState}>
                                      Nenhuma empresa encontrada.
                                    </td>
                                  </tr>
                                )}
                        {companies?.length > 0 && companies.map(company => (
                                  <tr key={company.id}>
                                    <td style={{ textAlign: "center" }}>
                              {company?.name}
                                    </td>
                                    <td style={{ textAlign: "center" }}>
                              {whats?.length && whats.filter((item) => item?.companyId === company?.id && item?.status === 'CONNECTED').length}
                                    </td>
                                    <td style={{ textAlign: "center" }}>
                              {whats?.length && whats.filter((item) => item?.companyId === company?.id && item?.status !== 'CONNECTED').length}
                                    </td>
                                    <td style={{ textAlign: "center" }}>
                              {whats?.length && whats.filter((item) => item?.companyId === company?.id).length}
                                    </td>
                            {user.profile === "admin" && (
                                      <td style={{ textAlign: "center" }}>
                                        <Tooltip {...CustomTooltipProps} title="Editar">
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenWhatsAppModal(whats.filter((item) => item?.companyId === company?.id), company)}
                                            style={{
                                              color: "#374151",
                                              backgroundColor: "#ffffff",
                                              border: "1px solid #d1d5db",
                                              borderRadius: "8px"
                                            }}
                                >
                                            <Edit fontSize="small" />
                                </IconButton>
                                        </Tooltip>
                                      </td>
                            )}
                                  </tr>
                                ))}
                                <tr className={classes.TableHead}>
                                  <td style={{ color: "#fff", textAlign: "center" }}>{i18n.t("Total")}</td>
                                  <td style={{ color: "#fff", textAlign: "center" }}>
                            {whats?.length &&
                              whats.filter((item) => item?.status === 'CONNECTED').length}
                                  </td>
                                  <td style={{ color: "#fff", textAlign: "center" }}>
                            {whats?.length &&
                              whats.filter((item) => item?.status !== 'CONNECTED').length}
                                  </td>
                                  <td style={{ color: "#fff", textAlign: "center" }}>
                            {whats?.length && whats.length}
                                  </td>
                                  {user.profile === "admin" && <td style={{ color: "#fff", textAlign: "center" }}></td>}
                                </tr>
                              </>
                            )}
                          </tbody>
                        </table>
                      </Box>
                    ) : (
                      /* Mobile View */
                      <div className="flex flex-col gap-1.5 mt-3 w-full max-w-[375px] mx-auto">
                        {!loadingWhatsapp && companies?.length === 0 && (
                          <div className="text-center text-sm text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                            Nenhuma empresa encontrada.
                          </div>
                        )}
                        {companies?.length > 0 && companies.map(company => (
                          <div key={company.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-sm">{company?.name}</span>
                              {user.profile === "admin" && (
                                <Tooltip {...CustomTooltipProps} title="Editar">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleOpenWhatsAppModal(whats.filter((item) => item?.companyId === company?.id), company)}
                                    style={{
                                      color: "#374151",
                                      backgroundColor: "#ffffff",
                                      border: "1px solid #d1d5db",
                                      borderRadius: "8px"
                                    }}
                                  >
                                    <Edit fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                    )}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                              <div>Conectadas: {whats?.length && whats.filter((item) => item?.companyId === company?.id && item?.status === 'CONNECTED').length}</div>
                              <div>Desconectadas: {whats?.length && whats.filter((item) => item?.companyId === company?.id && item?.status !== 'CONNECTED').length}</div>
                              <div>Total: {whats?.length && whats.filter((item) => item?.companyId === company?.id).length}</div>
                            </div>
                          </div>
                        ))}
                        {loadingWhatsapp && <TableRowSkeleton />}
                      </div>
                    )}
              </Paper>
            </Stack>
          </Paper>
        </>}
        </Box>
    </MainContainer>
    </Box>
  );
};

export default AllConnections;
