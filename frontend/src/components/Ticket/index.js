import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useParams, useHistory } from "react-router-dom";

import clsx from "clsx";

import { makeStyles, Paper, Hidden } from "@material-ui/core";
import whatsBackground from "../../assets/wa-background.png";
import whatsBackgroundDark from "../../assets/wa-background-dark.png";

import ContactDrawer from "../ContactDrawer";
import GroupInfoDrawer from "../GroupInfoDrawer";
import MessageInput from "../MessageInput";
import MessageSearchBar from "../MessageSearchBar";
import PinnedMessages from "../PinnedMessages";
import TicketHeader from "../TicketHeader";
import TicketInfo from "../TicketInfo";
import TicketActionButtons from "../TicketActionButtonsCustom";
import MessagesList from "../MessagesList";
import api from "../../services/api";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { ForwardMessageProvider } from "../../context/ForwarMessage/ForwardMessageContext";

import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TagsContainer } from "../TagsContainer";
import { isNil } from 'lodash';
import { EditMessageProvider } from "../../context/EditingMessage/EditingMessageContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import { OptimisticMessageProvider } from "../../context/OptimisticMessage/OptimisticMessageContext";
import ImportProgressBar from "../ImportProgressBar";

const drawerWidth = 320;

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    height: "100%",
    position: "relative",
    overflow: "hidden",
    width: '100%',
    maxWidth: '100vw',
  },

  overlayMask: {
    position: 'absolute',
    inset: 0,
    zIndex: 3,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    // mantém o mesmo fundo do chat para evitar "flash" branco
    backgroundColor: 'transparent',
    pointerEvents: 'none'
  },
  hiddenContent: {
    visibility: 'hidden'
  },

  mainWrapper: {
    flex: 1,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "transparent",
    backgroundColor: "transparent",
    backgroundImage: (theme) => (theme.mode === 'light' ? `url(${whatsBackground})` : `url(${whatsBackgroundDark})`),
    backgroundRepeat: "repeat",
    backgroundSize: "400px auto",
    backgroundPosition: "center top",
    boxShadow: "none",
    border: 0,
    borderRadius: 0,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeft: "0",
    marginRight: -drawerWidth,
    maxWidth: "100%",
    width: "100%",
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),

  },

  mainWrapperShift: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginRight: 0,
  },
}));

const Ticket = () => {
  const { ticketId } = useParams();
  const history = useHistory();
  const classes = useStyles();

  const { user, socket } = useContext(AuthContext);
  const { setTabOpen } = useContext(TicketsContext);


  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({});
  const [ticket, setTicket] = useState({});
  const [dragDropFiles, setDragDropFiles] = useState([]);
  // Ref estável para o UUID do ticket - evita re-execução do useEffect de socket
  const ticketUuidRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [hasExternalHeader, setHasExternalHeader] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        return !!window.__externalHeaderActive;
      }
    } catch (e) { }
    return false;
  });
  const { companyId } = user;
  const [importStatus, setImportStatus] = useState(null);


  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchTicket = async () => {
        try {

          if (!isNil(ticketId) && ticketId !== "undefined") {

            const { data } = await api.get("/tickets/u/" + ticketId);

            setContact(data.contact);
            // setWhatsapp(data.whatsapp);
            // setQueueId(data.queueId);
            setTicket(data);
            // Atualiza ref do UUID para uso estável nos handlers de socket
            if (data?.uuid) ticketUuidRef.current = data.uuid;
            
            // Marcar mensagens como lidas ao abrir o ticket
            if (data.id && data.unreadMessages > 0) {
              import("../../helpers/markTicketAsRead").then(({ markTicketAsRead }) => {
                markTicketAsRead(data.id);
              });
            }
            // Disponibiliza globalmente para header externo
            try { window.__lastTicket = data; window.__lastContact = data.contact; } catch { }
            // Notifica topo (HeaderTicketInfo) que o ticket foi carregado
            try {
              window.dispatchEvent(new CustomEvent('ticket-loaded', { detail: { ticket: data, contact: data.contact } }));
            } catch { }
            // Faz join imediato na sala do ticket pelo UUID
            try {
              const candidate = (data?.uuid || ticketId || "").toString().trim();
              if (candidate && candidate !== "undefined" && socket && typeof socket.joinRoom === "function") {
                console.log("[Ticket] JOIN imediato:", candidate);
                socket.joinRoom(candidate, (err) => {
                  if (err) console.error("[Ticket] joinRoom ERRO:", err);
                  else console.log("[Ticket] joinRoom OK:", candidate);
                });
              } else if (candidate && candidate !== "undefined" && socket && typeof socket.emit === "function") {
                socket.emit("joinChatBox", candidate, (err) => {
                  if (err) console.error("[Ticket] joinChatBox ERRO:", err);
                  else console.log("[Ticket] joinChatBox OK:", candidate);
                });
              }
            } catch (e) {
              console.error("[Ticket] EXCEÇÃO no join imediato:", e);
            }
            if (["pending", "open", "group"].includes(data.status)) {
              setTabOpen(data.status);
            }
            setLoading(false);
          }
        } catch (err) {
          history.push("/tickets");   // correção para evitar tela branca uuid não encontrado Feito por Altemir 16/08/2023
          setLoading(false);
          toastError(err);
        }
      };
      fetchTicket();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [ticketId, user, history, socket]);

  // Controla exibição do composer: só aparece quando as mensagens estiverem prontas/posicionadas
  useEffect(() => {
    setShowComposer(false);
    const onMessagesReady = () => setShowComposer(true);
    window.addEventListener('messages-ready', onMessagesReady);
    // Fallback: se por algum motivo o evento não vier, libera após 600ms
    const t = setTimeout(() => setShowComposer(true), 600);
    return () => {
      window.removeEventListener('messages-ready', onMessagesReady);
      clearTimeout(t);
    };
  }, [ticketId]);

  // Abre o drawer quando solicitado
  useEffect(() => {
    const onOpenContactDrawer = () => setDrawerOpen(true);
    window.addEventListener('open-contact-drawer', onOpenContactDrawer);
    return () => {
      window.removeEventListener('open-contact-drawer', onOpenContactDrawer);
    };
  }, []);

  // Fecha drawer automaticamente quando ticket de grupo está fechado
  useEffect(() => {
    if (ticket?.isGroup && ticket?.status === "closed" && drawerOpen) {
      setDrawerOpen(false);
    }
  }, [ticket?.isGroup, ticket?.status, drawerOpen]);

  // Escuta ativação do header externo (TicketsAdvanced) para evitar cabeçalho duplicado
  useEffect(() => {
    const handleExternalHeaderToggle = (e) => {
      try {
        if (e && typeof e.detail !== "undefined") {
          setHasExternalHeader(!!e.detail.active);
        }
      } catch { }
    };

    try {
      if (typeof window !== "undefined") {
        // Estado inicial, se já tiver sido sinalizado antes do mount
        setHasExternalHeader(!!window.__externalHeaderActive);
        window.addEventListener("external-header-toggle", handleExternalHeaderToggle);
      }
    } catch { }

    return () => {
      try {
        if (typeof window !== "undefined") {
          window.removeEventListener("external-header-toggle", handleExternalHeaderToggle);
        }
      } catch { }
    };
  }, []);

  useEffect(() => {
    // Guard: precisa de ticketId válido, socket e companyId
    if (!ticketId || ticketId === "undefined") return;
    if (!socket || typeof socket.on !== "function") return;
    if (!user?.companyId) return;

    // Função auxiliar para entrar na sala pelo UUID
    const doJoin = (room) => {
      if (!room || room === "undefined") return;
      if (typeof socket.joinRoom === "function") {
        socket.joinRoom(room, (err) => {
          if (err) console.error("[Ticket] joinRoom ERRO:", room, err);
          else console.log("[Ticket] joinRoom OK:", room);
        });
      } else if (typeof socket.emit === "function") {
        socket.emit("joinChatBox", room, (err) => {
          if (err) console.error("[Ticket] joinChatBox ERRO:", room, err);
          else console.log("[Ticket] joinChatBox OK:", room);
        });
      }
    };

    // Função auxiliar para sair da sala
    const doLeave = (room) => {
      if (!room || room === "undefined") return;
      if (typeof socket.leaveRoom === "function") {
        socket.leaveRoom(room);
      } else if (typeof socket.emit === "function") {
        socket.emit("joinChatBoxLeave", room);
      }
    };

    const onConnectTicket = () => {
      // Usa o UUID do ref (mais estável) ou o ticketId da URL
      const candidate = (ticketUuidRef.current || ticketId || "").toString().trim();
      console.log("[Ticket] onConnect - joinRoom:", candidate);
      doJoin(candidate);
    };

    // Usa refs para evitar stale closures nos handlers de eventos
    const ticketIdRef = { current: null };

    const onCompanyTicket = (data) => {
      setTicket((prev) => {
        // Compara pelo ID numérico do ticket
        if (data.action === "update" && data.ticket.id === (prev?.id || ticketIdRef.current)) {
          // Atualiza o ref do UUID se mudou
          if (data.ticket.uuid) ticketUuidRef.current = data.ticket.uuid;
          ticketIdRef.current = data.ticket.id;
          try {
            window.__lastTicket = data.ticket;
            window.dispatchEvent(new CustomEvent('ticket-loaded', { detail: { ticket: data.ticket, contact: data.ticket?.contact } }));
          } catch { }
          return data.ticket;
        }
        if (data.action === "delete" && data.ticketId === (prev?.id || ticketIdRef.current)) {
          history.push("/tickets");
        }
        return prev;
      });
    };

    const onCompanyContactTicket = (data) => {
      if (data.action === "update") {
        setContact((prevState) => {
          if (prevState.id === data.contact?.id) {
            const next = { ...prevState, ...data.contact };
            try {
              window.__lastContact = next;
              window.dispatchEvent(new CustomEvent('ticket-loaded', { detail: { ticket: window.__lastTicket, contact: next } }));
            } catch { }
            return next;
          }
          return prevState;
        });
      }
    };

    socket.on("connect", onConnectTicket);
    socket.on(`company-${companyId}-ticket`, onCompanyTicket);
    socket.on(`company-${companyId}-contact`, onCompanyContactTicket);

    // Se já estiver conectado, entra na sala imediatamente
    if (socket.connected) {
      onConnectTicket();
    }

    return () => {
      // Sai da sala ao desmontar ou trocar de ticket
      const candidate = (ticketUuidRef.current || ticketId || "").toString().trim();
      doLeave(candidate);
      socket.off("connect", onConnectTicket);
      socket.off(`company-${companyId}-ticket`, onCompanyTicket);
      socket.off(`company-${companyId}-contact`, onCompanyContactTicket);
    };
    // IMPORTANTE: NÃO incluir `ticket` nas dependências!
    // O ticket é atualizado via setTicket dentro do handler, não precisa re-montar o effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, socket, user?.companyId]);

  // Listener para progresso da importação de histórico
  useEffect(() => {
    if (!socket || typeof socket.on !== "function" || !ticket?.id) return;

    const eventName = `importHistory-${ticket.id}`;

    const onImportProgress = (data) => {
      if (data.action === "refresh") {
        setImportStatus(null);
        return;
      }
      if (data.action === "update" && data.status) {
        setImportStatus(data.status);
        // Auto-clear após COMPLETED
        if (data.status.state === "COMPLETED") {
          setTimeout(() => setImportStatus(null), 4000);
        }
      }
    };

    socket.on(eventName, onImportProgress);

    return () => {
      socket.off(eventName, onImportProgress);
    };
  }, [socket, ticket?.id]);

  const handleDrawerOpen = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const handleDrawerToggle = useCallback(() => {
    // Não permitir abrir drawer se ticket de grupo estiver fechado
    if (ticket?.isGroup && ticket?.status === "closed") {
      return;
    }
    setDrawerOpen(prev => !prev);
  }, [ticket?.isGroup, ticket?.status]);

  const renderMessagesList = () => {
    return (
      <>
        <MessagesList
          isGroup={ticket.isGroup}
          onDrop={setDragDropFiles}
          whatsappId={ticket.whatsappId}
          queueId={ticket.queueId}
          channel={ticket.channel}
        >
        </MessagesList>
        {showComposer && (
          <MessageInput
            ticketId={ticket.id}
            ticketStatus={ticket.status}
            ticketChannel={ticket.channel}
            droppedFiles={dragDropFiles}
            contactId={contact.id}
            contactData={contact}
            ticketData={ticket}
          />
        )}
      </>
    );
  };


  return (
    <div className={classes.root} id="drawer-container">
      <Paper
        elevation={0}
        square
        className={clsx(classes.mainWrapper, {
          [classes.mainWrapperShift]: drawerOpen,
        })}
        style={{ boxShadow: "none", border: 0 }}
      >
        {!hasExternalHeader && (
          <TicketHeader loading={loading}>
            {ticket.contact !== undefined && (
              <div id="TicketHeader" style={{ flex: 1, minWidth: 0 }}>
                <TicketInfo
                  contact={contact}
                  ticket={ticket}
                  onClick={handleDrawerToggle}
                />
              </div>
            )}
            <TicketActionButtons
              ticket={ticket}
              onSearchClick={() => setSearchOpen(prev => !prev)}
            />
          </TicketHeader>
        )}
        <MessageSearchBar
          ticketId={ticket.id}
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onNavigateToMessage={(msgId) => {
            const el = document.getElementById(`message-${msgId}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.style.backgroundColor = "#fef3cd";
              setTimeout(() => { el.style.backgroundColor = ""; }, 2000);
            }
          }}
        />
        <PinnedMessages
          ticketId={ticket.id}
          onNavigateToMessage={(msgId) => {
            const el = document.getElementById(`message-${msgId}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.style.backgroundColor = "#d9fdd3";
              setTimeout(() => { el.style.backgroundColor = ""; }, 2000);
            }
          }}
        />
        {importStatus && (
          <ImportProgressBar
            statusImport={importStatus}
          />
        )}
        <OptimisticMessageProvider>
          <ReplyMessageProvider>
            <ForwardMessageProvider>
              <EditMessageProvider>
                {renderMessagesList()}
              </EditMessageProvider>
            </ForwardMessageProvider>
          </ReplyMessageProvider>
        </OptimisticMessageProvider>
      </Paper>

      {ticket?.isGroup ? (
        <GroupInfoDrawer
          open={drawerOpen}
          handleDrawerClose={handleDrawerClose}
          contact={contact}
          ticket={ticket}
        />
      ) : (
        <ContactDrawer
          open={drawerOpen}
          handleDrawerClose={handleDrawerClose}
          contact={contact}
          loading={loading}
          ticket={ticket}
        />
      )}

    </div>
  );
};

export default Ticket;
