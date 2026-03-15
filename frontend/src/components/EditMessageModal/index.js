import React, { useEffect, useState, useRef } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  InputBase
} from "@material-ui/core";
import CloseIcon from '@material-ui/icons/Close';
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import whatsBackground from "../../assets/wa-background.png";
import { makeStyles } from "@material-ui/core";
import MarkdownWrapper from "../MarkdownWrapper";
import MoodIcon from "@material-ui/icons/Mood";
import api from "../../services/api";
import whatsBackgroundDark from "../../assets/wa-background-dark.png"
import WhatsAppPopover from "../WhatsAppPopover";

const useStyles = makeStyles((theme) => ({
  messagesList: {
    backgroundSize: "370px",
    backgroundImage: theme.mode === 'light' ? `url(${whatsBackground})` : `url(${whatsBackgroundDark})`, //DARK MODE PLW DESIGN//
    display: "flex",
    display: "flex",
    justifyContent: "center",
    flexGrow: 1,
    padding: "20px 20px 20px 20px",
    overflowY: "scroll",
    "@media (max-width: 600px)": {
      paddingBottom: "90px"
    },
    ...theme.scrollbarStyles,
    minHeight: "150px",
    minWidth: "500px"
  },
  textContentItem: {
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },
  messageRight: {
    fontSize: "13px",
    marginLeft: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 510,
    height: "auto",
    display: "block",
    position: "relative",
    whiteSpace: "pre-wrap",
    alignSelf: "flex-end",
    borderRadius: 8,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0
  },
  inputmsg: {
    backgroundColor: theme.mode === 'light' ? '#FFF' : '#1c1c1c',
    display: "flex",
    width: "100%",
    margin: "10px 0px 10px 20px",
    borderRadius: "10px"
  },
  timestamp: {
    fontSize: 11,
    position: "absolute",
    bottom: 0,
    right: 5,
    color: "#999"
  },
  titleBackground: {
    color: '#ffff',
    backgroundColor: "#00796b", // Cor de fundo desejada
    marginLeft: '3px'
  },
}));

const EditMessageModal = ({ open, onClose, onSave, message }) => {
  const classes = useStyles();
  const [editedMessage, setEditedMessage] = useState(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (open) {
      setEditedMessage(message?.body);
    }
  }, [open, message]);

  const handleSave = async (editedMessage) => {
    if (editedMessage) {
      try {
        const messages = {
          read: 1,
          fromMe: true,
          mediaUrl: "",
          body: editedMessage,
          quotedMsg: null,
        };
        await api.post(`/messages/edit/${message.id}`, messages);
        onClose(false);
      } catch (err) {
        console.error("Erro ao editar mensagem:", err);
        // Mostrar erro para o usuário se o toastError estiver disponível
        if (err.response?.data?.message) {
          alert(err.response.data.message);
        } else {
          alert("Erro ao editar mensagem. Tente novamente.");
        }
      }
    }
  };

  const handleEmojiSelect = (emoji) => {
    setEditedMessage((prev) => (prev || "") + emoji);
  };

  return (
    <Dialog
      open={open}
      onClose={() => onClose(false)}
      aria-labelledby="edit-message-dialog"
      PaperProps={{
        style: {
          zIndex: 1 // Defina um valor alto de zIndex para garantir que o modal sobreponha outros elementos
        },
      }}
      ref={modalRef}
    >
      <DialogTitle id="edit-message-dialog" className={classes.titleBackground}>
        <IconButton edge="start" color="inherit" onClick={() => onClose(false)} aria-label="close">
          <CloseIcon />
        </IconButton>
        Editar Mensagem
      </DialogTitle>
      <DialogContent style={{ padding: "0px" }}>
        <Box>
          <Box className={classes.messagesList} >
            <Box
              component="div"
              className={`${classes.messageRight}`}
              style={{
                fontStyle: "italic",
                backgroundColor: "#d9fdd3"
              }}
            >
              <Box className={classes.textContentItem}>
                <Box component="div" style={{ color: "#212B36" }}>
                  <MarkdownWrapper>{message?.body}</MarkdownWrapper>
                </Box>
                {/* <span className={classes.timestamp}>
                  {format(parseISO(message?.updatedAt), "HH:mm")}
                </span> */}
              </Box>
            </Box>
          </Box>
          <Paper
            component="form"
            style={{
              p: "2px 4px",
              display: "flex",
              alignItems: "center",
              borderRadius: "0px",
              backgroundColor: "#f0f2f5"
            }}
          >
            <Box
              className={`${classes.inputmsg}`}
            >
              <InputBase
                style={{ padding: "15px 0px 15px 15px", flex: 1 }}
                multiline
                maxRows={6}
                placeholder="Editar mensagem..."
                value={editedMessage || ""}
                onChange={(e) => setEditedMessage(e.target.value)}
                inputProps={{ "aria-label": "editar mensagem" }}
              />
              <WhatsAppPopover
                onSelectEmoji={handleEmojiSelect}
                disabled={false}
              />
            </Box>
            <IconButton color="primary" aria-label="directions" onClick={() => handleSave(editedMessage)}>
              <CheckCircleIcon
                style={{
                  width: "35px",
                  height: "35px",
                  color: '#00A884'
                }}
              />
            </IconButton>
          </Paper>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default EditMessageModal;