import React, { useEffect, useReducer, useState, useContext } from "react";

import {
  Button,
  IconButton,
  makeStyles,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
  Grid,
} from "@material-ui/core";
import useMediaQuery from "@material-ui/core/useMediaQuery";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import Title from "../../components/Title";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { DeleteOutline, Edit } from "@material-ui/icons";
import QueueModal from "../../components/QueueModal";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";
// import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import ForbiddenPage from "../../components/ForbiddenPage";
import usePermissions from "../../hooks/usePermissions";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    ...theme.scrollbarStyles,
  },
  customTableCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
  },
  colorSwatch: {
    width: 18,
    height: 18,
    borderRadius: 6,
    border: `1px solid ${theme.palette.divider}`,
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
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [queues, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);

  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  //   const socketManager = useContext(SocketContext);
  const { user, socket } = useContext(AuthContext);
  const { hasPermission } = usePermissions();
  const companyId = user.companyId;


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
            <Grid container spacing={isMobile ? 1 : 2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <Title>{i18n.t("queues.title")} ({queues.length})</Title>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Grid container spacing={1} justifyContent="flex-end">
                  <Grid item xs={12} sm="auto">
                    <Button
                      fullWidth={isMobile}
                      variant="contained"
                      color="primary"
                      onClick={handleOpenQueueModal}
                      style={{ minHeight: 44 }}
                    >
                      {i18n.t("queues.buttons.add")}
                    </Button>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </MainHeader>
          <Paper className={classes.mainPaper} variant="outlined">
            {/* Mobile cards */}
            <div className={classes.mobileList}>
              {queues.map((queue) => (
                <div key={queue.id} className={classes.card}>
                  <div className={classes.cardHeader}>
                    <div className={classes.cardTitle}>
                      <span className={classes.colorSwatch} style={{ backgroundColor: queue.color }} />
                      {queue.name}
                    </div>
                    <div className={classes.metaValue}>ID #{queue.id}</div>
                  </div>
                  <div className={classes.cardMeta}>
                    <div>
                      <div className={classes.metaLabel}>{i18n.t("queues.table.orderQueue")}</div>
                      <div className={classes.metaValue}>{queue.orderQueue ?? "—"}</div>
                    </div>
                    <div>
                      <div className={classes.metaLabel}>{i18n.t("queues.table.greeting")}</div>
                      <div className={classes.metaValue}>
                        {queue.greetingMessage ? queue.greetingMessage.slice(0, 90) + (queue.greetingMessage.length > 90 ? "…" : "") : "—"}
                      </div>
                    </div>
                  </div>
                  <div className={classes.cardActions}>
                    <IconButton
                      size="small"
                      className={classes.actionButton}
                      onClick={() => handleEditQueue(queue)}
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      className={classes.actionButton}
                      onClick={() => {
                        setSelectedQueue(queue);
                        setConfirmModalOpen(true);
                      }}
                    >
                      <DeleteOutline />
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
                    <TableCell align="center">
                      {i18n.t("queues.table.ID")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("queues.table.name")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("queues.table.color")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("queues.table.orderQueue")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("queues.table.greeting")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("queues.table.actions")}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <>
                    {queues.map((queue) => (
                      <TableRow key={queue.id}>
                        <TableCell align="center">{queue.id}</TableCell>
                        <TableCell align="center">{queue.name}</TableCell>
                        <TableCell align="center">
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
                        </TableCell>
                        <TableCell align="center">
                          <div className={classes.customTableCell}>
                            <Typography
                              style={{ width: 300, align: "center" }}
                              noWrap
                              variant="body2"
                            >
                              {queue.orderQueue}
                            </Typography>
                          </div>
                        </TableCell>
                        <TableCell align="center">
                          <div className={classes.customTableCell}>
                            <Typography
                              style={{ width: 300, align: "center" }}
                              noWrap
                              variant="body2"
                            >
                              {queue.greetingMessage}
                            </Typography>
                          </div>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => handleEditQueue(queue)}
                          >
                            <Edit />
                          </IconButton>

                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedQueue(queue);
                              setConfirmModalOpen(true);
                            }}
                          >
                            <DeleteOutline />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {loading && <TableRowSkeleton columns={4} />}
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

export default Queues;
