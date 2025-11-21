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
import AddManualContactsModal from "../../components/AddManualContactsModal";

import { i18n } from "../../translate/i18n";
 
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import useContactLists from "../../hooks/useContactLists";
import { Chip, Typography, Tooltip, Popover, Button, useMediaQuery, Paper, Box } from "@material-ui/core";
import { useTheme, makeStyles } from "@material-ui/core/styles";
import IconButton from "@material-ui/core/IconButton";
import { Edit as EditIcon, DeleteOutline as DeleteOutlineIcon } from "@material-ui/icons";
import ContactAvatar from "../../components/ContactAvatar";
import { Search, List as ListIcon, Upload as UploadIcon, Filter as FilterIcon, Plus as PlusIcon, Trash2, CheckCircle, Ban, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eraser as EraserIcon } from "lucide-react";
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

const useStyles = makeStyles((theme) => ({
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
  const classes = useStyles();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up(1200));

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
  const [manualContactsModalOpen, setManualContactsModalOpen] = useState(false);
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
          // Mapear campo de ordenação para o backend (creditLimit -> creditlimit)
          const orderByParam = (sortField === 'creditLimit') ? 'creditlimit' : sortField;
          const orderParam = (sortDirection || 'asc');
          const { data } = await api.get(`contact-list-items`, {
            params: { searchParam, pageNumber, contactListId, orderBy: orderByParam, order: orderParam },
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
  }, [searchParam, pageNumber, contactListId, refreshKey, sortField, sortDirection]);

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

  const handleOpenManualContactsModal = () => {
    setManualContactsModalOpen(true);
  };

  const handleCloseManualContactsModal = () => {
    setManualContactsModalOpen(false);
  };

  const handleManualContactsSuccess = () => {
    // Recarregar lista após adicionar contatos manualmente
    dispatch({ type: "RESET" });
    setSearchParam("");
    setPageNumber(1);
    setRefreshKey((k) => k + 1);
    refreshContactList();
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

  // Ordenação agora é server-side; manter fallback seguro
  const sortedContacts = useMemo(() => {
    try {
      if (!Array.isArray(contacts)) return [];
      return contacts;
    } catch (e) {
      toastError(e);
      return Array.isArray(contacts) ? contacts : [];
    }
  }, [contacts]);

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
    return pages;
  };

  const goToContactLists = () => {
    history.push("/contact-lists");
  };

  const monthsPT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const formatCurrency = (val) => {
    if (val == null || val === "") return null;
    const s = String(val).trim();
    let num;
    // Se tiver vírgula, assumimos formato PT-BR (1.234,56): remove pontos (milhar) e troca vírgula por ponto
    if (s.includes(',')) {
      const normalized = s.replace(/\./g, '').replace(/,/g, '.');
      num = Number(normalized);
    } else {
      // Sem vírgula: assumimos formato com ponto decimal (inglês) e não removemos pontos
      num = Number(s);
    }
    if (isNaN(num)) return String(val);
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
  };

  const formatPhoneNumber = (number) => {
    if (!number) return "";
    const cleaned = ('' + number).replace(/\D/g, '');
    
    // Verifica se tem código do país (55 = Brasil)
    const hasCountryCode = cleaned.startsWith("55") && cleaned.length >= 12;
    
    if (hasCountryCode) {
      // Formato: +55 (14) 98125-2988
      const withoutCountryCode = cleaned.substring(2);
      
      if (withoutCountryCode.length >= 10) {
        const ddd = withoutCountryCode.substring(0, 2);
        const phone = withoutCountryCode.substring(2);
        
        if (phone.length === 9) {
          // Celular: 9 dígitos
          const prefix = phone.substring(0, 5);
          const suffix = phone.substring(5);
          return `+55 (${ddd}) ${prefix}-${suffix}`;
        } else if (phone.length === 8) {
          // Fixo: 8 dígitos
          const prefix = phone.substring(0, 4);
          const suffix = phone.substring(4);
          return `+55 (${ddd}) ${prefix}-${suffix}`;
        }
      }
    } else {
      // Sem código do país: (14) 98125-2988
      if (cleaned.length >= 10) {
        const ddd = cleaned.substring(0, 2);
        const phone = cleaned.substring(2);
        
        if (phone.length === 9) {
          // Celular: 9 dígitos
          const prefix = phone.substring(0, 5);
          const suffix = phone.substring(5);
          return `(${ddd}) ${prefix}-${suffix}`;
        } else if (phone.length === 8) {
          // Fixo: 8 dígitos
          const prefix = phone.substring(0, 4);
          const suffix = phone.substring(4);
          return `(${ddd}) ${prefix}-${suffix}`;
        }
      } else if (cleaned.length === 9) {
        // Apenas o número sem DDD (celular)
        const prefix = cleaned.substring(0, 5);
        const suffix = cleaned.substring(5);
        return `${prefix}-${suffix}`;
      } else if (cleaned.length === 8) {
        // Apenas o número sem DDD (fixo)
        const prefix = cleaned.substring(0, 4);
        const suffix = cleaned.substring(4);
        return `${prefix}-${suffix}`;
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

    // Detecta se há algum critério realmente ativo; se não houver, não exibe nada
    const hasAny = (
      (Array.isArray(f.channel) && f.channel.length > 0) ||
      (Array.isArray(f.representativeCode) && f.representativeCode.length > 0) ||
      (Array.isArray(f.city) && f.city.length > 0) ||
      (Array.isArray(f.segment) && f.segment.length > 0) ||
      (Array.isArray(f.situation) && f.situation.length > 0) ||
      (Array.isArray(f.foundationMonths) && f.foundationMonths.length > 0) ||
      (!!f.minCreditLimit || !!f.maxCreditLimit) ||
      (typeof f.florder !== 'undefined') ||
      (!!f.dtUltCompraStart || !!f.dtUltCompraEnd) ||
      (f.minVlUltCompra != null || f.maxVlUltCompra != null) ||
      (Array.isArray(f.tags) && f.tags.length > 0)
    );
    if (!hasAny) return null;

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
      const s = String(val).trim().replace(/\s+/g,'').replace(/R\$?/i,'');
      let num;
      if (s.includes(',')) {
        const normalized = s.replace(/\./g,'').replace(/,/g,'.');
        num = Number(normalized);
      } else {
        num = Number(s);
      }
      if (isNaN(num)) return String(val);
      return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
    };
    const fmtDate = (s) => {
      if (!s) return '—';
      const d = new Date(s);
      return isNaN(d.getTime()) ? String(s) : d.toLocaleDateString('pt-BR');
    };

    // Conta critérios ativos para exibir no botão
    const activeCount = [
      Array.isArray(f.channel) && f.channel.length > 0,
      Array.isArray(f.representativeCode) && f.representativeCode.length > 0,
      Array.isArray(f.city) && f.city.length > 0,
      Array.isArray(f.segment) && f.segment.length > 0,
      Array.isArray(f.situation) && f.situation.length > 0,
      Array.isArray(f.foundationMonths) && f.foundationMonths.length > 0,
      (!!f.minCreditLimit || !!f.maxCreditLimit),
      (typeof f.florder !== 'undefined'),
      (!!f.dtUltCompraStart || !!f.dtUltCompraEnd),
      (f.minVlUltCompra != null || f.maxVlUltCompra != null),
      (Array.isArray(f.tags) && f.tags.length > 0)
    ].filter(Boolean).length;

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
              {`Filtro salvo${activeCount ? ` (${activeCount})` : ''}`}
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
                {Array.isArray(f.channel) && f.channel.length > 0 && (
                  <div><strong>Canal:</strong> {f.channel.join(', ')}</div>
                )}
                {Array.isArray(f.representativeCode) && f.representativeCode.length > 0 && (
                  <div><strong>Representante:</strong> {f.representativeCode.join(', ')}</div>
                )}
                {Array.isArray(f.city) && f.city.length > 0 && (
                  <div><strong>Cidade:</strong> {f.city.join(', ')}</div>
                )}
                {Array.isArray(f.segment) && f.segment.length > 0 && (
                  <div><strong>Segmento:</strong> {f.segment.join(', ')}</div>
                )}
                {Array.isArray(f.situation) && f.situation.length > 0 && (
                  <div><strong>Situação:</strong> {f.situation.join(', ')}</div>
                )}
                {Array.isArray(f.foundationMonths) && f.foundationMonths.length > 0 && (
                  <div><strong>Fundação (mês):</strong> {f.foundationMonths.join(', ')}</div>
                )}
                {(!!f.minCreditLimit || !!f.maxCreditLimit) && (
                  <div><strong>Crédito:</strong> {fmtCurrency(f.minCreditLimit)} – {f.maxCreditLimit ? fmtCurrency(f.maxCreditLimit) : '∞'}</div>
                )}
                {typeof f.florder !== 'undefined' && (
                  <div><strong>Encomenda:</strong> {f.florder ? 'Sim' : 'Não'}</div>
                )}
                {(!!f.dtUltCompraStart || !!f.dtUltCompraEnd) && (
                  <div><strong>Última compra (período):</strong> {fmtDate(f.dtUltCompraStart)} – {fmtDate(f.dtUltCompraEnd)}</div>
                )}
                {(f.minVlUltCompra != null || f.maxVlUltCompra != null) && (
                  <div><strong>Valor da última compra:</strong> {fmtCurrency(f.minVlUltCompra)} – {fmtCurrency(f.maxVlUltCompra)}</div>
                )}
                {Array.isArray(f.tags) && f.tags.length > 0 && (
                  <div><strong>Tags:</strong> {(allTags.length
                    ? allTags.filter(t => f.tags.includes(t.id)).map(t => t.name)
                    : f.tags.map(id => `#${id}`)).join(', ')}</div>
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
        <AddManualContactsModal
          open={manualContactsModalOpen}
          onClose={handleCloseManualContactsModal}
          contactListId={contactListId}
          onSuccess={handleManualContactsSuccess}
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
                  { id: 'addManual', label: 'Adicionar contatos manualmente', onClick: handleOpenManualContactsModal, icon: DefaultIconSet({ color: '#059669' }).addManual },
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
            {isDesktop ? (
              <Paper className={classes.mainPaper} variant="outlined">
                <Box style={{ overflowX: "auto" }}>
                  <table className={classes.table}>
                    <thead className={classes.tableHead}>
                      <tr>
                      <th scope="col" className="pl-3 pr-3 py-2 w-[150px]">
                        <button onClick={() => handleSort('name')} className="flex items-center gap-1 select-none font-medium">
                          NOME
                          <span className="text-[15px] opacity-70">{sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
                        </button>
                      </th>
                      <th scope="col" className="pl-3 pr-3 py-2 w-[160px]">
                        <button onClick={() => handleSort('number')} className="flex items-center gap-1 select-none w-full font-medium">
                          WHATSAPP
                          <span className="text-[15px] opacity-70">{sortField === 'number' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
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
                      <th scope="col" className="pl-3 pr-3 py-2 w-[120px]">
                        <button onClick={() => handleSort('empresa')} className="flex items-center gap-1 select-none font-medium">
                          EMPRESA
                          <span className="text-[15px] opacity-70">{sortField === 'empresa' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
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
                    <tbody className={classes.tableBody}>
                      {!loading && sortedContacts.length === 0 && (
                        <tr>
                          <td colSpan={9} className={classes.emptyState}>
                            Nenhum contato encontrado.
                          </td>
                        </tr>
                      )}
                      {sortedContacts.map((contact) => (
                        <tr key={contact.id}>
                        <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap dark:text-white flex items-center gap-2 max-w-[260px] overflow-hidden text-ellipsis">
                          <Tooltip {...CustomTooltipProps} title={contact.name}>
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300 flex-shrink-0 overflow-hidden">
                              <ContactAvatar 
                                contact={contact.contact || contact}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            </div>
                          </Tooltip>
                          <Tooltip {...CustomTooltipProps} title={contact.name}>
                            <span className="truncate max-w-[200px]">
                              {contact.name}
                            </span>
                          </Tooltip>
                        </td>
                        <td className="pl-3 pr-3 py-2">
                          <div className="flex items-center gap-1 text-[14px] leading-tight min-w-0" style={{ whiteSpace: 'nowrap' }}>
                            <span className="flex-1 min-w-0 truncate max-w-[140px]" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatPhoneNumber(contact.number)}</span>
                            {!!contact.isWhatsappValid ? (
                              <Tooltip {...CustomTooltipProps} title={`WhatsApp válido${contact.validatedAt ? ` • ${new Date(contact.validatedAt).toLocaleString('pt-BR')}` : ""}`}>
                                <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center" style={{ flexShrink: 0 }}>
                                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-500" strokeWidth={2.5} />
                                </div>
                              </Tooltip>
                            ) : (
                              <Tooltip {...CustomTooltipProps} title={`WhatsApp inválido${contact.validatedAt ? ` • ${new Date(contact.validatedAt).toLocaleString('pt-BR')}` : ""}`}>
                                <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20" style={{ flexShrink: 0 }}>
                                  <Ban className="w-3.5 h-3.5 text-red-600 dark:text-red-400" strokeWidth={2.5} />
                                </div>
                              </Tooltip>
                            )}
                          </div>
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
                        {/* Empresa */}
                        <td className="px-3 py-2 max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap">
                          <Tooltip {...CustomTooltipProps} title={(contact.contact && contact.contact.bzEmpresa) || ""}>
                            <span className="truncate">{(contact.contact && contact.contact.bzEmpresa) || ""}</span>
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
                        <td align="right" className="px-2 py-2 text-center align-middle whitespace-nowrap">
                          <Tooltip {...CustomTooltipProps} title={contact?.contact?.id ? "Editar" : "Contato não vinculado"}>
                            <IconButton
                              size="small"
                              disabled={!contact?.contact?.id}
                              onClick={() => contact?.contact?.id && hadleEditContact(contact.contact.id)}
                              style={{ color: contact?.contact?.id ? "#2563eb" : "#9ca3af" }}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Can
                            role={user.profile}
                            perform="contacts-page:deleteContact"
                            yes={() => (
                              <Tooltip {...CustomTooltipProps} title="Excluir">
                                <IconButton
                                  size="small"
                                  onClick={() => { setConfirmOpen(true); setDeletingContact(contact); }}
                                  style={{ color: "#dc2626" }}
                                >
                                  <DeleteOutlineIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                          />
                        </td>
                      </tr>
                    ))}
                      {loading && <TableRowSkeleton avatar columns={9} />}
                    </tbody>
                  </table>
                </Box>
                {/* Paginação Desktop */}
                <Box className={classes.pagination} component="nav" aria-label="Table navigation">
                  <span className={classes.paginationInfo}>
                    Página {" "}
                    <strong>{pageNumber}</strong>
                    {" "} de {" "}
                    <strong>{totalPages}</strong>
                    {" "} • {" "}
                    <strong>{totalContacts}</strong> itens
                  </span>
                  <Box className={classes.paginationControls} component="ul" style={{ listStyle: "none", display: "flex", gap: 4, margin: 0, padding: 0 }}>
                    <li>
                      <button
                        onClick={() => handlePageChange(1)}
                        disabled={pageNumber === 1}
                        className={classes.pageButton}
                        style={{ borderRadius: "4px 0 0 4px" }}
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
                    {renderPageNumbers().map((page, index) => (
                      <li key={index}>
                        {page === "..." ? (
                          <span className={classes.pageButton} style={{ cursor: "default" }}>
                            ...
                          </span>
                        ) : (
                          <button
                            onClick={() => handlePageChange(page)}
                            className={`${classes.pageButton} ${page === pageNumber ? classes.pageButtonActive : ""}`}
                          >
                            {page}
                          </button>
                        )}
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
                        style={{ borderRadius: "0 4px 4px 0", marginLeft: 4 }}
                      >
                        <ChevronsRight className="w-5 h-5" />
                      </button>
                    </li>
                  </Box>
                </Box>
              </Paper>
            ) : (
              /* Lista (Mobile) */
              <>
                <div className="flex flex-col gap-2 mt-4 items-center">
              {sortedContacts.map((contact) => (
                <div key={contact.id} className="bg-white dark:bg-gray-800 shadow rounded-lg p-3 flex items-center gap-3 w-full max-w-[375px] mx-auto">
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
                    <span className="text-[12px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                      {formatPhoneNumber(contact.number)}
                      {!!contact.isWhatsappValid ? (
                        <CheckCircle className="w-4 h-4 text-green-700 flex-shrink-0" />
                      ) : (
                        <Ban className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                    </span>
                    {(contact.contact && (contact.contact.city || contact.contact.segment || contact.contact.bzEmpresa)) && (
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        {contact.contact.city ? `${contact.contact.city}` : ""}
                        {contact.contact.city && (contact.contact.segment || contact.contact.bzEmpresa) ? " • " : ""}
                        {contact.contact.segment ? `${contact.contact.segment}` : ""}
                        {contact.contact.segment && contact.contact.bzEmpresa ? " • " : ""}
                        {contact.contact.bzEmpresa ? `${contact.contact.bzEmpresa}` : ""}
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
                    <Tooltip {...CustomTooltipProps} title={contact?.contact?.id ? "Editar" : "Contato não vinculado"}>
                      <IconButton
                        size="small"
                        disabled={!contact?.contact?.id}
                        onClick={() => contact?.contact?.id && hadleEditContact(contact.contact.id)}
                        style={{ color: contact?.contact?.id ? "#2563eb" : "#9ca3af" }}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Can
                      role={user.profile}
                      perform="contacts-page:deleteContact"
                      yes={() => (
                        <Tooltip {...CustomTooltipProps} title="Excluir">
                          <IconButton
                            size="small"
                            onClick={() => { setConfirmOpen(true); setDeletingContact(contact); }}
                            style={{ color: "#dc2626" }}
                          >
                            <DeleteOutlineIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    />
                  </div>
                </div>
              ))}
                </div>
                {/* Paginação Mobile */}
                <nav className="flex items-center justify-between p-3 mt-2 w-full max-w-[375px] mx-auto" aria-label="Mobile navigation">
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                    Página <span className="font-semibold text-gray-900 dark:text-white">{pageNumber}</span>
                    {" "} de {" "}
                    <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
                    {" "} • {" "}
                    <span className="font-semibold text-gray-900 dark:text-white">{totalContacts}</span> itens
                  </span>
                  <div className="flex items-center gap-2">
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
                      {renderPageNumbers().map((page, index) => (
                        <li key={index}>
                          <button
                            onClick={() => handlePageChange(page)}
                            className={`flex items-center justify-center px-2 h-8 leading-tight border
                              ${page === pageNumber
                                  ? "text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
                                  : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                                }`}
                            disabled={page === "..."}
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
                  </div>
                </nav>
              </>
            )}
          </>
      }
        </div>
      </MainContainer>
    </div>
  );
};

export default ContactListItems;
