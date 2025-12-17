import React, { useState, useEffect, useContext, useMemo } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  Paper,
  Typography,
  Badge,
  Grid,
  Box,
  Avatar,
  Card,
  CardContent,
  CardActionArea,
  Divider,
  Tooltip,
} from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { format, isSameDay, parseISO } from "date-fns";
import { useHistory } from "react-router-dom";
import {
  Android,
  Assignment,
  ReportProblem,
  Person,
  WhatsApp,
  Visibility
} from "@material-ui/icons";
import ContactAvatar from "../ContactAvatar";
import { grey, green, red, blue, orange } from "@material-ui/core/colors";
import { getBackendUrl } from "../../config";

const backendUrl = getBackendUrl();

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    gap: theme.spacing(2),
    height: "100%",
    width: "max-content", // Permite que o container cresça horizontalmente
    paddingBottom: theme.spacing(2),
  },
  column: {
    width: 350,
    minWidth: 350,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: "#f5f5f5",
    borderRadius: theme.shape.borderRadius,
    border: "1px solid rgba(0,0,0,0.12)",
    overflow: "hidden",
  },
  columnHeader: {
    padding: theme.spacing(2),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
    backgroundColor: "#fff",
  },
  columnTitle: {
    fontWeight: 600,
    fontSize: "1rem",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  ticketsList: {
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(1),
    ...theme.scrollbarStyles,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
  },
  ticketCard: {
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    borderRadius: 8,
    border: "1px solid transparent",
    transition: "all 0.2s",
    "&:hover": {
      borderColor: theme.palette.primary.main,
      transform: "translateY(-2px)",
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
    },
  },
  ticketContent: {
    padding: "12px !important",
  },
  ticketHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing(1),
  },
  ticketName: {
    fontWeight: 600,
    fontSize: "0.95rem",
    color: theme.palette.text.primary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 200,
  },
  ticketMessage: {
    fontSize: "0.85rem",
    color: theme.palette.text.secondary,
    display: "-webkit-box",
    "-webkit-line-clamp": 2,
    "-webkit-box-orient": "vertical",
    overflow: "hidden",
    marginBottom: theme.spacing(1),
    lineHeight: 1.3,
  },
  ticketFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: theme.spacing(1),
  },
  badge: {
    fontSize: "0.7rem",
    height: 20,
    padding: "0 6px",
    borderRadius: 4,
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
  },
  queueTag: {
    backgroundColor: theme.palette.grey[300],
    color: theme.palette.text.primary,
    marginRight: theme.spacing(1),
  },
  whatsappTag: {
    backgroundColor: "#25D366",
    color: "#fff",
  },
  time: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
  },
  actionButton: {
    padding: 4,
    color: theme.palette.text.secondary,
    "&:hover": {
      color: theme.palette.primary.main,
    },
  },
  avatarContainer: {
    position: "relative",
    marginRight: theme.spacing(1),
  },
  statusIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: "50%",
    border: "2px solid #fff",
  },
}));

const MomentsUser = () => {
  const classes = useStyles();
  const history = useHistory();
  const { user, socket } = useContext(AuthContext);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    const companyId = user.companyId;

    const onAppMessage = (data) => {
      if (
        data.action === "create" ||
        data.action === "update" ||
        data.action === "delete"
      ) {
        fetchTickets();
      }
    };

    socket.on(`company-${companyId}-ticket`, onAppMessage);
    socket.on(`company-${companyId}-appMessage`, onAppMessage);

    return () => {
      socket.off(`company-${companyId}-ticket`, onAppMessage);
      socket.off(`company-${companyId}-appMessage`, onAppMessage);
    };
  }, [socket, user.companyId]);

  const fetchTickets = async () => {
    try {
      const { data } = await api.get("/usersMoments");
      setTickets(data);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      toastError(err);
    }
  };

  const { botTickets, campaignTickets, pendingTickets, userTickets } = useMemo(() => {
    const bots = [];
    const campaigns = [];
    const pending = [];
    const byUser = {};

    tickets.forEach((ticket) => {
      // Bot Tickets
      if (ticket.isBot) {
        bots.push(ticket);
        return;
      }

      // Campaign Tickets (Imported)
      if (ticket.imported) {
        campaigns.push(ticket);
        return;
      }

      // User Tickets (com usuário atribuído)
      if (ticket.user) {
        if (!byUser[ticket.user.id]) {
          byUser[ticket.user.id] = {
            user: ticket.user,
            tickets: [],
          };
        }
        byUser[ticket.user.id].tickets.push(ticket);
        return;
      }

      // Pending Tickets (sem usuário e não é bot nem campanha)
      pending.push(ticket);
    });

    return {
      botTickets: bots,
      campaignTickets: campaigns,
      pendingTickets: pending,
      userTickets: Object.values(byUser),
    };
  }, [tickets]);

  const renderTicketCard = (ticket) => (
    <Card key={ticket.id} className={classes.ticketCard}>
      <CardActionArea
        onClick={() => {
          if (user.profile === "admin" || ticket.userId === user.id) {
            history.push(`/tickets/${ticket.uuid}`);
          }
        }}
      >
        <CardContent className={classes.ticketContent}>
          <div className={classes.ticketHeader}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div className={classes.avatarContainer}>
                <ContactAvatar
                  contact={ticket.contact}
                  style={{ width: 40, height: 40 }}
                />
              </div>
              <div>
                <Typography className={classes.ticketName}>
                  {ticket.contact?.name}
                </Typography>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {ticket.whatsapp && (
                    <div className={`${classes.badge} ${classes.whatsappTag}`}>
                      <WhatsApp style={{ fontSize: 12, marginRight: 2 }} />
                      {ticket.whatsapp.name}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {(user.profile === "admin" || ticket.userId === user.id) && (
              <Tooltip title="Visualizar">
                <Visibility className={classes.actionButton} fontSize="small" />
              </Tooltip>
            )}
          </div>

          <Typography className={classes.ticketMessage}>
            {ticket.lastMessage || "Sem mensagens"}
          </Typography>

          <Divider style={{ margin: "8px 0" }} />

          <div className={classes.ticketFooter}>
            <div style={{ display: "flex", gap: 4 }}>
              <div
                className={`${classes.badge} ${classes.queueTag}`}
                style={{
                  backgroundColor: ticket.queue?.color || "#e0e0e0",
                  color: ticket.queue?.color ? "#fff" : "inherit",
                }}
              >
                {ticket.queue?.name || "Sem Fila"}
              </div>
            </div>
            <Typography className={classes.time}>
              {isSameDay(parseISO(ticket.updatedAt), new Date())
                ? format(parseISO(ticket.updatedAt), "HH:mm")
                : format(parseISO(ticket.updatedAt), "dd/MM")}
            </Typography>
          </div>
        </CardContent>
      </CardActionArea>
    </Card>
  );

  const renderColumn = (title, icon, items, color) => (
    <Paper className={classes.column} elevation={0}>
      <div className={classes.columnHeader} style={{ borderTop: `4px solid ${color}` }}>
        <div className={classes.columnTitle} style={{ color }}>
          {icon}
          {title}
        </div>
        <Badge badgeContent={items.length} color="primary" max={99}>
          <Box width={10} />
        </Badge>
      </div>
      <div className={classes.ticketsList}>
        {items.length > 0 ? (
          items.map(renderTicketCard)
        ) : (
          <div style={{ padding: 20, textAlign: "center", color: "#bdbdbd" }}>
            <Typography variant="body2">Nenhum atendimento</Typography>
          </div>
        )}
      </div>
    </Paper>
  );

  return (
    <div className={classes.root}>
      {/* Coluna Bot */}
      {renderColumn(
        "Bot / Automático",
        <Android />,
        botTickets,
        blue[600]
      )}

      {/* Coluna Campanhas */}
      {renderColumn(
        "Campanhas",
        <Assignment />,
        campaignTickets,
        orange[600]
      )}

      {/* Coluna Pendentes */}
      {renderColumn(
        "Pendentes",
        <ReportProblem />,
        pendingTickets,
        red[600]
      )}

      {/* Colunas de Usuários */}
      {userTickets.map((group) => (
        <Paper key={group.user.id} className={classes.column} elevation={0}>
          <div className={classes.columnHeader} style={{ borderTop: `4px solid ${green[600]}` }}>
            <div className={classes.columnTitle}>
              <Avatar
                src={group.user.profileImage ? `${backendUrl}/public/company${user.companyId}/user/${group.user.profileImage}` : null}
                style={{ width: 30, height: 30, marginRight: 8 }}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.9rem' }}>{group.user.name}</span>
                <span style={{ fontSize: '0.75rem', color: grey[600], fontWeight: 400 }}>
                  {group.user.email}
                </span>
              </div>
            </div>
            <Badge badgeContent={group.tickets.length} color="primary" max={99}>
              <Box width={10} />
            </Badge>
          </div>
          <div className={classes.ticketsList}>
            {group.tickets.map(renderTicketCard)}
          </div>
        </Paper>
      ))}
    </div>
  );
};

export default MomentsUser;
