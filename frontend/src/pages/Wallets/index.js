import React, {
  useState,
  useEffect,
  useReducer,
  useContext,
  useRef,
  useCallback,
} from "react";

import { makeStyles } from "@material-ui/core/styles";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  InputAdornment,
  Tooltip,
  Chip,
  FormControl,
  Select,
  CircularProgress,
} from "@material-ui/core";

import {
  Search as SearchIcon,
  Eye as ViewIcon,
  Wallet as WalletIcon,
  Users as UsersIcon,
  Layers as QueuesIcon,
  Mail as MailIcon,
} from "lucide-react";

import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import ForbiddenPage from "../../components/ForbiddenPage";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ContactModal from "../../components/ContactModal";
import LazyContactAvatar from "../../components/LazyContactAvatar";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePermissions from "../../hooks/usePermissions";
import useDebounce from "../../hooks/useDebounce";
import useQueues from "../../hooks/useQueues";
import { safeFormatPhoneNumber } from "../../utils/formatSerializedId";

import { motion, useReducedMotion } from "framer-motion";
import StatCard from "../../components/bento/StatCard";
import { bentoContainer, bentoItem, bentoItemReduced } from "../../components/bento/motionPresets";
import "../../components/bento/bento.css";

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD_CONTACTS": {
      // Acumula páginas (scroll infinito) sem duplicar contatos
      const contacts = action.payload;
      const newContacts = [];
      contacts.forEach((contact) => {
        const idx = state.findIndex((c) => c.id === contact.id);
        if (idx !== -1) {
          state[idx] = contact;
        } else {
          newContacts.push(contact);
        }
      });
      return [...state, ...newContacts];
    }
    case "UPDATE_CONTACT": {
      // Atualização via socket: atualiza se já estiver na lista
      const contact = action.payload;
      const idx = state.findIndex((c) => c.id === contact.id);
      if (idx !== -1) {
        state[idx] = { ...state[idx], ...contact };
        return [...state];
      }
      return state;
    }
    case "DELETE_CONTACT":
      return state.filter((c) => c.id !== action.payload);
    case "RESET":
      return [];
    default:
      return state;
  }
};

// ===== Estilos no padrão das páginas novas (Connections/Tags) =====
const useStyles = makeStyles((theme) => ({
  paper: {
    flex: 1,
    padding: 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
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
    minWidth: 170,
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
    position: "sticky",
    top: 0,
    zIndex: 1,
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
  contactCell: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
    minWidth: 0,
  },
  contactName: {
    fontWeight: 600,
    fontSize: "0.9rem",
    lineHeight: 1.35,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 260,
  },
  mutedText: {
    color: theme.palette.text.secondary,
    fontSize: "0.78rem",
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
  // Área rolável — header/toolbar ficam fixos no topo do Paper
  listScroll: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  loadingMore: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(2),
  },
}));

const PAGE_SIZE = 50;

const Wallets = () => {
  const classes = useStyles();
  const { user, socket } = useContext(AuthContext);
  const { hasPermission } = usePermissions();
  const { findAllForSelection } = useQueues();

  const [contacts, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [count, setCount] = useState(0);

  // Filtros da toolbar (server-side)
  const [searchParam, setSearchParam] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [queueFilter, setQueueFilter] = useState("");
  const debouncedSearch = useDebounce(searchParam, 400);

  // Agregados retornados pelo backend (KPIs do strip bento)
  const [stats, setStats] = useState({
    totalContacts: 0,
    usersWithWallet: 0,
    activeQueues: 0,
    contactsWithEmail: 0,
  });
  // Usuários que possuem carteira — alimenta o select de filtro
  const [walletUsers, setWalletUsers] = useState([]);
  const [queues, setQueues] = useState([]);

  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState(null);

  const scrollRef = useRef(null);

  const reducedMotion = useReducedMotion();
  const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

  // Busca filas para o select de filtro (endpoint de seleção, sem permissão)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await findAllForSelection();
        if (mounted) setQueues(Array.isArray(list) ? list : []);
      } catch (err) {
        // falha silenciosa: filtro de fila fica vazio
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recarrega a primeira página quando filtros mudam
  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
    setLoading(true);

    const fetchWallets = async () => {
      try {
        const { data } = await api.get("/wallets", {
          params: {
            searchParam: debouncedSearch,
            pageNumber: 1,
            limit: PAGE_SIZE,
            userId: userFilter || undefined,
            queueId: queueFilter || undefined,
          },
        });
        dispatch({ type: "LOAD_CONTACTS", payload: data.contacts });
        setHasMore(data.hasMore);
        setCount(data.count);
        if (data.stats) setStats(data.stats);
        if (Array.isArray(data.walletUsers)) setWalletUsers(data.walletUsers);
      } catch (err) {
        // 403 = sem permissão contacts.view — silencia
        if (err?.response?.status !== 403) {
          toastError(err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchWallets();
  }, [debouncedSearch, userFilter, queueFilter]);

  // Carrega próxima página no scroll infinito
  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = pageNumber + 1;
    try {
      const { data } = await api.get("/wallets", {
        params: {
          searchParam: debouncedSearch,
          pageNumber: nextPage,
          limit: PAGE_SIZE,
          userId: userFilter || undefined,
          queueId: queueFilter || undefined,
        },
      });
      dispatch({ type: "LOAD_CONTACTS", payload: data.contacts });
      setHasMore(data.hasMore);
      setCount(data.count);
      setPageNumber(nextPage);
    } catch (err) {
      toastError(err);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, pageNumber, debouncedSearch, userFilter, queueFilter]);

  const handleScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      loadMore();
    }
  };

  // Atualização em tempo real: contato editado/criado/deletado reflete na lista
  useEffect(() => {
    const companyId = user.companyId;
    const onContactEvent = (data) => {
      if (data.action === "update" && data.contact) {
        dispatch({ type: "UPDATE_CONTACT", payload: data.contact });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE_CONTACT", payload: Number(data.contactId) });
      }
    };
    socket.on(`company-${companyId}-contact`, onContactEvent);
    return () => {
      socket.off(`company-${companyId}-contact`, onContactEvent);
    };
  }, [socket, user.companyId]);

  const handleViewContact = (contact) => {
    setSelectedContactId(contact.id);
    setContactModalOpen(true);
  };

  const handleCloseContactModal = () => {
    setContactModalOpen(false);
    setSelectedContactId(null);
  };

  // Chip de fila com a cor cadastrada
  const renderQueueChip = (queue) => {
    if (!queue) return <span className={classes.mutedText}>—</span>;
    return (
      <Chip
        size="small"
        variant="outlined"
        label={queue.name}
        style={{
          backgroundColor: queue.color || "transparent",
          color: "#fff",
          textShadow: "0px 0.3px #000",
          fontWeight: 600,
        }}
      />
    );
  };

  // Nomes dos donos da carteira (usuários com tag pessoal no contato)
  const renderWalletUsers = (contact) => {
    const owners = Array.isArray(contact.walletUsers) ? contact.walletUsers : [];
    if (!owners.length) {
      // Fallback: usuário registrado em Contact.userId
      return contact.user?.name
        ? <span>{contact.user.name}</span>
        : <span className={classes.mutedText}>—</span>;
    }
    return (
      <span>
        {owners.map((o) => o.name).join(", ")}
      </span>
    );
  };

  return (
    <MainContainer>
      <ContactModal
        open={contactModalOpen}
        onClose={handleCloseContactModal}
        aria-labelledby="form-dialog-title"
        contactId={selectedContactId}
      />
      {!hasPermission("contacts.view") ? (
        <ForbiddenPage />
      ) : (
        <motion.div
          variants={bentoContainer}
          initial="hidden"
          animate="show"
          style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 12 }}
        >
          {/* Strip de KPIs bento — agregados retornados pelo backend */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard
              label={i18n.t("wallets.stats.contacts")}
              value={stats.totalContacts}
              icon={<WalletIcon size={20} />}
              accent="var(--primary-color)"
              loading={loading}
            />
            <StatCard
              label={i18n.t("wallets.stats.users")}
              value={stats.usersWithWallet}
              icon={<UsersIcon size={20} />}
              accent="#26c281"
              loading={loading}
            />
            <StatCard
              label={i18n.t("wallets.stats.queues")}
              value={stats.activeQueues}
              icon={<QueuesIcon size={20} />}
              accent="#8e44ad"
              loading={loading}
            />
            <StatCard
              label={i18n.t("wallets.stats.withEmail")}
              value={stats.contactsWithEmail}
              icon={<MailIcon size={20} />}
              accent="#f39c12"
              loading={loading}
            />
          </div>

          <motion.div
            variants={itemVariant}
            style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
          >
            <Paper className={`${classes.paper} bento-panel`} variant="outlined">
              {/* Cabeçalho: título + subtítulo */}
              <div className={classes.header}>
                <div className={classes.headerText}>
                  <Title>
                    {i18n.t("wallets.title")} ({count})
                  </Title>
                  <span className={classes.subtitle}>
                    {i18n.t("wallets.subtitle")}
                  </span>
                </div>
              </div>

              {/* Toolbar: busca + filtro por usuário + filtro por fila */}
              <div className={classes.toolbar}>
                <TextField
                  className={classes.searchField}
                  size="small"
                  variant="outlined"
                  placeholder={i18n.t("wallets.searchPlaceholder")}
                  type="search"
                  value={searchParam}
                  onChange={(e) => setSearchParam(e.target.value.toLowerCase())}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon size={16} />
                      </InputAdornment>
                    ),
                  }}
                />
                <FormControl
                  size="small"
                  variant="outlined"
                  className={classes.filterSelect}
                >
                  <Select
                    native
                    displayEmpty
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                  >
                    <option value="">{i18n.t("wallets.filters.allUsers")}</option>
                    {(walletUsers || []).map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl
                  size="small"
                  variant="outlined"
                  className={classes.filterSelect}
                >
                  <Select
                    native
                    displayEmpty
                    value={queueFilter}
                    onChange={(e) => setQueueFilter(e.target.value)}
                  >
                    <option value="">{i18n.t("wallets.filters.allQueues")}</option>
                    {(queues || []).map((q) => (
                      <option key={q.id} value={q.id}>{q.name}</option>
                    ))}
                  </Select>
                </FormControl>
              </div>

              {/* Tabela com scroll infinito */}
              <div className={classes.listScroll} ref={scrollRef} onScroll={handleScroll}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell className={classes.headCell}>
                        {i18n.t("wallets.table.contact")}
                      </TableCell>
                      <TableCell className={classes.headCell}>
                        {i18n.t("wallets.table.user")}
                      </TableCell>
                      <TableCell className={classes.headCell}>
                        {i18n.t("wallets.table.queue")}
                      </TableCell>
                      <TableCell className={classes.headCell}>
                        {i18n.t("wallets.table.phone")}
                      </TableCell>
                      <TableCell className={classes.headCell}>
                        {i18n.t("wallets.table.email")}
                      </TableCell>
                      <TableCell className={classes.headCell} align="right">
                        {i18n.t("wallets.table.actions")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading && contacts.length === 0 ? (
                      <TableRowSkeleton avatar columns={5} />
                    ) : (
                      <>
                        {(contacts || []).map((contact) => (
                          <TableRow key={contact.id} className={classes.rowHover}>
                            <TableCell className={classes.bodyCell}>
                              <div className={classes.contactCell}>
                                <LazyContactAvatar
                                  contact={contact}
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: "50%",
                                    flexShrink: 0,
                                  }}
                                />
                                <Tooltip title={contact.name || ""}>
                                  <span className={classes.contactName}>
                                    {contact.name}
                                  </span>
                                </Tooltip>
                              </div>
                            </TableCell>
                            <TableCell className={classes.bodyCell}>
                              {renderWalletUsers(contact)}
                            </TableCell>
                            <TableCell className={classes.bodyCell}>
                              {renderQueueChip(contact.queue)}
                            </TableCell>
                            <TableCell className={classes.bodyCell}>
                              {safeFormatPhoneNumber(contact.number)}
                            </TableCell>
                            <TableCell className={classes.bodyCell}>
                              {contact.email || (
                                <span className={classes.mutedText}>—</span>
                              )}
                            </TableCell>
                            <TableCell className={`${classes.bodyCell} ${classes.actionsCell}`} align="right">
                              <Tooltip title={i18n.t("wallets.buttons.view")}>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleViewContact(contact)}
                                >
                                  <ViewIcon size={18} />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                        {loadingMore && <TableRowSkeleton avatar columns={5} />}
                      </>
                    )}
                  </TableBody>
                </Table>

                {!loading && contacts.length === 0 && (
                  <div className={classes.emptyState}>
                    <WalletIcon size={36} />
                    <span>{i18n.t("wallets.empty")}</span>
                  </div>
                )}

                {loadingMore && (
                  <div className={classes.loadingMore}>
                    <CircularProgress size={22} />
                  </div>
                )}
              </div>
            </Paper>
          </motion.div>
        </motion.div>
      )}
    </MainContainer>
  );
};

export default Wallets;
