import React, { useState, useMemo, useEffect, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Typography, Tooltip, Card, CardContent, IconButton, Menu, MenuItem, ListItemText } from "@material-ui/core";
import { Facebook, Instagram, WhatsApp, Close as CloseIcon, MoreVert as MoreVertIcon, AttachFile, EventAvailable } from "@material-ui/icons";
import ContactAvatar from "../../components/ContactAvatar";
import { i18n } from "../../translate/i18n";
import { format, parseISO } from "date-fns";
import { AuthContext } from "../../context/Auth/AuthContext";
import { grey, blue } from "@material-ui/core/colors";
import { Eye as VisibilityIcon } from "lucide-react";
import ConversationPeekModal from "../../components/ConversationPeekModal";
import { canViewTicketConversation } from "../../utils/ticketPreviewPermissions";

const useStyles = makeStyles(theme => ({
  ticketCard: {
    background: theme.palette.background.paper,
    borderRadius: 8,
    border: "1px solid rgba(0, 0, 0, 0.05) !important",
    boxShadow: "none !important",
    transition: "all 0.2s",
    marginBottom: 8,
    width: "calc(100% - 20px)",
    margin: "8px auto",
    boxSizing: "border-box",
    position: "relative",
    "&:hover": {
      borderColor: theme.palette.primary.main,
      transform: "translateY(-2px)",
    },
  },
  ticketContent: {
    padding: "8px !important",
  },
  ticketHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 0,
  },
  avatarContainer: {
    position: "relative",
    marginRight: theme.spacing(1),
  },
  connectionBadge: {
    position: "absolute",
    bottom: 0,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid #fff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
    zIndex: 2,
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
    color: theme.palette.text.secondary,
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
    minHeight: "auto",
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
  closeBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    padding: 4,
    zIndex: 10,
  },
  menuBtn: {
    position: 'absolute',
    top: 2,
    left: 2,
    padding: 4,
    zIndex: 10,
  },
  priorityDot: {
    position: 'absolute',
    top: 26,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 999,
    border: "1px solid #fff",
    zIndex: 5,
  },
  // Barra de progresso
  progressWrap: {
    marginTop: 4,
    marginBottom: theme.spacing(1),
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    background: theme.palette.action.hover,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  },
  // Contadores
  countersRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: theme.spacing(0.5),
    paddingTop: theme.spacing(0.5),
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
  counterItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: theme.palette.text.secondary,
    fontSize: '0.8rem',
  },
  // Usuário atribuído
  userRow: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginTop: theme.spacing(0.5),
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  userAvatar: {
    width: 18,
    height: 18,
    fontSize: 9,
  },
  tagContainer: {
    display: "flex",
    gap: 4,
    width: "100%",
    justifyContent: "center",
    marginTop: 4
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
  viewButton: {
    position: 'absolute',
    top: 26,
    right: -1,
    padding: 8,
    zIndex: 10,
    color: blue[700],
  },
}));

const getPriorityFromUnread = (unread) => {
  const u = Number(unread) || 0;
  if (u === 0) return { label: "Low", color: "#22c55e" };
  if (u > 5) return { label: "High", color: "#ef4444" };
  return { label: "Medium", color: "#f59e0b" };
};

export default function KanbanCard({ ticket, onClick, allTags = [], onMoveRequest }) {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [menuEl, setMenuEl] = useState(null);
  const [moveEl, setMoveEl] = useState(null);
  const [prioritySignal, setPrioritySignal] = useState(0);

  const [openTicketMessageDialog, setOpenTicketMessageDialog] = useState(false);
  const [selectedTicketForView, setSelectedTicketForView] = useState(null);

  useEffect(() => {
    const handler = () => setPrioritySignal(s => s + 1);
    window.addEventListener('kanban:priorityChanged', handler);
    return () => window.removeEventListener('kanban:priorityChanged', handler);
  }, []);

  const priorityKey = `kanbanPriorityOverrides`;
  const override = useMemo(() => {
    try {
      const raw = localStorage.getItem(priorityKey);
      const map = raw ? JSON.parse(raw) : {};
      return map[String(ticket?.id)];
    } catch (e) { return null; }
  }, [ticket?.id, prioritySignal]);

  const priority = useMemo(() => {
    if (override === 'High') return { label: 'High', color: '#ef4444' };
    if (override === 'Medium') return { label: 'Medium', color: '#f59e0b' };
    if (override === 'Low') return { label: 'Low', color: '#22c55e' };
    return getPriorityFromUnread(ticket?.unreadMessages);
  }, [override, ticket?.unreadMessages]);

  const channelBadge = useMemo(() => {
    let bg = ticket?.whatsapp?.color;

    if (!bg) {
      bg = ticket?.channel === 'facebook'
        ? '#3b5998'
        : ticket?.channel === 'instagram'
          ? '#e1306c'
          : '#25D366';
    }

    const Icon = ticket?.channel === 'facebook'
      ? Facebook
      : ticket?.channel === 'instagram'
        ? Instagram
        : WhatsApp;

    return { bg, Icon };
  }, [ticket?.channel, ticket?.whatsapp?.color]);


  const ChannelBadgeIcon = channelBadge.Icon;

  // Calcular progresso baseado em mensagens não lidas
  const progress = useMemo(() => {
    const u = Number(ticket?.unreadMessages) || 0;
    return Math.max(0, 100 - Math.min(u, 10) * 10);
  }, [ticket?.unreadMessages]);

  // Contadores
  const comments = Number(ticket?.unreadMessages) || 0;
  const attachments = Number(ticket?.mediaCount) || 0;
  const schedules = Number(ticket?.schedulesCount || ticket?.appointmentsCount || 0);

  // Iniciais do usuário atribuído
  const userInitials = ticket?.user?.name
    ? ticket.user.name.split(" ").map(p => p[0]).slice(0, 2).join("")
    : "?";

  const canPreviewConversation = useMemo(() => {
    return canViewTicketConversation({ ticket, user });
  }, [ticket, user]);

  // Handler para abrir o modal de mensagens
  const handleOpenMessageDialog = (e) => {
    e.stopPropagation();
    if (!canPreviewConversation) return;
    setSelectedTicketForView(ticket);
    setOpenTicketMessageDialog(true);
  };

  return (
    <Card variant="outlined" elevation={0} className={classes.ticketCard} onClick={onClick}>
      {/* Botões de Ação */}
      <Tooltip title="Opções">
        <IconButton className={classes.menuBtn} size="small" onClick={(e) => { e.stopPropagation(); setMenuEl(e.currentTarget); }}>
          <MoreVertIcon style={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      {/* Só o atendente pode fechar o ticket - ou se não tiver atendente (pendente) */}
      {(ticket.userId === user.id || !ticket.userId) && (
        <Tooltip title="Fechar Ticket">
          <IconButton className={classes.closeBtn} size="small" onClick={(e) => {
            e.stopPropagation();
            try { window.dispatchEvent(new CustomEvent('kanban:cardClose', { detail: { id: ticket?.id } })); } catch (err) { }
          }}>
            <CloseIcon style={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}

      {/* Indicador de Prioridade */}
      <Tooltip title={`Prioridade: ${priority.label}`}>
        <span className={classes.priorityDot} style={{ background: priority.color }} />
      </Tooltip>

      {/* Ícone de espiar conversa */}
      {canPreviewConversation && (
        <Tooltip title="Espiar Conversa">
          <IconButton 
            className={classes.viewButton} 
            size="small" 
            onClick={handleOpenMessageDialog}
          >
            <VisibilityIcon size={20} />
          </IconButton>
        </Tooltip>
      )}

      <div style={{ paddingTop: 20, cursor: 'pointer' }}>
        <CardContent className={classes.ticketContent}>
          {/* Header: Avatar + Nome + Ticket ID */}
          <div className={classes.ticketHeader}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div className={classes.avatarContainer}>
                <ContactAvatar
                  contact={ticket?.contact}
                  style={{ width: 40, height: 40 }}
                />
                <Tooltip title={ticket?.whatsapp?.name || i18n.t('kanban.connection')}>
                  <div className={classes.connectionBadge} style={{ background: "#25D366" }}>
                    <ChannelBadgeIcon style={{ fontSize: 12, color: '#fff' }} />
                  </div>
                </Tooltip>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Tooltip title={ticket?.contact?.name || "Contato"}>
                    <Typography className={classes.ticketName}>
                      {ticket?.contact?.name}
                    </Typography>
                  </Tooltip>
                  <Typography className={classes.ticketId}>
                    #{ticket?.id}
                  </Typography>
                </div>
                
                {/* Última Mensagem (subida para logo abaixo do ID) */}
                <Tooltip title={ticket?.lastMessage || "Sem mensagens"}>
                  <Typography className={classes.ticketMessage}>
                    {ticket?.lastMessage || "Sem mensagens"}
                  </Typography>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Barra de Progresso + Horário */}
          <div className={classes.progressWrap}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Typography style={{ fontSize: '0.75rem', color: grey[600] }}>Progresso</Typography>
              <Typography style={{ fontSize: '0.75rem', color: grey[600] }}>
                {format(parseISO(ticket.updatedAt), "HH:mm")}
              </Typography>
            </div>
            <div className={classes.progressTrack}>
              <div className={classes.progressBar} style={{ width: `${progress}%`, backgroundColor: priority.color || '#ff9800' }} />
            </div>
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

            <Tooltip title={`Fila: ${ticket?.queue?.name || "Sem Fila"}`}>
              <div
                className={`${classes.badge}`}
                style={{
                  backgroundColor: ticket?.queue?.color || "#e0e0e0",
                  color: ticket?.queue?.color ? "#fff" : "inherit",
                  textTransform: "uppercase"
                }}
              >
                {ticket?.queue?.name || "Sem Fila"}
              </div>
            </Tooltip>

            {ticket?.user?.name && (
              <Tooltip title={`Atendente: ${ticket.user.name}`}>
                <div
                  className={`${classes.badge}`}
                  style={{
                    backgroundColor: ticket.user.color || "#000",
                    color: "#fff",
                    textTransform: "uppercase"
                  }}
                >
                  {ticket.user.name}
                </div>
              </Tooltip>
            )}
          </div>

          {/* Contadores: Mensagens, Anexos, Agendamentos */}
          <div className={classes.countersRow}>
            {Number(ticket.unreadMessages) > 0 && (
              <div className={classes.unreadBadge} style={{ transform: 'scale(0.8)', margin: '-2px -4px 0 -4px' }}>
                {ticket.unreadMessages}
              </div>
            )}
            <Tooltip title={i18n.t('kanban.counters.attachments')}>
              <div className={classes.counterItem}>
                <AttachFile style={{ fontSize: 16 }} />
                <span>{attachments}</span>
              </div>
            </Tooltip>
            <Tooltip title={i18n.t('kanban.counters.subtasks')}>
              <div className={classes.counterItem}>
                <EventAvailable style={{ fontSize: 16 }} />
                <span>{schedules}</span>
              </div>
            </Tooltip>
          </div>
        </CardContent>
      </div>

      {/* Menus Flutuantes Restaurados */}
      <Menu anchorEl={menuEl} open={Boolean(menuEl)} onClose={() => setMenuEl(null)} onClick={(e) => e.stopPropagation()}>
        <MenuItem onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/tickets/${ticket?.uuid}`); } catch (e) { } setMenuEl(null); }}>
          <ListItemText primary={i18n.t('kanban.copyTicketLink')} />
        </MenuItem>
        <MenuItem onClick={(e) => { setMoveEl(e.currentTarget); }}>
          <ListItemText primary={i18n.t('kanban.moveToTag')} />
        </MenuItem>
        <MenuItem onClick={() => {
          try {
            const raw = localStorage.getItem(priorityKey);
            const map = raw ? JSON.parse(raw) : {};
            const order = ['Low', 'Medium', 'High'];
            const current = map[String(ticket?.id)] || null;
            const next = current ? order[(order.indexOf(current) + 1) % order.length] : 'High';
            map[String(ticket?.id)] = next;
            localStorage.setItem(priorityKey, JSON.stringify(map));
            setPrioritySignal(s => s + 1);
            try { window.dispatchEvent(new CustomEvent('kanban:priorityChanged')); } catch (_) { }
          } catch (e) { }
          setMenuEl(null);
        }}>
          <ListItemText primary={i18n.t('kanban.togglePriority')} />
        </MenuItem>
      </Menu>

      <Menu anchorEl={moveEl} open={Boolean(moveEl)} onClose={() => setMoveEl(null)} onClick={(e) => e.stopPropagation()}>
        {allTags && allTags.length ? allTags.map(t => (
          <MenuItem key={t.id} onClick={() => { setMoveEl(null); setMenuEl(null); onMoveRequest && onMoveRequest(String(t.id)); }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: t.color, display: 'inline-block', marginRight: 8 }} />
            <ListItemText primary={t.name} />
          </MenuItem>
        )) : (
          <MenuItem disabled>
            <ListItemText primary={i18n.t('kanban.noTagsAvailable')} />
          </MenuItem>
        )}
      </Menu>

      <ConversationPeekModal
        open={openTicketMessageDialog}
        onClose={() => setOpenTicketMessageDialog(false)}
        ticket={selectedTicketForView}
      />
    </Card>
  );
}
