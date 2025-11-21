import React, { useState, useEffect, useReducer, useContext, useMemo } from "react";
import { toast } from "react-toastify";
import n8n from "../../assets/n8n.png";
import dialogflow from "../../assets/dialogflow.png";
import webhooks from "../../assets/webhook.png";
import typebot from "../../assets/typebot.jpg";
import flowbuilder from "../../assets/flowbuilders.png";
import openai from "../../assets/openai.png";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Avatar, Button, IconButton, InputAdornment, Paper, TextField, Box, Grid, Tooltip, useMediaQuery } from "@material-ui/core";
import { DeleteOutline, Edit } from "@material-ui/icons";
import SearchIcon from "@material-ui/icons/Search";
import { Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
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
  },
  avatar: {
    width: "140px",
    height: "40px",
    borderRadius: 4
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHead: {
    backgroundColor: theme.palette.grey[100],
    "& th": {
      padding: theme.spacing(1.5),
      textAlign: "left",
      fontSize: "0.75rem",
      fontWeight: 600,
      textTransform: "uppercase",
      color: theme.palette.text.secondary,
      borderBottom: `2px solid ${theme.palette.divider}`,
    },
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

const QueueIntegration = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up(1200));

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [queueIntegration, dispatch] = useReducer(reducer, []);
  const { user, socket } = useContext(AuthContext);
  const { hasPermission } = usePermissions();

  const { getPlanCompany } = usePlans();
  const companyId = user.companyId;
  const history = useHistory();

  const filteredIntegrations = useMemo(() => {
    return queueIntegration.filter((integration) => 
      !["openai", "gemini", "knowledge"].includes(String(integration.type || '').toLowerCase())
    );
  }, [queueIntegration]);

  const totalPages = useMemo(() => {
    return totalItems === 0 ? 1 : Math.ceil(totalItems / itemsPerPage);
  }, [totalItems, itemsPerPage]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setPageNumber(page);
    }
  };

  const renderPageNumbers = useMemo(() => {
    const pages = [];
    if (totalPages <= 3) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const start = Math.max(1, Math.min(pageNumber - 1, totalPages - 2));
      const end = Math.min(totalPages, start + 2);
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  }, [pageNumber, totalPages]);

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
          setTotalItems(data.count || sanitized.length);
          setLoading(false);
        } catch (err) {
          toastError(err);
          setLoading(false);
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

  return (
    <Box className={classes.root}>
      <MainContainer useWindowScroll>
        <Box className={classes.container}>
          <ConfirmationModal
            title={
              deletingUser &&
              `${i18n.t("queueIntegration.confirmationModal.deleteTitle")} ${deletingUser.name}?`
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
                <Grid style={{ width: "99.6%" }} container>
                  <Grid xs={12} sm={5} item>
                    <Title>
                      {i18n.t("queueIntegration.title")} ({filteredIntegrations.length})
                    </Title>
                  </Grid>
                  <Grid xs={12} sm={7} item>
                    <Grid container alignItems="center" spacing={2}>
                      <Grid item xs>
                        <TextField
                          fullWidth
                          placeholder={i18n.t("queueIntegration.searchPlaceholder")}
                          type="search"
                          value={searchParam}
                          onChange={handleSearch}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon style={{ color: "gray" }} />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      <Grid item>
                        <Tooltip {...CustomTooltipProps} title={i18n.t("queueIntegration.buttons.add")}>
                          <Button
                            onClick={handleOpenUserModal}
                            variant="contained"
                            size="small"
                            style={{ 
                              backgroundColor: "#4ade80",
                              color: "#ffffff",
                              textTransform: "uppercase",
                              fontWeight: 600,
                              borderRadius: "8px"
                            }}
                            startIcon={<Plus className="w-4 h-4" />}
                            aria-label={i18n.t("queueIntegration.buttons.add")}
                          >
                            {i18n.t("queueIntegration.buttons.add")}
                          </Button>
                        </Tooltip>
                      </Grid>
                    </Grid>
                  </Grid>
                </Grid>
              </MainHeader>
              {isDesktop ? (
                <Paper className={classes.mainPaper} variant="outlined">
                  <Box style={{ overflowX: "auto" }}>
                    <table className={classes.table}>
                      <thead className={classes.tableHead}>
                        <tr>
                          <th scope="col" style={{ textAlign: "center" }}>
                            {i18n.t("queueIntegration.table.type").toUpperCase() || "TIPO"}
                          </th>
                          <th scope="col" style={{ textAlign: "center" }}>
                            {i18n.t("queueIntegration.table.id").toUpperCase()}
                          </th>
                          <th scope="col" style={{ textAlign: "center" }}>
                            {i18n.t("queueIntegration.table.name").toUpperCase()}
                          </th>
                          <th scope="col" style={{ textAlign: "center" }}>
                            {i18n.t("queueIntegration.table.actions").toUpperCase() || "AÇÕES"}
                          </th>
                        </tr>
                      </thead>
                      <tbody className={classes.tableBody}>
                        {!loading && filteredIntegrations.length === 0 && (
                          <tr>
                            <td colSpan={4} className={classes.emptyState}>
                              Nenhuma integração encontrada.
                            </td>
                          </tr>
                        )}
                        {filteredIntegrations.map((integration) => (
                          <tr key={integration.id}>
                            <td style={{ textAlign: "center" }}>
                              {integration.type === "dialogflow" && (<Avatar src={dialogflow} className={classes.avatar} />)}
                              {integration.type === "n8n" && (<Avatar src={n8n} className={classes.avatar} />)}
                              {integration.type === "webhook" && (<Avatar src={webhooks} className={classes.avatar} />)}
                              {integration.type === "typebot" && (<Avatar src={typebot} className={classes.avatar} />)}
                              {integration.type === "flowbuilder" && (<Avatar src={flowbuilder} className={classes.avatar} />)}
                              {integration.type === "openai" && (<Avatar src={openai} className={classes.avatar} />)}
                              {integration.type === "gemini" && (<Avatar src={openai} className={classes.avatar} />)}
                              {integration.type === "knowledge" && (
                                <Avatar className={classes.avatar}>KB</Avatar>
                              )}
                            </td>
                            <td style={{ textAlign: "center" }}>{integration.id}</td>
                            <td style={{ textAlign: "center" }}>{integration.name}</td>
                            <td style={{ textAlign: "center" }}>
                              <Tooltip {...CustomTooltipProps} title="Editar">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEditIntegration(integration)}
                                  style={{
                                    color: "#374151",
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px",
                                    marginRight: 4
                                  }}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip {...CustomTooltipProps} title="Deletar">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    setConfirmModalOpen(true);
                                    setDeletingUser(integration);
                                  }}
                                  style={{
                                    color: "#dc2626",
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px"
                                  }}
                                >
                                  <DeleteOutline fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </td>
                          </tr>
                        ))}
                        {loading && (
                          <tr>
                            <td colSpan={4}>
                              <TableRowSkeleton columns={4} />
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </Box>
                </Paper>
              ) : (
                /* Mobile View */
                <div className="flex flex-col gap-1.5 mt-3 w-full max-w-[375px] mx-auto">
                  {!loading && filteredIntegrations.length === 0 && (
                    <div className="text-center text-sm text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      Nenhuma integração encontrada.
                    </div>
                  )}
                  {filteredIntegrations.map((integration) => (
                    <div key={integration.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {integration.type === "dialogflow" && (<Avatar src={dialogflow} className={classes.avatar} />)}
                          {integration.type === "n8n" && (<Avatar src={n8n} className={classes.avatar} />)}
                          {integration.type === "webhook" && (<Avatar src={webhooks} className={classes.avatar} />)}
                          {integration.type === "typebot" && (<Avatar src={typebot} className={classes.avatar} />)}
                          {integration.type === "flowbuilder" && (<Avatar src={flowbuilder} className={classes.avatar} />)}
                          <div>
                            <span className="font-semibold text-sm">{integration.name}</span>
                            <div className="text-xs text-gray-600 dark:text-gray-400">ID: {integration.id}</div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Tooltip {...CustomTooltipProps} title="Editar">
                            <IconButton
                              size="small"
                              onClick={() => handleEditIntegration(integration)}
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
                          <Tooltip {...CustomTooltipProps} title="Deletar">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                setConfirmModalOpen(true);
                                setDeletingUser(integration);
                              }}
                              style={{
                                color: "#dc2626",
                                backgroundColor: "#ffffff",
                                border: "1px solid #d1d5db",
                                borderRadius: "8px"
                              }}
                            >
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  ))}
                  {loading && <TableRowSkeleton columns={4} />}
                </div>
              )}
            </>
          ) : <ForbiddenPage />}
        </Box>
      </MainContainer>
    </Box>
  );
};

export default QueueIntegration;