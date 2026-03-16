import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  Card,
  CardContent,
  Typography,
  Tooltip,
  IconButton,
} from "@material-ui/core";
import { Close as CloseIcon, WhatsApp } from "@material-ui/icons";
import { format, parseISO } from "date-fns";
import { grey, green } from "@material-ui/core/colors";
import ContactAvatar from "../ContactAvatar";

const useStyles = makeStyles((theme) => ({
  card: {
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    borderRadius: 8,
    border: "1px solid transparent",
    transition: "all 0.2s",
    flexShrink: 0,
    marginBottom: theme.spacing(1),
    position: "relative",
    cursor: "pointer",
    "&:hover": {
      borderColor: theme.palette.primary.main,
      transform: "translateY(-2px)",
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
    },
  },
  closeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    padding: 4,
    zIndex: 10,
    color: theme.palette.text.secondary,
    "&:hover": {
      color: theme.palette.error.main,
      backgroundColor: "rgba(211, 47, 47, 0.1)",
    },
  },
  content: {
    padding: "12px 12px 8px 12px !important",
    "&:last-child": {
      paddingBottom: "8px !important",
    },
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing(0.5),
  },
  avatarContainer: {
    position: "relative",
    marginRight: theme.spacing(1.5),
  },
  statusIndicator: {
    position: "absolute",
    bottom: 0,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: "50%",
    border: "2px solid #fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    backgroundColor: "#25D366",
  },
  nameContainer: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flex: 1,
    paddingRight: 28, // espaço para o botão X
  },
  ticketName: {
    fontWeight: 600,
    fontSize: "0.95rem",
    color: theme.palette.text.primary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 180,
  },
  ticketId: {
    fontSize: "0.75rem",
    color: grey[600],
  },
  message: {
    fontSize: "0.85rem",
    color: theme.palette.text.secondary,
    display: "-webkit-box",
    "-webkit-line-clamp": 2,
    "-webkit-box-orient": "vertical",
    overflow: "hidden",
    lineHeight: 1.3,
    wordBreak: "break-word",
    marginBottom: theme.spacing(0.5),
    marginLeft: 56, // alinhado com o nome (40px avatar + 16px gap)
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing(1),
    marginLeft: 46, // reduzido de 56 para mover chips mais à esquerda
  },
  tagContainer: {
    display: "flex",
    gap: 4,
    flex: 1,
    overflow: "hidden",
  },
  badge: {
    fontSize: "0.65rem",
    height: 18,
    padding: "0 6px",
    borderRadius: 4,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 100,
  },
  timeContainer: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginLeft: "auto",
    flexShrink: 0,
  },
  unreadBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#25d366",
    color: "#fff",
    borderRadius: "12px",
    padding: "0 6px",
    fontSize: "0.7rem",
    fontWeight: "bold",
    height: 18,
    minWidth: 18,
  },
  time: {
    fontSize: "0.7rem",
    color: theme.palette.text.secondary,
    whiteSpace: "nowrap",
  },
}));

const getChannelIcon = (channel) => {
  if (channel === "whatsapp" || channel === "whatsappapi") {
    return <WhatsApp style={{ fontSize: 10, color: "#fff" }} />;
  }
  return null;
};

const NotificationTicketCard = ({ ticket, onClick, onClose }) => {
  const classes = useStyles();

  const handleCardClick = () => {
    if (onClick) onClick(ticket);
  };

  const handleCloseClick = (e) => {
    e.stopPropagation();
    if (onClose) onClose(ticket);
  };

  const formatTime = (dateString) => {
    try {
      return format(parseISO(dateString), "HH:mm");
    } catch {
      return "";
    }
  };

  return (
    <Card className={classes.card} onClick={handleCardClick}>
      <IconButton
        className={classes.closeButton}
        size="small"
        onClick={handleCloseClick}
        title="Marcar como lido"
      >
        <CloseIcon fontSize="small" />
      </IconButton>

      <CardContent className={classes.content}>
        <div className={classes.header}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div className={classes.avatarContainer}>
              <ContactAvatar
                contact={ticket.contact}
                style={{ width: 40, height: 40 }}
              />
              <div className={classes.statusIndicator}>
                {getChannelIcon(ticket.channel)}
              </div>
            </div>
            <div className={classes.nameContainer}>
              <Typography className={classes.ticketName}>
                {ticket.contact?.name || "Contato"}
              </Typography>
              <Typography className={classes.ticketId}>
                #{ticket.id}
              </Typography>
            </div>
          </div>
        </div>

        {/* Mensagem */}
        <Typography className={classes.message}>
          {ticket.lastMessage || "Sem mensagens"}
        </Typography>

        {/* Rodapé com tags e hora */}
        <div className={classes.footer}>
          <div className={classes.tagContainer}>
            {ticket.whatsapp && (
              <Tooltip title={`Conexão: ${ticket.whatsapp.name}`}>
                <div
                  className={classes.badge}
                  style={{
                    backgroundColor: ticket.whatsapp.color || "#25D366",
                    color: "#fff",
                  }}
                >
                  {ticket.whatsapp.name}
                </div>
              </Tooltip>
            )}

            {ticket.queue && (
              <Tooltip title={`Fila: ${ticket.queue.name}`}>
                <div
                  className={classes.badge}
                  style={{
                    backgroundColor: ticket.queue.color || "#e0e0e0",
                    color: ticket.queue.color ? "#fff" : "inherit",
                  }}
                >
                  {ticket.queue.name}
                </div>
              </Tooltip>
            )}

            {ticket.user?.name && (
              <Tooltip title={`Atendente: ${ticket.user.name}`}>
                <div
                  className={classes.badge}
                  style={{
                    backgroundColor: ticket.user.color || "#000",
                    color: "#fff",
                  }}
                >
                  {ticket.user.name}
                </div>
              </Tooltip>
            )}
          </div>

          <div className={classes.timeContainer}>
            {Number(ticket.unreadMessages) > 0 && (
              <div className={classes.unreadBadge}>
                {ticket.unreadMessages}
              </div>
            )}
            <Typography className={classes.time}>
              {formatTime(ticket.updatedAt)}
            </Typography>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationTicketCard;
