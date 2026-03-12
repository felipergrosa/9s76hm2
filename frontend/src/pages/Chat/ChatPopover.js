import React, {
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { makeStyles } from "@material-ui/core/styles";
import toastError from "../../errors/toastError";
import Popover from "@material-ui/core/Popover";
import { MessageCircle as ForumIcon } from "lucide-react";
import {
  Badge,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography,
  Tooltip
} from "@material-ui/core";
import api from "../../services/api";
import { isArray } from "lodash";
// import { SocketContext } from "../../context/Socket/SocketContext";
import { useDate } from "../../hooks/useDate";
import { AuthContext } from "../../context/Auth/AuthContext";
import ColorModeContext from "../../layout/themeContext";

import notifySound from "../../assets/chat_notify.mp3";
import useSound from "use-sound";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    maxHeight: 300,
    maxWidth: 500,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_CHATS") {
    const chats = action.payload;
    let nextState = [...state];

    if (isArray(chats)) {
      chats.forEach((chat) => {
        const chatIndex = nextState.findIndex((u) => u.id === chat.id);
        if (chatIndex !== -1) {
          nextState[chatIndex] = chat;
        } else {
          nextState.push(chat);
        }
      });
    }

    return nextState;
  }

  if (action.type === "UPDATE_CHATS") {
    const chat = action.payload;
    const chatIndex = state.findIndex((u) => u.id === chat.id);

    if (chatIndex !== -1) {
      const nextState = [...state];
      nextState.splice(chatIndex, 1);
      return [chat, ...nextState];
    } else {
      return [chat, ...state];
    }
  }

  if (action.type === "DELETE_CHAT") {
    const chatId = action.payload;

    return state.filter((u) => u.id !== chatId);
  }

  if (action.type === "RESET") {
    return [];
  }

  if (action.type === "CHANGE_CHAT") {
    const changedChat = action.payload.chat;
    const chatIndex = state.findIndex((chat) => chat.id === changedChat.id);

    if (chatIndex === -1) {
      return [changedChat, ...state];
    }

    const nextState = [...state];
    nextState.splice(chatIndex, 1);
    return [changedChat, ...nextState];
  }
};

export default function ChatPopover() {
  const classes = useStyles();

  //   const socketManager = useContext(SocketContext);
  const { user, socket } = useContext(AuthContext);
  const { colorMode } = useContext(ColorModeContext);
  const { viewMode } = colorMode;


  const [loading, setLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchParam] = useState("");
  const [chats, dispatch] = useReducer(reducer, []);
  const [invisible, setInvisible] = useState(true);
  const { datetimeToClient } = useDate();
  const [play] = useSound(notifySound);
  const soundAlertRef = useRef();

  useEffect(() => {
    soundAlertRef.current = play;

    if (!("Notification" in window)) {
      console.log("This browser doesn't support notifications");
    } else {
      Notification.requestPermission();
    }
  }, [play]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchChats();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, pageNumber]);

  useEffect(() => {
    if (user.companyId) {

      const companyId = user.companyId;
      //    const socket = socketManager.GetSocket();

      const onCompanyChatPopover = (data) => {
        if (data.action === "new-message") {
          dispatch({ type: "CHANGE_CHAT", payload: data });
          if (data.newMessage.senderId !== user.id) {

            soundAlertRef.current();
          }
        }
        if (data.action === "update") {
          dispatch({ type: "CHANGE_CHAT", payload: data });
        }
      }

      socket.on(`company-${companyId}-chat`, onCompanyChatPopover);

      return () => {
        socket.off(`company-${companyId}-chat`, onCompanyChatPopover);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);


  useEffect(() => {
    let unreadsCount = 0;
    if (chats.length > 0) {
      for (let chat of chats) {
        for (let chatUser of chat.users) {
          if (chatUser.userId === user.id) {
            unreadsCount += chatUser.unreads;
          }
        }
      }
    }
    if (unreadsCount > 0) {
      setInvisible(false);
    } else {
      setInvisible(true);
    }
  }, [chats, user.id]);

  const fetchChats = async () => {
    try {
      const { data } = await api.get("/chats/", {
        params: { searchParam, pageNumber },
      });
      dispatch({ type: "LOAD_CHATS", payload: data.records });
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (err) {
      toastError(err);
    }
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
    setInvisible(true);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const goToMessages = (chat) => {
    window.location.href = `/chats/${chat.uuid}`;
  };

  const getChatDisplayName = (chat) => {
    if (chat.type === "direct") {
      const otherParticipant = Array.isArray(chat.users)
        ? chat.users.find((participant) => participant.userId !== user.id)
        : null;

      return otherParticipant?.user?.name || chat.title || "Conversa direta";
    }

    return chat.title || "Grupo sem título";
  };

  const open = Boolean(anchorEl);
  const id = open ? "simple-popover" : undefined;

  return (
    <div>
      <Tooltip title={i18n.t("dashboard.buttons.chat")} arrow>
        <IconButton
          aria-describedby={id}
          variant="contained"
          color={invisible ? "default" : "inherit"}
          onClick={handleClick}
          style={{ padding: 8, color: viewMode === "modern" ? "var(--text)" : "white" }}
        >
          <Badge color="secondary" variant="dot" invisible={invisible} overlap="rectangular">
            <ForumIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
      >
        <Paper
          variant="outlined"
          onScroll={handleScroll}
          className={classes.mainPaper}
        >
          <List
            component="nav"
            aria-label="main mailbox folders"
            style={{ minWidth: 300 }}
          >
            {isArray(chats) &&
              chats.map((item, key) => (
                <ListItem
                  key={key}
                  style={{
                    background: key % 2 === 0 ? "#ededed" : "white",
                    border: "1px solid #eee",
                    cursor: "pointer",
                  }}
                  onClick={() => goToMessages(item)}
                  button
                >
                  <ListItemText
                    primary={getChatDisplayName(item)}
                    secondary={
                      <>
                        <Typography component="span" style={{ fontSize: 12 }}>
                          {datetimeToClient(item.updatedAt)}
                        </Typography>
                        <span style={{ marginTop: 5, display: "block" }}>{item.lastMessage}</span>
                      </>
                    }
                  />
                </ListItem>
              ))}
            {isArray(chats) && chats.length === 0 && (
              <ListItemText primary={i18n.t("mainDrawer.appBar.notRegister")} />
            )}
          </List>
        </Paper>
      </Popover>
    </div>
  );
}
