import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemSecondaryAction,
  Checkbox,
  Avatar,
  Typography,
  Box,
  CircularProgress,
  Chip,
  IconButton
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import {
  Search,
  Person,
  CheckCircle,
  Phone,
  LocationOn,
  Business,
  Clear
} from "@material-ui/icons";
import { toast } from "react-toastify";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  searchField: {
    marginBottom: theme.spacing(2),
  },
  contactList: {
    maxHeight: 400,
    overflow: "auto",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
  contactItem: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    "&:last-child": {
      borderBottom: "none",
    },
  },
  contactAvatar: {
    width: theme.spacing(5),
    height: theme.spacing(5),
    marginRight: theme.spacing(2),
  },
  contactInfo: {
    flex: 1,
    minWidth: 0,
  },
  contactName: {
    fontWeight: 500,
    fontSize: "0.95rem",
  },
  contactDetails: {
    fontSize: "0.8rem",
    color: theme.palette.text.secondary,
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  selectedCount: {
    padding: theme.spacing(1, 2),
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.primary.contrastText,
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: 200,
  },
  emptyState: {
    textAlign: "center",
    padding: theme.spacing(4),
    color: theme.palette.text.secondary,
  },
  tagChip: {
    height: 16,
    fontSize: "0.7rem",
    marginRight: theme.spacing(0.5),
  },
  clearButton: {
    padding: theme.spacing(0.5),
  }
}));

const AddManualContactsModal = ({ open, onClose, contactListId, onSuccess }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);

  const fetchContacts = useCallback(async (search = "", page = 1, reset = true) => {
    if (page === 1) setLoading(true);
    
    try {
      const { data } = await api.get("/contacts", {
        params: {
          searchParam: search,
          pageNumber: page,
          limit: 20,
          isWhatsappValid: true, // Apenas contatos com WhatsApp válido
        },
      });

      if (reset) {
        setContacts(data.contacts || []);
      } else {
        setContacts(prev => [...prev, ...(data.contacts || [])]);
      }
      
      setHasMore(data.hasMore || false);
    } catch (err) {
      console.error("Erro ao buscar contatos:", err);
      toast.error("Erro ao carregar contatos");
    } finally {
      setLoading(false);
    }
  }, []);

  // Filtrar contatos que já estão na lista atual
  const filterExistingContacts = useCallback(async (contactsToFilter) => {
    if (!contactListId || contactsToFilter.length === 0) return contactsToFilter;

    try {
      const { data } = await api.get(`/contact-list-items`, {
        params: {
          contactListId,
          limit: 1000, // Buscar todos os itens da lista para comparação
        },
      });

      const existingNumbers = new Set(
        (data.contacts || []).map(item => item.number)
      );

      return contactsToFilter.filter(contact => !existingNumbers.has(contact.number));
    } catch (err) {
      console.error("Erro ao verificar contatos existentes:", err);
      return contactsToFilter; // Em caso de erro, retorna todos
    }
  }, [contactListId]);

  useEffect(() => {
    if (open) {
      setSearchParam("");
      setSelectedContacts(new Set());
      setPageNumber(1);
      fetchContacts("", 1, true);
    }
  }, [open, fetchContacts]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (open) {
        setPageNumber(1);
        fetchContacts(searchParam, 1, true);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, open, fetchContacts]);

  // Filtrar contatos para remover os que já estão na lista
  useEffect(() => {
    if (contacts.length > 0) {
      filterExistingContacts(contacts).then(filtered => {
        if (filtered.length !== contacts.length) {
          setContacts(filtered);
        }
      });
    }
  }, [contacts, filterExistingContacts]);

  const handleSearchChange = (event) => {
    setSearchParam(event.target.value);
  };

  const handleContactToggle = (contactId) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map(c => c.id)));
    }
  };

  const handleLoadMore = () => {
    const nextPage = pageNumber + 1;
    setPageNumber(nextPage);
    fetchContacts(searchParam, nextPage, false);
  };

  const handleSubmit = async () => {
    if (selectedContacts.size === 0) {
      toast.warning("Selecione pelo menos um contato");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post(
        `/contact-list-items/${contactListId}/add-manual-contacts`,
        {
          contactIds: Array.from(selectedContacts),
        }
      );

      toast.success(
        `${data.added} contato(s) adicionado(s) com sucesso!`
      );

      if (data.duplicated > 0) {
        toast.warning(
          `${data.duplicated} contato(s) já estavam na lista`
        );
      }

      if (data.errors > 0) {
        toast.error(
          `${data.errors} contato(s) não puderam ser adicionados`
        );
      }

      onSuccess?.();
      handleClose();
    } catch (err) {
      console.error("Erro ao adicionar contatos:", err);
      toast.error(
        err.response?.data?.error || "Erro ao adicionar contatos"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSearchParam("");
    setSelectedContacts(new Set());
    setContacts([]);
    setPageNumber(1);
    onClose();
  };

  const formatPhoneNumber = (number) => {
    if (!number) return "";
    const cleaned = number.replace(/\D/g, "");
    if (cleaned.startsWith("55") && cleaned.length >= 12) {
      const withoutCountry = cleaned.substring(2);
      const ddd = withoutCountry.substring(0, 2);
      const phone = withoutCountry.substring(2);
      return `BR (${ddd}) ${phone.substring(0, phone.length - 4)}-${phone.substring(phone.length - 4)}`;
    }
    return number;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        style: { minHeight: "70vh" }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            Adicionar Contatos Manualmente
          </Typography>
          <IconButton onClick={handleClose} className={classes.clearButton}>
            <Clear />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Buscar contatos por nome, telefone, cidade..."
          value={searchParam}
          onChange={handleSearchChange}
          className={classes.searchField}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />

        {selectedContacts.size > 0 && (
          <Box className={classes.selectedCount}>
            <Typography variant="body2">
              {selectedContacts.size} contato(s) selecionado(s)
            </Typography>
          </Box>
        )}

        {loading && contacts.length === 0 ? (
          <Box className={classes.loadingContainer}>
            <CircularProgress />
          </Box>
        ) : contacts.length === 0 ? (
          <Box className={classes.emptyState}>
            <Person style={{ fontSize: 48, marginBottom: 16 }} />
            <Typography variant="body1">
              {searchParam 
                ? "Nenhum contato encontrado para esta busca"
                : "Nenhum contato disponível"
              }
            </Typography>
            <Typography variant="body2" style={{ marginTop: 8 }}>
              Apenas contatos com WhatsApp válido são exibidos
            </Typography>
          </Box>
        ) : (
          <>
            <Box display="flex" alignItems="center" marginBottom={1}>
              <Checkbox
                checked={selectedContacts.size === contacts.length && contacts.length > 0}
                indeterminate={selectedContacts.size > 0 && selectedContacts.size < contacts.length}
                onChange={handleSelectAll}
              />
              <Typography variant="body2" color="textSecondary">
                Selecionar todos ({contacts.length})
              </Typography>
            </Box>

            <List className={classes.contactList}>
              {contacts.map((contact) => (
                <ListItem
                  key={contact.id}
                  button
                  onClick={() => handleContactToggle(contact.id)}
                  className={classes.contactItem}
                >
                  <Avatar className={classes.contactAvatar}>
                    {contact.urlPicture ? (
                      <img 
                        src={contact.urlPicture} 
                        alt={contact.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <Person />
                    )}
                  </Avatar>

                  <Box className={classes.contactInfo}>
                    <Typography className={classes.contactName}>
                      {contact.name}
                    </Typography>
                    
                    <Box className={classes.contactDetails}>
                      <Box display="flex" alignItems="center">
                        <Phone style={{ fontSize: 14, marginRight: 4 }} />
                        <span>{formatPhoneNumber(contact.number)}</span>
                        <CheckCircle 
                          style={{ 
                            fontSize: 14, 
                            marginLeft: 4, 
                            color: "#4caf50" 
                          }} 
                        />
                      </Box>
                      
                      {contact.city && (
                        <Box display="flex" alignItems="center">
                          <LocationOn style={{ fontSize: 14, marginRight: 4 }} />
                          <span>{contact.city}</span>
                        </Box>
                      )}
                      
                      {contact.segment && (
                        <Box display="flex" alignItems="center">
                          <Business style={{ fontSize: 14, marginRight: 4 }} />
                          <span>{contact.segment}</span>
                        </Box>
                      )}
                    </Box>

                    {contact.tags && contact.tags.length > 0 && (
                      <Box marginTop={0.5}>
                        {contact.tags.slice(0, 3).map((tag) => (
                          <Chip
                            key={tag.id}
                            label={tag.name}
                            size="small"
                            className={classes.tagChip}
                            style={{
                              backgroundColor: tag.color || "#9e9e9e",
                              color: "#fff",
                            }}
                          />
                        ))}
                        {contact.tags.length > 3 && (
                          <Chip
                            label={`+${contact.tags.length - 3}`}
                            size="small"
                            className={classes.tagChip}
                            style={{
                              backgroundColor: "#9e9e9e",
                              color: "#fff",
                            }}
                          />
                        )}
                      </Box>
                    )}
                  </Box>

                  <ListItemSecondaryAction>
                    <Checkbox
                      edge="end"
                      checked={selectedContacts.has(contact.id)}
                      onChange={() => handleContactToggle(contact.id)}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>

            {hasMore && (
              <Box textAlign="center" marginTop={2}>
                <Button
                  variant="outlined"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={20} /> : "Carregar mais"}
                </Button>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          color="primary"
          variant="contained"
          disabled={submitting || selectedContacts.size === 0}
        >
          {submitting ? (
            <CircularProgress size={20} />
          ) : (
            `Adicionar ${selectedContacts.size} contato(s)`
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddManualContactsModal;
