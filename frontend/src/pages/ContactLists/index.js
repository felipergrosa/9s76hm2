import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";

import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
 
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import PeopleIcon from "@material-ui/icons/People";
import DownloadIcon from "@material-ui/icons/GetApp";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ContactListDialog from "../../components/ContactListDialog";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { Grid, Popover, Button, Typography, Chip } from "@material-ui/core";
import { Plus as PlusIcon, Filter as FilterIcon } from "lucide-react";

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
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    // Removido overflow e scrollbar interna para usar scroll da janela
  },
}));

const ContactLists = () => {
  const classes = useStyles();
  const history = useHistory();

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
      <MainHeader>
        <Grid style={{ width: "99.6%" }} container>
          <Grid xs={12} sm={5} item>
            <Title>{i18n.t("contactLists.title")}</Title>
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
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleOpenContactListModal}
                    className="px-4 py-2 text-sm font-semibold uppercase text-white bg-green-400 hover:bg-green-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 flex items-center"
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    {i18n.t("contactLists.buttons.add")}
                  </button>
                </div>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </MainHeader>
      <Paper
        className={classes.mainPaper}
        variant="outlined"
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="left">{i18n.t("contactLists.table.name")}</TableCell>
              <TableCell align="left">{i18n.t("contactLists.table.contacts")}</TableCell>
              <TableCell align="left">Filtro salvo</TableCell>
              <TableCell align="right">{i18n.t("contactLists.table.actions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {contactLists.map((contactList) => (
                <TableRow key={contactList.id}>
                  <TableCell align="left">{contactList.name}</TableCell>
                  <TableCell align="left">{contactList.contactsCount || 0}</TableCell>
                  <TableCell align="left" style={{ maxWidth: 560 }}>
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
                  </TableCell>
                  <TableCell align="right">
                    <a href={planilhaExemplo} download="planilha.xlsx">
                      <IconButton size="small" title="Baixar Planilha Exemplo">
                        <DownloadIcon />
                      </IconButton>
                    </a>

                    <IconButton
                      size="small"
                      onClick={() => goToContacts(contactList.id)}
                    >
                      <PeopleIcon />
                    </IconButton>

                    <IconButton
                      size="small"
                      onClick={() => handleEditContactList(contactList)}
                    >
                      <EditIcon />
                    </IconButton>

                    <IconButton
                      size="small"
                      onClick={(e) => {
                        setConfirmModalOpen(true);
                        setDeletingContactList(contactList);
                      }}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {loading && <TableRowSkeleton columns={4} />}
            </>
          </TableBody>
        </Table>
      </Paper>
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
      {/* Paginação (baseada no totalPages/renderPageNumbers) */}
      <nav className="flex justify-between items-center mt-4">
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
    </MainContainer>
  );
};

export default ContactLists;
