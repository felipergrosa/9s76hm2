import React, { useState, useMemo, useEffect, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Typography, Tooltip, Divider, Card, CardActionArea, CardContent, IconButton, Menu, MenuItem, ListItemText, Avatar } from "@material-ui/core";
import { Facebook, Instagram, WhatsApp, Close as CloseIcon, MoreVert as MoreVertIcon, ChatBubbleOutline, AttachFile, EventAvailable } from "@material-ui/icons";
import ContactAvatar from "../../components/ContactAvatar";
import { i18n } from "../../translate/i18n";
import { format, isSameDay, parseISO } from "date-fns";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles(theme => ({
  ticketCard: {
    background: theme.palette.background.paper,
    borderRadius: 8,
    boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
    border: "1px solid transparent",
    transition: "all 0.2s",
    marginBottom: 8,
    width: "100%",
    boxSizing: "border-box",
    position: "relative",
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
  avatarContainer: {
    position: "relative",
    marginRight: theme.spacing(1),
  },
  connectionBadge: {
    position: "absolute",
    bottom: -2,
    left: -2,
    width: 18,
    height: 18,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid #fff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
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
    fontSize: "0.85rem",
    color: theme.palette.text.secondary,
    display: "-webkit-box",
    "-webkit-line-clamp": 2,
    "-webkit-box-orient": "vertical",
    overflow: "hidden",
    marginBottom: theme.spacing(1),
    lineHeight: 1.3,
    minHeight: 36,
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
    top: 38,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: 999,
    border: "1px solid #fff",
    zIndex: 5,
  },
  // Barra de progresso
  progressWrap: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  progressTrack: {
    width: '100%',
    height: 6,
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
    gap: 16,
    marginTop: theme.spacing(1),
    paddingTop: theme.spacing(1),
    borderTop: `1px solid ${theme.palette.divider}`,
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
    gap: 8,
    marginTop: theme.spacing(1),
  },
  userAvatar: {
    width: 20,
    height: 20,
    fontSize: 10,
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
    const bg = ticket?.channel === 'facebook'
      ? '#3b5998'
      : ticket?.channel === 'instagram'
        ? '#e1306c'
        : '#25D366';

    const Icon = ticket?.channel === 'facebook'
      ? Facebook
      : ticket?.channel === 'instagram'
        ? Instagram
        : WhatsApp;

    return { bg, Icon };
  }, [ticket?.channel]);

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

  return (
    <Card className={classes.ticketCard} onClick={onClick}>
      {/* Botões de Ação */}
      <Tooltip title="Opções">
        <IconButton className={classes.menuBtn} size="small" onClick={(e) => { e.stopPropagation(); setMenuEl(e.currentTarget); }}>
          <MoreVertIcon style={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      
      {(user.profile === "admin" || ticket.userId === user.id) && (
        <Tooltip title="Fechar Ticket">
          <IconButton className={classes.closeBtn} size="small" onClick={(e) => { 
            e.stopPropagation(); 
            try { window.dispatchEvent(new CustomEvent('kanban:cardClose', { detail: { id: ticket?.id } })); } catch (err) {} 
          }}>
            <CloseIcon style={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}

      {/* Indicador de Prioridade */}
      <Tooltip title={`Prioridade: ${priority.label}`}>
        <span className={classes.priorityDot} style={{ background: priority.color }} />
      </Tooltip>

      <CardActionArea style={{ paddingTop: 20 }}>
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
                  <div className={classes.connectionBadge} style={{ background: channelBadge.bg }}>
                    <ChannelBadgeIcon style={{ fontSize: 12, color: '#fff' }} />
                  </div>
                </Tooltip>
              </div>
              <div>
                <Tooltip title={ticket?.contact?.name || "Contato"}>
                  <Typography className={classes.ticketName}>
                    {ticket?.contact?.name}
                  </Typography>
                </Tooltip>
                <Typography className={classes.ticketId}>
                  Ticket #{ticket?.id}
                </Typography>
              </div>
            </div>
          </div>

          {/* Última Mensagem (limitada a 2 linhas) */}
          <Tooltip title={ticket?.lastMessage || "Sem mensagens"}>
            <Typography className={classes.ticketMessage}>
              {ticket?.lastMessage || "Sem mensagens"}
            </Typography>
          </Tooltip>

          {/* Barra de Progresso */}
          <div className={classes.progressWrap}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="textSecondary">{i18n.t('kanban.progress')}</Typography>
              <Typography variant="caption" color="textSecondary">
                {isSameDay(parseISO(ticket?.updatedAt), new Date())
                  ? format(parseISO(ticket?.updatedAt), "HH:mm")
                  : format(parseISO(ticket?.updatedAt), "dd/MM/yyyy HH:mm")}
              </Typography>
            </div>
            <div className={classes.progressTrack}>
              <div className={classes.progressBar} style={{ width: `${progress}%`, background: priority.color }} />
            </div>
          </div>

          {/* Usuário Atribuído + Fila */}
          <div className={classes.userRow}>
            <Avatar className={classes.userAvatar}>{userInitials}</Avatar>
            <Typography variant="caption" color="textSecondary">
              {ticket?.user?.name || i18n.t('kanban.noAssignee')}
            </Typography>
            <div style={{ marginLeft: 'auto' }}>
              <div
                className={`${classes.badge} ${classes.queueTag}`}
                style={{
                  backgroundColor: ticket?.queue?.color || "#e0e0e0",
                  color: ticket?.queue?.color ? "#fff" : "inherit",
                }}
              >
                {ticket?.queue?.name || "Sem Fila"}
              </div>
            </div>
          </div>

          {/* Contadores: Mensagens, Anexos, Agendamentos */}
          <div className={classes.countersRow}>
            <Tooltip title={i18n.t('kanban.counters.comments')}>
              <div className={classes.counterItem}>
                <ChatBubbleOutline style={{ fontSize: 16 }} />
                <span>{comments}</span>
              </div>
            </Tooltip>
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
      </CardActionArea>

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
    </Card>
  );
}
