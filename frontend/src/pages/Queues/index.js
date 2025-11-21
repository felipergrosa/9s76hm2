import React, { useEffect, useReducer, useState, useContext, useMemo } from "react";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Paper, Box, useMediaQuery, TextField, InputAdornment, Grid, IconButton, Button, Tooltip, Typography } from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import { DeleteOutline, Edit } from "@material-ui/icons";
import { Plus } from "lucide-react";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import QueueModal from "../../components/QueueModal";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";
import { AuthContext } from "../../context/Auth/AuthContext";
import ForbiddenPage from "../../components/ForbiddenPage";
import usePermissions from "../../hooks/usePermissions";

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
  sortButton: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    font: "inherit",
    color: "inherit",
    "&:hover": {
      opacity: 0.8,
    },
  },
  sortIcon: {
    fontSize: "0.75rem",
    opacity: 0.6,
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
  customTableCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
}));

const CustomTooltipProps = {
  arrow: true,
  enterTouchDelay: 0,
  leaveTouchDelay: 5000,
  enterDelay: 300,
  leaveDelay: 100,
};

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
  const isDesktop = useMediaQuery(theme.breakpoints.up(1200));

  const [queues, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const { user, socket } = useContext(AuthContext);
  const { hasPermission } = usePermissions();
  const companyId = user.companyId;

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };


  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/queue");
        dispatch({ type: "LOAD_QUEUES", payload: data });

        setLoading(false);
      } catch (err) {
        toastError(err);
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
      toastError(err);
    }
    setSelectedQueue(null);
  };

  return (
    <Box className={classes.root}>
      <MainContainer useWindowScroll>
        <Box className={classes.container}>
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
      {hasPermission("queues.view") ? (
        <>
          <MainHeader>
                <Grid style={{ width: "99.6%" }} container>
                  <Grid xs={12} sm={5} item>
                    <Title>
                      {i18n.t("queues.title")} ({queues.length})
                    </Title>
                  </Grid>
                  <Grid xs={12} sm={7} item>
                    <Grid container alignItems="center" spacing={2} justifyContent="flex-end">
                      <Grid item>
                        <Tooltip {...CustomTooltipProps} title={i18n.t("queues.buttons.add")}>
              <Button
                            onClick={handleOpenQueueModal}
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
                            aria-label={i18n.t("queues.buttons.add")}
              >
                {i18n.t("queues.buttons.add")}
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
                          <th scope="col" style={{ textAlign: "center", width: "80px" }}>
                            <button 
                              onClick={() => handleSort('id')} 
                              className={classes.sortButton}
                              style={{ width: "100%", justifyContent: "center" }}
                            >
                              {i18n.t("queues.table.ID").toUpperCase()}
                              <span className={classes.sortIcon}>
                                {sortField === 'id' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                              </span>
                            </button>
                          </th>
                          <th scope="col" style={{ textAlign: "center" }}>
                            <button 
                              onClick={() => handleSort('name')} 
                              className={classes.sortButton}
                              style={{ width: "100%", justifyContent: "center" }}
                            >
                              {i18n.t("queues.table.name").toUpperCase()}
                              <span className={classes.sortIcon}>
                                {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                              </span>
                            </button>
                          </th>
                          <th scope="col" style={{ textAlign: "center" }}>
                            {i18n.t("queues.table.color").toUpperCase()}
                          </th>
                          <th scope="col" style={{ textAlign: "center" }}>
                            {i18n.t("queues.table.orderQueue").toUpperCase()}
                          </th>
                          <th scope="col" style={{ textAlign: "center" }}>
                            {i18n.t("queues.table.greeting").toUpperCase()}
                          </th>
                          <th scope="col" style={{ textAlign: "center" }}>
                            {i18n.t("queues.table.actions").toUpperCase()}
                          </th>
                        </tr>
                      </thead>
                      <tbody className={classes.tableBody}>
                        {!loading && queues.length === 0 && (
                          <tr>
                            <td colSpan={6} className={classes.emptyState}>
                              Nenhuma fila encontrada.
                            </td>
                          </tr>
                        )}
                  {queues.map((queue) => (
                          <tr key={queue.id}>
                            <td style={{ textAlign: "center" }}>{queue.id}</td>
                            <td style={{ textAlign: "center" }}>{queue.name}</td>
                            <td style={{ textAlign: "center" }}>
                        <div className={classes.customTableCell}>
                          <span
                            style={{
                              backgroundColor: queue.color,
                              width: 60,
                              height: 20,
                              alignSelf: "center",
                            }}
                          />
                        </div>
                            </td>
                            <td style={{ textAlign: "center" }}>
                        <div className={classes.customTableCell}>
                          <Typography
                            style={{ width: 300, align: "center" }}
                            noWrap
                            variant="body2"
                          >
                            {queue.orderQueue}
                          </Typography>
                        </div>
                            </td>
                            <td style={{ textAlign: "center" }}>
                        <div className={classes.customTableCell}>
                          <Typography
                            style={{ width: 300, align: "center" }}
                            noWrap
                            variant="body2"
                          >
                            {queue.greetingMessage}
                          </Typography>
                        </div>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <Tooltip {...CustomTooltipProps} title="Editar">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEditQueue(queue)}
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
                                  onClick={() => {
                                    setSelectedQueue(queue);
                                    setConfirmModalOpen(true);
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
                        {loading && <TableRowSkeleton columns={6} />}
                      </tbody>
                    </table>
                  </Box>
                </Paper>
              ) : (
                /* Mobile View */
                <>
                  <div className="flex flex-col gap-1.5 mt-3 w-full max-w-[375px] mx-auto">
                    {!loading && queues.length === 0 && (
                      <div className="text-center text-sm text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        Nenhuma fila encontrada.
                      </div>
                    )}
                    {queues.map((queue) => (
                      <div key={queue.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-semibold text-sm">{queue.name}</span>
                            <div className="text-xs text-gray-600 dark:text-gray-400">ID: {queue.id}</div>
                          </div>
                          <div className="flex gap-1">
                            <Tooltip {...CustomTooltipProps} title="Editar">
                        <IconButton
                          size="small"
                          onClick={() => handleEditQueue(queue)}
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
                          onClick={() => {
                            setSelectedQueue(queue);
                            setConfirmModalOpen(true);
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
                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                          <div className="flex items-center gap-2">
                            <span>Cor:</span>
                            <span
                              style={{
                                backgroundColor: queue.color,
                                width: 40,
                                height: 16,
                                display: "inline-block",
                                borderRadius: "4px"
                              }}
                            />
                          </div>
                          <div>Ordem: {queue.orderQueue}</div>
                          {queue.greetingMessage && (
                            <div className="truncate">Saudação: {queue.greetingMessage}</div>
                          )}
                        </div>
                      </div>
                  ))}
                    {loading && <TableRowSkeleton columns={6} />}
                  </div>
                </>
              )}
        </>
      ) : <ForbiddenPage />}
        </Box>
    </MainContainer>
    </Box>
  );
};

export default Queues;
