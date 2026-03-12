import React, { useState, useRef, useEffect, useContext } from "react";
import { useTheme } from "@material-ui/core/styles";

import { useHistory } from "react-router-dom";
import { format } from "date-fns";
// import { SocketContext } from "../../context/Socket/SocketContext";

import useSound from "use-sound";

import Popover from "@material-ui/core/Popover";
import IconButton from "@material-ui/core/IconButton";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import { makeStyles } from "@material-ui/core/styles";
import Badge from "@material-ui/core/Badge";
import { Bell as ChatIcon } from "lucide-react";
import { Button, Tooltip } from "@material-ui/core";

import TicketListItem from "../TicketListItem";
import useTickets from "../../hooks/useTickets";
import alertSound from "../../assets/sound.mp3";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import useCompanySettings from "../../hooks/useSettings/companySettings";
import Favicon from "react-favicon";
import { getBackendUrl } from "../../config";
import defaultLogoFavicon from "../../assets/favicon.ico";
import ContactAvatar from "../ContactAvatar";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import api from "../../services/api";
import usePermissions from "../../hooks/usePermissions";
import ColorModeContext from "../../layout/themeContext";

const useStyles = makeStyles(theme => ({
  tabContainer: {
    overflowY: "auto",
    maxHeight: 350,
    ...theme.scrollbarStyles,
  },
  popoverPaper: {
    width: "100%",
    maxWidth: 350,
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
    [theme.breakpoints.down("sm")]: {
      maxWidth: 270,
    },
  },
  noShadow: {
    boxShadow: "none !important",
  },
}));

const NotificationsPopOver = ({ volume = 1 }) => {
  const classes = useStyles();
  const theme = useTheme();

  const history = useHistory();
  const { user, socket } = useContext(AuthContext);
  const { colorMode } = useContext(ColorModeContext);
  const { viewMode } = colorMode;
  const { profile, queues } = user;

  const ticketIdUrl = +history.location.pathname.split("/")[2];
  const ticketIdRef = useRef(ticketIdUrl);
  const anchorEl = useRef();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [releaseRequests, setReleaseRequests] = useState([]);
  const queueIds = queues.map((q) => q.id);
  const { get: getSetting } = useCompanySettings();
  const { setCurrentTicket, setTabOpen } = useContext(TicketsContext);

  const [showTicketWithoutQueue, setShowTicketWithoutQueue] = useState(false);
  const [showNotificationPending, setShowNotificationPending] = useState(false);
  const [showGroupNotification, setShowGroupNotification] = useState(false);

  const [, setDesktopNotifications] = useState([]);

  const soundTimeoutRef = useRef(null);
  const lastSoundTimeRef = useRef(0);

  const { hasPermission: checkPerm } = usePermissions();

  const { tickets } = useTickets({
    withUnreadMessages: "true",
    queueIds: JSON.stringify(queueIds),
    showAll: checkPerm("tickets.view-all") ? "true" : "false"
  });

  const [play] = useSound(alertSound, { volume });
  const soundAlertRef = useRef();

  const historyRef = useRef(history);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const setting = await getSetting(
          {
            "column": "showNotificationPending"
          }
        );

        if (setting && setting.showNotificationPending === true) {
          setShowNotificationPending(true);
        }

        if (checkPerm("tickets.view-all")) {
          setShowTicketWithoutQueue(true);
        }
        if (checkPerm("tickets.view-groups")) {
          setShowGroupNotification(true);
        }
      } catch (err) {
        // 403 = sem permissão settings.view, silencia
        if (err?.response?.status !== 403) {
          toastError(err);
        }
      }
    }

    fetchSettings();
  }, [setShowTicketWithoutQueue, setShowNotificationPending]);

  useEffect(() => {
    soundAlertRef.current = play;

    if (!("Notification" in window)) {
      console.log("This browser doesn't support notifications");
    } else {
      Notification.requestPermission();
    }
  }, [play]);

  useEffect(() => {
    const processNotifications = () => {
      setNotifications(tickets);
    }

    processNotifications();
  }, [tickets]);

  useEffect(() => {
    ticketIdRef.current = ticketIdUrl;
  }, [ticketIdUrl]);

  useEffect(() => {
    const companyId = user.companyId;
    if (!user.id || !socket) {
      return;
    }

    const onConnectNotificationsPopover = () => {
      socket.emit("joinNotification");
    }

    const onCompanyTicketNotificationsPopover = (data) => {
      if (data.action === "updateUnread" || data.action === "delete") {
        setNotifications(prevState => {
          const ticketIndex = prevState.findIndex(t => t.id === data.ticketId);
          if (ticketIndex !== -1) {
            prevState.splice(ticketIndex, 1);
            return [...prevState];
          }
          return prevState;
        });

        setDesktopNotifications(prevState => {
          const notfiticationIndex = prevState.findIndex(
            n => n.tag === String(data.ticketId)
          );
          if (notfiticationIndex !== -1) {
            prevState[notfiticationIndex].close();
            prevState.splice(notfiticationIndex, 1);
            return [...prevState];
          }
          return prevState;
        });
      }
    };

    const onCompanyAppMessageNotificationsPopover = (data) => {
      const message = data?.message;
      const ticket = data?.ticket;
      const hasUnreadSignal = ticket?.unreadMessages > 0 || message?.read === false;
      const isAssignedToCurrentUser = ticket?.userId === user?.id || !ticket?.userId;
      const isQueueAllowed =
        user?.queues?.some(queue => queue.id === ticket?.queueId) ||
        (!ticket?.queueId && showTicketWithoutQueue === true);
      const isStatusAllowed =
        !["pending", "lgpd", "nps", "group"].includes(ticket?.status) ||
        (ticket?.status === "pending" && showNotificationPending === true) ||
        (ticket?.status === "group" && ticket?.whatsapp?.groupAsTicket === "enabled" && showGroupNotification === true);

      if (
        data?.action === "create" &&
        message &&
        ticket &&
        !message.fromMe &&
        hasUnreadSignal &&
        isAssignedToCurrentUser &&
        isQueueAllowed &&
        isStatusAllowed
      ) {
        setNotifications(prevState => {
          const ticketIndex = prevState.findIndex(t => t.id === ticket.id);
          if (ticketIndex !== -1) {
            prevState[ticketIndex] = ticket;
            return [...prevState];
          }
          return [ticket, ...prevState];
        });

        const shouldNotNotificate =
          (message.ticketId === ticketIdRef.current &&
            document.visibilityState === "visible") ||
          (ticket.userId && ticket.userId !== user?.id) ||
          (ticket.isGroup && ticket?.whatsapp?.groupAsTicket === "disabled" && showGroupNotification === false);


        if (shouldNotNotificate === true) return;

        handleNotifications(data);
      }
    }

    const onCompanyContactReleaseRequest = (data) => {
      if (profile !== "admin") return;
      if (!data || !data.action) return;
      if (data.action === "create" && data.record) {
        setReleaseRequests(prev => {
          const exists = prev.some(r => r.id === data.record.id);
          if (exists) {
            return prev.map(r => r.id === data.record.id ? data.record : r);
          }
          return [data.record, ...prev];
        });
      }
      if (data.action === "resolve" && data.record?.id) {
        setReleaseRequests(prev => prev.filter(r => r.id !== data.record.id));
      }
    };

    // Registrar listeners
    socket.on("connect", onConnectNotificationsPopover);
    socket.on(`company-${companyId}-ticket`, onCompanyTicketNotificationsPopover);
    socket.on(`company-${companyId}-appMessage`, onCompanyAppMessageNotificationsPopover);
    socket.on(`company-${companyId}-contactReleaseRequest`, onCompanyContactReleaseRequest);

    // Emitir join ao montar (caso já esteja conectado)
    if (socket.connected) {
      socket.emit("joinNotification");
    }

    return () => {
      socket.off("connect", onConnectNotificationsPopover);
      socket.off(`company-${companyId}-ticket`, onCompanyTicketNotificationsPopover);
      socket.off(`company-${companyId}-appMessage`, onCompanyAppMessageNotificationsPopover);
      socket.off(`company-${companyId}-contactReleaseRequest`, onCompanyContactReleaseRequest);
      if (soundTimeoutRef.current) {
        clearTimeout(soundTimeoutRef.current);
      }
    };
  }, [user?.id, user?.companyId, profile, queues, showTicketWithoutQueue, socket, showNotificationPending, showGroupNotification]);

  useEffect(() => {
    const fetchReleaseRequests = async () => {
      try {
        if (profile !== "admin") return;
        const { data } = await api.get("/contact-release-requests");
        const records = Array.isArray(data?.records) ? data.records : [];
        setReleaseRequests(records);
      } catch (err) {
        // Não quebrar o popover por falha de permissão/configuração
      }
    };
    if (user?.id) {
      fetchReleaseRequests();
    }
  }, [user?.id, profile]);

  const handleResolveReleaseRequest = async (id) => {
    try {
      await api.post(`/contact-release-requests/${id}/resolve`);
      setReleaseRequests(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenContactFromRelease = (contactId) => {
    setIsOpen(false);
    history.push(`/contacts?openContactId=${contactId}`);
  };

  const handleNotifications = data => {
    const { message, ticket } = data;
    const contact = data?.contact || data?.ticket?.contact || {};

    // Debug: verificar se notificação está sendo chamada
    console.log('[Notifications] handleNotifications chamado', {
      ticketId: ticket.id,
      volume: volume,
      hasSound: !!soundAlertRef.current
    });

    try {
      if ("Notification" in window && Notification.permission === "granted") {
        const options = {
          body: `${message.body} - ${format(new Date(), "HH:mm")}`,
          icon: contact.urlPicture ? `${getBackendUrl()}${contact.urlPicture}` : null,
          tag: ticket.id,
          renotify: true,
        };
        const notification = new Notification(
          `${i18n.t("tickets.notification.message")} ${contact.name || "Contato"}`,
          options
        );

        notification.onclick = e => {
          e.preventDefault();
          window.focus();
          setTabOpen(ticket.status)
          historyRef.current.push(`/tickets/${ticket.uuid}`);
        };

        setDesktopNotifications(prevState => {
          const notfiticationIndex = prevState.findIndex(
            n => n.tag === notification.tag
          );
          if (notfiticationIndex !== -1) {
            prevState[notfiticationIndex] = notification;
            return [...prevState];
          }
          return [notification, ...prevState];
        });
      }
    } catch (error) {
      console.warn("[Notifications] Falha ao criar notificação desktop", error);
    }

    const now = Date.now();
    const timeSinceLastSound = now - lastSoundTimeRef.current;
    const MIN_SOUND_INTERVAL = 1000; // Mínimo 1 segundo entre sons

    // Debug: verificar condições do som
    console.log('[Notifications] Som - volume:', volume, 'timeSinceLastSound:', timeSinceLastSound);

    if (timeSinceLastSound < MIN_SOUND_INTERVAL) {
      if (soundTimeoutRef.current) {
        clearTimeout(soundTimeoutRef.current);
      }
      soundTimeoutRef.current = setTimeout(() => {
        console.log('[Notifications] Tocando som (delayed)');
        soundAlertRef.current?.();
        lastSoundTimeRef.current = Date.now();
      }, MIN_SOUND_INTERVAL - timeSinceLastSound);
    } else {
      console.log('[Notifications] Tocando som imediatamente');
      soundAlertRef.current?.();
      lastSoundTimeRef.current = now;
    }
  };

  const handleClick = () => {
    setIsOpen(prevState => !prevState);
  };

  const handleClickAway = () => {
    setIsOpen(false);
  };

  const NotificationTicket = ({ children }) => {
    return <div onClick={handleClickAway}>{children}</div>;
  };

  const browserNotification = () => {
    const numbers = "⓿➊➋➌➍➎➏➐➑➒➓⓫⓬⓭⓮⓯⓰⓱⓲⓳⓴";
    if (notifications.length > 0) {
      if (notifications.length < 21) {
        document.title = numbers.substring(notifications.length, notifications.length + 1) + " - " + (theme.appName || "...");
      } else {
        document.title = "(" + notifications.length + ")" + (theme.appName || "...");
      }
    } else {
      document.title = theme.appName || "...";
    }
    return (
      <>
        <Favicon
          animated={true}
          url={(theme?.appLogoFavicon) ? theme.appLogoFavicon : defaultLogoFavicon}
          alertCount={notifications.length}
          iconSize={195}
        />
      </>
    );
  };

  return (
    <>
      {browserNotification()}

      <Tooltip title={i18n.t("dashboard.buttons.notifications")} arrow>
        <IconButton
          onClick={handleClick}
          ref={anchorEl}
          aria-label="Open Notifications"
          color="inherit"
          style={{ padding: 8, color: viewMode === "modern" ? "var(--text)" : "white" }}
        >
          <Badge
            overlap="rectangular"
            badgeContent={notifications.length + (profile === "admin" ? releaseRequests.length : 0)}
            color="secondary"
          >
            <ChatIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        disableScrollLock
        open={isOpen}
        anchorEl={anchorEl.current}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        classes={{ paper: classes.popoverPaper }}
        onClose={handleClickAway}
      >
        <List dense className={classes.tabContainer}>
          {profile === "admin" && releaseRequests.length > 0 && (
            <>
              <ListItem>
                <ListItemText primary="Solicitações de liberação" />
              </ListItem>
              {releaseRequests.map(req => (
                <ListItem key={`release-${req.id}`} divider>
                  <ListItemText
                    primary={`Contato bloqueado: ${req?.contact?.name || req?.contactId}`}
                    secondary={`Solicitado por: ${req?.requester?.name || req?.requesterId}`}
                    onClick={() => handleOpenContactFromRelease(req.contactId)}
                    style={{ cursor: "pointer" }}
                  />
                  <ListItemSecondaryAction>
                    <Button
                      size="small"
                      color="primary"
                      onClick={() => handleResolveReleaseRequest(req.id)}
                    >
                      Resolver
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
              <ListItem>
                <ListItemText primary="Notificações de tickets" />
              </ListItem>
            </>
          )}
          {notifications.length === 0 ? (
            <ListItem>
              <ListItemText>{i18n.t("notifications.noTickets")}</ListItemText>
            </ListItem>
          ) : (
            notifications.map(ticket => (
              <NotificationTicket key={ticket.id}>
                <TicketListItem ticket={ticket} />
              </NotificationTicket>
            ))
          )}
        </List>
      </Popover>
    </>
  );
};

export default NotificationsPopOver;