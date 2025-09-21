import React, {
  useState,
  useEffect,
  useReducer,
  useContext,
  useRef,
  useMemo,
} from "react";

import { toast } from "react-toastify";
import { useParams, useHistory } from "react-router-dom";
import IconDock, { DefaultIconSet } from "../../components/IconDock";
 

 
 

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ContactListItemModal from "../../components/ContactListItemModal";
import ContactModal from "../../components/ContactModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import AddFilteredContactsModal from "../../components/AddFilteredContactsModal";

import { i18n } from "../../translate/i18n";
 
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import useContactLists from "../../hooks/useContactLists";
import { Chip, Typography, Tooltip, Popover, Button } from "@material-ui/core";
import IconButton from "@material-ui/core/IconButton";
import ContactAvatar from "../../components/ContactAvatar";
import { Search, List as ListIcon, Upload as UploadIcon, Filter as FilterIcon, Plus as PlusIcon, Edit, Trash2, CheckCircle, Ban, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eraser as EraserIcon } from "lucide-react";
import LoadingOverlay from "../../components/LoadingOverlay";

import planilhaExemplo from "../../assets/planilha.xlsx";
import ForbiddenPage from "../../components/ForbiddenPage";
// import { SocketContext } from "../../context/Socket/SocketContext";


// Tooltips consistentes com a página Contacts
const CustomTooltipProps = {
  arrow: true,
  enterTouchDelay: 0,
  leaveTouchDelay: 5000,
  enterDelay: 300,
  leaveDelay: 100,
};

const reducer = (state, action) => {
  if (action.type === "SET_CONTACTS") {
    // Substitui completamente a lista (paginação por página)
    return Array.isArray(action.payload) ? [...action.payload] : [];
  }
  if (action.type === "LOAD_CONTACTS") {
    const incoming = Array.isArray(action.payload)
      ? action.payload
      : action.payload
      ? [action.payload]
      : [];
    const newContacts = [];

    incoming.forEach((contact) => {
      const contactIndex = state.findIndex((c) => c.id === contact.id);
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
    if (!contact) return state;
    const contactIndex = state.findIndex((c) => c.id === contact.id);

    if (contactIndex !== -1) {
      state[contactIndex] = { ...state[contactIndex], ...contact };
      return [...state];
    } else {
      return [contact, ...state];
    }
  }

  if (action.type === "DELETE_CONTACT") {
    const contactId = action.payload;
    if (contactId == null) return state;

    const contactIndex = state.findIndex((c) => c.id === contactId);
    if (contactIndex !== -1) {
      state.splice(contactIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }

  return state;
};

const ContactListItems = () => {
  

  //   const socketManager = useContext(SocketContext);
  const { user, socket } = useContext(AuthContext);

  const { contactListId } = useParams();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [contacts, dispatch] = useReducer(reducer, []);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactListItemModalOpen, setContactListItemModalOpen] =
    useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [deletingContact, setDeletingContact] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmClearListOpen, setConfirmClearListOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [contactList, setContactList] = useState({});
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const fileUploadRef = useRef(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [totalContacts, setTotalContacts] = useState(0);
  const [contactsPerPage, setContactsPerPage] = useState(20); // espelha backend (ListService.limit)
  // Ordenação
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc"); // 'asc' | 'desc'
  

  const { findById: findContactList } = useContactLists();


  const refreshContactList = () => {
    findContactList(contactListId).then((data) => {
      setContactList(data);
    });
  };

  useEffect(() => {
    refreshContactList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactListId]);

  // Carrega tags apenas se necessário para exibir nomes no resumo do filtro
  useEffect(() => {
    const loadTags = async () => {
      try {
        const { data } = await api.get("/tags");
        const list = Array.isArray(data) ? data : (data && Array.isArray(data.tags) ? data.tags : []);
        setAllTags(list);
      } catch (err) {
        // silencioso no resumo
      }
    };
    if (contactList && contactList.savedFilter && Array.isArray(contactList.savedFilter.tags)) {
      loadTags();
    }
  }, [contactList]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get(`contact-list-items`, {
            params: { searchParam, pageNumber, contactListId },
          });
          // Substitui a lista pelo resultado da página atual
          dispatch({ type: "SET_CONTACTS", payload: data.contacts });
          setHasMore(data.hasMore);
          setTotalContacts(typeof data.count === 'number' ? data.count : (data.total || data.contacts.length || 0));
        } catch (err) {
          toastError(err);
        } finally {
          setLoading(false);
        }
      };
      fetchContacts();
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber, contactListId, refreshKey]);

  // Persistência da ordenação por usuário/lista
  useEffect(() => {
    const key = `contactListItemsSort:${user?.id || "anon"}:${contactListId}`;
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && saved.field) {
        setSortField(saved.field);
        setSortDirection(saved.direction === "desc" ? "desc" : "asc");
      }
    } catch (_) { /* ignora */ }
  }, [user?.id, contactListId]);


  useEffect(() => {
    const companyId = user.companyId;
    // const socket = socketManager.GetSocket();

    const onCompanyContactLists = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CONTACTS", payload: data.record });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_CONTACT", payload: +data.id });
      }

      if (data.action === "reload") {
        // Evitar anexar listas grandes via socket. Força refetch da página 1.
        dispatch({ type: "RESET" });
        setPageNumber(1);
        setRefreshKey(k => k + 1);
      }
    }
    socket.on(`company-${companyId}-ContactListItem`, onCompanyContactLists);
    // Canal específico da lista (usado por upload/clear)
    socket.on(`company-${companyId}-ContactListItem-${contactListId}`, onCompanyContactLists);

    // Atualiza metadados da lista (ex.: savedFilter) quando houver atualizações na ContactList
    const onCompanyContactList = (data) => {
      if (data.action === "update" && data.record && data.record.id === Number(contactListId)) {
        setContactList(data.record);
      }
    };
    socket.on(`company-${companyId}-ContactList`, onCompanyContactList);

    return () => {
      socket.off(`company-${companyId}-ContactListItem`, onCompanyContactLists);
      socket.off(`company-${companyId}-ContactListItem-${contactListId}`, onCompanyContactLists);
      socket.off(`company-${companyId}-ContactList`, onCompanyContactList);
    };
  }, [contactListId]);

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleOpenContactListItemModal = () => {
    setSelectedContactId(null);
    setContactListItemModalOpen(true);
  };

  const handleCloseContactListItemModal = () => {
    setSelectedContactId(null);
    setContactListItemModalOpen(false);
  };

  const handleCloseContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(false);
    // Recarregar lista para refletir alterações do contato
    dispatch({ type: "RESET" });
    setSearchParam("");
    setPageNumber(1);
    setRefreshKey((k) => k + 1);
  };

  const hadleEditContact = (contactId) => {
    if (!contactId) return;
    setSelectedContactId(contactId);
    setContactModalOpen(true);
  };

  const handleDeleteContact = async (contactId) => {
    try {
      await api.delete(`/contact-list-items/${contactId}`);
      dispatch({ type: "DELETE_CONTACT", payload: contactId });
      toast.success(i18n.t("contacts.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingContact(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const handleClearListItems = async () => {
    try {
      await api.delete(`/contact-lists/${contactListId}/items`);
      // Resetar e recarregar a lista
      dispatch({ type: "RESET" });
      setSearchParam("");
      setPageNumber(1);
      setRefreshKey((k) => k + 1);
      toast.success("Itens da lista removidos.");
    } catch (err) {
      toastError(err);
    } finally {
      setConfirmClearListOpen(false);
    }
  };

  // Ações globais usadas no IconDock
  const handleDisableAutoUpdate = async () => {
    try {
      await api.put(`/contact-lists/${contactListId}`, { savedFilter: null });
      const updated = await findContactList(contactListId);
      setContactList(updated);
      // Recarregar lista sem filtro salvo
      dispatch({ type: "RESET" });
      setSearchParam("");
      setPageNumber(1);
      setRefreshKey((k) => k + 1);
      toast.success('Filtro salvo limpo.');
    } catch (err) {
      toastError(err);
    }
  };

  const handleSyncNow = async () => {
    try {
      await api.post(`/contact-lists/${contactListId}/sync`);
      toast.success('Sincronização iniciada.');
      // Recarregar lista sem F5
      dispatch({ type: "RESET" });
      setSearchParam("");
      setPageNumber(1);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toastError(err);
    }
  };

  const handleImportContacts = async () => {
    try {
      const formData = new FormData();
      formData.append("file", fileUploadRef.current.files[0]);
      await api.request({
        url: `contact-lists/${contactListId}/upload`,
        method: "POST",
        data: formData,
      });
      toast.success("Importação iniciada. Processaremos o arquivo em segundo plano.");
      // Recarregar lista
      dispatch({ type: "RESET" });
      setSearchParam("");
      setPageNumber(1);
      setRefreshKey((k) => k + 1);
      if (fileUploadRef.current) fileUploadRef.current.value = null;
      setDeletingContact(null);
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenFilterModal = () => {
    setFilterModalOpen(true);
  };

  const handleCloseFilterModal = () => {
    setFilterModalOpen(false);
  };

  // Persistência de ordenação (por usuário/lista)
  const persistSort = (field, direction) => {
    const key = `contactListItemsSort:${user?.id || "anon"}:${contactListId}`;
    try {
      localStorage.setItem(key, JSON.stringify({ field, direction }));
    } catch (_) { /* ignora */ }
  };

  // Handler de ordenação
  const handleSort = (field) => {
    setSortField((prevField) => {
      const nextField = field;
      setSortDirection((prevDir) => {
        const nextDir = prevField === field ? (prevDir === "asc" ? "desc" : "asc") : "asc";
        persistSort(nextField, nextDir);
        setPageNumber(1);
        return nextDir;
      });
      return nextField;
    });
  };

  // Ordenação client-side (por página)
  const sortedContacts = useMemo(() => {
    const normalize = (v) => {
      if (v === null || v === undefined) return "";
      if (typeof v === "string") return v.toLowerCase();
      return v;
    };
    const getFieldValue = (c) => {
      switch (sortField) {
        case "name":
          return c.name || (c.contact && c.contact.name) || "";
        case "number":
          return c.number || (c.contact && c.contact.number) || "";
        case "email":
          return c.email || (c.contact && c.contact.email) || "";
        case "city":
          return (c.contact && c.contact.city) || "";
        case "segment":
          return (c.contact && c.contact.segment) || "";
        case "situation":
          return (c.contact && c.contact.situation) || "";
        case "creditLimit":
          return c.contact && c.contact.creditLimit ? formatCurrency(c.contact.creditLimit) : "";
        case "tags":
          return Array.isArray(c.contact && c.contact.tags) ? (c.contact.tags || []).length : 0;
        default:
          return c.name || (c.contact && c.contact.name) || "";
      }
    };
    const cmp = (a, b) => {
      const va = normalize(getFieldValue(a));
      const vb = normalize(getFieldValue(b));
      if (typeof va === "number" && typeof vb === "number") {
        return va - vb;
      }
      return String(va).localeCompare(String(vb), "pt-BR", { sensitivity: "base" });
    };
    const sorted = [...contacts].sort(cmp);
    return sortDirection === "desc" ? sorted.reverse() : sorted;
  }, [contacts, sortField, sortDirection]);

  // Paginação fixa (sem infinite scroll), espelhando /contatos
  const handlePageChange = (page) => {
    const pages = totalContacts === 0 ? 1 : Math.ceil(totalContacts / contactsPerPage);
    if (page >= 1 && page <= pages) {
      setPageNumber(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  const totalPages = totalContacts === 0 ? 1 : Math.ceil(totalContacts / contactsPerPage);
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
            className={`flex items-center justify-center px-3 h-8 leading-tight border ${page === pageNumber
              ? "text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
              : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"}`}
          >
            {page}
          </button>
        )}
      </li>
    ));
  };

  const goToContactLists = () => {
    history.push("/contact-lists");
  };

  const monthsPT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const formatCurrency = (val) => {
    if (val == null || val === "") return null;
    const num = Number(String(val).replace(/\./g, '').replace(/,/g, '.'));
    if (isNaN(num)) return String(val);
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
  };

  const formatPhoneNumber = (number) => {
    if (!number) return "";
    const cleaned = ('' + number).replace(/\D/g, '');
    if (cleaned.startsWith("55") && cleaned.length === 13) {
      const match = cleaned.match(/^(\d{2})(\d{2})(\d{5})(\d{4})$/);
      if (match) {
        return `BR (${match[2]}) ${match[3]}-${match[4]}`;
      }
    }
    return number;
  };

  const FilterSummary = () => {
    // Popover de detalhes
    const [anchorEl, setAnchorEl] = useState(null);
    const [open, setOpen] = useState(false);
    const f = contactList && contactList.savedFilter;
    if (!f) return null;

    const parts = [];
    if (Array.isArray(f.channel) && f.channel.length) parts.push({ label: 'Canal', values: f.channel });
    if (Array.isArray(f.representativeCode) && f.representativeCode.length) parts.push({ label: 'Representante', values: f.representativeCode });
    if (Array.isArray(f.city) && f.city.length) parts.push({ label: 'Cidade', values: f.city });
    const segmentValues = Array.isArray(f.segment) ? f.segment : (typeof f.segment === 'string' && f.segment ? [f.segment] : []);
    if (segmentValues.length) parts.push({ label: 'Segmento', values: segmentValues });
    if (Array.isArray(f.situation) && f.situation.length) parts.push({ label: 'Situação', values: f.situation });
    if (Array.isArray(f.foundationMonths) && f.foundationMonths.length) parts.push({ label: 'Fundação', values: f.foundationMonths.map(m => monthsPT[m-1]).filter(Boolean) });
    if (f.minCreditLimit || f.maxCreditLimit) {
      const min = formatCurrency(f.minCreditLimit) || '—';
      const max = formatCurrency(f.maxCreditLimit) || '—';
      parts.push({ label: 'Limite', values: [`${min} – ${max}`] });
    }
    // Encomenda (Sim/Não)
    if (typeof f.florder !== 'undefined') {
      const v = f.florder === true ? 'Sim' : f.florder === false ? 'Não' : null;
      if (v) parts.push({ label: 'Encomenda', values: [v] });
    }
    // Última Compra (período)
    if (f.dtUltCompraStart || f.dtUltCompraEnd) {
      try {
        const s = f.dtUltCompraStart ? new Date(f.dtUltCompraStart) : null;
        const e = f.dtUltCompraEnd ? new Date(f.dtUltCompraEnd) : null;
        const fmt = (d) => d ? d.toLocaleDateString('pt-BR') : '—';
        parts.push({ label: 'Última Compra', values: [`${fmt(s)} – ${fmt(e)}`] });
      } catch (_) {
        // silencioso
      }
    }
    if (Array.isArray(f.tags) && f.tags.length) {
      const tagNames = allTags.length ? allTags.filter(t => f.tags.includes(t.id)).map(t => t.name) : f.tags.map(id => `#${id}`);
      parts.push({ label: 'Tags', values: tagNames });
    }
    // Mesmo que não haja partes reconhecíveis, exibir controles de sincronização
    const handleDisableAutoUpdate = async () => {
      try {
        await api.put(`/contact-lists/${contactListId}`, { savedFilter: null });
        const updated = await findContactList(contactListId);
        setContactList(updated);
        // Recarregar lista sem filtro salvo
        dispatch({ type: "RESET" });
        setSearchParam("");
        setPageNumber(1);
        setRefreshKey(k => k + 1);
        toast.success('Filtro salvo limpo.');
      } catch (err) {
        toastError(err);
      }
    };

    const handleSyncNow = async () => {
      try {
        await api.post(`/contact-lists/${contactListId}/sync`);
        toast.success('Sincronização iniciada.');
        // Recarregar lista sem F5
        dispatch({ type: "RESET" });
        setSearchParam("");
        setPageNumber(1);
        setRefreshKey(k => k + 1);
      } catch (err) {
        toastError(err);
      }
    };

    // Helpers
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

    return (
      <div style={{ padding: '6px 8px 2px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, rowGap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              size="small"
              variant="outlined"
              onMouseEnter={(e) => { setAnchorEl(e.currentTarget); setOpen(true); }}
              startIcon={<FilterIcon size={16} color="#059669" />}
            >
              Filtro salvo
            </Button>
            <Tooltip title="Limpar filtro salvo" placement="top" arrow>
              <IconButton size="small" onClick={handleDisableAutoUpdate}>
                <EraserIcon size={18} color="#be185d" />
              </IconButton>
            </Tooltip>
          </div>
          <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={() => setOpen(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            PaperProps={{ onMouseLeave: () => setOpen(false) }}
            disableAutoFocus
            disableEnforceFocus
            disableRestoreFocus
          >
            <div style={{ padding: 16, maxWidth: 440 }}>
              <Typography variant="subtitle2" gutterBottom>Detalhes do filtro salvo</Typography>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Array.isArray(f.channel) && f.channel.length && (
                  <div><strong>Canal:</strong> {f.channel.join(', ')}</div>
                )}
                {Array.isArray(f.representativeCode) && f.representativeCode.length && (
                  <div><strong>Representante:</strong> {f.representativeCode.join(', ')}</div>
                )}
                {Array.isArray(f.city) && f.city.length && (
                  <div><strong>Cidade:</strong> {f.city.join(', ')}</div>
                )}
                {Array.isArray(f.segment) && f.segment.length && (
                  <div><strong>Segmento:</strong> {f.segment.join(', ')}</div>
                )}
                {Array.isArray(f.situation) && f.situation.length && (
                  <div><strong>Situação:</strong> {f.situation.join(', ')}</div>
                )}
                {Array.isArray(f.foundationMonths) && f.foundationMonths.length && (
                  <div><strong>Fundação (mês):</strong> {f.foundationMonths.join(', ')}</div>
                )}
                {(f.minCreditLimit || f.maxCreditLimit) && (
                  <div><strong>Crédito:</strong> {fmtCurrency(f.minCreditLimit)} – {f.maxCreditLimit ? fmtCurrency(f.maxCreditLimit) : '∞'}</div>
                )}
                {typeof f.florder !== 'undefined' && (
                  <div><strong>Encomenda:</strong> {f.florder ? 'Sim' : 'Não'}</div>
                )}
                {(f.dtUltCompraStart || f.dtUltCompraEnd) && (
                  <div><strong>Última compra (período):</strong> {fmtDate(f.dtUltCompraStart)} – {fmtDate(f.dtUltCompraEnd)}</div>
                )}
                {(f.minVlUltCompra != null || f.maxVlUltCompra != null) && (
                  <div><strong>Valor da última compra:</strong> {fmtCurrency(f.minVlUltCompra)} – {fmtCurrency(f.maxVlUltCompra)}</div>
                )}
                {Array.isArray(f.tags) && f.tags.length && (
                  <div><strong>Tags:</strong> {f.tags.length}</div>
                )}
              </div>
            </div>
          </Popover>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-gray-50 dark:bg-gray-900 min-h-full">
      <MainContainer useWindowScroll>
        <div className="w-full p-4 md:p-6 lg:p-8 overflow-x-hidden">
        <LoadingOverlay open={loading} message="Aguarde..." />
        <ContactListItemModal
          open={contactListItemModalOpen}
          onClose={handleCloseContactListItemModal}
          aria-labelledby="form-dialog-title"
          contactId={selectedContactId}
          onSave={(data) => {
            dispatch({ type: "UPDATE_CONTACTS", payload: data });
          }}
        />
        <AddFilteredContactsModal
          open={filterModalOpen}
          onClose={handleCloseFilterModal}
          contactListId={contactListId}
        savedFilter={contactList && contactList.savedFilter}
        reload={() => {
          dispatch({ type: "RESET" });
          setSearchParam("");
          setPageNumber(1);
          setRefreshKey((k) => k + 1);
          refreshContactList();
        }}
      />
        <ContactModal
          open={contactModalOpen}
          onClose={handleCloseContactModal}
          contactId={selectedContactId}
          onSave={() => {
            // Em criação/edição, forçar recarregar lista
            dispatch({ type: "RESET" });
            setSearchParam("");
            setPageNumber(1);
            setRefreshKey((k) => k + 1);
          }}
        />
      {/* Confirmação para limpar todos os itens da lista */}
      <ConfirmationModal
        title={"Limpar itens da lista"}
        open={confirmClearListOpen}
        onClose={setConfirmClearListOpen}
        onConfirm={handleClearListItems}
      >
        Tem certeza que deseja remover todos os itens desta lista? Esta ação não pode ser desfeita.
      </ConfirmationModal>
      <ConfirmationModal
        title={
          deletingContact
            ? `${i18n.t("contactListItems.confirmationModal.deleteTitle")} ${deletingContact.name
            }?`
            : `${i18n.t("contactListItems.confirmationModal.importTitlte")}`
        }
        open={confirmOpen}
        onClose={setConfirmOpen}
        onConfirm={() =>
          deletingContact
            ? handleDeleteContact(deletingContact.id)
            : handleImportContacts()
        }
      >
        {deletingContact ? (
          `${i18n.t("contactListItems.confirmationModal.deleteMessage")}`
        ) : (
          <>
            {i18n.t("contactListItems.confirmationModal.importMessage")}
            <a href={planilhaExemplo} download="planilha.xlsx">
              Clique aqui para baixar planilha exemplo.
            </a>
          </>
        )}
      </ConfirmationModal>
      {
        user.profile === "user" ?
          <ForbiddenPage />
          :
          <>
            {/* Cabeçalho */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
               Lista de Contatos {"›"} {contactList.name}
              </h1>
            </header>

            {/* Filtro salvo (acima da busca) */}
            <FilterSummary />

            {/* Barra de Ações e Filtros */}
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 md:flex-nowrap mb-2 md:mb-2">
              {/* Busca (Esquerda) */}
              <div className="w-full flex items-center gap-2 flex-1 min-w-0 justify-start">
                <div className="relative flex-1 min-w-[260px] max-w-[620px]">
                  <input
                    type="text"
                    placeholder={i18n.t("contactListItems.searchPlaceholder")}
                    value={searchParam}
                    onChange={handleSearch}
                    className="w-full h-10 pl-10 pr-4 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>

              {/* Dock minimalista (somente ícones com tooltip) */}
              <IconDock
                actions={[
                  { id: 'import', label: i18n.t("contactListItems.buttons.import"), onClick: () => { if (fileUploadRef.current) { fileUploadRef.current.value = null; fileUploadRef.current.click(); } }, icon: DefaultIconSet({ color: '#111' }).import },
                  { id: 'filter', label: 'Filtrar', onClick: handleOpenFilterModal, icon: DefaultIconSet({ color: '#111' }).filter, active: filterModalOpen },
                  { id: 'clearItems', label: 'Limpar itens da lista', onClick: () => setConfirmClearListOpen(true), icon: DefaultIconSet({ color: '#b91c1c' }).clearItems },
                  { id: 'syncNow', label: 'Sincronizar agora', onClick: handleSyncNow, icon: DefaultIconSet({ color: '#065f46' }).syncNow },
                ]}
              />
            </div>

            
            {/* Input de upload oculto */}
            <input
              style={{ display: "none" }}
              id="upload"
              name="file"
              type="file"
              accept=".xls,.xlsx"
              onChange={() => {
                setDeletingContact(null);
                setConfirmOpen(true);
              }}
              ref={fileUploadRef}
            />

            {/* Tabela (Desktop) */}
            <div className="hidden md:block bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
              <div className="overflow-x-hidden">
                <table className="w-full table-auto text-sm text-left text-gray-500 dark:text-gray-400">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-700 dark:text-gray-300 sticky top-0 z-10">
                    <tr className="uppercase text-xs text-gray-500 dark:text-gray-400 tracking-wider">
                      <th scope="col" className="w-[44px] p-2 text-center">#</th>
                      <th scope="col" className="pl-3 pr-3 py-2 w-[220px]">
                        <button onClick={() => handleSort('name')} className="flex items-center gap-1 select-none font-medium">
                          NOME
                          <span className="text-[15px] opacity-70">{sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th scope="col" className="pl-3 pr-3 py-2 w-[140px]">
                        <button onClick={() => handleSort('number')} className="flex items-center gap-1 select-none w-full font-medium">
                          WHATSAPP
                          <span className="text-[15px] opacity-70">{sortField === 'number' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th scope="col" className="hidden xl:table-cell pl-3 pr-3 py-2 w-[160px]">
                        <button onClick={() => handleSort('email')} className="flex items-center gap-1 select-none font-medium">
                          EMAIL
                          <span className="text-[15px] opacity-70">{sortField === 'email' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th scope="col" className="pl-3 pr-3 py-2 w-[120px]">
                        <button onClick={() => handleSort('city')} className="flex items-center gap-1 select-none font-medium">
                          CIDADE
                          <span className="text-[15px] opacity-70">{sortField === 'city' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th scope="col" className="pl-3 pr-3 py-2 w-[120px]">
                        <button onClick={() => handleSort('segment')} className="flex items-center gap-1 select-none font-medium">
                          SEGMENTO
                          <span className="text-[15px] opacity-70">{sortField === 'segment' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th scope="col" className="pl-3 pr-3 py-2 w-[110px]">
                        <button onClick={() => handleSort('situation')} className="flex items-center gap-1 select-none font-medium">
                          SITUAÇÃO
                          <span className="text-[15px] opacity-70">{sortField === 'situation' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th scope="col" className="pl-3 pr-3 py-2 w-[110px]">
                        <button onClick={() => handleSort('creditLimit')} className="flex items-center gap-1 select-none">
                          LIMITE
                          <span className="text-[15px] opacity-70">{sortField === 'creditLimit' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th scope="col" className="pl-3 pr-3 py-2 text-center w-[70px]">
                        <button onClick={() => handleSort('tags')} className="flex items-center justify-center gap-1 w-full select-none">
                          TAGS
                          <span className="text-[15px] opacity-70">{sortField === 'tags' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th scope="col" className="px-2 py-2 text-center w-[100px]">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedContacts.map((contact) => (
                      <tr key={contact.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                        <td className="px-2 py-3 text-center">
                          {contact.isWhatsappValid ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <Ban className="w-4 h-4 text-gray-400" />
                          )}
                        </td>
                        <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap dark:text-white flex items-center gap-2 max-w-[180px] overflow-hidden text-ellipsis">
                          <Tooltip {...CustomTooltipProps} title={contact.name}>
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 flex-shrink-0 overflow-hidden">
                              <ContactAvatar 
                                contact={contact.contact || contact}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            </div>
                          </Tooltip>
                          <Tooltip {...CustomTooltipProps} title={contact.name}>
                            <span className="truncate" style={{maxWidth: 'calc(100% - 32px)'}}>
                              {contact.name}
                            </span>
                          </Tooltip>
                        </td>
                        <td className="pl-3 pr-3 py-2">
                          <div className="flex items-center gap-1 text-[14px] leading-tight">
                            <span className="truncate max-w-[110px]">{formatPhoneNumber(contact.number)}</span>
                            {!!contact.isWhatsappValid ? (
                              <Tooltip {...CustomTooltipProps} title={`WhatsApp válido${contact.validatedAt ? ` • ${new Date(contact.validatedAt).toLocaleString('pt-BR')}` : ""}`}>
                                <CheckCircle className="w-4 h-4 text-green-700 flex-shrink-0" />
                              </Tooltip>
                            ) : (
                              <Tooltip {...CustomTooltipProps} title={`WhatsApp inválido${contact.validatedAt ? ` • ${new Date(contact.validatedAt).toLocaleString('pt-BR')}` : ""}`}>
                                <Ban className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        <td className="hidden xl:table-cell px-3 py-2 max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap">
                          <Tooltip {...CustomTooltipProps} title={contact.email}>
                            <span className="truncate">{contact.email}</span>
                          </Tooltip>
                        </td>
                        {/* Cidade */}
                        <td className="px-3 py-2 max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap">
                          <Tooltip {...CustomTooltipProps} title={(contact.contact && contact.contact.city) || ""}>
                            <span className="truncate">{(contact.contact && contact.contact.city) || ""}</span>
                          </Tooltip>
                        </td>
                        {/* Segmento */}
                        <td className="px-3 py-2 max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap">
                          <Tooltip {...CustomTooltipProps} title={(contact.contact && contact.contact.segment) || ""}>
                            <span className="truncate">{(contact.contact && contact.contact.segment) || ""}</span>
                          </Tooltip>
                        </td>
                        {/* Situação */}
                        <td className="px-3 py-2 text-center w-[110px]">
                          <Tooltip {...CustomTooltipProps} title={(contact.contact && contact.contact.situation) || ""}>
                            <span className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${
                              (contact.contact?.situation || '').toLowerCase() === 'ativo' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                                : (contact.contact?.situation || '').toLowerCase() === 'inativo' 
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                                  : (contact.contact?.situation || '').toLowerCase() === 'suspenso'
                                    ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                    : 'bg-gray-300 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
                            }`}>
                              {(contact.contact && contact.contact.situation) || ""}
                            </span>
                          </Tooltip>
                        </td>
                        {/* Limite de Crédito */}
                        <td className="px-3 py-2 max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">
                          <Tooltip {...CustomTooltipProps} title={contact.contact && contact.contact.creditLimit ? formatCurrency(contact.contact.creditLimit) : ""}>
                            <span className="truncate">{contact.contact && contact.contact.creditLimit ? formatCurrency(contact.contact.creditLimit) : ""}</span>
                          </Tooltip>
                        </td>
                        {/* Tags - estilo pontos coloridos */}
                        <td className="pl-3 pr-3 py-2 text-center w-[70px]">
                          <div className="flex justify-center gap-1">
                            {Array.isArray(contact.contact && contact.contact.tags) && (contact.contact.tags || []).slice(0, 4).map((tag) => (
                              <Tooltip {...CustomTooltipProps} title={tag.name} key={tag.id}>
                                <span
                                  className="inline-block w-[8px] h-[8px] rounded-full"
                                  style={{ backgroundColor: tag.color || '#9CA3AF' }}
                                ></span>
                              </Tooltip>
                            ))}
                            {Array.isArray(contact.contact && contact.contact.tags) && (contact.contact.tags || []).length > 4 && (
                              <Tooltip {...CustomTooltipProps} title={(contact.contact.tags || []).slice(4).map(t => t.name).join(", ") }>
                                <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-semibold text-white rounded-full bg-gray-400 dark:bg-gray-600 select-none">
                                  +{(contact.contact.tags || []).length - 4}
                                </span>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Tooltip {...CustomTooltipProps} title="Editar">
                              <button onClick={() => hadleEditContact(contact?.contact?.id)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                                <Edit className="w-4 h-4" />
                              </button>
                            </Tooltip>
                            <Can
                              role={user.profile}
                              perform="contacts-page:deleteContact"
                              yes={() => (
                                <Tooltip {...CustomTooltipProps} title="Excluir">
                                  <button onClick={() => { setConfirmOpen(true); setDeletingContact(contact); }} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </Tooltip>
                              )}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {loading && <TableRowSkeleton avatar columns={10} />}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Paginação (Desktop) */}
            <div className="hidden md:flex justify-between items-center mt-4">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Página {pageNumber} de {totalPages} • {totalContacts} itens
              </div>
              <nav>
                <ul className="inline-flex -space-x-px">
                  <li>
                    <button onClick={() => handlePageChange(1)} className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white">
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                  </li>
                  <li>
                    <button onClick={() => handlePageChange(pageNumber - 1)} disabled={pageNumber === 1} className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </li>
                  {renderPageNumbers()}
                  <li>
                    <button onClick={() => handlePageChange(pageNumber + 1)} disabled={pageNumber === totalPages} className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </li>
                  <li>
                    <button onClick={() => handlePageChange(totalPages)} className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white">
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </li>
                </ul>
              </nav>
            </div>

            {/* Lista (Mobile) */}
            <div className="md:hidden flex flex-col gap-2 mt-4 items-center">
              {sortedContacts.map((contact) => (
                <div key={contact.id} className="bg-white dark:bg-gray-800 shadow rounded-lg p-3 flex items-center gap-3 w-full max-w-[375px] mx-auto">
                  <div className="flex items-center justify-center">
                    {contact.isWhatsappValid ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <Ban className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 overflow-hidden flex-shrink-0">
                    <ContactAvatar 
                      contact={contact.contact || contact}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-medium text-gray-900 dark:text-white truncate text-[13px]" title={contact.name}>
                      {contact.name}
                    </span>
                    {contact.email && (
                      <span className="text-[12px] text-gray-500 dark:text-gray-400 truncate" title={contact.email}>
                        {contact.email}
                      </span>
                    )}
                    <span className="text-[12px] text-gray-500 dark:text-gray-400 truncate">
                      {formatPhoneNumber(contact.number)}
                    </span>
                    {(contact.contact && (contact.contact.city || contact.contact.segment)) && (
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        {contact.contact.city ? `${contact.contact.city}` : ""}
                        {contact.contact.city && contact.contact.segment ? " • " : ""}
                        {contact.contact.segment ? `${contact.contact.segment}` : ""}
                      </span>
                    )}
                    {Array.isArray(contact.contact && contact.contact.tags) && (contact.contact.tags || []).length > 0 && (
                      <div className="mt-1 flex items-center gap-1 flex-wrap">
                        {(contact.contact.tags || []).slice(0, 3).map(tag => (
                          <span key={tag.id} className="inline-block w-[8px] h-[8px] rounded-full" style={{ backgroundColor: tag.color || '#9CA3AF' }} title={tag.name}></span>
                        ))}
                        {(contact.contact.tags || []).length > 3 && (
                          <span className="inline-flex items-center justify-center px-1.5 h-4 text-[10px] font-semibold text-white rounded-full bg-gray-400 dark:bg-gray-600">
                            +{(contact.contact.tags || []).length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap shrink-0">
                    <button onClick={() => hadleEditContact(contact?.contact?.id)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"><Edit className="w-4 h-4" /></button>
                    <Can
                      role={user.profile}
                      perform="contacts-page:deleteContact"
                      yes={() => (
                        <button onClick={() => { setConfirmOpen(true); setDeletingContact(contact); }} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Paginação (Mobile) */}
            <div className="md:hidden flex justify-between items-center mt-4">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Página {pageNumber} de {totalPages}
              </div>
              <nav>
                <ul className="inline-flex -space-x-px">
                  <li>
                    <button onClick={() => handlePageChange(1)} className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white">
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                  </li>
                  <li>
                    <button onClick={() => handlePageChange(pageNumber - 1)} disabled={pageNumber === 1} className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </li>
                  {renderPageNumbers()}
                  <li>
                    <button onClick={() => handlePageChange(pageNumber + 1)} disabled={pageNumber === totalPages} className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </li>
                  <li>
                    <button onClick={() => handlePageChange(totalPages)} className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white">
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          </>
      }
        </div>
      </MainContainer>
    </div>
  );
};

export default ContactListItems;
