import React, { useContext, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  makeStyles,
} from "@material-ui/core";
import { X as CloseIcon } from "lucide-react";
import { useHistory } from "react-router-dom";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import ContactAvatar from "../ContactAvatar";
import MessagesList from "../MessagesList";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { ForwardMessageProvider } from "../../context/ForwarMessage/ForwardMessageContext";
import { OptimisticMessageProvider } from "../../context/OptimisticMessage/OptimisticMessageContext";
import { QueueSelectedProvider } from "../../context/QueuesSelected/QueuesSelectedContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { canAssumeTicketConversation } from "../../utils/ticketPreviewPermissions";

const useStyles = makeStyles(theme => ({
  dialogPaper: {
    overflow: "hidden",
  },
  dialogTitle: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.palette.primary.main,
    color: "#fff",
    paddingRight: theme.spacing(1),
  },
  closeButton: {
    color: "#fff",
  },
  dialogContent: {
    padding: 0,
    display: "flex",
    flexDirection: "column",
    height: "80vh",
    maxHeight: "900px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(1.5, 2),
    borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
    backgroundColor: theme.palette.background.paper,
    gap: theme.spacing(2),
  },
  headerMain: {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
    gap: theme.spacing(1.5),
  },
  headerMeta: {
    minWidth: 0,
  },
  contactName: {
    fontWeight: 600,
    lineHeight: 1.2,
  },
  channelText: {
    display: "block",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexShrink: 0,
  },
  messagesWrapper: {
    flex: 1,
    minHeight: 0,
    display: "flex",
  },
}));

const ConversationPeekModal = ({
  open,
  onClose,
  ticket,
  onAssumed,
}) => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const [assuming, setAssuming] = useState(false);

  const canAssume = useMemo(() => {
    return canAssumeTicketConversation({ ticket, user });
  }, [ticket, user]);

  const containerId = useMemo(() => {
    return `messagesList-peek-${ticket?.id || "unknown"}`;
  }, [ticket?.id]);

  const handleAssumeConversation = async () => {
    if (!ticket?.id || assuming || !canAssume) return;

    setAssuming(true);
    try {
      const { data } = await api.put(`/tickets/${ticket.id}`, {
        userId: user.id,
        status: ticket.isGroup ? "group" : "open",
      });

      if (typeof onAssumed === "function") {
        onAssumed(data);
      }

      if (data?.uuid) {
        onClose();
        history.push(`/tickets/${data.uuid}`);
      }
    } catch (err) {
      toastError(err);
    } finally {
      setAssuming(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      classes={{ paper: classes.dialogPaper }}
    >
      <DialogTitle disableTypography className={classes.dialogTitle}>
        <Typography variant="h6">Espiando a conversa</Typography>
        <IconButton className={classes.closeButton} onClick={onClose}>
          <CloseIcon size={24} />
        </IconButton>
      </DialogTitle>

      <DialogContent className={classes.dialogContent}>
        <div className={classes.header}>
          <div className={classes.headerMain}>
            <ContactAvatar contact={ticket?.contact} />
            <div className={classes.headerMeta}>
              <Typography variant="subtitle1" noWrap className={classes.contactName}>
                {ticket?.contact?.name || "Contato"}
              </Typography>
              <Typography variant="caption" color="textSecondary" noWrap className={classes.channelText}>
                {ticket?.whatsapp?.name || ticket?.channel || ""}
              </Typography>
            </div>
          </div>

          {canAssume && (
            <div className={classes.headerActions}>
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={handleAssumeConversation}
                disabled={assuming}
              >
                {assuming ? "Assumindo..." : "Assumir conversa"}
              </Button>
            </div>
          )}
        </div>

        <div className={classes.messagesWrapper}>
          {open && ticket && (
            <OptimisticMessageProvider>
              <ReplyMessageProvider>
                <ForwardMessageProvider>
                  <QueueSelectedProvider>
                    <MessagesList
                      isGroup={ticket.isGroup}
                      whatsappId={ticket.whatsappId}
                      queueId={ticket.queueId}
                      channel={ticket.channel}
                      ticketIdOverride={ticket.uuid || ticket.id}
                      ticketDataOverride={ticket}
                      readOnly
                      containerId={containerId}
                    />
                  </QueueSelectedProvider>
                </ForwardMessageProvider>
              </ReplyMessageProvider>
            </OptimisticMessageProvider>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConversationPeekModal;
