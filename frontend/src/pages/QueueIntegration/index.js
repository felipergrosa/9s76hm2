import React, { useState, useEffect, useReducer, useContext, useMemo } from "react";
import { toast } from "react-toastify";
import n8n from "../../assets/n8n.png";
import dialogflow from "../../assets/dialogflow.png";
import webhooks from "../../assets/webhook.png";
import typebot from "../../assets/typebot.jpg";
import flowbuilder from "../../assets/flowbuilders.png";
import openai from "../../assets/openai.png";

import { makeStyles, useTheme } from "@material-ui/core/styles";

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
  FormControl,
  Select,
  CircularProgress,
} from "@material-ui/core";

import {
  Search as SearchIcon,
  Pencil as EditIcon,
  Trash2 as DeleteIcon,
  Plus as AddIcon,
  Plug as EmptyIcon,
  Plug as IntegrationsIcon,
  Webhook as WebhookIcon,
  Bot as BotIcon,
  Workflow as FlowsIcon,
} from "lucide-react";

import MainContainer from "../../components/MainContainer";
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

// Bento design system — moldura + strip de KPIs + entrada spring
import { motion, useReducedMotion } from "framer-motion";
import StatCard from "../../components/bento/StatCard";
import { bentoContainer, bentoItem, bentoItemReduced } from "../../components/bento/motionPresets";
import "../../components/bento/bento.css";

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

// Tipos de IA gerenciados em outra tela — nunca exibidos aqui
const HIDDEN_TYPES = ["openai", "gemini", "knowledge"];

// Logo da integração conforme o tipo (webhook, n8n, typebot etc.)
const integrationImage = (type) => {
  switch (type) {
    case "dialogflow":
      return dialogflow;
    case "n8n":
      return n8n;
    case "webhook":
      return webhooks;
    case "typebot":
      return typebot;
    case "flowbuilder":
      return flowbuilder;
    case "openai":
    case "gemini":
      return openai;
    default:
      return undefined;
  }
};

// ===== Estilos no padrão do gerenciador de Conexões/Campanhas =====
const useStyles = makeStyles((theme) => ({
  paper: {
    flex: 1,
    padding: 0,
    overflow: "hidden",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    display: "flex",
    flexDirection: "column",
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
  avatar: {
    width: "140px",
    height: "40px",
    borderRadius: 4,
  },
  // Área rolável da lista — dispara a paginação infinita (handleScroll)
  listScroll: {
    flex: 1,
    overflowY: "auto",
    ...theme.scrollbarStyles,
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

const QueueIntegration = () => {
  const classes = useStyles();
  const theme = useTheme();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [queueIntegration, dispatch] = useReducer(reducer, []);
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
          const sanitized = (data.queueIntegrations || []).filter((i) => !HIDDEN_TYPES.includes(String(i.type || '').toLowerCase()));
          dispatch({ type: "LOAD_INTEGRATIONS", payload: sanitized });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          // 403 = sem permissão integrations.view (admin)
          // Silencia o erro, lista de integrações fica vazia
          if (err?.response?.status !== 403) {
            toastError(err);
          }
          setLoading(false);
        }
      };
      fetchIntegrations();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const onQueueEvent = (data) => {
      // Ignorar eventos de integrações de IA nesta tela
      const t = (data?.queueIntegration?.type || "").toLowerCase();
      if (HIDDEN_TYPES.includes(t)) {
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

  // Lista visível: remove os tipos de IA e aplica o filtro de tipo da toolbar
  const visibleIntegrations = useMemo(() => {
    return (queueIntegration || []).filter((integration) => {
      const t = String(integration.type || "").toLowerCase();
      if (HIDDEN_TYPES.includes(t)) return false;
      if (typeFilter && t !== typeFilter) return false;
      return true;
    });
  }, [queueIntegration, typeFilter]);

  // KPIs do strip bento — derivados da lista carregada (tipos de IA excluídos)
  const integrationStats = useMemo(() => {
    const list = (queueIntegration || []).filter(
      (i) => !HIDDEN_TYPES.includes(String(i.type || "").toLowerCase())
    );
    const count = (types) =>
      list.filter((i) => types.includes(String(i.type || "").toLowerCase())).length;
    return {
      total: list.length,
      automations: count(["webhook", "n8n"]),
      bots: count(["typebot", "dialogflow"]),
      flows: count(["flowbuilder"]),
    };
  }, [queueIntegration]);

  // Respeita prefers-reduced-motion: troca o spring de entrada por fade simples
  const reducedMotion = useReducedMotion();
  const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

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
      // 403 = sem permissão integrations.delete (admin)
      // Silencia o erro
      if (err?.response?.status !== 403) {
        toastError(err);
      }
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
      {!hasPermission("integrations.view") ? (
        <ForbiddenPage />
      ) : (
        <motion.div
          variants={bentoContainer}
          initial="hidden"
          animate="show"
          style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 12 }}
        >
          {/* Strip de KPIs bento — resume as integrações sem fetch extra */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard label="Integrações" value={integrationStats.total} icon={<IntegrationsIcon size={20} />} accent="var(--primary-color)" loading={loading && queueIntegration.length === 0} />
            <StatCard label="Webhook + n8n" value={integrationStats.automations} icon={<WebhookIcon size={20} />} accent="#f39c12" loading={loading && queueIntegration.length === 0} />
            <StatCard label="Typebot + Dialogflow" value={integrationStats.bots} icon={<BotIcon size={20} />} accent="#8e44ad" loading={loading && queueIntegration.length === 0} />
            <StatCard label="FlowBuilder" value={integrationStats.flows} icon={<FlowsIcon size={20} />} accent="#3598dc" loading={loading && queueIntegration.length === 0} />
          </div>
        <motion.div variants={itemVariant} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <Paper className={`${classes.paper} bento-panel`} variant="outlined">
          {/* Cabeçalho: título + contador + subtítulo + ação primária */}
          <div className={classes.header}>
            <div className={classes.headerText}>
              <Title>{i18n.t("queueIntegration.title")} ({visibleIntegrations.length})</Title>
              <span className={classes.subtitle}>
                Gerencie as integrações conectadas às filas — Webhook, n8n, Typebot, Dialogflow e FlowBuilder.
              </span>
            </div>
            <div className={classes.headerActions}>
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<AddIcon size={16} />}
                onClick={handleOpenUserModal}
                style={{ minHeight: 36 }}
              >
                {i18n.t("queueIntegration.buttons.add")}
              </Button>
            </div>
          </div>

          {/* Toolbar: busca (server-side, com debounce) + filtro de tipo */}
          <div className={classes.toolbar}>
            <TextField
              className={classes.searchField}
              size="small"
              variant="outlined"
              placeholder={i18n.t("queueIntegration.searchPlaceholder")}
              type="search"
              value={searchParam}
              onChange={handleSearch}
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
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                displayEmpty
              >
                <option value="">Todos os tipos</option>
                <option value="webhook">Webhook</option>
                <option value="n8n">n8n</option>
                <option value="typebot">Typebot</option>
                <option value="dialogflow">Dialogflow</option>
                <option value="flowbuilder">FlowBuilder</option>
              </Select>
            </FormControl>
          </div>

          {/* Conteúdo rolável — a paginação infinita dispara neste scroll */}
          <div className={classes.listScroll} onScroll={handleScroll}>
            {loading && visibleIntegrations.length === 0 ? (
              <Table size="small">
                <TableBody>
                  <TableRowSkeleton columns={4} />
                </TableBody>
              </Table>
            ) : visibleIntegrations.length === 0 ? (
              <div className={classes.emptyState}>
                <EmptyIcon size={44} style={{ color: theme.palette.text.disabled }} />
                <div>Nenhuma integração encontrada.</div>
              </div>
            ) : (
              <>
                {/* Cards — mobile */}
                <div className={classes.mobileList}>
                  {visibleIntegrations.map((integration) => (
                    <div key={integration.id} className={classes.card}>
                      <div className={classes.cardHeader}>
                        <div className={classes.cardTitle}>
                          <Avatar
                            src={integrationImage(integration.type)}
                            className={classes.avatar}
                          />
                          <div className={classes.cardName} title={integration.name}>
                            {integration.name}
                          </div>
                        </div>
                        <div className={classes.metaValue}>#{integration.id}</div>
                      </div>
                      <div className={classes.cardMeta}>
                        <div>
                          <div className={classes.metaLabel}>
                            {i18n.t("queueIntegration.table.type")}
                          </div>
                          <div className={classes.metaValue}>{integration.type || "—"}</div>
                        </div>
                      </div>
                      <div className={classes.cardActions}>
                        <IconButton
                          size="small"
                          className={classes.actionButton}
                          onClick={() => handleEditIntegration(integration)}
                        >
                          <EditIcon size={18} />
                        </IconButton>

                        <IconButton
                          size="small"
                          className={classes.actionButton}
                          onClick={() => {
                            setConfirmModalOpen(true);
                            setDeletingUser(integration);
                          }}
                        >
                          <DeleteIcon size={18} />
                        </IconButton>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div style={{ display: "flex", justifyContent: "center", padding: 8 }}>
                      <CircularProgress size={22} />
                    </div>
                  )}
                </div>

                {/* Tabela — desktop */}
                <div className={classes.desktopTableWrapper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell className={classes.headCell}>
                          {i18n.t("queueIntegration.table.type")}
                        </TableCell>
                        <TableCell align="center" className={classes.headCell}>
                          {i18n.t("queueIntegration.table.id")}
                        </TableCell>
                        <TableCell align="center" className={classes.headCell}>
                          {i18n.t("queueIntegration.table.name")}
                        </TableCell>
                        <TableCell align="center" className={classes.headCell}>
                          {i18n.t("queueIntegration.table.actions")}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {visibleIntegrations.map((integration) => (
                        <TableRow key={integration.id} className={classes.rowHover}>
                          <TableCell className={classes.bodyCell}>
                            <Avatar
                              src={integrationImage(integration.type)}
                              className={classes.avatar}
                            />
                          </TableCell>
                          <TableCell align="center" className={classes.bodyCell}>
                            {integration.id}
                          </TableCell>
                          <TableCell align="center" className={classes.bodyCell}>
                            {integration.name}
                          </TableCell>
                          <TableCell align="center" className={`${classes.bodyCell} ${classes.actionsCell}`}>
                            <IconButton
                              size="small"
                              onClick={() => handleEditIntegration(integration)}
                            >
                              <EditIcon size={18} />
                            </IconButton>

                            <IconButton
                              size="small"
                              onClick={() => {
                                setConfirmModalOpen(true);
                                setDeletingUser(integration);
                              }}
                            >
                              <DeleteIcon size={18} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      {loading && <TableRowSkeleton columns={4} />}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </Paper>
        </motion.div>
        </motion.div>
      )}
    </MainContainer>
  );
};

export default QueueIntegration;
