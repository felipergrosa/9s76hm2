import React, { useState, useEffect, useCallback } from "react";
import {
  makeStyles,
  Typography,
  IconButton,
  Collapse,
} from "@material-ui/core";
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon,
} from "@material-ui/icons";
import { format, parseISO } from "date-fns";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  root: {
    backgroundColor: "#d9fdd3",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
    cursor: "pointer",
  },
  header: {
    display: "flex",
    alignItems: "center",
    padding: "6px 12px",
    gap: 8,
  },
  pinIcon: {
    fontSize: 16,
    color: "#008069",
    transform: "rotate(45deg)",
  },
  headerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: 500,
    color: "#111b21",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  count: {
    fontSize: 11,
    color: "#667781",
    marginLeft: 4,
  },
  messagesList: {
    maxHeight: 200,
    overflow: "auto",
    backgroundColor: "#fff",
  },
  messageItem: {
    display: "flex",
    alignItems: "flex-start",
    padding: "8px 12px",
    borderBottom: "1px solid rgba(0,0,0,0.04)",
    cursor: "pointer",
    "&:hover": {
      backgroundColor: "#f5f6f6",
    },
  },
  messageBody: {
    flex: 1,
    fontSize: 13,
    color: "#111b21",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  messageMeta: {
    fontSize: 11,
    color: "#8696a0",
    whiteSpace: "nowrap",
    marginLeft: 8,
  },
}));

const PinnedMessages = ({ ticketId, onNavigateToMessage }) => {
  const classes = useStyles();
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const fetchPinned = useCallback(async () => {
    if (!ticketId) return;
    try {
      const { data } = await api.get(`/messages/${ticketId}/pinned`);
      setPinnedMessages(data.messages || []);
    } catch (err) {
      console.error("[PinnedMessages] Erro:", err);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchPinned();
    setDismissed(false);
  }, [ticketId, fetchPinned]);

  if (pinnedMessages.length === 0 || dismissed) return null;

  // Mostrar a mensagem fixada mais recente no header
  const latestPinned = pinnedMessages[0];

  const handleClick = (msg) => {
    if (onNavigateToMessage) {
      onNavigateToMessage(msg.id);
    }
  };

  return (
    <div className={classes.root}>
      <div className={classes.header} onClick={() => setExpanded(!expanded)}>
        <span className={classes.pinIcon}>📌</span>
        <span className={classes.headerText}>
          {latestPinned.body?.substring(0, 80) || "Mensagem fixada"}
          {pinnedMessages.length > 1 && (
            <span className={classes.count}>
              +{pinnedMessages.length - 1} fixada{pinnedMessages.length > 2 ? "s" : ""}
            </span>
          )}
        </span>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDismissed(true); }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>

      <Collapse in={expanded}>
        <div className={classes.messagesList}>
          {pinnedMessages.map((msg) => (
            <div
              key={msg.id}
              className={classes.messageItem}
              onClick={() => handleClick(msg)}
            >
              <span className={classes.messageBody}>
                {msg.body?.substring(0, 100) || "(mídia)"}
              </span>
              <span className={classes.messageMeta}>
                {msg.contact?.name || (msg.fromMe ? "Você" : "")}
                {msg.createdAt && ` · ${format(parseISO(msg.createdAt), "dd/MM HH:mm")}`}
              </span>
            </div>
          ))}
        </div>
      </Collapse>
    </div>
  );
};

export default PinnedMessages;
