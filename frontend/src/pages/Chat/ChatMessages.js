import React, { useContext, useEffect, useRef, useState } from "react";
import {
  Box,
  FormControl,
  IconButton,
  Input,
  InputAdornment,
  makeStyles,
  Paper,
  Typography,
  Avatar,
} from "@material-ui/core";
import SendIcon from "@material-ui/icons/Send";
import AvatarFallback from "../../components/AvatarFallback";

import { AuthContext } from "../../context/Auth/AuthContext";
import { useDate } from "../../hooks/useDate";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    overflow: "hidden",
    borderRadius: 0,
    height: "100%",
    borderLeft: "1px solid rgba(0, 0, 0, 0.12)",
  },
  messageList: {
    position: "relative",
    overflowY: "auto",
    height: "100%",
    ...theme.scrollbarStyles,
    backgroundColor: theme.mode === 'light' ? "#f2f2f2" : "#7f7f7f",
  },
  inputArea: {
    position: "relative",
    height: "auto",
  },
  input: {
    padding: "10px",
  },
  buttonSend: {
    margin: theme.spacing(1),
  },
  messageCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    padding: "10px 10px 6px",
    margin: "6px",
    position: "relative",
    maxWidth: 420,
    borderRadius: 12,
    border: "1px solid rgba(0, 0, 0, 0.12)",
    backgroundColor: "#ffffff",
    color: "#303030",
  },
  messageCardOwn: {
    marginLeft: "auto",
    backgroundColor: "#dcf8c6",
    textAlign: "right",
  },
  messageHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  messageBody: {
    flex: 1,
  },
  senderName: {
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  avatar: {
    width: 28,
    height: 28,
  },
}));

export default function ChatMessages({
  chat,
  messages,
  handleSendMessage,
  handleLoadMore,
  scrollToBottomRef,
  pageInfo,
  loading,
}) {
  const classes = useStyles();
  const { user, socket } = useContext(AuthContext);
  const { datetimeToClient } = useDate();
  const baseRef = useRef();

  const [contentMessage, setContentMessage] = useState("");

  const scrollToBottom = () => {
    if (baseRef.current) {
      baseRef.current.scrollIntoView({});
    }
  };

  const unreadMessages = (chat) => {
    if (chat !== undefined) {
      const currentUser = chat.users.find((u) => u.userId === user.id);
      return (currentUser?.unreads || 0) > 0;
    }
    return 0;
  };

  useEffect(() => {
    if (unreadMessages(chat) > 0) {
      try {
        api.post(`/chats/${chat.id}/read`);
      } catch (err) {}
    }
    scrollToBottomRef.current = scrollToBottom;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = (e) => {
    const { scrollTop } = e.currentTarget;
    if (!pageInfo.hasMore || loading) return;
    if (scrollTop < 600) {
      handleLoadMore();
    }
  };

  return (
    <Paper className={classes.mainContainer}>
      <div onScroll={handleScroll} className={classes.messageList}>
        {Array.isArray(messages) &&
          messages.map((item, key) => {
            const isOwn = item.senderId === user.id;
            const senderCompanyId = item.sender?.companyId || user.companyId;
            const avatarSrc = item.sender?.profileImage
              ? `${process.env.REACT_APP_BACKEND_URL}/public/company${senderCompanyId}/${item.sender.profileImage}`
              : null;

            return (
              <Box
                key={key}
                className={`${classes.messageCard} ${isOwn ? classes.messageCardOwn : ""}`}
                style={{ alignSelf: isOwn ? "flex-end" : "flex-start" }}
              >
                <AvatarFallback
                  src={avatarSrc}
                  name={item.sender?.name}
                  style={{ width: 32, height: 32 }}
                />

                <div className={classes.messageBody}>
                  <div className={classes.messageHeader} style={{ justifyContent: isOwn ? "flex-end" : "flex-start" }}>
                    {!isOwn && (
                      <Typography variant="subtitle2" className={classes.senderName}>
                        {item.sender?.name}
                      </Typography>
                    )}
                    {isOwn && (
                      <Typography variant="subtitle2" className={classes.senderName} style={{ marginLeft: "auto" }}>
                        {item.sender?.name}
                      </Typography>
                    )}
                  </div>
                  <Typography variant="body2" component="div" style={{ whiteSpace: "pre-wrap" }}>
                    {item.message}
                  </Typography>
                  <Typography variant="caption" display="block" style={{ marginTop: 4 }}>
                    {datetimeToClient(item.createdAt)}
                  </Typography>
                </div>
              </Box>
            );
          })}
        <div ref={baseRef}></div>
      </div>
      <div className={classes.inputArea}>
        <FormControl variant="outlined" fullWidth>
          <Input
            multiline
            value={contentMessage}
            onKeyUp={(e) => {
              if (e.key === "Enter" && contentMessage.trim() !== "") {
                handleSendMessage(contentMessage);
                setContentMessage("");
              }
            }}
            onChange={(e) => setContentMessage(e.target.value)}
            className={classes.input}
            endAdornment={
              <InputAdornment position="end">
                <IconButton
                  onClick={() => {
                    if (contentMessage.trim() !== "") {
                      handleSendMessage(contentMessage);
                      setContentMessage("");
                    }
                  }}
                  className={classes.buttonSend}
                >
                  <SendIcon />
                </IconButton>
              </InputAdornment>
            }
          />
        </FormControl>
      </div>
    </Paper>
  );
}
