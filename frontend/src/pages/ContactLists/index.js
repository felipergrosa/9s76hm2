import React, { useState, useEffect, useReducer, useContext, useMemo } from "react";
import { toast } from "react-toastify";

import { useHistory } from "react-router-dom";

import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Paper, Box, useMediaQuery, TextField, InputAdornment, Grid, IconButton, Button, Tooltip, Popover, Typography } from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import PeopleIcon from "@material-ui/icons/People";
import DownloadIcon from "@material-ui/icons/GetApp";
import { Plus as PlusIcon, Filter as FilterIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

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

const useStyles = makeStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.palette.background.default,
    minHeight: "100%",
    padding: theme.spacing(2),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },
  container: {
    width: "100%",
    padding: theme.spacing(2),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHead: {
    backgroundColor: theme.palette.grey[100],
    "& th": {
      padding: theme.spacing(1.5),
      textAlign: "left",
      fontSize: "0.75rem",
      fontWeight: 600,
      textTransform: "uppercase",
      color: theme.palette.text.secondary,
      borderBottom: `2px solid ${theme.palette.divider}`,
    },
  },
  sortButton: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    font: "inherit",
    color: "inherit",
    "&:hover": {
      opacity: 0.8,
    },
  },
  sortIcon: {
    fontSize: "0.75rem",
    opacity: 0.6,
  },
  tableBody: {
    "& tr": {
      borderBottom: `1px solid ${theme.palette.divider}`,
      transition: "background-color 0.2s",
      "&:hover": {
        backgroundColor: theme.palette.action.hover,
      },
      "&:last-child": {
        borderBottom: "none",
      },
    },
    "& td": {
      padding: theme.spacing(1.5),
      fontSize: "0.875rem",
      color: theme.palette.text.primary,
    },
  },
  emptyState: {
    padding: theme.spacing(4),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[1],
    marginTop: theme.spacing(2),
  },
  paginationInfo: {
    fontSize: "0.875rem",
    color: theme.palette.text.secondary,
  },
  paginationControls: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  pageButton: {
    minWidth: 32,
    height: 32,
    padding: theme.spacing(0.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    cursor: "pointer",
    transition: "all 0.2s",
    "&:hover:not(:disabled)": {
      backgroundColor: theme.palette.action.hover,
    },
    "&:disabled": {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  },
  pageButtonActive: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    borderColor: theme.palette.primary.main,
    "&:hover": {
      backgroundColor: theme.palette.primary.dark,
    },
  },
}));

const CustomTooltipProps = {
  arrow: true,
  enterTouchDelay: 0,
  leaveTouchDelay: 5000,
  enterDelay: 300,
  leaveDelay: 100,
};

const ContactLists = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up(1200));
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalContactLists, setTotalContactLists] = useState(0);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedContactList, setSelectedContactList] = useState(null);
  const [deletingContactList, setDeletingContactList] = useState(null);
  const [contactListModalOpen, setContactListModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [contactLists, dispatch] = useReducer(reducer, []);
  const { user, socket } = useContext(AuthContext);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

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
    try {
      // Diagnóstico: inspeciona o conteúdo real vindo do backend
      // Remova depois que identificarmos o(s) campo(s) responsável(is) por '0000'
      console.log('[SavedFilter - details RAW]', sf);
      console.log('[SavedFilter - details CLEAN]', cleaned);
    } catch (_) {}
  };
  
  // Log sempre que o estado mudar (garante diagnóstico mesmo sem evento do botão)
  useEffect(() => {
    try { console.log('[SavedFilter - state]', detailsFilter); } catch(_) {}
  }, [detailsFilter]);
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
  const totalPages = useMemo(() => {
    return totalContactLists === 0 ? 1 : Math.ceil(totalContactLists / CONTACTLISTS_PER_PAGE);
  }, [totalContactLists]);
  
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setPageNumber(page);
    }
  };
  
  const renderPageNumbers = useMemo(() => {
    const pages = [];
    if (totalPages <= 3) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const start = Math.max(1, Math.min(pageNumber - 1, totalPages - 2));
      const end = Math.min(totalPages, start + 2);
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  }, [pageNumber, totalPages]);

  const goToContacts = (id) => {
    history.push(`/contact-lists/${id}/contacts`);
  };

  return (
    <Box className={classes.root}>
    <MainContainer useWindowScroll>
        <Box className={classes.container}>
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
      <MainHeader>
        <Grid style={{ width: "99.6%" }} container>
          <Grid xs={12} sm={5} item>
                <Title>
                  {i18n.t("contactLists.title")} ({totalContactLists})
                </Title>
          </Grid>
          <Grid xs={12} sm={7} item>
            <Grid container alignItems="center" spacing={2}>
              <Grid item xs>
                <TextField
                  fullWidth
                  placeholder={i18n.t("contacts.searchPlaceholder")}
                  type="search"
                  value={searchParam}
                  onChange={handleSearch}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon style={{ color: "gray" }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item>
                    <Tooltip {...CustomTooltipProps} title={i18n.t("contactLists.buttons.add")}>
                      <Button
                    onClick={handleOpenContactListModal}
                        variant="contained"
                        size="small"
                        style={{ 
                          backgroundColor: "#4ade80",
                          color: "#ffffff",
                          textTransform: "uppercase",
                          fontWeight: 600,
                          borderRadius: "8px"
                        }}
                        startIcon={<PlusIcon className="w-4 h-4" />}
                        aria-label={i18n.t("contactLists.buttons.add")}
                      >
                    {i18n.t("contactLists.buttons.add")}
                      </Button>
                    </Tooltip>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </MainHeader>
          {isDesktop ? (
            <Paper className={classes.mainPaper} variant="outlined">
        <Box style={{ overflowX: "auto" }}>
          <table className={classes.table}>
            <thead className={classes.tableHead}>
              <tr>
                      <th scope="col" align="left">
                        <button 
                          onClick={() => handleSort('name')} 
                          className={classes.sortButton}
                        >
                          {i18n.t("contactLists.table.name").toUpperCase()}
                          <span className={classes.sortIcon}>
                            {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </button>
                      </th>
                      <th scope="col" align="left">
                        <button 
                          onClick={() => handleSort('contactsCount')} 
                          className={classes.sortButton}
                        >
                          {i18n.t("contactLists.table.contacts").toUpperCase()}
                          <span className={classes.sortIcon}>
                            {sortField === 'contactsCount' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                          </span>
                        </button>
                      </th>
                      <th scope="col" align="left">FILTRO SALVO</th>
                      <th scope="col" align="right">{i18n.t("contactLists.table.actions").toUpperCase()}</th>
              </tr>
            </thead>
            <tbody className={classes.tableBody}>
              {!loading && contactLists.length === 0 && (
                <tr>
                  <td colSpan={4} className={classes.emptyState}>
                    Nenhuma lista de contatos encontrada.
                  </td>
                </tr>
              )}
              {contactLists.map((contactList) => (
                <tr key={contactList.id}>
                  <td align="left">{contactList.name}</td>
                  <td align="left">{contactList.contactsCount || 0}</td>
                  <td align="left" style={{ maxWidth: 560 }}>
                    {(() => {
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
                    })()}
                  </td>
                  <td align="right">
                    <Tooltip {...CustomTooltipProps} title="Baixar Planilha Exemplo">
                    <a href={planilhaExemplo} download="planilha.xlsx">
                        <IconButton 
                          size="small" 
                          style={{
                            color: "#374151",
                            backgroundColor: "#ffffff",
                            border: "1px solid #d1d5db",
                            borderRadius: "8px",
                            marginRight: 4
                          }}
                        >
                          <DownloadIcon fontSize="small" />
                      </IconButton>
                    </a>
                    </Tooltip>

                    <Tooltip {...CustomTooltipProps} title="Ver Contatos">
                    <IconButton
                      size="small"
                      onClick={() => goToContacts(contactList.id)}
                        style={{
                          color: "#374151",
                          backgroundColor: "#ffffff",
                          border: "1px solid #d1d5db",
                          borderRadius: "8px",
                          marginRight: 4
                        }}
                    >
                        <PeopleIcon fontSize="small" />
                    </IconButton>
                    </Tooltip>

                    <Tooltip {...CustomTooltipProps} title="Editar">
                    <IconButton
                      size="small"
                      onClick={() => handleEditContactList(contactList)}
                        style={{
                          color: "#374151",
                          backgroundColor: "#ffffff",
                          border: "1px solid #d1d5db",
                          borderRadius: "8px",
                          marginRight: 4
                        }}
                    >
                        <EditIcon fontSize="small" />
                    </IconButton>
                    </Tooltip>

                    <Tooltip {...CustomTooltipProps} title="Deletar">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        setConfirmModalOpen(true);
                        setDeletingContactList(contactList);
                      }}
                        style={{
                          color: "#dc2626",
                          backgroundColor: "#ffffff",
                          border: "1px solid #d1d5db",
                          borderRadius: "8px"
                        }}
                    >
                        <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                    </Tooltip>
                  </td>
                </tr>
              ))}
              {loading && <TableRowSkeleton columns={4} />}
            </tbody>
          </table>
            </Box>
              {/* Paginação Desktop */}
              <Box className={classes.pagination} component="nav" aria-label="Table navigation">
                <span className={classes.paginationInfo}>
                  Página <strong>{pageNumber}</strong> de <strong>{totalPages}</strong> • 
                  <strong>{totalContactLists}</strong> listas
                </span>
                <Box className={classes.paginationControls} component="ul" style={{ listStyle: "none", display: "flex", gap: 4, margin: 0, padding: 0 }}>
                  <li>
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={pageNumber === 1}
                      className={classes.pageButton}
                    >
                      <ChevronsLeft className="w-5 h-5" />
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => handlePageChange(pageNumber - 1)}
                      disabled={pageNumber === 1}
                      className={classes.pageButton}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  </li>
                  {renderPageNumbers.map((page, index) => (
                    <li key={index}>
                      <button
                        onClick={() => handlePageChange(page)}
                        className={`${classes.pageButton} ${page === pageNumber ? classes.pageButtonActive : ""}`}
                      >
                        {page}
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      onClick={() => handlePageChange(pageNumber + 1)}
                      disabled={pageNumber === totalPages}
                      className={classes.pageButton}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      disabled={pageNumber === totalPages}
                      className={classes.pageButton}
                    >
                      <ChevronsRight className="w-5 h-5" />
                    </button>
                  </li>
                </Box>
        </Box>
      </Paper>
          ) : (
            /* Mobile View */
            <>
              <div className="flex flex-col gap-1.5 mt-3 w-full max-w-[375px] mx-auto">
                {!loading && contactLists.length === 0 && (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    Nenhuma lista de contatos encontrada.
                  </div>
                )}
                {contactLists.map((contactList) => (
                  <div key={contactList.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{contactList.name}</span>
                      <div className="flex gap-1">
                        <Tooltip {...CustomTooltipProps} title="Baixar Planilha">
                          <a href={planilhaExemplo} download="planilha.xlsx">
                            <IconButton 
                              size="small"
                              style={{
                                color: "#374151",
                                backgroundColor: "#ffffff",
                                border: "1px solid #d1d5db",
                                borderRadius: "8px"
                              }}
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </a>
                        </Tooltip>
                        <Tooltip {...CustomTooltipProps} title="Ver Contatos">
                          <IconButton
                            size="small"
                            onClick={() => goToContacts(contactList.id)}
                            style={{
                              color: "#374151",
                              backgroundColor: "#ffffff",
                              border: "1px solid #d1d5db",
                              borderRadius: "8px"
                            }}
                          >
                            <PeopleIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip {...CustomTooltipProps} title="Editar">
                          <IconButton
                            size="small"
                            onClick={() => handleEditContactList(contactList)}
                            style={{
                              color: "#374151",
                              backgroundColor: "#ffffff",
                              border: "1px solid #d1d5db",
                              borderRadius: "8px"
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip {...CustomTooltipProps} title="Deletar">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              setConfirmModalOpen(true);
                              setDeletingContactList(contactList);
                            }}
                            style={{
                              color: "#dc2626",
                              backgroundColor: "#ffffff",
                              border: "1px solid #d1d5db",
                              borderRadius: "8px"
                            }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      {i18n.t("contactLists.table.contacts")}: {contactList.contactsCount || 0}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Filtro salvo: {contactList.savedFilter ? (
                        <Button
                          size="small"
                          variant="outlined"
                          onMouseEnter={(e) => openDetails(e, contactList.savedFilter)}
                          onClick={(e) => openDetails(e, contactList.savedFilter)}
                          startIcon={<FilterIcon size={16} color="#059669" />}
                        >
                          Ver filtro
                        </Button>
                      ) : (
                        <span style={{ color: '#999' }}>—</span>
                      )}
                    </div>
                  </div>
                ))}
                {loading && <TableRowSkeleton columns={4} />}
              </div>
              {/* Paginação Mobile */}
              <nav className="flex items-center justify-between p-3 mt-2 w-full max-w-[375px] mx-auto" aria-label="Mobile navigation">
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                  Página <span className="font-semibold text-gray-900 dark:text-white">{pageNumber}</span>
                  {" "} de {" "}
                  <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
                  {" "} • {" "}
                  <span className="font-semibold text-gray-900 dark:text-white">{totalContactLists}</span> listas
                </span>
                <ul className="inline-flex items-center -space-x-px">
                  <li>
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={pageNumber === 1}
                      className="flex items-center justify-center px-2 h-8 ml-0 leading-tight text-gray-500 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => handlePageChange(pageNumber - 1)}
                      disabled={pageNumber === 1}
                      className="flex items-center justify-center px-2 h-8 leading-tight text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </li>
                  {renderPageNumbers.map((page, index) => (
                    <li key={index}>
                      <button
                        onClick={() => handlePageChange(page)}
                        className={`flex items-center justify-center px-2 h-8 leading-tight border
                          ${page === pageNumber
                              ? "text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
                              : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                            }`}
                      >
                        {page}
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      onClick={() => handlePageChange(pageNumber + 1)}
                      disabled={pageNumber === totalPages}
                      className="flex items-center justify-center px-2 h-8 leading-tight text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      disabled={pageNumber === totalPages}
                      className="flex items-center justify-center px-2 h-8 leading-tight text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </li>
                </ul>
              </nav>
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
        </Box>
      </MainContainer>
      </Box>
  );
};

export default ContactLists;
