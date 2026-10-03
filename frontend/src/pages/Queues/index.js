import React, { useContext, useEffect, useMemo, useReducer, useState } from "react";

import {
  Button,
  IconButton,
  InputAdornment,
  makeStyles,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  useTheme,
} from "@material-ui/core";

import {
  ListTree as QueuesIcon,
  Pencil as EditIcon,
  Plus as AddIcon,
  Search as SearchIcon,
  Trash2 as DeleteIcon,
} from "lucide-react";

import MainContainer from "../../components/MainContainer";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import Title from "../../components/Title";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import QueueModal from "../../components/QueueModal";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";
import { AuthContext } from "../../context/Auth/AuthContext";
import ForbiddenPage from "../../components/ForbiddenPage";
import usePermissions from "../../hooks/usePermissions";

// ===== Estilos no padrão de listagem (referência: /connections) =====
const useStyles = makeStyles((theme) => ({
  paper: {
    flex: 1,
    padding: 0,
    // overflowY auto: conteúdo longo rola dentro do Paper (o MainContainer não usa useWindowScroll)
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
  // Amostra da cor da fila (cards e tabela)
  colorSwatch: {
    width: 18,
    height: 18,
    borderRadius: 6,
    border: `1px solid ${theme.palette.divider}`,
    flexShrink: 0,
  },
  colorSwatchTable: {
    display: "inline-block",
    width: 48,
    height: 18,
    borderRadius: 6,
    border: `1px solid ${theme.palette.divider}`,
    verticalAlign: "middle",
  },
  // Texto da saudação truncado com reticências na tabela
  greetingText: {
    display: "inline-block",
    maxWidth: 320,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    verticalAlign: "middle",
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
    fontWeight: 700,
    fontSize: "1.05rem",
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

const reducer = (state, action) => {
  if (action.type === "LOAD_QUEUES") {
    const queues = action.payload;
    const newQueues = [];

    queues.forEach((queue) => {
      const queueIndex = state.findIndex((q) => q.id === queue.id);
      if (queueIndex !== -1) {
        state[queueIndex] = queue;
      } else {
        newQueues.push(queue);
      }
    });

    return [...state, ...newQueues];
  }

  if (action.type === "UPDATE_QUEUES") {
    const queue = action.payload;
    const queueIndex = state.findIndex((u) => u.id === queue.id);

    if (queueIndex !== -1) {
      state[queueIndex] = queue;
      return [...state];
    } else {
      return [queue, ...state];
    }
  }

  if (action.type === "DELETE_QUEUE") {
    const queueId = action.payload;
    const queueIndex = state.findIndex((q) => q.id === queueId);
    if (queueIndex !== -1) {
      state.splice(queueIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const Queues = () => {
  const classes = useStyles();
  const theme = useTheme();

  const [queues, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);

  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  // Busca da toolbar (filtro client-side — a listagem de filas vem toda do backend)
  const [searchParam, setSearchParam] = useState("");
  const { user, socket } = useContext(AuthContext);
  const { hasPermission } = usePermissions();
  const companyId = user.companyId;

  // Filas filtradas pela busca da toolbar (compartilhada entre tabela e cards)
  const filteredQueues = useMemo(() => {
    const search = searchParam.trim().toLowerCase();
    if (!search) return queues;
    return queues.filter((queue) =>
      `${queue.id} ${queue.name || ""} ${queue.greetingMessage || ""} ${queue.orderQueue ?? ""}`
        .toLowerCase()
        .includes(search)
    );
  }, [queues, searchParam]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/queue");
        dispatch({ type: "LOAD_QUEUES", payload: data });

        setLoading(false);
      } catch (err) {
        // 403 = sem permissão queues.view (admin)
        // Silencia o erro, lista de filas fica vazia
        if (err?.response?.status !== 403) {
          toastError(err);
        }
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {

    const onQueueEvent = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_QUEUES", payload: data.queue });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_QUEUE", payload: data.queueId });
      }
    };
    socket.on(`company-${companyId}-queue`, onQueueEvent);

    return () => {
      socket.off(`company-${companyId}-queue`, onQueueEvent);
    };
  }, [socket, companyId]);

  const handleOpenQueueModal = () => {
    setQueueModalOpen(true);
    setSelectedQueue(null);
  };

  const handleCloseQueueModal = () => {
    setQueueModalOpen(false);
    setSelectedQueue(null);
  };

  const handleEditQueue = (queue) => {
    setSelectedQueue(queue);
    setQueueModalOpen(true);
  };

  const handleCloseConfirmationModal = () => {
    setConfirmModalOpen(false);
    setSelectedQueue(null);
  };

  const handleDeleteQueue = async (queueId) => {
    try {
      await api.delete(`/queue/${queueId}`);
      toast.success(i18n.t("Queue deleted successfully!"));
    } catch (err) {
      // 403 = sem permissão queues.delete (admin)
      // Silencia o erro
      if (err?.response?.status !== 403) {
        toastError(err);
      }
    }
    setSelectedQueue(null);
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          selectedQueue &&
          `${i18n.t("queues.confirmationModal.deleteTitle")} ${selectedQueue.name
          }?`
        }
        open={confirmModalOpen}
        onClose={handleCloseConfirmationModal}
        onConfirm={() => handleDeleteQueue(selectedQueue.id)}
      >
        {i18n.t("queues.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      {/* Modal de fila — mantém integrações, chatbots, horários e RAG por fila */}
      <QueueModal
        open={queueModalOpen}
        onClose={handleCloseQueueModal}
        queueId={selectedQueue?.id}
        onEdit={(res) => {
          if (res) {
            setTimeout(() => {
              handleEditQueue(res)
            }, 500)
          }
        }}
      />
      {!hasPermission("queues.view") ? <ForbiddenPage /> : (
        <Paper className={classes.paper} variant="outlined">
          {/* 1. Cabeçalho: título + subtítulo + ações primárias */}
          <div className={classes.header}>
            <div className={classes.headerText}>
              <Title>{i18n.t("queues.title")} ({filteredQueues.length})</Title>
              <span className={classes.subtitle}>
                Gerencie as filas de atendimento — ordem de exibição, saudação, integrações e chatbots por fila.
              </span>
            </div>
            <div className={classes.headerActions}>
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<AddIcon size={16} />}
                onClick={handleOpenQueueModal}
                style={{ minHeight: 36 }}
              >
                {i18n.t("queues.buttons.add")}
              </Button>
            </div>
          </div>

          {/* 2. Toolbar de busca */}
          <div className={classes.toolbar}>
            <TextField
              className={classes.searchField}
              size="small"
              variant="outlined"
              placeholder="Buscar por nome, saudação ou ID…"
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
          </div>

          {/* 3. Conteúdo: skeleton / vazio / lista responsiva */}
          {loading ? (
            <Table>
              <TableBody>
                <TableRowSkeleton columns={6} />
              </TableBody>
            </Table>
          ) : filteredQueues.length === 0 ? (
            <div className={classes.emptyState}>
              <QueuesIcon size={44} style={{ color: theme.palette.text.disabled }} />
              <div>
                {searchParam
                  ? "Nenhuma fila encontrada para essa busca."
                  : "Nenhuma fila cadastrada."}
              </div>
            </div>
          ) : (
            <>
              {/* Cards — mobile */}
              <div className={classes.mobileList}>
                {filteredQueues.map((queue) => (
                  <div key={queue.id} className={classes.card}>
                    <div className={classes.cardHeader}>
                      <div className={classes.cardTitle}>
                        <span
                          className={classes.colorSwatch}
                          style={{ backgroundColor: queue.color }}
                        />
                        <span className={classes.cardName}>{queue.name}</span>
                      </div>
                      <div className={classes.metaValue}>#{queue.id}</div>
                    </div>
                    <div className={classes.cardMeta}>
                      <div>
                        <div className={classes.metaLabel}>
                          {i18n.t("queues.table.orderQueue")}
                        </div>
                        <div className={classes.metaValue}>
                          {queue.orderQueue ?? "—"}
                        </div>
                      </div>
                      <div>
                        <div className={classes.metaLabel}>
                          {i18n.t("queues.table.greeting")}
                        </div>
                        <div className={classes.metaValue}>
                          {queue.greetingMessage
                            ? queue.greetingMessage.slice(0, 90) +
                              (queue.greetingMessage.length > 90 ? "…" : "")
                            : "—"}
                        </div>
                      </div>
                    </div>
                    <div className={classes.cardActions}>
                      {hasPermission("queues.edit") && (
                        <IconButton
                          size="small"
                          className={classes.actionButton}
                          onClick={() => handleEditQueue(queue)}
                        >
                          <EditIcon size={18} />
                        </IconButton>
                      )}
                      {hasPermission("queues.delete") && (
                        <IconButton
                          size="small"
                          className={classes.actionButton}
                          onClick={() => {
                            setSelectedQueue(queue);
                            setConfirmModalOpen(true);
                          }}
                        >
                          <DeleteIcon size={18} />
                        </IconButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tabela — desktop */}
              <div className={classes.desktopTableWrapper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell align="center" className={classes.headCell}>
                        {i18n.t("queues.table.ID")}
                      </TableCell>
                      <TableCell align="center" className={classes.headCell}>
                        {i18n.t("queues.table.name")}
                      </TableCell>
                      <TableCell align="center" className={classes.headCell}>
                        {i18n.t("queues.table.color")}
                      </TableCell>
                      <TableCell align="center" className={classes.headCell}>
                        {i18n.t("queues.table.orderQueue")}
                      </TableCell>
                      <TableCell align="center" className={classes.headCell}>
                        {i18n.t("queues.table.greeting")}
                      </TableCell>
                      <TableCell align="center" className={classes.headCell}>
                        {i18n.t("queues.table.actions")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredQueues.map((queue) => (
                      <TableRow key={queue.id} className={classes.rowHover}>
                        <TableCell align="center" className={classes.bodyCell}>
                          #{queue.id}
                        </TableCell>
                        <TableCell align="center" className={classes.bodyCell}>
                          {queue.name}
                        </TableCell>
                        <TableCell align="center" className={classes.bodyCell}>
                          <span
                            className={classes.colorSwatchTable}
                            style={{ backgroundColor: queue.color }}
                          />
                        </TableCell>
                        <TableCell align="center" className={classes.bodyCell}>
                          {queue.orderQueue ?? "—"}
                        </TableCell>
                        <TableCell align="center" className={classes.bodyCell}>
                          <span className={classes.greetingText}>
                            {queue.greetingMessage || "—"}
                          </span>
                        </TableCell>
                        <TableCell
                          align="center"
                          className={`${classes.bodyCell} ${classes.actionsCell}`}
                        >
                          {hasPermission("queues.edit") && (
                            <IconButton
                              size="small"
                              onClick={() => handleEditQueue(queue)}
                            >
                              <EditIcon size={18} />
                            </IconButton>
                          )}
                          {hasPermission("queues.delete") && (
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedQueue(queue);
                                setConfirmModalOpen(true);
                              }}
                            >
                              <DeleteIcon size={18} />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Paper>
      )}
    </MainContainer>
  );
};

export default Queues;
