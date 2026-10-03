import React, { useContext, useEffect, useRef, useState } from "react";

import { useParams, useHistory } from "react-router-dom";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  makeStyles,
  Paper,
  Tab,
  Tabs,
  TextField,
} from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";
import {
  MessageSquare as ChatIcon,
  Plus as AddIcon,
} from "lucide-react";

import ChatList from "./ChatList";
import ChatMessages from "./ChatMessages";
import { UsersFilter } from "../../components/UsersFilter";
import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import api from "../../services/api";
// import { SocketContext } from "../../context/Socket/SocketContext";

import { has, isObject } from "lodash";

import { AuthContext } from "../../context/Auth/AuthContext";
import withWidth, { isWidthUp } from "@material-ui/core/withWidth";
import { i18n } from "../../translate/i18n";

const isDirectChatSelection = (users, type) => type === "new" && Array.isArray(users) && users.length === 1;

// ===== Estilos no padrão do gerenciador de Conexões/Campanhas =====
// Página de chat interno: cabeçalho + corpo com lista lateral e área de mensagens
const useStyles = makeStyles((theme) => ({
  paper: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    padding: 0,
    overflow: "hidden",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    padding: theme.spacing(2, 2.5),
  },
  headerText: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: "0.85rem",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  chatBody: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    borderTop: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.color,
  },
  chatGrid: {
    height: "100%",
    flexWrap: "nowrap",
  },
  listPane: {
    height: "100%",
    overflow: "hidden",
    borderRight: `1px solid ${theme.palette.divider}`,
  },
  // O ChatList (componente compartilhado) reserva 58px para a antiga linha
  // do botão "Nova", que migrou para o cabeçalho — compensamos a altura aqui
  listPaneInner: {
    height: "calc(100% + 58px)",
  },
  messagesPane: {
    height: "100%",
  },
  mobileChat: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
  tabPanel: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1),
    height: "100%",
    padding: theme.spacing(4, 2),
    color: theme.palette.text.secondary,
    textAlign: "center",
  },
}));

export function ChatModal({
  open,
  chat,
  type,
  handleClose,
  handleLoadNewChat,
}) {
  const [users, setUsers] = useState([]);
  const [title, setTitle] = useState("");
  const isDirectSelection = isDirectChatSelection(users, type);
  const isEditingDirectChat = type === "edit" && chat?.type === "direct";

  useEffect(() => {
    setTitle("");
    setUsers([]);
    if (type === "edit") {
      const userList = chat.users.map((u) => ({
        id: u.user.id,
        name: u.user.name,
      }));
      setUsers(userList);
      setTitle(chat.title);
    }
  }, [chat, open, type]);

  const handleSave = async () => {
    try {
      if (type === "edit") {
        await api.put(`/chats/${chat.id}`, {
          users,
          title,
        });
      } else {
        const { data } = await api.post("/chats", {
          users,
          title,
        });
        handleLoadNewChat(data);
      }
      handleClose();
    } catch (err) {
      console.error("Erro ao salvar chat:", err);
      if (err.response?.data?.error) {
        alert(`Erro: ${err.response.data.error}`);
      } else {
        alert("Erro ao salvar chat. Verifique os dados e tente novamente.");
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{i18n.t("chatInternal.modal.title")}</DialogTitle>
      <DialogContent>
        <Grid spacing={2} container>
          {!isDirectSelection && !isEditingDirectChat && (
            <Grid xs={12} style={{ padding: 18 }} item>
            <TextField
              label="Título do grupo"
              placeholder="Título do grupo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              variant="outlined"
              size="small"
              fullWidth
            />
            </Grid>
          )}
          <Grid xs={12} item>
            <UsersFilter
              onFiltered={(users) => setUsers(users)}
              initialUsers={users}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          {i18n.t("chatInternal.modal.cancel")}
        </Button>
        <Button
          onClick={handleSave}
          color="primary"
          variant="contained"
          disabled={
            users === undefined ||
            users.length === 0 ||
            (!isDirectSelection && !isEditingDirectChat && (title === null || title === "" || title === undefined))
          }
        >
          {i18n.t("chatInternal.modal.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Chat(props) {
  const classes = useStyles();
  const theme = useTheme();
  const { user, socket } = useContext(AuthContext);
  const history = useHistory();

  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState("new");
  const [currentChat, setCurrentChat] = useState({});
  const [chats, setChats] = useState([]);
  const [chatsPageInfo, setChatsPageInfo] = useState({ hasMore: false });
  const [messages, setMessages] = useState([]);
  const [messagesPageInfo, setMessagesPageInfo] = useState({ hasMore: false });
  const [messagesPage, setMessagesPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const isMounted = useRef(true);
  const scrollToBottomRef = useRef();
  const { id } = useParams();

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isMounted.current) {
      findChats().then((data) => {
        const records = data?.records || [];
        if (records.length > 0) {
          setChats(records);
          setChatsPageInfo(data);

          if (id && records.length) {
            const chat = records.find((r) => r.uuid === id);
            if (chat) {
              selectChat(chat);
            }
          }
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isObject(currentChat) && has(currentChat, "id")) {
      findMessages(currentChat.id).then(() => {
        if (typeof scrollToBottomRef.current === "function") {
          setTimeout(() => {
            scrollToBottomRef.current();
          }, 300);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChat]);

  useEffect(() => {
    const companyId = user.companyId;

    const onChatUser = (data) => {
      if (data.action === "create") {
        setChats((prev) => {
          const chatIndex = prev.findIndex((chat) => chat.id === data.record.id);

          if (chatIndex !== -1) {
            const updatedChats = [...prev];
            updatedChats[chatIndex] = data.record;
            return updatedChats;
          }

          return [data.record, ...prev];
        });
      }

      if (data.action === "update") {
        setChats((prev) => prev.map((chat) => {
          if (chat.id === data.record.id) {
            return {
              ...data.record,
            };
          }

          return chat;
        }));

        setCurrentChat((prev) => {
          if (prev?.id === data.record.id) {
            return data.record;
          }

          return prev;
        });
      }
    };

    const onChat = (data) => {
      if (data.action === "delete") {
        setChats((prev) => prev.filter((c) => c.id !== +data.id));
        setMessages([]);
        setMessagesPage(1);
        setMessagesPageInfo({ hasMore: false });
        setCurrentChat({});
        history.push("/chats");
      }
    };

    const onCurrentChat = (data) => {
      if (data.action === "new-message") {
        setMessages((prev) => [...prev, data.newMessage]);

        setChats((prev) => prev.map((chat) => {
          if (chat.id === data.newMessage.chatId) {
            return {
              ...data.chat,
            };
          }

          return chat;
        }));

        setCurrentChat((prev) => {
          if (prev?.id === data.chat?.id) {
            return data.chat;
          }

          return prev;
        });

        if (typeof scrollToBottomRef.current === "function") {
          scrollToBottomRef.current();
        }
      }

      if (data.action === "update") {

        setChats((prev) => prev.map((chat) => {
          if (chat.id === data.chat.id) {
            return {
              ...data.chat,
            };
          }

          return chat;
        }));

        setCurrentChat((prev) => {
          if (prev?.id === data.chat?.id) {
            return data.chat;
          }

          return prev;
        });

        if (typeof scrollToBottomRef.current === "function") {
          scrollToBottomRef.current();
        }
      }
    };

    socket.on(`company-${companyId}-chat-user-${user.id}`, onChatUser);
    socket.on(`company-${companyId}-chat`, onChat);
    if (isObject(currentChat) && has(currentChat, "id")) {
      socket.on(`company-${companyId}-chat-${currentChat.id}`, onCurrentChat);
    }

    return () => {
      socket.off(`company-${companyId}-chat-user-${user.id}`, onChatUser);
      socket.off(`company-${companyId}-chat`, onChat);
      if (isObject(currentChat) && has(currentChat, "id")) {
        socket.off(`company-${companyId}-chat-${currentChat.id}`, onCurrentChat);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChat]);

  const selectChat = (chat) => {
    try {
      setMessages([]);
      setMessagesPage(1);
      setCurrentChat(chat);
      setTab(1);
    } catch (err) { }
  };

  const sendMessage = async (contentMessage) => {
    setLoading(true);
    try {
      await api.post(`/chats/${currentChat.id}/messages`, {
        message: contentMessage,
      });
    } catch (err) { }
    setLoading(false);
  };

  const deleteChat = async (chat) => {
    try {
      await api.delete(`/chats/${chat.id}`);
    } catch (err) { }
  };

  const findMessages = async (chatId) => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/chats/${chatId}/messages?pageNumber=${messagesPage}`
      );
      setMessagesPage((prev) => prev + 1);
      setMessagesPageInfo(data);
      setMessages((prev) => [...data.records, ...prev]);
    } catch (err) { }
    setLoading(false);
  };

  const loadMoreMessages = async () => {
    if (!loading) {
      findMessages(currentChat.id);
    }
  };

  const findChats = async () => {
    try {
      const { data } = await api.get("/chats");
      return data;
    } catch (err) {
      console.error("Erro ao carregar chats:", err);
      if (err.response?.status === 403) {
        console.error("Sem permissão para acessar chat interno");
      }
      return { records: [], count: 0, hasMore: false };
    }
  };

  // Estado vazio da área de mensagens (nenhuma conversa selecionada)
  const renderEmptyChat = () => (
    <div className={classes.emptyState}>
      <ChatIcon size={44} style={{ color: theme.palette.text.disabled }} />
      <div>Selecione uma conversa para começar.</div>
    </div>
  );

  const renderGrid = () => {
    return (
      <Grid className={classes.chatGrid} container>
        <Grid className={classes.listPane} md={3} item>
          <div className={classes.listPaneInner}>
            <ChatList
              chats={chats}
              pageInfo={chatsPageInfo}
              loading={loading}
              handleSelectChat={(chat) => selectChat(chat)}
              handleDeleteChat={(chat) => deleteChat(chat)}
              handleEditChat={() => {
                setDialogType("edit");
                setShowDialog(true);
              }}
            />
          </div>
        </Grid>
        <Grid className={classes.messagesPane} md={9} item>
          {isObject(currentChat) && has(currentChat, "id") ? (
            <ChatMessages
              chat={currentChat}
              scrollToBottomRef={scrollToBottomRef}
              pageInfo={messagesPageInfo}
              messages={messages}
              loading={loading}
              handleSendMessage={sendMessage}
              handleLoadMore={loadMoreMessages}
            />
          ) : (
            renderEmptyChat()
          )}
        </Grid>
      </Grid>
    );
  };

  const renderTab = () => {
    return (
      <div className={classes.mobileChat}>
        <Tabs
          value={tab}
          indicatorColor="primary"
          textColor="primary"
          onChange={(e, v) => setTab(v)}
          aria-label="disabled tabs example"
        >
          <Tab label="Chats" />
          <Tab label="Mensagens" />
        </Tabs>
        <div className={classes.tabPanel}>
          {tab === 0 && (
            <div className={classes.listPaneInner}>
              {/* Props idênticas à versão original mobile (sem handleEditChat) */}
              <ChatList
                chats={chats}
                pageInfo={chatsPageInfo}
                loading={loading}
                handleSelectChat={(chat) => selectChat(chat)}
                handleDeleteChat={(chat) => deleteChat(chat)}
              />
            </div>
          )}
          {tab === 1 && (
            isObject(currentChat) && has(currentChat, "id") ? (
              /* Sem a prop `chat` — mesma assinatura da versão original mobile */
              <ChatMessages
                scrollToBottomRef={scrollToBottomRef}
                pageInfo={messagesPageInfo}
                messages={messages}
                loading={loading}
                handleSendMessage={sendMessage}
                handleLoadMore={loadMoreMessages}
              />
            ) : (
              renderEmptyChat()
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <MainContainer>
      <ChatModal
        type={dialogType}
        open={showDialog}
        chat={currentChat}
        handleLoadNewChat={(data) => {
          setMessages([]);
          setMessagesPage(1);
          setCurrentChat(data);
          setTab(1);
          history.push(`/chats/${data.uuid}`);
        }}
        handleClose={() => setShowDialog(false)}
      />
      <Paper className={classes.paper} variant="outlined">
        {/* Cabeçalho no padrão de listagens: título + subtítulo + ação primária */}
        <div className={classes.header}>
          <div className={classes.headerText}>
            <Title>
              {i18n.t("mainDrawer.listItems.chats")} ({chats.length})
            </Title>
            <span className={classes.subtitle}>
              Conversas internas da equipe — crie grupos ou chats diretos com os usuários da empresa.
            </span>
          </div>
          <div className={classes.headerActions}>
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<AddIcon size={16} />}
              style={{ minHeight: 36 }}
              onClick={() => {
                setDialogType("new");
                setShowDialog(true);
              }}
            >
              {i18n.t("chatInternal.new")}
            </Button>
          </div>
        </div>

        {/* Corpo do chat: lista lateral + mensagens (grid no desktop, abas no mobile) */}
        <div className={classes.chatBody}>
          {isWidthUp("md", props.width) ? renderGrid() : renderTab()}
        </div>
      </Paper>
    </MainContainer>
  );
}

export default withWidth()(Chat);
