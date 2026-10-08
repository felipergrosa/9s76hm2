import React, { useContext, useEffect, useState, useCallback, useRef } from "react";
import {
  makeStyles,
  Modal,
  Backdrop,
  Fade,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Typography,
} from "@material-ui/core";
import DeleteIcon from "@material-ui/icons/Delete";
import CloseIcon from "@material-ui/icons/Close";
import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

const PAGE_LIMIT = 50;

const useStyles = makeStyles((theme) => ({
  modal: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  paper: {
    position: "relative",
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[5],
    padding: theme.spacing(2, 4, 3),
    borderRadius: "8px",
    overflow: "auto",
    maxHeight: "80vh",
    minWidth: 480,
    maxWidth: "90vw",
  },
  closeButton: {
    position: "absolute",
    top: theme.spacing(1),
    right: theme.spacing(1),
  },
  emptyState: {
    padding: theme.spacing(4, 2),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  loadingRow: {
    textAlign: "center",
    padding: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
}));

const ContactTagListModal = ({ open, onClose, tag }) => {
  const classes = useStyles();
  const { user, socket } = useContext(AuthContext);
  const [contacts, setContacts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const scrollRef = useRef(null);

  // Busca uma página de contatos da tag — lazy loading para não pesar
  // em tags com milhares de contatos
  const fetchPage = useCallback(
    async (pageNumber) => {
      if (!tag?.id || loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        const { data } = await api.get("/contacts", {
          params: {
            contactTag: JSON.stringify([tag.id]),
            pageNumber,
            limit: PAGE_LIMIT,
          },
        });
        const list = data?.contacts || [];
        setContacts((prev) =>
          pageNumber === 1 ? list : [...prev, ...list]
        );
        setHasMore(Boolean(data?.hasMore));
        setPage(pageNumber);
      } catch (err) {
        toastError(err);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [tag?.id]
  );

  // Carrega a primeira página ao abrir
  useEffect(() => {
    if (open && tag?.id) {
      setContacts([]);
      setPage(1);
      setHasMore(false);
      fetchPage(1);
    }
  }, [open, tag?.id, fetchPage]);

  // Atualiza a lista quando a tag muda via socket (ex.: contato removido em outra tela)
  useEffect(() => {
    if (!open || !tag?.id) return;

    const onCompanyTags = (data) => {
      if ((data.action === "update" || data.action === "create") && data.tag?.id === tag.id) {
        fetchPage(1);
      }
      if (data.action === "delete" && Number(data.tagId) === tag.id) {
        onClose();
      }
    };
    socket.on(`company${user.companyId}-tag`, onCompanyTags);

    return () => {
      socket.off(`company${user.companyId}-tag`, onCompanyTags);
    };
  }, [open, tag?.id, socket, user.companyId, fetchPage, onClose]);

  // Scroll infinito: ao chegar perto do fim, carrega a próxima página
  const handleScroll = (e) => {
    const el = e.currentTarget;
    if (!el || loading || !hasMore) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    if (nearBottom) {
      fetchPage(page + 1);
    }
  };

  const handleRemoveContactTag = async (contactId) => {
    try {
      await api.delete(`/tags-contacts/${tag.id}/${contactId}`);
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      toast.success("Contato removido da tag");
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Modal
      className={classes.modal}
      open={open}
      onClose={onClose}
      closeAfterTransition
      BackdropComponent={Backdrop}
      BackdropProps={{
        timeout: 500,
      }}
    >
      <Fade in={open}>
        <div className={classes.paper} ref={scrollRef} onScroll={handleScroll}>
          <IconButton className={classes.closeButton} onClick={onClose}>
            <CloseIcon />
          </IconButton>
          <h2 id="transition-modal-title">
            {tag?.name} - Contatos ({tag?.contactCount ?? contacts.length})
          </h2>
          {contacts.length === 0 && !loading ? (
            <div className={classes.emptyState}>
              <Typography variant="body2">Nenhum contato nesta tag.</Typography>
            </div>
          ) : (
            <TableContainer component={Paper}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Nome</TableCell>
                    <TableCell>Número</TableCell>
                    <TableCell>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>{contact.id}</TableCell>
                      <TableCell>{contact.name}</TableCell>
                      <TableCell>{contact.number}</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveContactTag(contact.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {loading && (
                <div className={classes.loadingRow}>Carregando contatos…</div>
              )}
            </TableContainer>
          )}
        </div>
      </Fade>
    </Modal>
  );
};

export default ContactTagListModal;
