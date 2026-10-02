import React, { useState, useEffect, useReducer, useContext, useMemo } from "react";

import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import { format, parseISO } from "date-fns";

import { makeStyles, useTheme } from "@material-ui/core/styles";
import {
  Button,
  Paper,
  IconButton,
  Tooltip,
  CircularProgress,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  Table,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@material-ui/core";

import {
  Search as SearchIcon,
  Plus as AddIcon,
  PenLine as EditNameIcon,
  Workflow as FlowIcon,
  Copy as DuplicateIcon,
  Trash2 as DeleteIcon,
} from "lucide-react";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ConfirmationModal from "../../components/ConfirmationModal";

import { i18n } from "../../translate/i18n";
import Title from "../../components/Title";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePermissions from "../../hooks/usePermissions";
import NewTicketModal from "../../components/NewTicketModal";
import FlowBuilderModal from "../../components/FlowBuilderModal";
import ForbiddenPage from "../../components/ForbiddenPage";

const reducer = (state, action) => {
  if (action.type === "LOAD_CONTACTS") {
    const contacts = action.payload;
    const newContacts = [];

    contacts.forEach(contact => {
      const contactIndex = state.findIndex(c => c.id === contact.id);
      if (contactIndex !== -1) {
        state[contactIndex] = contact;
      } else {
        newContacts.push(contact);
      }
    });

    return [...state, ...newContacts];
  }

  if (action.type === "UPDATE_CONTACTS") {
    const contact = action.payload;
    const contactIndex = state.findIndex(c => c.id === contact.id);

    if (contactIndex !== -1) {
      state[contactIndex] = contact;
      return [...state];
    } else {
      return [contact, ...state];
    }
  }

  if (action.type === "DELETE_CONTACT") {
    const contactId = action.payload;

    const contactIndex = state.findIndex(c => c.id === contactId);
    if (contactIndex !== -1) {
      state.splice(contactIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

// ===== Estilos no padrão das páginas de listagem (SPEC-LAYOUT-PADRAO) =====
const useStyles = makeStyles((theme) => ({
  paper: {
    flex: 1,
    padding: 0,
    overflowY: "auto",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    ...theme.scrollbarStyles,
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
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
    padding: theme.spacing(1.5, 2.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    borderBottom: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : "#fafafa",
  },
  searchField: {
    minWidth: 220,
    flex: "1 1 280px",
    maxWidth: 380,
  },
  filterSelect: {
    minWidth: 150,
  },
  headCell: {
    fontWeight: 600,
    fontSize: "0.72rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    borderBottom: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : "#fafafa",
    whiteSpace: "nowrap",
  },
  bodyCell: {
    fontSize: "0.85rem",
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
    borderBottom: `1px solid ${theme.palette.divider}`,
    verticalAlign: "middle",
  },
  rowHover: {
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    transition: "background-color 120ms ease",
  },
  flowName: {
    fontWeight: 600,
    fontSize: "0.9rem",
    lineHeight: 1.35,
  },
  actionsCell: {
    whiteSpace: "nowrap",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(8, 2),
    color: theme.palette.text.secondary,
    textAlign: "center",
  },
  flowAvatar: {
    width: 34,
    height: 34,
    borderRadius: 9,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: theme.palette.primary.main,
    backgroundColor: `${theme.palette.primary.main}1a`,
  },
  loadMore: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(2),
  },
  // Cards mobile
  mobileList: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    [theme.breakpoints.up("sm")]: {
      display: "none",
    },
  },
  desktopTableWrapper: {
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  card: {
    borderRadius: 12,
    padding: theme.spacing(1.75),
    border: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.25),
    background: theme.palette.background.paper,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
  },
  cardTitle: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
    minWidth: 0,
  },
  cardName: {
    fontWeight: 700,
    fontSize: "1rem",
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 190,
  },
  cardMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: theme.spacing(1),
  },
  metaLabel: {
    fontSize: "0.72rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: theme.palette.text.secondary,
  },
  metaValue: {
    fontSize: "0.9rem",
    fontWeight: 600,
    wordBreak: "break-word",
  },
  cardActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    flexWrap: "wrap",
  },
  actionButton: {
    minWidth: 44,
    minHeight: 44,
  },
}));

// Chip de status do fluxo (Ativo/Desativado) — padrão tailwind das listagens
const FlowStatusChip = ({ flow }) => (
  <span
    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
      flow.active
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
        : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
    }`}
  >
    {flow.active ? "Ativo" : "Desativado"}
  </span>
);

const FlowBuilder = () => {
  const classes = useStyles();
  const theme = useTheme();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [, dispatch] = useReducer(reducer, []);
  const [webhooks, setWebhooks] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [selectedWebhookName, setSelectedWebhookName] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [contactTicket] = useState({});
  const [deletingContact, setDeletingContact] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDuplicateOpen, setConfirmDuplicateOpen] = useState(false);

  const [hasMore, setHasMore] = useState(false);
  const [reloadData, setReloadData] = useState(false);
  const { user, socket } = useContext(AuthContext);
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("flowbuilder.create");
  const canEdit = hasPermission("flowbuilder.edit");
  const canDelete = hasPermission("flowbuilder.delete");

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get("/flowbuilder");
          setWebhooks(data.flows);
          dispatch({ type: "LOAD_CONTACTS", payload: data.flows });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          // 403 = sem permissão flowbuilder.view (admin)
          // Silencia o erro, lista de flows fica vazia
          if (err?.response?.status !== 403) {
            toastError(err);
          }
          setLoading(false);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber, reloadData]);

  useEffect(() => {
    const companyId = user.companyId;

    const onContact = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CONTACTS", payload: data.contact });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_CONTACT", payload: +data.contactId });
      }
    };

    socket.on(`company-${companyId}-contact`, onContact);

    return () => {
      // Remove apenas o listener deste evento; nao desconectar o socket compartilhado
      socket.off(`company-${companyId}-contact`, onContact);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtro client-side: busca por nome/ID + filtro de status da toolbar
  const filteredFlows = useMemo(() => {
    const search = searchParam.trim().toLowerCase();
    return (webhooks || []).filter((flow) => {
      if (search) {
        const hay = `${flow.id} ${flow.name || ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      if (statusFilter === "active" && !flow.active) return false;
      if (statusFilter === "inactive" && flow.active) return false;
      return true;
    });
  }, [webhooks, searchParam, statusFilter]);

  const handleSearch = event => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleOpenContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(true);
  };

  const handleCloseContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(false);
  };

  const handleCloseOrOpenTicket = ticket => {
    setNewTicketModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  // Abre o modal de renomear fluxo
  const hadleEditContact = (flow) => {
    setSelectedContactId(flow.id);
    setSelectedWebhookName(flow.name);
    setContactModalOpen(true);
  };

  const handleDeleteWebhook = async webhookId => {
    try {
      await api.delete(`/flowbuilder/${webhookId}`).then(res => {
        setDeletingContact(null);
        setReloadData(old => !old);
      });
      toast.success("Fluxo excluído com sucesso");
    } catch (err) {
      // 403 = sem permissão flowbuilder.delete (admin)
      // Silencia o erro
      if (err?.response?.status !== 403) {
        toastError(err);
      }
    }
  };

  const handleDuplicateFlow = async flowId => {
    try {
      await api.post(`/flowbuilder/duplicate`, { flowId: flowId }).then(res => {
        setDeletingContact(null);
        setReloadData(old => !old);
      });
      toast.success("Fluxo duplicado com sucesso");
    } catch (err) {
      // 403 = sem permissão flowbuilder.create (admin)
      // Silencia o erro
      if (err?.response?.status !== 403) {
        toastError(err);
      }
    }
  };

  const loadMore = () => {
    setPageNumber(prevState => prevState + 1);
  };

  // Paginação por scroll infinito (preservada da versão anterior)
  const handleScroll = e => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  // Ações por fluxo (compartilhadas entre cards mobile e tabela desktop)
  const renderFlowActions = (flow, isCard = false) => (
    <>
      {canEdit && (
        <Tooltip title="Editar nome">
          <IconButton
            size="small"
            className={isCard ? classes.actionButton : undefined}
            onClick={(e) => {
              e.stopPropagation();
              hadleEditContact(flow);
            }}
          >
            <EditNameIcon size={18} />
          </IconButton>
        </Tooltip>
      )}
      {canEdit && (
        <Tooltip title="Editar fluxo">
          <IconButton
            size="small"
            className={isCard ? classes.actionButton : undefined}
            onClick={(e) => {
              e.stopPropagation();
              history.push(`/flowbuilder/${flow.id}`);
            }}
          >
            <FlowIcon size={18} />
          </IconButton>
        </Tooltip>
      )}
      {canCreate && (
        <Tooltip title="Duplicar">
          <IconButton
            size="small"
            className={isCard ? classes.actionButton : undefined}
            onClick={(e) => {
              e.stopPropagation();
              setDeletingContact(flow);
              setConfirmDuplicateOpen(true);
            }}
          >
            <DuplicateIcon size={18} />
          </IconButton>
        </Tooltip>
      )}
      {canDelete && (
        <Tooltip title="Excluir">
          <IconButton
            size="small"
            className={isCard ? classes.actionButton : undefined}
            onClick={(e) => {
              e.stopPropagation();
              setDeletingContact(flow);
              setConfirmOpen(true);
            }}
          >
            <DeleteIcon size={18} />
          </IconButton>
        </Tooltip>
      )}
    </>
  );

  return (
    <MainContainer>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        initialContact={contactTicket}
        onClose={ticket => {
          handleCloseOrOpenTicket(ticket);
        }}
      />
      <FlowBuilderModal
        open={contactModalOpen}
        onClose={handleCloseContactModal}
        aria-labelledby="form-dialog-title"
        flowId={selectedContactId}
        nameWebhook={selectedWebhookName}
        onSave={() => setReloadData(old => !old)}
      />
      <ConfirmationModal
        title={
          deletingContact
            ? `${i18n.t("contacts.confirmationModal.deleteTitle")} ${deletingContact.name}?`
            : `${i18n.t("contacts.confirmationModal.importTitlte")}`
        }
        open={confirmOpen}
        onClose={setConfirmOpen}
        onConfirm={e =>
          deletingContact ? handleDeleteWebhook(deletingContact.id) : () => {}
        }
      >
        {deletingContact
          ? `Tem certeza que deseja deletar este fluxo? Todas as integrações relacionados serão perdidos.`
          : `${i18n.t("contacts.confirmationModal.importMessage")}`}
      </ConfirmationModal>
      <ConfirmationModal
        title={
          deletingContact
            ? `Deseja duplicar o fluxo ${deletingContact.name}?`
            : `${i18n.t("contacts.confirmationModal.importTitlte")}`
        }
        open={confirmDuplicateOpen}
        onClose={setConfirmDuplicateOpen}
        onConfirm={e =>
          deletingContact ? handleDuplicateFlow(deletingContact.id) : () => {}
        }
      >
        {deletingContact
          ? `Tem certeza que deseja duplicar este fluxo?`
          : `${i18n.t("contacts.confirmationModal.importMessage")}`}
      </ConfirmationModal>

      {!hasPermission("flowbuilder.view") ? (
        <ForbiddenPage />
      ) : (
        <Paper
          className={classes.paper}
          variant="outlined"
          onScroll={handleScroll}
        >
          {/* Cabeçalho: título + contagem + subtítulo + ação primária */}
          <div className={classes.header}>
            <div className={classes.headerText}>
              <Title>Fluxos de conversa ({filteredFlows.length})</Title>
              <span className={classes.subtitle}>
                Crie e gerencie fluxos automatizados de atendimento da empresa.
              </span>
            </div>
            <div className={classes.headerActions}>
              {canCreate && (
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<AddIcon size={16} />}
                  onClick={handleOpenContactModal}
                  style={{ minHeight: 36 }}
                >
                  Adicionar Fluxo
                </Button>
              )}
            </div>
          </div>

          {/* Toolbar: busca + filtro de status */}
          <div className={classes.toolbar}>
            <TextField
              className={classes.searchField}
              size="small"
              variant="outlined"
              placeholder={i18n.t("contacts.searchPlaceholder")}
              type="search"
              value={searchParam}
              onChange={handleSearch}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon size={16} />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" variant="outlined" className={classes.filterSelect}>
              <Select
                native
                displayEmpty
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Todos os status</option>
                <option value="active">Ativos</option>
                <option value="inactive">Desativados</option>
              </Select>
            </FormControl>
          </div>

          {loading && webhooks.length === 0 ? (
            <Table>
              <TableBody>
                <TableRowSkeleton columns={4} />
              </TableBody>
            </Table>
          ) : filteredFlows.length === 0 ? (
            <div className={classes.emptyState}>
              <FlowIcon size={44} style={{ color: theme.palette.text.disabled }} />
              <div>Nenhum fluxo encontrado.</div>
            </div>
          ) : (
            <>
              {/* Cards — mobile */}
              <div className={classes.mobileList}>
                {filteredFlows.map((flow) => (
                  <div key={flow.id} className={classes.card}>
                    <div className={classes.cardHeader}>
                      <div
                        className={classes.cardTitle}
                        style={{ cursor: "pointer" }}
                        onClick={() => history.push(`/flowbuilder/${flow.id}`)}
                      >
                        <span className={classes.flowAvatar}>
                          <FlowIcon size={18} />
                        </span>
                        <div className={classes.cardName} title={flow.name}>
                          {flow.name}
                        </div>
                      </div>
                      <FlowStatusChip flow={flow} />
                    </div>

                    <div className={classes.cardMeta}>
                      <div>
                        <div className={classes.metaLabel}>ID</div>
                        <div className={classes.metaValue}>#{flow.id}</div>
                      </div>
                      <div>
                        <div className={classes.metaLabel}>Atualizado em</div>
                        <div className={classes.metaValue}>
                          {flow.updatedAt
                            ? format(parseISO(flow.updatedAt), "dd/MM/yy HH:mm")
                            : "—"}
                        </div>
                      </div>
                    </div>

                    <div className={classes.cardActions}>
                      {renderFlowActions(flow, true)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tabela — desktop */}
              <div className={classes.desktopTableWrapper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell className={classes.headCell}>
                        {i18n.t("contacts.table.name")}
                      </TableCell>
                      <TableCell align="center" className={classes.headCell}>
                        Status
                      </TableCell>
                      <TableCell align="center" className={classes.headCell}>
                        Atualizado em
                      </TableCell>
                      <TableCell align="right" className={classes.headCell}>
                        {i18n.t("contacts.table.actions")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredFlows.map((flow) => (
                      <TableRow key={flow.id} className={classes.rowHover}>
                        <TableCell className={classes.bodyCell}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              cursor: "pointer",
                            }}
                            onClick={() => history.push(`/flowbuilder/${flow.id}`)}
                          >
                            <span className={classes.flowAvatar}>
                              <FlowIcon size={18} />
                            </span>
                            <span className={classes.flowName}>{flow.name}</span>
                          </div>
                        </TableCell>
                        <TableCell align="center" className={classes.bodyCell}>
                          <FlowStatusChip flow={flow} />
                        </TableCell>
                        <TableCell align="center" className={classes.bodyCell}>
                          {flow.updatedAt
                            ? format(parseISO(flow.updatedAt), "dd/MM/yy HH:mm")
                            : "—"}
                        </TableCell>
                        <TableCell
                          align="right"
                          className={`${classes.bodyCell} ${classes.actionsCell}`}
                        >
                          {renderFlowActions(flow)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Indicador de "carregar mais" do scroll infinito */}
              {loading && webhooks.length > 0 && (
                <div className={classes.loadMore}>
                  <CircularProgress size={24} />
                </div>
              )}
            </>
          )}
        </Paper>
      )}
    </MainContainer>
  );
};

export default FlowBuilder;
