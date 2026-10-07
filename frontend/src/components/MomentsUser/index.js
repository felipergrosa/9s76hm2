import React, { useState, useEffect, useContext, useMemo, useRef, useCallback } from "react";
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
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  IconButton,
} from "@material-ui/core";
import { debounce } from "lodash";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { format, parseISO } from "date-fns";
import { useHistory } from "react-router-dom";
import {
  Android,
  Assignment,
  ReportProblem,
  Person,
  WhatsApp,
} from "@material-ui/icons";
import ContactAvatar from "../ContactAvatar";
import { grey, green, red, blue, orange } from "@material-ui/core/colors";
import { getBackendUrl } from "../../config";
import { Eye as VisibilityIcon, ListChecks } from "lucide-react";
import ConversationPeekModal from "../ConversationPeekModal";
import BulkProcessTicketsModal from "../BulkProcessTicketsModal";
import usePermissions from "../../hooks/usePermissions";
import {
  canAssumeTicketConversation,
  canViewTicketConversation,
} from "../../utils/ticketPreviewPermissions";
import { motion, useReducedMotion } from "framer-motion";
import { bentoContainer, bentoItem, bentoItemReduced } from "../bento/motionPresets";
import "../bento/bento.css";

const backendUrl = getBackendUrl();

// Card de ticket memoizado: a cada evento de socket o painel refaz o fetch
// inteiro; sem memo, centenas de cards re-renderizam junto e travam a tela.
const TicketCard = React.memo(({ ticket, classes, canAccess, onTicketClick, onPeek }) => (
  <Card className={classes.ticketCard}>
    <CardActionArea onClick={() => onTicketClick(ticket)}>
      <CardContent className={classes.ticketContent}>
        <div className={classes.ticketHeader}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div className={classes.avatarContainer}>
              <ContactAvatar
                contact={ticket.contact}
                style={{ width: 40, height: 40 }}
              />
              <div
                className={classes.statusIndicator}
                style={{
                  backgroundColor: "#25D366",
                }}
              >
                <WhatsApp style={{ fontSize: 10, color: "#fff" }} />
              </div>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Typography className={classes.ticketName}>
                  {ticket.contact?.name}
                </Typography>
                <Typography style={{ fontSize: "0.75rem", color: grey[600] }}>
                  #{ticket.id}
                </Typography>
              </div>

              {/* Última Mensagem (subida para logo abaixo do ID) */}
              <Typography className={classes.ticketMessage}>
                {ticket.lastMessage || "Sem mensagens"}
              </Typography>
            </div>
          </div>
          {canAccess && (
            <Tooltip title="Espiar Conversa">
              <IconButton
                size="small"
                onClick={(e) => onPeek(e, ticket)}
                // Touch target mínimo de 44px no mobile
                style={{ padding: 4, color: blue[700], minWidth: 44, minHeight: 44 }}
              >
                <VisibilityIcon size={20} />
              </IconButton>
            </Tooltip>
          )}
        </div>

        {/* Tags de Conexão, Fila e Usuário no rodapé */}
        <div className={classes.tagContainer}>
          {ticket.whatsapp && (
            <Tooltip title={`Conexão: ${ticket.whatsapp.name}`}>
              <div
                className={`${classes.badge}`}
                style={{
                  backgroundColor: ticket.whatsapp.color || "#25D366",
                  color: "#fff",
                  textTransform: "uppercase"
                }}
              >
                {ticket.whatsapp.name}
              </div>
            </Tooltip>
          )}

          <Tooltip title={`Fila: ${ticket.queue?.name || "Sem Fila"}`}>
            <div
              className={`${classes.badge}`}
              style={{
                backgroundColor: ticket.queue?.color || "#e0e0e0",
                color: ticket.queue?.color ? "#fff" : "inherit",
                textTransform: "uppercase"
              }}
            >
              {ticket.queue?.name || "Sem Fila"}
            </div>
          </Tooltip>

          {ticket.user?.name && (
            <Tooltip title={`Atendente: ${ticket.user.name}`}>
              <div
                className={`${classes.badge}`}
                style={{
                  backgroundColor: ticket.user.color || '#000',
                  color: '#fff',
                  textTransform: "uppercase"
                }}
              >
                {ticket.user.name}
              </div>
            </Tooltip>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            {Number(ticket.unreadMessages) > 0 && (
              <div className={classes.unreadBadge} style={{ transform: 'scale(0.8)' }}>
                {ticket.unreadMessages}
              </div>
            )}
            <Typography className={classes.time}>
              {(() => {
                try {
                  if (!ticket.updatedAt) return "";
                  return format(parseISO(ticket.updatedAt), "HH:mm");
                } catch {
                  return "";
                }
              })()}
            </Typography>
          </div>
        </div>
      </CardContent>
    </CardActionArea>
  </Card>
), (a, b) =>
  // Campos realmente exibidos no card — refetch com mesmo conteúdo não re-renderiza
  a.ticket.id === b.ticket.id &&
  a.ticket.updatedAt === b.ticket.updatedAt &&
  a.ticket.unreadMessages === b.ticket.unreadMessages &&
  a.ticket.lastMessage === b.ticket.lastMessage &&
  a.ticket.user?.id === b.ticket.user?.id &&
  a.ticket.queue?.id === b.ticket.queue?.id &&
  a.ticket.whatsapp?.id === b.ticket.whatsapp?.id &&
  a.ticket.contact?.name === b.ticket.contact?.name &&
  a.ticket.contact?.profilePicUrl === b.ticket.contact?.profilePicUrl &&
  a.canAccess === b.canAccess
);

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: theme.spacing(2),
    height: "100%",
    minHeight: 0,
    width: "fit-content",
    minWidth: "100%",
    paddingBottom: theme.spacing(2),
    paddingRight: theme.spacing(4), // Aumentado para garantir espaço após última coluna
    alignItems: "stretch",
  },
  column: {
    width: 350,
    minWidth: 350,
    maxWidth: 350,
    flex: "0 0 350px",
    // No mobile a coluna ocupa 82% da viewport: mostra 1 coluna inteira
    // + "espiada" da próxima, mantendo o pan horizontal contido
    [theme.breakpoints.down("sm")]: {
      width: "82vw",
      minWidth: "82vw",
      maxWidth: "82vw",
      flex: "0 0 82vw",
    },
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
    maxHeight: "100%",
    // Superfície bento: usa as vars do tema moderno (dark-aware),
    // com fallback sólido para o tema clássico
    backgroundColor: "var(--card, #f5f5f5)",
    borderRadius: 20,
    border: "1px solid var(--border, rgba(0,0,0,0.12))",
    boxShadow: "var(--shadow, 0 1px 3px rgba(0,0,0,0.08))",
    overflow: "hidden",
    cursor: "grab",
    "&:active": {
      cursor: "grabbing",
    },
  },
  columnHeader: {
    padding: theme.spacing(2),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid var(--border, rgba(0,0,0,0.08))",
    backgroundColor: "transparent",
    flex: "0 0 auto",
    cursor: "grab",
  },
  columnTitle: {
    fontWeight: 600,
    fontSize: "1rem",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  ticketsList: {
    flex: "1 1 0",
    overflowY: "auto",
    overflowX: "hidden",
    padding: theme.spacing(1),
    minHeight: 0,
    maxHeight: "100%",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    "&::-webkit-scrollbar": {
      width: 0,
      height: 0,
      display: "none",
    },
  },
  ticketCard: {
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    borderRadius: 12,
    border: "1px solid var(--border, transparent)",
    backgroundColor: "var(--card-elevated, var(--card, #fff))",
    transition: "all 0.2s",
    flexShrink: 0,
    marginBottom: theme.spacing(1),
    // Pinta só o que está visível: em lanes com muitos tickets, o custo
    // de layout/paint dos cards fora da tela some quase por completo
    contentVisibility: "auto",
    containIntrinsicSize: "auto 110px",
    "&:hover": {
      borderColor: theme.palette.primary.main,
      transform: "translateY(-2px)",
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
    },
  },
  ticketContent: {
    padding: "8px !important",
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
    // Coluna mobile é mais estreita: reduzir o limite do ellipsis
    [theme.breakpoints.down("sm")]: {
      maxWidth: 150,
    },
  },
  ticketMessage: {
    fontSize: "0.8rem",
    color: theme.palette.text.secondary,
    display: "-webkit-box",
    "-webkit-line-clamp": 2,
    "-webkit-box-orient": "vertical",
    overflow: "hidden",
    marginBottom: theme.spacing(0.5),
    lineHeight: 1.3,
    wordBreak: "break-word",
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
    lineHeight: "20px",
    padding: "0 6px",
    borderRadius: 4,
    fontWeight: 600,
    display: "block",
    textAlign: "center",
    // Nomes longos (fila/conexão/atendente) truncam com ellipsis em vez de
    // quebrar linha — a altura fixa de 20px clipava a segunda linha e o
    // texto "sumia". Tooltip no wrapper já mostra o nome completo.
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 110,
    minWidth: 0,
    flex: "0 1 auto",
    [theme.breakpoints.down("sm")]: {
      maxWidth: 88,
    },
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
    right: -4,
    width: 14,
    height: 14,
    borderRadius: "50%",
    border: "2px solid #fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  tagContainer: {
    display: "flex",
    alignItems: "center",
    flexWrap: "nowrap",
    overflow: "hidden",
    gap: 4,
    width: "100%",
    justifyContent: "center",
    marginTop: 4
  },
  unreadBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25d366',
    color: '#fff',
    borderRadius: '12px',
    padding: '0 6px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    height: 20,
    minWidth: 20,
  },
  // Estilos para modal de espiar conversa
  dialogTitle: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.palette.primary.main,
    color: "white",
    paddingBottom: theme.spacing(1),
  },
  closeButton: {
    color: "white",
  },
  messagesContainer: {
    height: "60vh",
    maxHeight: "600px",
    overflowY: "auto",
    padding: theme.spacing(2),
    scrollBehavior: "smooth",
  },
  messagesHeader: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(1, 2),
    backgroundColor: theme.palette.grey[100],
  },
  messageAvatar: {
    marginRight: theme.spacing(1),
  },
  messageItem: {
    padding: theme.spacing(1),
    margin: theme.spacing(1, 0),
    borderRadius: theme.spacing(1),
    maxWidth: "80%",
    position: "relative",
  },
  fromMe: {
    backgroundColor: "#dcf8c6",
    marginLeft: "auto",
  },
  fromThem: {
    backgroundColor: "#f5f5f5",
  },
  messageTime: {
    fontSize: "0.75rem",
    color: grey[500],
    position: "absolute",
    bottom: "2px",
    right: "8px",
  },
  messageText: {
    marginBottom: theme.spacing(2),
    wordBreak: "break-word",
  },
  emptyMessages: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: grey[500],
  },
  loadingMessages: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(3),
  },
}));

const MomentsUser = ({ onPanStart }) => {
  const classes = useStyles();
  const history = useHistory();
  const { user, socket } = useContext(AuthContext);
  const shouldReduceMotion = useReducedMotion();
  const itemVariant = shouldReduceMotion ? bentoItemReduced : bentoItem;
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  // Estados para modal de confirmação de transferência
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  const [openTicketMessageDialog, setOpenTicketMessageDialog] = useState(false);
  const [selectedTicketForView, setSelectedTicketForView] = useState(null);

  // Modal de processamento em massa (transferir em lote para outro atendente)
  const { hasPermission } = usePermissions();
  const canBulkProcess = hasPermission("tickets.bulk-process");
  const [bulkModal, setBulkModal] = useState({ open: false, filters: {} });

  // Manipulador seguro para iniciar o arrasto apenas no cabeçalho
  const handleHeaderPointerDown = (e) => {
    if (e.button !== 0) return;
    const isInteractive = e.target.closest('button,a,input,textarea,select,[role="button"]');
    if (isInteractive) return;
    try { e.preventDefault(); } catch (_) { }
    if (onPanStart) onPanStart(e);
  };

  const fetchTickets = async () => {
    try {
      const { data } = await api.get("/usersMoments");
      if (!isMounted.current) return;
      setTickets(data);
      setLoading(false);
    } catch (err) {
      if (!isMounted.current) return;
      setLoading(false);
      toastError(err);
    }
  };

  // Debounce de 500ms para evitar tempestade de GET /usersMoments
  // a cada evento de socket (ticket/appMessage)
  const debouncedFetchTickets = useRef(
    debounce(() => {
      fetchTickets();
    }, 500)
  ).current;

  useEffect(() => {
    fetchTickets();
    return () => {
      isMounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Guard: socket inicial é {} até o AuthProvider conectar
    if (typeof socket?.on !== "function") return;
    const companyId = user.companyId;

    const onAppMessage = (data) => {
      if (
        data.action === "create" ||
        data.action === "update" ||
        data.action === "delete"
      ) {
        debouncedFetchTickets();
      }
    };

    socket.on(`company-${companyId}-ticket`, onAppMessage);
    socket.on(`company-${companyId}-appMessage`, onAppMessage);

    return () => {
      socket.off(`company-${companyId}-ticket`, onAppMessage);
      socket.off(`company-${companyId}-appMessage`, onAppMessage);
      debouncedFetchTickets.cancel();
    };
  }, [socket, user.companyId, debouncedFetchTickets]);

  const { botTickets, campaignTickets, pendingTickets, userTickets } = useMemo(() => {
    const bots = [];
    const campaigns = [];
    const pending = [];
    const byUser = {};

    tickets.forEach((ticket) => {
      // Campaign Tickets (status campaign)
      if (ticket.status === "campaign") {
        campaigns.push(ticket);
        return;
      }

      // User Tickets (com usuário atribuído) — tem PRIORIDADE sobre isBot
      // Quando o atendente aceita um ticket do bot, isBot pode continuar true,
      // mas o ticket já tem user e deve aparecer na coluna do atendente.
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

      // Bot Tickets (sem user atribuído)
      if (ticket.isBot) {
        bots.push(ticket);
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

  const canAccessTicket = useCallback((ticket) => {
    return canViewTicketConversation({ ticket, user });
  }, [user]);

  const shouldShowConfirmModal = (ticket) => {
    const ticketUserId = ticket?.userId;
    const currentUserId = user.id;
    
    // Se não tem dono ou é meu ticket, não mostra modal
    if (!ticketUserId || Number(ticketUserId) === Number(currentUserId)) {
      return false;
    }

    return canAssumeTicketConversation({ ticket, user });
  };

  // Handler para clique no ticket
  const handleTicketClick = useCallback((ticket) => {
    if (shouldShowConfirmModal(ticket)) {
      setSelectedTicket(ticket);
      setConfirmModalOpen(true);
    } else if (canAccessTicket(ticket)) {
      history.push(`/tickets/${ticket.uuid}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, history, canAccessTicket]);

  // Confirmar transferência do ticket
  const handleConfirmTransfer = async () => {
    if (!selectedTicket) return;
    
    setIsTransferring(true);
    try {
      const { data } = await api.put(`/tickets/${selectedTicket.id}`, {
        userId: user.id,
        status: "open"
      });
      
      setConfirmModalOpen(false);
      setSelectedTicket(null);
      if (data?.uuid) {
        history.push(`/tickets/${data.uuid}`);
      }
    } catch (err) {
      console.error("Erro ao transferir ticket:", err);
      toastError("Erro ao assumir o ticket. Tente novamente.");
    } finally {
      setIsTransferring(false);
    }
  };

  // Cancelar transferência
  const handleCancelTransfer = () => {
    setConfirmModalOpen(false);
    setSelectedTicket(null);
  };

  const handleOpenMessageDialog = useCallback((e, ticket) => {
    e.stopPropagation();
    if (!canAccessTicket(ticket)) return;
    setSelectedTicketForView(ticket);
    setOpenTicketMessageDialog(true);
  }, [canAccessTicket]);

  const renderTicket = (ticket) => (
    <TicketCard
      key={ticket.id}
      ticket={ticket}
      classes={classes}
      canAccess={canAccessTicket(ticket)}
      onTicketClick={handleTicketClick}
      onPeek={handleOpenMessageDialog}
    />
  );

  const renderColumn = (title, icon, items, color) => (
    <Paper
      component={motion.div}
      variants={itemVariant}
      className={classes.column}
      elevation={0}
    >
      <div
        className={classes.columnHeader}
        style={{ borderTop: `4px solid ${color}` }}
        onPointerDown={handleHeaderPointerDown}
      >
        <div className={classes.columnTitle} style={{ color }}>
          {icon}
          {title}
        </div>
        <Badge badgeContent={items.length} color="primary" max={99999} overlap="rectangular">
          <Box width={10} />
        </Badge>
      </div>
      <div className={classes.ticketsList}>
        {items.length > 0 ? (
          items.map(renderTicket)
        ) : (
          <div onPointerDown={onPanStart} style={{ padding: 20, textAlign: "center", color: "#bdbdbd", cursor: "grab" }}>
            <Typography variant="body2">Nenhum atendimento</Typography>
          </div>
        )}
      </div>
    </Paper>
  );

  // Skeleton de entrada: shimmer nas colunas enquanto o fetch inicial não volta
  if (loading) {
    return (
      <div className={classes.root}>
        {[0, 1, 2].map((i) => (
          <Paper key={i} className={classes.column} elevation={0}>
            <div className={classes.columnHeader}>
              <div className="bento-shimmer" style={{ width: "60%", height: 24, borderRadius: 8 }} />
            </div>
            <div className={classes.ticketsList} style={{ padding: 8 }}>
              {[0, 1, 2].map((j) => (
                <div key={j} className="bento-shimmer" style={{ height: 96, borderRadius: 12, marginBottom: 8 }} />
              ))}
            </div>
          </Paper>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      variants={bentoContainer}
      initial="hidden"
      animate="show"
      className={classes.root}
    >
      {/* Coluna Bot - só exibe se tiver tickets */}
      {botTickets.length > 0 && renderColumn(
        "Bot / Automático",
        <Android />,
        botTickets,
        blue[600]
      )}

      {/* Coluna Campanhas - só exibe se tiver tickets */}
      {campaignTickets.length > 0 && renderColumn(
        "Campanhas",
        <Assignment />,
        campaignTickets,
        orange[600]
      )}

      {/* Coluna Pendentes - só exibe se tiver tickets */}
      {pendingTickets.length > 0 && renderColumn(
        "Pendentes",
        <ReportProblem />,
        pendingTickets,
        red[600]
      )}

      {/* Colunas de Usuários - só exibe usuários com tickets */}
      {userTickets.filter(group => group.tickets.length > 0).map((group) => (
        <Paper
          component={motion.div}
          variants={itemVariant}
          key={group.user.id}
          className={classes.column}
          elevation={0}
        >
          <div
            className={classes.columnHeader}
            style={{ borderTop: `4px solid ${green[600]}` }}
            onPointerDown={handleHeaderPointerDown}
          >
            <div className={classes.columnTitle}>
              <Avatar
                src={group.user.profileImage ? `${backendUrl}/public/company${user.companyId}/${group.user.profileImage}` : null}
                style={{ width: 30, height: 30, marginRight: 8 }}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.9rem' }}>{group.user.name}</span>
                <span style={{ fontSize: '0.75rem', color: grey[600], fontWeight: 400 }}>
                  {group.user.email}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {canBulkProcess && (
                <Tooltip title={`Processar tickets de ${group.user.name} em massa`}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBulkModal({
                        open: true,
                        filters: { status: "open", users: [group.user.id] },
                      });
                    }}
                    style={{ padding: 4, minWidth: 32, minHeight: 32 }}
                  >
                    <ListChecks size={16} />
                  </IconButton>
                </Tooltip>
              )}
              <Badge badgeContent={group.tickets.length} color="primary" max={99999} overlap="rectangular">
                <Box width={10} />
              </Badge>
            </div>
          </div>
          <div className={classes.ticketsList}>
            {group.tickets.map(renderTicket)}
          </div>
        </Paper>
      ))}

      {/* Modal de confirmação para assumir ticket */}
      <Dialog
        open={confirmModalOpen}
        onClose={handleCancelTransfer}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Assumir Atendimento</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Este ticket está sendo atendido por <strong>{selectedTicket?.user?.name || selectedTicket?.userId || 'outro usuário'}</strong>.
            <br /><br />
            Deseja assumir este atendimento? Ao confirmar, o ticket será transferido para você.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelTransfer} color="primary" disabled={isTransferring}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmTransfer} color="primary" variant="contained" disabled={isTransferring}>
            {isTransferring ? 'Transferindo...' : 'Sim, Assumir'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConversationPeekModal
        open={openTicketMessageDialog}
        onClose={() => setOpenTicketMessageDialog(false)}
        ticket={selectedTicketForView}
      />

      {/* Processar em massa — aberto pelo ícone na coluna do atendente,
          já filtrando os tickets "open" daquele usuário */}
      <BulkProcessTicketsModal
        open={bulkModal.open}
        onClose={() => setBulkModal({ open: false, filters: {} })}
        initialFilters={bulkModal.filters}
      />
    </motion.div>
  );
};

export default MomentsUser;
