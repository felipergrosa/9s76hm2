import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";

import { useHistory } from "react-router-dom";

import { makeStyles, useTheme } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";

import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import { Popover, Button, Typography } from "@material-ui/core";

import {
  Search as SearchIcon,
  Pencil as EditIcon,
  Trash2 as DeleteIcon,
  Users as ContactsIcon,
  Download as DownloadIcon,
  Plus as PlusIcon,
  Filter as FilterIcon,
} from "lucide-react";

import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import usePermissions from "../../hooks/usePermissions";
import ForbiddenPage from "../../components/ForbiddenPage";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ContactListDialog from "../../components/ContactListDialog";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";

import planilhaExemplo from "../../assets/planilha.xlsx";
// import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";

const reducer = (state, action) => {
  if (action.type === "SET_CONTACTLISTS") {
    // Substitui completamente a lista (paginação por página)
    return [...action.payload];
  }
  if (action.type === "LOAD_CONTACTLISTS") {
    const contactLists = action.payload;
    const newContactLists = [];

    contactLists.forEach((contactList) => {
      const contactListIndex = state.findIndex((u) => u.id === contactList.id);
      if (contactListIndex !== -1) {
        state[contactListIndex] = contactList;
      } else {
        newContactLists.push(contactList);
      }
    });

    return [...state, ...newContactLists];
  }

  if (action.type === "UPDATE_CONTACTLIST") {
    const contactList = action.payload;
    const contactListIndex = state.findIndex((u) => u.id === contactList.id);

    if (contactListIndex !== -1) {
      state[contactListIndex] = contactList;
      return [...state];
    } else {
      return [contactList, ...state];
    }
  }

  if (action.type === "DELETE_CONTACTLIST") {
    const contactListId = action.payload;

    const contactListIndex = state.findIndex((u) => u.id === contactListId);
    if (contactListIndex !== -1) {
      state.splice(contactListIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

// ===== Estilos no padrão SPEC-LAYOUT-PADRAO (referência: pages/Connections) =====
const useStyles = makeStyles((theme) => ({
  paper: {
    flex: 1,
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
  listName: {
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
  paginationBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing(1.5, 2.5),
    borderTop: `1px solid ${theme.palette.divider}`,
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

const ContactLists = () => {
  const classes = useStyles();
  const history = useHistory();
  const theme = useTheme();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalContactLists, setTotalContactLists] = useState(0);
  const [selectedContactList, setSelectedContactList] = useState(null);
  const [deletingContactList, setDeletingContactList] = useState(null);
  const [contactListModalOpen, setContactListModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [contactLists, dispatch] = useReducer(reducer, []);
  //   const socketManager = useContext(SocketContext);
  const { user, socket } = useContext(AuthContext);
  const { hasPermission } = usePermissions();

  // Popover de detalhes do filtro salvo
  const [detailsAnchorEl, setDetailsAnchorEl] = useState(null);
  const [detailsFilter, setDetailsFilter] = useState(null);
  // Nomes das tags (carregado uma vez)
  const [allTags, setAllTags] = useState([]);
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/tags');
        setAllTags(Array.isArray(data) ? data : (data && Array.isArray(data.tags) ? data.tags : []));
      } catch {}
    };
    load();
  }, []);
  const openDetails = (event, sf) => {
    setDetailsAnchorEl(event.currentTarget);
    // Limpa chaves com valores vazios ou compostos apenas por zeros para evitar "linhas fantasma"
    const clean = (obj) => {
      try {
        if (!obj || typeof obj !== 'object') return obj;
        const isZeroOnly = (val) => {
          const s = String(val ?? '').trim();
          return s === '' || /^0+$/.test(s);
        };
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
          if (Array.isArray(v)) {
            const arr = v.map(x => (x == null ? '' : String(x).trim())).filter(x => !isZeroOnly(x));
            if (arr.length) out[k] = arr;
          } else if (v != null && !isZeroOnly(v)) {
            out[k] = v;
          }
        }
        return out;
      } catch { return obj; }
    };
    const cleaned = clean(sf || null);
    setDetailsFilter(cleaned || null);
  };
  const closeDetails = () => {
    // Restaura o foco para o botão/anchor para não manter o foco em um elemento que poderá ficar oculto
    try { detailsAnchorEl && typeof detailsAnchorEl.focus === 'function' && detailsAnchorEl.focus(); } catch(_) {}
    setDetailsAnchorEl(null);
    setDetailsFilter(null);
  };

  // limpeza de filtro salvo acontece somente na página de contatos da lista

  // Helpers de formatação
  const fmtCurrency = (val) => {
    if (val == null || val === '') return '—';
    const num = Number(String(val).replace(/\s+/g,'').replace(/R\$?/i,'').replace(/\./g,'').replace(/,/g,'.'));
    if (isNaN(num)) return String(val);
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
  };
  const fmtDate = (s) => {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d.getTime()) ? String(s) : d.toLocaleDateString('pt-BR');
  };


  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContactLists = async () => {
        try {
          const { data } = await api.get("/contact-lists/", {
            params: { searchParam, pageNumber },
          });
          // Substitui a lista ao trocar de página/filtro
          dispatch({ type: "SET_CONTACTLISTS", payload: data.records });
          setTotalContactLists(typeof data.count === "number" ? data.count : 0);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchContactLists();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const companyId = user.companyId;
    // const socket = socketManager.GetSocket();

    const onContactListEvent = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CONTACTLIST", payload: data.record });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_CONTACTLIST", payload: +data.id });
      }
    };

    socket.on(`company-${companyId}-ContactList`, onContactListEvent);

    return () => {
      socket.off(`company-${companyId}-ContactList`, onContactListEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenContactListModal = () => {
    setSelectedContactList(null);
    setContactListModalOpen(true);
  };

  const handleCloseContactListModal = () => {
    setSelectedContactList(null);
    setContactListModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditContactList = (contactList) => {
    setSelectedContactList(contactList);
    setContactListModalOpen(true);
  };

  const handleDeleteContactList = async (contactListId) => {
    try {
      await api.delete(`/contact-lists/${contactListId}`);
      toast.success(i18n.t("contactLists.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingContactList(null);
    setSearchParam("");
    setPageNumber(1);
  };

  // Paginação numerada
  const CONTACTLISTS_PER_PAGE = 20; // manter alinhado ao backend
  const totalPages = totalContactLists === 0 ? 1 : Math.ceil(totalContactLists / CONTACTLISTS_PER_PAGE);
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setPageNumber(page);
    }
  };
  const renderPageNumbers = () => {
    const pages = [];
    if (totalPages <= 3) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1, 2, 3, "...");
    }
    return pages.map((page, index) => (
      <li key={index}>
        {page === "..." ? (
          <span className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 dark:bg-gray-800 dark:border-gray-700">...</span>
        ) : (
          <button
            onClick={() => handlePageChange(page)}
            className={`flex items-center justify-center px-3 h-8 leading-tight border ${
              page === pageNumber
                ? "text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
                : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            }`}
          >
            {page}
          </button>
        )}
      </li>
    ));
  };

  const goToContacts = (id) => {
    history.push(`/contact-lists/${id}/contacts`);
  };

  // Botão "Filtro salvo" (compartilhado entre tabela desktop e cards mobile)
  // Exibe um resumo clicável quando a lista possui savedFilter com algum critério ativo
  const renderSavedFilterButton = (contactList) => {
    const sf = contactList && contactList.savedFilter ? contactList.savedFilter : null;
    if (!sf) return <span style={{ color: '#999' }}>—</span>;
    const hasAny = (
      (Array.isArray(sf.channel) && sf.channel.length > 0) ||
      (Array.isArray(sf.representativeCode) && sf.representativeCode.length > 0) ||
      (Array.isArray(sf.city) && sf.city.length > 0) ||
      (Array.isArray(sf.segment) && sf.segment.length > 0) ||
      (Array.isArray(sf.situation) && sf.situation.length > 0) ||
      (Array.isArray(sf.foundationMonths) && sf.foundationMonths.length > 0) ||
      (!!sf.minCreditLimit || !!sf.maxCreditLimit) ||
      (typeof sf.florder !== 'undefined') ||
      (!!sf.dtUltCompraStart || !!sf.dtUltCompraEnd) ||
      (sf.minVlUltCompra != null || sf.maxVlUltCompra != null) ||
      (Array.isArray(sf.tags) && sf.tags.length > 0)
    );
    if (!hasAny) return <span style={{ color: '#999' }}>—</span>;
    const activeCount = [
      Array.isArray(sf.channel) && sf.channel.length > 0,
      Array.isArray(sf.representativeCode) && sf.representativeCode.length > 0,
      Array.isArray(sf.city) && sf.city.length > 0,
      Array.isArray(sf.segment) && sf.segment.length > 0,
      Array.isArray(sf.situation) && sf.situation.length > 0,
      Array.isArray(sf.foundationMonths) && sf.foundationMonths.length > 0,
      (!!sf.minCreditLimit || !!sf.maxCreditLimit),
      (typeof sf.florder !== 'undefined'),
      (!!sf.dtUltCompraStart || !!sf.dtUltCompraEnd),
      (sf.minVlUltCompra != null || sf.maxVlUltCompra != null),
      (Array.isArray(sf.tags) && sf.tags.length > 0)
    ].filter(Boolean).length;
    return (
      <Button
        size="small"
        variant="outlined"
        onMouseEnter={(e) => openDetails(e, sf)}
        onClick={(e) => openDetails(e, sf)}
        startIcon={<FilterIcon size={16} color="#059669" />}
      >
        {`Filtro salvo${activeCount ? ` (${activeCount})` : ''}`}
      </Button>
    );
  };

  return (
    <MainContainer useWindowScroll>
      <ConfirmationModal
        title={
          deletingContactList &&
          `${i18n.t("contactLists.confirmationModal.deleteTitle")} ${deletingContactList.name
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteContactList(deletingContactList.id)}
      >
        {i18n.t("contactLists.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <ContactListDialog
        open={contactListModalOpen}
        onClose={handleCloseContactListModal}
        aria-labelledby="form-dialog-title"
        contactListId={selectedContactList && selectedContactList.id}
      />
      {!hasPermission("contact-lists.view") ? (
        <ForbiddenPage />
      ) : (
        <>
          <Paper className={classes.paper} variant="outlined">
            {/* 1. Cabeçalho: título + total + subtítulo + ações */}
            <div className={classes.header}>
              <div className={classes.headerText}>
                <Title>
                  {i18n.t("contactLists.title")} ({totalContactLists})
                </Title>
                <span className={classes.subtitle}>
                  Crie e gerencie listas de contatos para usar em campanhas, com filtros salvos e planilha de exemplo.
                </span>
              </div>
              <div className={classes.headerActions}>
                {hasPermission("contact-lists.create") && (
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    onClick={handleOpenContactListModal}
                    startIcon={<PlusIcon size={16} />}
                    style={{ minHeight: 36 }}
                  >
                    {i18n.t("contactLists.buttons.add")}
                  </Button>
                )}
              </div>
            </div>

            {/* 2. Toolbar: busca (server-side com debounce) */}
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
            </div>

            {/* 3. Conteúdo: skeleton / vazio / cards + tabela */}
            {loading ? (
              <Table>
                <TableBody>
                  <TableRowSkeleton columns={4} />
                </TableBody>
              </Table>
            ) : contactLists.length === 0 ? (
              <div className={classes.emptyState}>
                <ContactsIcon size={44} style={{ color: theme.palette.text.disabled }} />
                <div>Nenhuma lista de contatos encontrada.</div>
              </div>
            ) : (
              <>
                {/* Cards — mobile */}
                <div className={classes.mobileList}>
                  {contactLists.map((contactList) => (
                    <div key={contactList.id} className={classes.card}>
                      <div className={classes.cardHeader}>
                        <div className={classes.cardTitle}>
                          <div className={classes.cardName} title={contactList.name}>
                            {contactList.name}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {contactList.contactsCount || 0} contatos
                        </span>
                      </div>
                      <div className={classes.cardMeta}>
                        <div>
                          <div className={classes.metaLabel}>Filtro salvo</div>
                          <div className={classes.metaValue}>
                            {renderSavedFilterButton(contactList)}
                          </div>
                        </div>
                      </div>
                      <div className={classes.cardActions}>
                        <IconButton
                          size="small"
                          className={classes.actionButton}
                          onClick={() => goToContacts(contactList.id)}
                        >
                          <ContactsIcon size={18} />
                        </IconButton>
                        {hasPermission("contact-lists.edit") && (
                          <IconButton
                            size="small"
                            className={classes.actionButton}
                            onClick={() => handleEditContactList(contactList)}
                          >
                            <EditIcon size={18} />
                          </IconButton>
                        )}
                        {hasPermission("contact-lists.delete") && (
                          <IconButton
                            size="small"
                            className={classes.actionButton}
                            onClick={() => {
                              setConfirmModalOpen(true);
                              setDeletingContactList(contactList);
                            }}
                          >
                            <DeleteIcon size={18} />
                          </IconButton>
                        )}
                        <IconButton size="small" className={classes.actionButton} component="a" href={planilhaExemplo} download="planilha.xlsx" title="Baixar Planilha Exemplo">
                          <DownloadIcon size={18} />
                        </IconButton>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tabela — desktop */}
                <div className={classes.desktopTableWrapper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell align="left" className={classes.headCell}>{i18n.t("contactLists.table.name")}</TableCell>
                        <TableCell align="left" className={classes.headCell}>{i18n.t("contactLists.table.contacts")}</TableCell>
                        <TableCell align="left" className={classes.headCell}>Filtro salvo</TableCell>
                        <TableCell align="right" className={classes.headCell}>{i18n.t("contactLists.table.actions")}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {contactLists.map((contactList) => (
                        <TableRow key={contactList.id} className={classes.rowHover}>
                          <TableCell align="left" className={classes.bodyCell}>
                            <span className={classes.listName}>{contactList.name}</span>
                          </TableCell>
                          <TableCell align="left" className={classes.bodyCell}>
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {contactList.contactsCount || 0}
                            </span>
                          </TableCell>
                          <TableCell align="left" className={classes.bodyCell} style={{ maxWidth: 560 }}>
                            {renderSavedFilterButton(contactList)}
                          </TableCell>
                          <TableCell align="right" className={`${classes.bodyCell} ${classes.actionsCell}`}>
                            <a href={planilhaExemplo} download="planilha.xlsx">
                              <IconButton size="small" title="Baixar Planilha Exemplo">
                                <DownloadIcon size={18} />
                              </IconButton>
                            </a>

                            <IconButton
                              size="small"
                              onClick={() => goToContacts(contactList.id)}
                            >
                              <ContactsIcon size={18} />
                            </IconButton>

                            {hasPermission("contact-lists.edit") && (
                              <IconButton
                                size="small"
                                onClick={() => handleEditContactList(contactList)}
                              >
                                <EditIcon size={18} />
                              </IconButton>
                            )}

                            {hasPermission("contact-lists.delete") && (
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setConfirmModalOpen(true);
                                  setDeletingContactList(contactList);
                                }}
                              >
                                <DeleteIcon size={18} />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            {/* Paginação numerada (server-side) — preservada dentro do Paper */}
            <nav className={classes.paginationBar}>
              <ul className="inline-flex items-center -space-x-px">
                <li>
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={pageNumber === 1}
                    className={`flex items-center justify-center px-3 h-8 leading-tight border rounded-l-lg ${
                      pageNumber === 1
                        ? "text-gray-300 bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-700"
                        : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                    }`}
                  >
                    «
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handlePageChange(pageNumber - 1)}
                    disabled={pageNumber === 1}
                    className={`flex items-center justify-center px-3 h-8 leading-tight border ${
                      pageNumber === 1
                        ? "text-gray-300 bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-700"
                        : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                    }`}
                  >
                    ‹
                  </button>
                </li>
                {renderPageNumbers()}
                <li>
                  <button
                    onClick={() => handlePageChange(pageNumber + 1)}
                    disabled={pageNumber === totalPages}
                    className={`flex items-center justify-center px-3 h-8 leading-tight border ${
                      pageNumber === totalPages
                        ? "text-gray-300 bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-700"
                        : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                    }`}
                  >
                    ›
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={pageNumber === totalPages}
                    className={`flex items-center justify-center px-3 h-8 leading-tight border rounded-r-lg ${
                      pageNumber === totalPages
                        ? "text-gray-300 bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-700"
                        : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                    }`}
                  >
                    »
                  </button>
                </li>
              </ul>
            </nav>
          </Paper>
        </>
      )}
      {/* Popover de detalhes do filtro salvo */}
      <Popover
        open={Boolean(detailsAnchorEl)}
        anchorEl={detailsAnchorEl}
        onClose={closeDetails}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ onMouseLeave: closeDetails, tabIndex: -1, role: 'tooltip', 'aria-live': 'polite' }}
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
      >
        <div style={{ padding: 16, maxWidth: 440 }}>
          <Typography variant="subtitle2" gutterBottom>Detalhes do filtro salvo</Typography>
          {detailsFilter ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Array.isArray(detailsFilter.channel) && detailsFilter.channel.length > 0 && (
                <div><strong>Canal:</strong> {detailsFilter.channel.join(', ')}</div>
              )}
              {Array.isArray(detailsFilter.representativeCode) && detailsFilter.representativeCode.length > 0 && (
                <div><strong>Representante:</strong> {detailsFilter.representativeCode.join(', ')}</div>
              )}
              {Array.isArray(detailsFilter.city) && detailsFilter.city.length > 0 && (
                <div><strong>Cidade:</strong> {detailsFilter.city.join(', ')}</div>
              )}
              {Array.isArray(detailsFilter.segment) && detailsFilter.segment.length > 0 && (
                <div><strong>Segmento:</strong> {detailsFilter.segment.join(', ')}</div>
              )}
              {Array.isArray(detailsFilter.situation) && detailsFilter.situation.length > 0 && (
                <div><strong>Situação:</strong> {detailsFilter.situation.join(', ')}</div>
              )}
              {Array.isArray(detailsFilter.foundationMonths) && detailsFilter.foundationMonths.length > 0 && (
                <div><strong>Fundação (mês):</strong> {detailsFilter.foundationMonths.join(', ')}</div>
              )}
              {!!detailsFilter.minCreditLimit || !!detailsFilter.maxCreditLimit ? (
                <div><strong>Crédito:</strong> {fmtCurrency(detailsFilter.minCreditLimit)} – {detailsFilter.maxCreditLimit ? fmtCurrency(detailsFilter.maxCreditLimit) : '∞'}</div>
              ) : null}
              {typeof detailsFilter.florder !== 'undefined' && (
                <div><strong>Encomenda:</strong> {detailsFilter.florder ? 'Sim' : 'Não'}</div>
              )}
              {!!detailsFilter.dtUltCompraStart || !!detailsFilter.dtUltCompraEnd ? (
                <div><strong>Última compra (período):</strong> {fmtDate(detailsFilter.dtUltCompraStart)} – {fmtDate(detailsFilter.dtUltCompraEnd)}</div>
              ) : null}
              {detailsFilter.minVlUltCompra != null || detailsFilter.maxVlUltCompra != null ? (
                <div><strong>Valor da última compra:</strong> {fmtCurrency(detailsFilter.minVlUltCompra)} – {fmtCurrency(detailsFilter.maxVlUltCompra)}</div>
              ) : null}
              {Array.isArray(detailsFilter.tags) && detailsFilter.tags.length > 0 && (
                <div><strong>Tags:</strong> {(allTags.length ? allTags.filter(t => detailsFilter.tags.includes(t.id)).map(t => t.name) : detailsFilter.tags.map(id => `#${id}`)).join(', ')}</div>
              )}
            </div>
          ) : (
            <Typography variant="body2" color="textSecondary">—</Typography>
          )}
        </div>
      </Popover>
    </MainContainer>
  );
};

export default ContactLists;
