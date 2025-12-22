import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";
// import { SocketContext } from "../../context/Socket/SocketContext";
import n8n from "../../assets/n8n.png";
import dialogflow from "../../assets/dialogflow.png";
import webhooks from "../../assets/webhook.png";
import typebot from "../../assets/typebot.jpg";
import flowbuilder from "../../assets/flowbuilders.png";
import openai from "../../assets/openai.png";

import { makeStyles, useTheme } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";

import {
  Avatar,
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  Grid,
} from "@material-ui/core";

import {
  DeleteOutline,
  Edit
} from "@material-ui/icons";

import SearchIcon from "@material-ui/icons/Search";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import IntegrationModal from "../../components/QueueIntegrationModal";
import ConfirmationModal from "../../components/ConfirmationModal";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePlans from "../../hooks/usePlans";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";
import ForbiddenPage from "../../components/ForbiddenPage";
import usePermissions from "../../hooks/usePermissions";

const reducer = (state, action) => {
  if (action.type === "LOAD_INTEGRATIONS") {
    const queueIntegration = action.payload;
    const newIntegrations = [];

    queueIntegration.forEach((integration) => {
      const integrationIndex = state.findIndex((u) => u.id === integration.id);
      if (integrationIndex !== -1) {
        state[integrationIndex] = integration;
      } else {
        newIntegrations.push(integration);
      }
    });

    return [...state, ...newIntegrations];
  }

  if (action.type === "UPDATE_INTEGRATIONS") {
    const queueIntegration = action.payload;
    const integrationIndex = state.findIndex((u) => u.id === queueIntegration.id);

    if (integrationIndex !== -1) {
      state[integrationIndex] = queueIntegration;
      return [...state];
    } else {
      return [queueIntegration, ...state];
    }
  }

  if (action.type === "DELETE_INTEGRATION") {
    const integrationId = action.payload;

    const integrationIndex = state.findIndex((u) => u.id === integrationId);
    if (integrationIndex !== -1) {
      state.splice(integrationIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    margin: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  avatar: {
    width: "140px",
    height: "40px",
    borderRadius: 4
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

const QueueIntegration = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [queueIntegration, dispatch] = useReducer(reducer, []);
  //   const socketManager = useContext(SocketContext);
  const { user, socket } = useContext(AuthContext);
  const { hasPermission } = usePermissions();

  const { getPlanCompany } = usePlans();
  const companyId = user.companyId;
  const history = useHistory();

  useEffect(() => {
    async function fetchData() {
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useIntegrations) {
        toast.error("Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando.");
        setTimeout(() => {
          history.push(`/`)
        }, 1000);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchIntegrations = async () => {
        try {
          const { data } = await api.get("/queueIntegration/", {
            params: { searchParam, pageNumber, excludeTypes: "openai,gemini,knowledge" },
          });
          const sanitized = (data.queueIntegrations || []).filter((i) => !["openai","gemini","knowledge"].includes(String(i.type||'').toLowerCase()));
          dispatch({ type: "LOAD_INTEGRATIONS", payload: sanitized });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchIntegrations();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    // const socket = socketManager.GetSocket();

    const onQueueEvent = (data) => {
      // Ignorar eventos de integrações de IA nesta tela
      const t = (data?.queueIntegration?.type || "").toLowerCase();
      if (["openai", "gemini", "knowledge"].includes(t)) {
        return;
      }
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_INTEGRATIONS", payload: data.queueIntegration });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_INTEGRATION", payload: +data.integrationId });
      }
    };

    socket.on(`company-${companyId}-queueIntegration`, onQueueEvent);
    return () => {
      socket.off(`company-${companyId}-queueIntegration`, onQueueEvent);
    };
  }, [companyId, socket, dispatch]);

  const handleOpenUserModal = () => {
    setSelectedIntegration(null);
    setUserModalOpen(true);
  };

  const handleCloseIntegrationModal = () => {
    setSelectedIntegration(null);
    setUserModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditIntegration = (queueIntegration) => {
    setSelectedIntegration(queueIntegration);
    setUserModalOpen(true);
  };

  const handleDeleteIntegration = async (integrationId) => {
    try {
      await api.delete(`/queueIntegration/${integrationId}`);
      toast.success(i18n.t("queueIntegration.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingUser(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingUser &&
          `${i18n.t("queueIntegration.confirmationModal.deleteTitle")} ${deletingUser.name
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteIntegration(deletingUser.id)}
      >
        {i18n.t("queueIntegration.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <IntegrationModal
        open={userModalOpen}
        onClose={handleCloseIntegrationModal}
        aria-labelledby="form-dialog-title"
        integrationId={selectedIntegration && selectedIntegration.id}
      />
      {hasPermission("integrations.view") ? (
        <>

          <MainHeader>
            <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <Title>{i18n.t("queueIntegration.title")} ({queueIntegration.length})</Title>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Grid container spacing={1} alignItems="center" justifyContent="flex-end">
                  <Grid item xs={12} sm>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder={i18n.t("queueIntegration.searchPlaceholder")}
                      type="search"
                      value={searchParam}
                      onChange={handleSearch}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon color="secondary" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm="auto">
                    <Button
                      fullWidth={isMobile}
                      variant="contained"
                      color="primary"
                      onClick={handleOpenUserModal}
                      style={{ minHeight: 44 }}
                    >
                      {i18n.t("queueIntegration.buttons.add")}
                    </Button>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </MainHeader>
          <Paper
            className={classes.mainPaper}
            variant="outlined"
            onScroll={handleScroll}
          >
            {/* Mobile cards */}
            <div className={classes.mobileList}>
              {queueIntegration
                .filter((integration) => !["openai", "gemini", "knowledge"].includes(String(integration.type || '').toLowerCase()))
                .map((integration) => (
                  <div key={integration.id} className={classes.card}>
                    <div className={classes.cardHeader}>
                      <div className={classes.cardTitle}>
                        <Avatar
                          src={
                            integration.type === "dialogflow" ? dialogflow :
                            integration.type === "n8n" ? n8n :
                            integration.type === "webhook" ? webhooks :
                            integration.type === "typebot" ? typebot :
                            integration.type === "flowbuilder" ? flowbuilder :
                            integration.type === "openai" ? openai :
                            integration.type === "gemini" ? openai :
                            undefined
                          }
                          className={classes.avatar}
                        >
                          {["openai", "gemini", "knowledge"].includes(String(integration.type || '').toLowerCase()) ? "KB" : null}
                        </Avatar>
                        {integration.name}
                      </div>
                      <div className={classes.metaValue}>ID #{integration.id}</div>
                    </div>
                    <div className={classes.cardMeta}>
                      <div>
                        <div className={classes.metaLabel}>Tipo</div>
                        <div className={classes.metaValue}>{integration.type || "—"}</div>
                      </div>
                    </div>
                    <div className={classes.cardActions}>
                      <IconButton
                        size="small"
                        className={classes.actionButton}
                        onClick={() => handleEditIntegration(integration)}
                      >
                        <Edit color="secondary" />
                      </IconButton>

                      <IconButton
                        size="small"
                        className={classes.actionButton}
                        onClick={(e) => {
                          setConfirmModalOpen(true);
                          setDeletingUser(integration);
                        }}
                      >
                        <DeleteOutline color="secondary" />
                      </IconButton>
                    </div>
                  </div>
                ))}
              {loading && <TableRowSkeleton columns={1} />}
            </div>

            {/* Desktop table */}
            <div className={classes.desktopTableWrapper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox"></TableCell>
                    <TableCell align="center">{i18n.t("queueIntegration.table.id")}</TableCell>
                    <TableCell align="center">{i18n.t("queueIntegration.table.name")}</TableCell>
                    <TableCell align="center">{i18n.t("queueIntegration.table.actions")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <>
                    {queueIntegration
                      .filter((integration) => !["openai", "gemini", "knowledge"].includes(String(integration.type || '').toLowerCase()))
                      .map((integration) => (
                      <TableRow key={integration.id}>
                        <TableCell >
                          {integration.type === "dialogflow" && (<Avatar
                            src={dialogflow} className={classes.avatar} />)}
                          {integration.type === "n8n" && (<Avatar
                            src={n8n} className={classes.avatar} />)}
                          {integration.type === "webhook" && (<Avatar
                            src={webhooks} className={classes.avatar} />)}
                          {integration.type === "typebot" && (<Avatar
                            src={typebot} className={classes.avatar} />)}
                          {integration.type === "flowbuilder" && (<Avatar
                            src={flowbuilder} className={classes.avatar} />)}
                          {integration.type === "openai" && (<Avatar
                            src={openai} className={classes.avatar} />)}
                          {integration.type === "gemini" && (<Avatar
                            src={openai} className={classes.avatar} />)}
                          {integration.type === "knowledge" && (
                            <Avatar className={classes.avatar}>
                              KB
                            </Avatar>
                          )}
                        </TableCell>

                        <TableCell align="center">{integration.id}</TableCell>
                        <TableCell align="center">{integration.name}</TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => handleEditIntegration(integration)}
                          >
                            <Edit color="secondary" />
                          </IconButton>

                          <IconButton
                            size="small"
                            onClick={(e) => {
                              setConfirmModalOpen(true);
                              setDeletingUser(integration);
                            }}
                          >
                            <DeleteOutline color="secondary" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {loading && <TableRowSkeleton columns={7} />}
                  </>
                </TableBody>
              </Table>
            </div>
          </Paper>
        </>
      ) : <ForbiddenPage />}
    </MainContainer>
  );
};

export default QueueIntegration;