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

  useEffect(() => {
    console.log("======== Ticket ===========")
    console.log(ticket)
    console.log("===========================")
  }, [ticket])

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
            // Disponibiliza globalmente para header externo
            try { window.__lastTicket = data; window.__lastContact = data.contact; } catch { }
            // Notifica topo (HeaderTicketInfo) que o ticket foi carregado
            try {
              window.dispatchEvent(new CustomEvent('ticket-loaded', { detail: { ticket: data, contact: data.contact } }));
            } catch { }
            // Faz join imediato na sala do ticket pelo UUID (se o socket já estiver pronto)
            try {
              const candidate = (data?.uuid || ticketId || "").toString().trim();
              console.log("=== [Ticket] JOIN IMEDIATO ===");
              console.log("[Ticket] UUID do ticket:", data?.uuid);
              console.log("[Ticket] ticketId da URL:", ticketId);
              console.log("[Ticket] Candidate (room):", candidate);
              console.log("[Ticket] Socket existe?", !!socket);
              console.log("[Ticket] Socket.joinRoom existe?", socket && typeof socket.joinRoom === "function");
              console.log("[Ticket] Socket conectado?", socket?.connected);
              
              if (candidate && candidate !== "undefined" && socket && typeof socket.joinRoom === "function") {
                console.log("[Ticket] Chamando socket.joinRoom para:", candidate);
                // Usa joinRoom que tem buffer automático para quando desconectado
                socket.joinRoom(candidate, (err) => {
                  if (err) {
                    console.error("[Ticket] ❌ ERRO no immediate joinRoom:", err);
                  } else {
                    console.log("[Ticket] ✓ immediate joinRoom OK para sala:", candidate);
                  }
                });
              } else if (candidate && candidate !== "undefined" && socket && typeof socket.emit === "function") {
                console.warn("[Ticket] joinRoom não disponível, usando emit direto");
                // Fallback para emit direto se joinRoom não existir
                socket.emit("joinChatBox", candidate, (err) => {
                  if (err) {
                    console.error("[Ticket] ❌ ERRO no immediate joinChatBox:", err);
                  } else {
                    console.log("[Ticket] ✓ immediate joinChatBox OK para sala:", candidate);
                  }
                });
              } else {
                console.error("[Ticket] ⚠️ PULOU join imediato - socket não pronto ou ID inválido", { 
                  uuid: data?.uuid, 
                  ticketId, 
                  hasSocket: !!socket,
                  hasJoinRoom: socket && typeof socket.joinRoom === "function",
                  connected: socket?.connected
                });
              }
            } catch (e) {
              console.error("[Ticket] ❌ EXCEÇÃO no join imediato:", e);
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
    if (!ticket && !ticket.id && ticket.uuid !== ticketId && ticketId === "undefined") {
      return;
    }

    // Aguarda socket e companyId disponíveis
    if (!socket || typeof socket.on !== "function") {
      return;
    }
    if (user.companyId) {
      const onConnectTicket = () => {
        try {
          console.log("=== [Ticket] onConnectTicket DISPARADO ===");
          // Usa imediatamente o UUID presente na URL como fallback, para evitar janela sem sala
          const candidate = (ticket?.uuid || ticketId || "").toString().trim();
          console.log("[Ticket] onConnectTicket - UUID do ticket:", ticket?.uuid);
          console.log("[Ticket] onConnectTicket - ticketId da URL:", ticketId);
          console.log("[Ticket] onConnectTicket - Candidate (room):", candidate);
          
          if (!candidate || candidate === "undefined") {
            console.error("[Ticket] ⚠️ onConnectTicket - PULOU join por ID inválido", { uuid: ticket?.uuid, ticketId });
            return;
          }
          
          console.log("[Ticket] onConnectTicket - Socket existe?", !!socket);
          console.log("[Ticket] onConnectTicket - Socket.joinRoom existe?", socket && typeof socket.joinRoom === "function");
          
          // Usa joinRoom que tem buffer automático
          if (socket && typeof socket.joinRoom === "function") {
            console.log("[Ticket] onConnectTicket - Chamando socket.joinRoom para:", candidate);
            socket.joinRoom(candidate, (err) => {
              if (err) {
                console.error("[Ticket] ❌ onConnectTicket - ERRO joinRoom:", err);
              } else {
                console.log("[Ticket] ✓ onConnectTicket - joinRoom OK para sala:", candidate);
              }
            });
          } else if (socket && typeof socket.emit === "function") {
            console.warn("[Ticket] onConnectTicket - joinRoom não disponível, usando emit direto");
            // Fallback
            socket.emit("joinChatBox", candidate, (err) => {
              if (err) {
                console.error("[Ticket] ❌ onConnectTicket - ERRO joinChatBox:", err);
              } else {
                console.log("[Ticket] ✓ onConnectTicket - joinChatBox OK para sala:", candidate);
              }
            });
          }
        } catch (e) {
          console.error("[Ticket] ❌ onConnectTicket - EXCEÇÃO:", e);
        }
      }

      const onCompanyTicket = (data) => {
        if (data.action === "update" && data.ticket.id === ticket?.id) {
          setTicket(data.ticket);
          // Notifica topo sobre atualização do ticket
          try {
            window.__lastTicket = data.ticket; window.__lastContact = contact;
            window.dispatchEvent(new CustomEvent('ticket-loaded', { detail: { ticket: data.ticket, contact } }));
          } catch { }
        }

        if (data.action === "delete" && data.ticketId === ticket?.id) {
          history.push("/tickets");
        }
      };

      const onCompanyContactTicket = (data) => {
        if (data.action === "update") {
          // if (isMounted) {
          setContact((prevState) => {
            let next = prevState;
            if (prevState.id === data.contact?.id) {
              next = { ...prevState, ...data.contact };
            }
            try {
              window.__lastTicket = ticket; window.__lastContact = next;
              window.dispatchEvent(new CustomEvent('ticket-loaded', { detail: { ticket, contact: next } }));
            } catch { }
            return next;
          });
          // }
        }
      };

      socket.on("connect", onConnectTicket)
      socket.on(`company-${companyId}-ticket`, onCompanyTicket);
      socket.on(`company-${companyId}-contact`, onCompanyContactTicket);

      // Se já estiver conectado, entra na sala imediatamente
      try {
        console.log("[Ticket] Verificando se socket já está conectado...");
        console.log("[Ticket] Socket conectado?", socket?.connected);
        if (socket && socket.connected) {
          console.log("[Ticket] ✓ Socket JÁ CONECTADO, chamando onConnectTicket imediatamente");
          onConnectTicket();
        } else {
          console.warn("[Ticket] ⚠️ Socket NÃO conectado, aguardando evento 'connect'");
        }
      } catch (e) {
        console.error("[Ticket] ❌ Erro ao verificar conexão do socket:", e);
      }

      return () => {
        try {
          const candidate = (ticket?.uuid || ticketId || "").toString().trim();
          if (!candidate || candidate === "undefined") {
            console.debug("[Ticket] skip joinRoomLeave - invalid id", { uuid: ticket?.uuid, ticketId });
          } else if (socket && typeof socket.leaveRoom === "function") {
            socket.leaveRoom(candidate, (err) => {
              if (err) console.debug("[Ticket] leaveRoom ack error", err);
              else console.debug("[Ticket] leaveRoom ok", { room: candidate });
            });
          } else if (socket && typeof socket.emit === "function") {
            socket.emit("joinChatBoxLeave", candidate, (err) => {
              if (err) console.debug("[Ticket] joinChatBoxLeave ack error", err);
              else console.debug("[Ticket] joinChatBoxLeave ok", { room: candidate });
            });
          }
        } catch { }
        socket.off("connect", onConnectTicket);
        socket.off(`company-${companyId}-ticket`, onCompanyTicket);
        socket.off(`company-${companyId}-contact`, onCompanyContactTicket);
      };
    }
  }, [ticketId, ticket, history, socket, user?.companyId]);

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
