import React, {
    useState,
    useEffect,
    useReducer,
    useContext,
    useRef,
    useMemo,
    useCallback,
} from "react";
import useContactHandlers from "../../hooks/useContactHandlers";
import useContactPagination from "../../hooks/useContactPagination";
import useContactSort from "../../hooks/useContactSort";
import useDebounce from "../../hooks/useDebounce";
import { toast } from "react-toastify";
import { useHistory, useLocation } from "react-router-dom";
import useContactUpdates from "../../hooks/useContactUpdates";

import {
    Trash2,
    Edit,
    Lock,
    Unlock,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    FileUp,
    FileDown,
    UserPlus,
    SlidersHorizontal,
    X,
    Phone,
    CheckCircle,
    Ban,
    GitMerge,
} from "lucide-react";
import { Facebook, Instagram, WhatsApp, ImportExport, Backup, ContactPhone } from "@material-ui/icons";
import { Tooltip, Menu, MenuItem } from "@material-ui/core";
import api from "../../services/api";
import ContactAvatar from "../../components/ContactAvatar";
import ContactRow from "../../components/ContactRow";
import ContactCard from "../../components/ContactCard";
import LazyContactAvatar from "../../components/LazyContactAvatar";
// Removida virtualização mobile para manter um único scroll externo
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ContactModal from "../../components/ContactModal";
import ConfirmationModal from "../../components/ConfirmationModal";

import { i18n } from "../../translate/i18n";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import toastError from "../../errors/toastError";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Paper, Box, useMediaQuery, TextField, InputAdornment, Grid, IconButton, Button } from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";

import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import NewTicketModal from "../../components/NewTicketModal";
import PopupState, { bindTrigger, bindMenu } from "material-ui-popup-state";
import { FormatMask } from "../../utils/FormatMask";
import formatSerializedId, { safeFormatPhoneNumber } from '../../utils/formatSerializedId';
import { v4 as uuidv4 } from "uuid";
import LoadingOverlay from "../../components/LoadingOverlay";

import ContactImportWpModal from "../../components/ContactImportWpModal";
import ContactImportTagsModal from "../../components/ContactImportTagsModal";
import FilterContactModal from "../../components/FilterContactModal"; // NOVO IMPORT
import useCompanySettings from "../../hooks/useSettings/companySettings";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import BulkEditContactsModal from "../../components/BulkEditContactsModal";
import DuplicateContactsModal from "../../components/DuplicateContactsModal";

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
    filterChip: {
        display: "inline-flex",
        alignItems: "center",
        padding: theme.spacing(0.5, 1),
        margin: theme.spacing(0.25),
        backgroundColor: theme.palette.success.light,
        color: theme.palette.success.dark,
        borderRadius: theme.shape.borderRadius,
        fontSize: "0.75rem",
        border: `1px solid ${theme.palette.success.main}`,
    },
    mobileCardContainer: {
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(1),
        marginTop: theme.spacing(2),
    },
}));

const CustomTooltipProps = {
    arrow: true,
    enterTouchDelay: 0,
    leaveTouchDelay: 5000,
    enterDelay: 300,
    leaveDelay: 100,
};

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const reducer = (state, action) => {
    if (action.type === "SET_CONTACTS") {
        // Substitui completamente a lista de contatos (paginação por página)
        return [...action.payload];
    }
    if (action.type === "LOAD_CONTACTS") {
        const contacts = action.payload;
        const newContacts = [];

        contacts.forEach((contact) => {
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
        const contactIndex = state.findIndex((c) => c.id === contact.id);

        if (contactIndex !== -1) {
            state[contactIndex] = contact;
            return [...state];
        } else {
            // Não insere contatos que não estão na página/lista atual para evitar "subir para o topo"
            return state;
        }
    }

    if (action.type === "DELETE_CONTACT") {
        const contactId = action.payload;

        const contactIndex = state.findIndex((c) => c.id === contactId);
        if (contactIndex !== -1) {
            state.splice(contactIndex, 1);
        }
        return [...state];
    }

    if (action.type === "RESET") {
        return [];
    }
};

const Contacts = () => {
    const classes = useStyles();
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up(1200));
    const history = useHistory();
    const location = useLocation();

    const { user, socket } = useContext(AuthContext);

    // Hook de ordenação para contatos
    const {
        sortField,
        sortDirection,
        handleSort
    } = useContactSort('name', 'asc', user?.id);

    const [loading, setLoading] = useState(false);
    const [searchParam, setSearchParam] = useState("");
    const debouncedSearchParam = useDebounce(searchParam, 400);
    const isSearching = searchParam !== debouncedSearchParam;
    const [contacts, dispatch] = useReducer(reducer, []);
    const [refreshTick, setRefreshTick] = useState(0);
    const requestIdRef = useRef(0);
    const prevPageRef = useRef(null);
    const prevLimitRef = useRef(null);
    const [selectedContactId, setSelectedContactId] = useState(null);
    const [contactModalOpen, setContactModalOpen] = useState(false);
    const [filterContactModalOpen, setFilterContactModalOpen] = useState(false); // NOVO ESTADO PARA O MODAL DE FILTRO DE CONTATOS

    // Hook de paginação
    const {
        pageNumber,
        setPageNumber,
        contactsPerPage,
        setContactsPerPage,
        totalContacts,
        setTotalContacts,
        totalPages,
        handleChangePerPage,
        goToPage: handlePageChange,
        renderPageNumbers
    } = useContactPagination(25, user?.id);

    const [importContactModalOpen, setImportContactModalOpen] = useState(false);
    const [deletingContact, setDeletingContact] = useState(null);
    const [ImportContacts, setImportContacts] = useState(null);

    const [blockingContact, setBlockingContact] = useState(null);
    const [unBlockingContact, setUnBlockingContact] = useState(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [exportContact, setExportContact] = useState(false);
    const [confirmChatsOpen, setConfirmChatsOpen] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
    const [contactTicket, setContactTicket] = useState({});
    const fileUploadRef = useRef(null);
    const [appliedFilters, setAppliedFilters] = useState({}); // Novo estado para os filtros aplicados
    const [segmentFilter, setSegmentFilter] = useState([]); // array de segmentos vindos da URL
    const { setCurrentTicket } = useContext(TicketsContext);

    const [importWhatsappId, setImportWhatsappId] = useState()

    // NOVOS ESTADOS PARA SELEÇÃO E DELEÇÃO EM MASSA
    const [selectedContactIds, setSelectedContactIds] = useState([]); // Array de IDs dos contatos selecionados
    const [isSelectAllChecked, setIsSelectAllChecked] = useState(false); // Estado para o checkbox "Selecionar Tudo"
    const [confirmDeleteManyOpen, setConfirmDeleteManyOpen] = useState(false); // Estado para o modal de confirmação de deleção em massa
    const [bulkEditOpen, setBulkEditOpen] = useState(false); // Modal de edição em massa
    const [importTagsModalOpen, setImportTagsModalOpen] = useState(false); // Modal de importação com tags
    const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);

    const { getAll: getAllSettings } = useCompanySettings();
    const [hideNum, setHideNum] = useState(false);
    const [enableLGPD, setEnableLGPD] = useState(false);

    const currencyFormatter = useMemo(() => new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0
    }), []);

    const safeNumber = useCallback((value) => {
        if (value === null || value === undefined || value === "") return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }, []);

    const formatCurrency = useCallback((value) => {
        const num = safeNumber(value);
        if (num === null) return null;
        return currencyFormatter.format(num);
    }, [currencyFormatter, safeNumber]);

    const formatDate = useCallback((value) => {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return date.toLocaleDateString("pt-BR");
    }, []);

    const filtersSummary = useMemo(() => {
        if (!appliedFilters || Object.keys(appliedFilters).length === 0) return [];

        const items = [];

        const toArray = (value) => {
            if (Array.isArray(value)) {
                return value
                    .map((entry) => (entry == null ? "" : String(entry).trim()))
                    .filter(Boolean);
            }
            if (value === undefined || value === null) return [];
            const trimmed = String(value).trim();
            return trimmed ? [trimmed] : [];
        };

        const pushArray = (value, label) => {
            const arr = toArray(value);
            if (arr.length) {
                items.push({ label, value: arr.join(", ") });
            }
        };

        pushArray(appliedFilters.channel, "Canal");
        pushArray(appliedFilters.city, "Cidade");
        pushArray(appliedFilters.region, "Região");
        pushArray(appliedFilters.segment, "Segmento");
        pushArray(appliedFilters.situation, "Situação");
        pushArray(appliedFilters.representativeCode, "Representante");
        pushArray(appliedFilters.bzEmpresa, "Empresa");

        const foundation = Array.isArray(appliedFilters.foundationMonths)
            ? appliedFilters.foundationMonths
            : toArray(appliedFilters.foundationMonths);
        if (foundation.length) {
            const monthNames = foundation
                .map((m) => MONTH_LABELS[(Number(m) || 0) - 1])
                .filter(Boolean);
            if (monthNames.length) {
                items.push({ label: "Fundação", value: monthNames.join(", ") });
            }
        }

        const addRange = (min, max, label) => {
            const minVal = safeNumber(min);
            const maxVal = safeNumber(max);
            if (minVal === null && maxVal === null) return;

            let text = "";
            if (minVal !== null && maxVal !== null) {
                text = `${formatCurrency(minVal)} — ${formatCurrency(maxVal)}`;
            } else if (minVal !== null) {
                text = `≥ ${formatCurrency(minVal)}`;
            } else {
                text = `≤ ${formatCurrency(maxVal)}`;
            }
            items.push({ label, value: text });
        };

        addRange(appliedFilters.minCreditLimit, appliedFilters.maxCreditLimit, "Limite de Crédito");
        addRange(appliedFilters.minVlUltCompra, appliedFilters.maxVlUltCompra, "Última Compra");

        const startDate = formatDate(appliedFilters.dtUltCompraStart);
        const endDate = formatDate(appliedFilters.dtUltCompraEnd);
        if (startDate || endDate) {
            const rangeLabel = startDate && endDate
                ? `${startDate} — ${endDate}`
                : startDate
                    ? `A partir de ${startDate}`
                    : `Até ${endDate}`;
            items.push({ label: "Data da Última Compra", value: rangeLabel });
        }

        if (typeof appliedFilters.florder === "boolean") {
            items.push({ label: "Encomenda", value: appliedFilters.florder ? "Sim" : "Não" });
        }

        if (typeof appliedFilters.isWhatsappValid === "boolean" && appliedFilters.isWhatsappValid === false) {
            items.push({ label: "WhatsApp", value: "Somente Inválidos" });
        }

        return items;
    }, [appliedFilters, formatCurrency, formatDate, safeNumber]);

    const hasActiveFilters = filtersSummary.length > 0;

    const filterButtonClass = hasActiveFilters
        ? "shrink-0 w-10 h-10 flex items-center justify-center text-green-700 bg-green-50 dark:bg-green-900/30 border border-green-400 dark:border-green-500 rounded-lg hover:bg-green-100 dark:hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500"
        : "shrink-0 w-10 h-10 flex items-center justify-center text-gray-700 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500";

    const filterIconClass = hasActiveFilters ? "w-5 h-5 text-green-600" : "w-5 h-5";

    // Estados para seleção avançada
    const [lastSelectedIndex, setLastSelectedIndex] = useState(null); // Desktop: shift-select
    const [isSelectionMode, setIsSelectionMode] = useState(false); // Mobile: long-press
    const longPressTimerRef = useRef(null);

    // Handlers para interações com contatos
    const {
        handleEditContact,
        handleDeleteContact,
        handleShowDeleteConfirm,
        handleBlockContact,
        handleShowBlockConfirm,
        handleUnblockContact,
        handleShowUnblockConfirm,
        handleStartNewTicket
    } = useContactHandlers(
        setDeletingContact,
        setBlockingContact,
        setUnBlockingContact,
        setConfirmOpen,
        setRefreshTick,
        setContactTicket,
        setNewTicketModalOpen,
        setSelectedContactId,
        setContactModalOpen,
        setSearchParam,
        setPageNumber
    );
    // Hook de ordenação já foi importado no topo

    // Preferências de paginação já são gerenciadas pelo hook useContactPagination

    // Adaptador para manter compatibilidade com o componente atual
    const adaptedHandleChangePerPage = (e) => {
        const value = parseInt(e.target.value, 10) || 25;
        handleChangePerPage(value);
    };

    useEffect(() => {
        async function fetchData() {
            const settingList = await getAllSettings(user.companyId);
            for (const [key, value] of Object.entries(settingList)) {
                if (key === "enableLGPD") setEnableLGPD(value === "enabled");
                if (key === "lgpdHideNumber") setHideNum(value === "enabled");
            }
        }
        fetchData();
    }, []);

    const handleImportExcel = async () => {
        try {
            const formData = new FormData();
            formData.append("file", fileUploadRef.current.files[0]);
            await api.request({
                url: `/contacts/upload`,
                method: "POST",
                data: formData,
            });
            history.go(0);
        } catch (err) {
            toastError(err);
        }
    };

    useEffect(() => {
        dispatch({ type: "RESET" });
        setPageNumber(1);
        setSelectedContactIds([]); // Limpar seleção ao mudar filtro/pesquisa
        setIsSelectAllChecked(false); // Desmarcar "Selecionar Tudo"
    }, [searchParam, appliedFilters, segmentFilter]);

    // Lê 'segment' da URL e normaliza para array
    useEffect(() => {
        const params = new URLSearchParams(location.search || "");
        const norm = (v) => (typeof v === "string" ? v.trim() : v);
        let arr = [];

        // Prioriza múltiplos valores repetidos: ?segment=a&segment=b
        const repeated = params.getAll("segment");
        if (repeated && repeated.length > 1) {
            arr = repeated.map(norm).filter(Boolean);
        } else {
            // Suporta segment[]
            const bracketed = params.getAll("segment[]");
            if (bracketed && bracketed.length > 0) {
                arr = bracketed.map(norm).filter(Boolean);
            } else {
                // Único valor: pode ser JSON ou CSV
                const single = params.get("segment") || params.get("segment[]");
                if (single && typeof single === "string") {
                    const s = single.trim();
                    if (s.startsWith("[") && s.endsWith("]")) {
                        try {
                            const parsed = JSON.parse(s);
                            if (Array.isArray(parsed)) {
                                arr = parsed.map(norm).filter(Boolean);
                            }
                        } catch (_) { /* ignora */ }
                    } else if (s.includes(",")) {
                        arr = s.split(",").map((t) => t.trim()).filter(Boolean);
                    } else if (s) {
                        arr = [s];
                    }
                }
            }
        }

        setSegmentFilter(arr);
    }, [location.search]);

    useEffect(() => {
        // Só reseta a lista quando mudar de página ou de itens por página
        const shouldReset = prevPageRef.current !== pageNumber || prevLimitRef.current !== contactsPerPage;
        if (shouldReset) {
            dispatch({ type: "RESET" });
        }
        setLoading(true);
        // Garante que respostas antigas sejam ignoradas
        const currentId = ++requestIdRef.current;
        const fetchContacts = async () => {
            try {
                const { data } = await api.get("/contacts/", {
                    params: {
                        searchParam: debouncedSearchParam,
                        pageNumber,
                        limit: contactsPerPage,
                        isGroup: "false",
                        orderBy: sortField === 'tags' ? 'name' : sortField,
                        order: sortDirection,
                        segment: segmentFilter,
                        ...appliedFilters, // Inclui todos os filtros aplicados
                        contactTag: appliedFilters.tags ? JSON.stringify(appliedFilters.tags).replace(/\\/g, '\\\\') : undefined, // Tags precisam ser stringified e escapmente escapadas
                    },
                });
                // Ignora respostas de solicitações antigas
                if (currentId !== requestIdRef.current) return;
                // Substitui a lista pelo resultado da página atual
                dispatch({ type: "SET_CONTACTS", payload: data.contacts });
                setHasMore(data.hasMore);
                // Usa a contagem total fornecida pelo backend (já respeita filtros/pesquisa)
                setTotalContacts(data.count);

                // Atualizar o estado do "Selecionar Tudo" baseado nos contatos carregados e selecionados
                const allCurrentContactIds = data.contacts.map(c => c.id);
                const newSelected = selectedContactIds.filter(id => allCurrentContactIds.includes(id));
                setSelectedContactIds(newSelected); // Mantenha apenas os IDs que ainda estão na lista
                setIsSelectAllChecked(newSelected.length === allCurrentContactIds.length && allCurrentContactIds.length > 0);

            } catch (err) {
                toastError(err);
            } finally {
                if (currentId === requestIdRef.current) setLoading(false);
                // Atualiza refs de comparação após a busca
                prevPageRef.current = pageNumber;
                prevLimitRef.current = contactsPerPage;
            }
        };
        fetchContacts();
    }, [
        debouncedSearchParam,
        pageNumber,
        appliedFilters,
        contactsPerPage,
        sortField,
        sortDirection,
        segmentFilter,
        refreshTick,
    ]);

    // Hook para atualização em tempo real de avatares
    useContactUpdates((updatedContact) => {
        dispatch({ type: "UPDATE_CONTACTS", payload: updatedContact });
    });

    // Atualização silenciosa de avatares ao carregar a página
    useEffect(() => {
        const refreshAvatars = async () => {
            if (contacts.length > 0) {
                try {
                    const contactIds = contacts.map(c => c.id);
                    await api.post('/contacts/bulk-refresh-avatars', {
                        contactIds: contactIds.slice(0, 20) // Limita a 20 contatos por vez
                    });
                } catch (error) {
                    // Falha silenciosa - não mostra erro ao usuário
                    console.log('Falha na atualização silenciosa de avatares:', error);
                }
            }
        };

        // Executa após 2 segundos da página carregar
        const timer = setTimeout(refreshAvatars, 2000);
        return () => clearTimeout(timer);
    }, [contacts.length]); // Executa quando contatos são carregados

    useEffect(() => {
        const companyId = user.companyId;
        const onContactEvent = (data) => {
            if (data.action === "update" || data.action === "create") {
                dispatch({ type: "UPDATE_CONTACTS", payload: data.contact });
            }

            if (data.action === "delete") {
                const contactIdNum = Number(data.contactId);
                dispatch({ type: "DELETE_CONTACT", payload: contactIdNum });
                // Remover o contato deletado da lista de selecionados, se estiver lá
                setSelectedContactIds((prevSelected) =>
                    prevSelected.filter((id) => id !== contactIdNum)
                );
            }
        };
        socket.on(`company-${companyId}-contact`, onContactEvent);

        return () => {
            socket.off(`company-${companyId}-contact`, onContactEvent);
        };
    }, [socket]);

    const handleSelectTicket = (ticket) => {
        const code = uuidv4();
        const { id, uuid } = ticket;
        setCurrentTicket({ id, uuid, code });
    }

    const handleCloseOrOpenTicket = (ticket) => {
        setNewTicketModalOpen(false);
        if (ticket !== undefined && ticket.uuid !== undefined) {
            handleSelectTicket(ticket);
            history.push(`/tickets/${ticket.uuid}`);
        }
    };

    const handleApplyFiltersFromModal = (filters) => {
        setAppliedFilters(filters);
    };

    const handleClearFilters = () => {
        setAppliedFilters({});
        setFilterContactModalOpen(false);
    };

    const handleSearch = (event) => {
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

    const handleOpenFilterContactModal = () => { // NOVA FUNÇÃO
        setFilterContactModalOpen(true);
    };

    const handleCloseFilterContactModal = () => { // NOVA FUNÇÃO
        setFilterContactModalOpen(false);
    };

    // A lista já vem paginada e ordenada do backend (params: limit, pageNumber, orderBy, order).
    // Portanto, evitamos reordenar/repaginar no cliente para não misturar páginas.
    const sortedContacts = useMemo(() => {
        return contacts.filter(c => !c.isGroup);
    }, [contacts]);

    // Agora usando o handleEditContact do hook useContactHandlers

    // Agora usando o handleDeleteContact do hook useContactHandlers

    // NOVA FUNÇÃO: SELECIONAR UM CONTATO INDIVIDUALMENTE (memoizada)
    const handleToggleSelectContact = useCallback((contactId, rowIndex = null, evt = null) => {
        setSelectedContactIds((prevSelected) => {
            const hasShift = !!(evt && evt.shiftKey);
            // Shift-select (desktop)
            if (hasShift && lastSelectedIndex !== null && rowIndex !== null) {
                const start = Math.min(lastSelectedIndex, rowIndex);
                const end = Math.max(lastSelectedIndex, rowIndex);
                const rangeIds = sortedContacts.slice(start, end + 1).map(c => c.id);
                const setIds = new Set([...prevSelected, ...rangeIds]);
                if (isSelectAllChecked) setIsSelectAllChecked(false);
                return Array.from(setIds);
            }
            // Toggle simples
            const already = prevSelected.includes(contactId);
            const next = already ? prevSelected.filter(id => id !== contactId) : [...prevSelected, contactId];
            if (!already) setLastSelectedIndex(rowIndex);
            if (isSelectAllChecked && already) setIsSelectAllChecked(false);
            return next;
        });
        if (rowIndex !== null && !(evt && evt.shiftKey)) setLastSelectedIndex(rowIndex);
    }, [lastSelectedIndex, sortedContacts, isSelectAllChecked]);

    // Mobile: toque longo para entrar em modo seleção
    const handleCardLongPressStart = useCallback((contactId) => {
        setIsSelectionMode(true);
        setSelectedContactIds((prev) => prev.includes(contactId) ? prev : [...prev, contactId]);
    }, []);

    // Mobile: arrastar sobre cards para selecionar
    const handleCardDragSelect = useCallback((contactId) => {
        if (!isSelectionMode || !contactId) return;
        setSelectedContactIds((prev) => prev.includes(contactId) ? prev : [...prev, contactId]);
    }, [isSelectionMode]);

    const handleCardLongPressEnd = useCallback(() => {
        // Mantém o modo seleção ativo até o usuário limpar manualmente
    }, []);

    // Mobile: toque simples durante o modo seleção alterna o item
    const handleTapWhileSelection = useCallback((contactId) => {
        if (!isSelectionMode) return;
        setSelectedContactIds((prev) => (
            prev.includes(contactId)
                ? prev.filter(id => id !== contactId)
                : [...prev, contactId]
        ));
    }, [isSelectionMode]);

    // NOVA FUNÇÃO: SELECIONAR/DESSELECIONAR TODOS OS CONTATOS
    const handleSelectAllContacts = (event) => {
        const checked = event.target.checked;
        setIsSelectAllChecked(checked);

        if (checked) {
            // Seleciona todos os IDs dos contatos atualmente carregados
            const allContactIds = contacts.map((contact) => contact.id);
            setSelectedContactIds(allContactIds);
        } else {
            setSelectedContactIds([]);
        }
    };

    // NOVA FUNÇÃO: DELETAR CONTATOS SELECIONADOS EM MASSA
    const handleDeleteSelectedContacts = async () => {
        try {
            setLoading(true);
            await api.delete("/contacts/batch-delete", {
                data: { contactIds: selectedContactIds } // Envia os IDs no corpo da requisição DELETE
            });
            toast.success("Contatos selecionados deletados com sucesso!");
            setSelectedContactIds([]); // Limpa a seleção
            setIsSelectAllChecked(false); // Desmarca o "Selecionar Tudo"
            setConfirmDeleteManyOpen(false); // Fecha o modal de confirmação
            // Re-fetch os contatos para atualizar a lista, sem limpar visualmente
            setRefreshTick((t) => t + 1);
        } catch (err) {
            toastError(err);
        } finally {
            setLoading(false);
        }
    };


    // Agora usando o handleBlockContact e handleUnblockContact do hook useContactHandlers

    const onSave = (whatsappId) => {
        setImportWhatsappId(whatsappId)
    }

    const handleimportContact = async () => {
        setImportContactModalOpen(false)

        try {
            await api.post("/contacts/import", { whatsappId: importWhatsappId });
            history.go(0);
            setImportContactModalOpen(false);
        } catch (err) {
            toastError(err);
            setImportContactModalOpen(false);
        }
    };

    const handleimportChats = async () => {
        console.log("handleimportChats")
        try {
            await api.post("/contacts/import/chats");
            history.go(0);
        } catch (err) {
            toastError(err);
        }
    };

    const handleImportWithTags = async (tagMapping, whatsappId) => {
        try {
            // Chamar API para importar contatos com mapeamento de tags
            const resp = await api.post("/contacts/import-with-tags", { tagMapping, whatsappId });
            toast.success("Importação iniciada/concluída.");
            // NÃO recarrega a página aqui; o modal irá apresentar o relatório
            return resp;
        } catch (err) {
            toastError(err);
            throw err;
        }
    };

    const loadMore = () => {
        setPageNumber((prevState) => prevState + 1);
    };

    const modalElements = (
        <>
            <NewTicketModal
                modalOpen={newTicketModalOpen}
                initialContact={contactTicket}
                onClose={(ticket) => {
                    handleCloseOrOpenTicket(ticket);
                }}
            />

            <ContactModal
                open={contactModalOpen}
                onClose={handleCloseContactModal}
                aria-labelledby="form-dialog-title"
                contactId={selectedContactId}
            />

            <ContactImportWpModal
                isOpen={importContactModalOpen}
                handleClose={() => setImportContactModalOpen(false)}
                onSave={onSave}
                onConfirm={handleimportContact}
            />

            <ContactImportTagsModal
                isOpen={importTagsModalOpen}
                handleClose={() => setImportTagsModalOpen(false)}
                onImport={handleImportWithTags}
            />

            <FilterContactModal
                isOpen={filterContactModalOpen}
                onClose={handleCloseFilterContactModal}
                onFiltered={handleApplyFiltersFromModal}
                initialFilter={appliedFilters}
            />

            <BulkEditContactsModal
                open={bulkEditOpen}
                onClose={() => setBulkEditOpen(false)}
                selectedContactIds={selectedContactIds}
                onSuccess={() => setRefreshTick(prev => prev + 1)}
            />

            <DuplicateContactsModal
                open={duplicateModalOpen}
                onClose={() => setDuplicateModalOpen(false)}
                onActionCompleted={() => {
                    setRefreshTick(prev => prev + 1);
                    setDuplicateModalOpen(false);
                }}
            />
        </>
    );

    // Removido infinite scroll para manter paginação fixa por página

    const formatPhoneNumber = useCallback((number, isGroup = false) => {
        if (!number) return "";
        if (isGroup) return number;

        const cleaned = String(number).replace(/\D/g, "");
        if (!cleaned) return number;

        // Verifica se tem código do país (55 = Brasil)
        const hasCountryCode = cleaned.startsWith("55") && cleaned.length >= 12;
        
        if (hasCountryCode) {
            // Formato: +55 (14) 98125-2988
            // Remove o código do país (55)
            const withoutCountryCode = cleaned.substring(2);
            
            if (withoutCountryCode.length >= 10) {
                const ddd = withoutCountryCode.substring(0, 2);
                const phone = withoutCountryCode.substring(2);
                
                if (phone.length === 9) {
                    // Celular: 9 dígitos (ex: 98125-2988)
                    const prefix = phone.substring(0, 5);
                    const suffix = phone.substring(5);
                    return `+55 (${ddd}) ${prefix}-${suffix}`;
                } else if (phone.length === 8) {
                    // Fixo: 8 dígitos (ex: 1234-5678)
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

        // Fallback: usa a função original se não conseguir formatar
        const formatted = safeFormatPhoneNumber(number, false, isGroup);
        if (formatted && formatted !== number) {
            return formatted;
        }

        const mask = new FormatMask();
        return mask.setPhoneFormatMask(cleaned) || number;
    }, []);

    // Função de navegação já é fornecida pelo hook como handlePageChange

    // Calculação de páginas já é feita no hook useContactPagination

    // Agora usando o handleSort do hook useContactSort

    // Função renderPageNumbers já está disponibilizada pelo hook useContactPagination

    return (
        <Box className={classes.root}>
            <MainContainer useWindowScroll>
                <Box className={classes.container}>
                    <LoadingOverlay open={loading} message="Aguarde..." />
                    <NewTicketModal
                        modalOpen={newTicketModalOpen}
                        initialContact={contactTicket}
                        onClose={(ticket) => {
                            handleCloseOrOpenTicket(ticket);
                        }}
                    />
                    <ContactModal
                        open={contactModalOpen}
                        onClose={handleCloseContactModal}
                        aria-labelledby="form-dialog-title"
                        contactId={selectedContactId}
                    ></ContactModal>

                    <ContactImportWpModal
                        isOpen={importContactModalOpen}
                        handleClose={() => setImportContactModalOpen(false)}
                        onSave={onSave}
                        onConfirm={handleimportContact}
                    />
                    <ContactImportTagsModal
                        isOpen={importTagsModalOpen}
                        handleClose={() => setImportTagsModalOpen(false)}
                        onImport={handleImportWithTags}
                    />

                    {/* NOVO MODAL DE FILTRO DE CONTATOS */}
                    <FilterContactModal
                        isOpen={filterContactModalOpen}
                        onClose={handleCloseFilterContactModal}
                        onFiltered={handleApplyFiltersFromModal}
                        initialFilter={appliedFilters}
                    />

                    <ConfirmationModal
                        title={
                            deletingContact
                                ? `${i18n.t(
                                    "contacts.confirmationModal.deleteTitle"
                                )} ${deletingContact.name}?`
                                : blockingContact
                                    ? `Bloquear Contato ${blockingContact.name}?`
                                    : unBlockingContact
                                        ? `Desbloquear Contato ${unBlockingContact.name}?`
                                        : ImportContacts
                                            ? `${i18n.t("contacts.confirmationModal.importTitlte")}`
                                            : `${i18n.t("contactListItems.confirmationModal.importTitlte")}`
                        }
                        onSave={onSave}
                        isCellPhone={ImportContacts}
                        open={confirmOpen}
                        onClose={setConfirmOpen}
                        onConfirm={(e) =>
                            deletingContact
                                ? handleDeleteContact(deletingContact.id)
                                : blockingContact
                                    ? handleBlockContact(blockingContact.id)
                                    : unBlockingContact
                                        ? handleUnblockContact(unBlockingContact.id)
                                        : ImportContacts
                                            ? handleimportContact()
                                            : handleImportExcel()
                        }
                    >
                        {exportContact
                            ? `${i18n.t("contacts.confirmationModal.exportContact")}`
                            : deletingContact
                                ? `${i18n.t("contacts.confirmationModal.deleteMessage")}`
                                : blockingContact
                                    ? `${i18n.t("contacts.confirmationModal.blockContact")}`
                                    : unBlockingContact
                                        ? `${i18n.t("contacts.confirmationModal.unblockContact")}`
                                        : ImportContacts
                                            ? `Escolha de qual conexão deseja importar`
                                            : `${i18n.t("contactListItems.confirmationModal.importMessage")}`}
                    </ConfirmationModal>

                    {/* NOVO MODAL DE CONFIRMAÇÃO PARA DELEÇÃO EM MASSA */}
                    <ConfirmationModal
                        title={`Tem certeza que deseja deletar ${selectedContactIds.length} contatos selecionados?`}
                        open={confirmDeleteManyOpen}
                        onClose={() => setConfirmDeleteManyOpen(false)}
                        onConfirm={handleDeleteSelectedContacts}
                    >
                        Essa ação é irreversível.
                    </ConfirmationModal>

                    <ConfirmationModal
                        title={i18n.t("contacts.confirmationModal.importChat")}
                        open={confirmChatsOpen}
                        onClose={setConfirmChatsOpen}
                        onConfirm={(e) => handleimportChats()}
                    >
                        {i18n.t("contacts.confirmationModal.wantImport")}
                    </ConfirmationModal>

                    <BulkEditContactsModal
                        open={bulkEditOpen}
                        onClose={() => setBulkEditOpen(false)}
                        selectedContactIds={selectedContactIds}
                        onSuccess={() => setRefreshTick(prev => prev + 1)}
                    />

                    <DuplicateContactsModal
                        open={duplicateModalOpen}
                        onClose={() => setDuplicateModalOpen(false)}
                        onActionCompleted={() => {
                            setRefreshTick(prev => prev + 1);
                            setDuplicateModalOpen(false);
                        }}
                    />

                    {/* Cabeçalho */}
                    <MainHeader>
                        <Grid style={{ width: "99.6%" }} container>
                            <Grid xs={12} sm={5} item>
                                <Title>
                                    {i18n.t("contacts.title")} ({totalContacts})
                                </Title>
                            </Grid>
                            <Grid xs={12} sm={7} item>
                                <Grid container alignItems="center" spacing={2}>
                                    <Grid item xs>
                                        <TextField
                                            fullWidth
                                            placeholder="Buscar por nome, telefone, cidade, cnpj/cpf, cod. representante ou email..."
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
                            <Tooltip {...CustomTooltipProps} title="Filtrar Contatos">
                                <IconButton
                                    onClick={handleOpenFilterContactModal}
                                    size="small"
                                    style={{
                                        color: hasActiveFilters ? "#059669" : "#374151",
                                        backgroundColor: hasActiveFilters ? "#d1fae5" : "#ffffff",
                                        border: hasActiveFilters ? "1px solid #10b981" : "1px solid #d1d5db",
                                        borderRadius: "8px"
                                    }}
                                    aria-label="Filtrar Contatos"
                                >
                                    <SlidersHorizontal className="w-5 h-5" />
                                </IconButton>
                            </Tooltip>
                                            <PopupState variant="popover" popupId="contacts-import-export-menu">
                                    {(popupState) => (
                                        <>
                                            <Tooltip {...CustomTooltipProps} title="Importar/Exportar">
                                                <IconButton
                                                    size="small"
                                                    aria-label="Importar/Exportar"
                                                    {...bindTrigger(popupState)}
                                                    style={{ 
                                                        color: "#374151",
                                                        backgroundColor: "#ffffff",
                                                        border: "1px solid #d1d5db",
                                                        borderRadius: "8px"
                                                    }}
                                                >
                                                    <ImportExport fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Menu {...bindMenu(popupState)}>
                                                <MenuItem onClick={() => { setImportTagsModalOpen(true); popupState.close(); }}>
                                                    <ContactPhone fontSize="small" color="primary" style={{ marginRight: 10 }} />
                                                    Importar com Tags
                                                </MenuItem>
                                                <MenuItem onClick={() => { setImportContactModalOpen(true) }}>
                                                    <Backup fontSize="small" color="primary" style={{ marginRight: 10 }} />
                                                    {i18n.t("contacts.menu.importToExcel")}
                                                </MenuItem>
                                            </Menu>
                                        </>
                                    )}
                                </PopupState>
                                <Can
                                    role={user.profile}
                                    perform="contacts-page:deleteContact"
                                    yes={() => (
                                        selectedContactIds.length > 0 ? (
                                            <Tooltip {...CustomTooltipProps} title={`Deletar (${selectedContactIds.length})`}>
                                                {loading ? (
                                                    <span>
                                                        <IconButton
                                                            disabled
                                                            size="small"
                                                            style={{ 
                                                                color: "#ffffff",
                                                                backgroundColor: "#dc2626",
                                                                borderRadius: "8px"
                                                            }}
                                                            aria-label={`Deletar ${selectedContactIds.length} contato(s)`}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </IconButton>
                                                    </span>
                                                ) : (
                                                    <IconButton
                                                        onClick={() => setConfirmDeleteManyOpen(true)}
                                                        size="small"
                                                        style={{ 
                                                            color: "#ffffff",
                                                            backgroundColor: "#dc2626",
                                                            borderRadius: "8px"
                                                        }}
                                                        aria-label={`Deletar ${selectedContactIds.length} contato(s)`}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </IconButton>
                                                )}
                                            </Tooltip>
                                        ) : null
                                    )}
                                    no={() => null}
                                />
                                <Can
                                    role={user.profile}
                                    perform="contacts-page:bulkEdit"
                                    yes={() => (
                                        selectedContactIds.length > 0 ? (
                                            <Tooltip {...CustomTooltipProps} title={`Editar em massa (${selectedContactIds.length})`}>
                                                {loading ? (
                                                    <span>
                                                        <IconButton
                                                            disabled
                                                            size="small"
                                                            style={{ 
                                                                color: "#ffffff",
                                                                backgroundColor: "#ca8a04",
                                                                borderRadius: "8px"
                                                            }}
                                                            aria-label={`Editar em massa ${selectedContactIds.length} contato(s)`}
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </IconButton>
                                                    </span>
                                                ) : (
                                                    <IconButton
                                                        onClick={() => setBulkEditOpen(true)}
                                                        size="small"
                                                        style={{ 
                                                            color: "#ffffff",
                                                            backgroundColor: "#ca8a04",
                                                            borderRadius: "8px"
                                                        }}
                                                        aria-label={`Editar em massa ${selectedContactIds.length} contato(s)`}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </IconButton>
                                                )}
                                            </Tooltip>
                                        ) : null
                                    )}
                                    no={() => null}
                                />
                                {String(user?.profile || "").toLowerCase() === "admin" && (
                                    <Tooltip {...CustomTooltipProps} title="Deduplicar contatos">
                                        {loading ? (
                                            <span>
                                                <IconButton
                                                    disabled
                                                    size="small"
                                                    style={{ 
                                                        color: "#6366f1",
                                                        backgroundColor: "#ffffff",
                                                        border: "1px solid #6366f1",
                                                        borderRadius: "8px"
                                                    }}
                                                    aria-label="Gerenciar duplicados"
                                                >
                                                    <GitMerge className="w-5 h-5" />
                                                </IconButton>
                                            </span>
                                        ) : (
                                            <IconButton
                                                onClick={() => setDuplicateModalOpen(true)}
                                                size="small"
                                                style={{ 
                                                    color: "#6366f1",
                                                    backgroundColor: "#ffffff",
                                                    border: "1px solid #6366f1",
                                                    borderRadius: "8px"
                                                }}
                                                aria-label="Gerenciar duplicados"
                                            >
                                                <GitMerge className="w-5 h-5" />
                                            </IconButton>
                                        )}
                                    </Tooltip>
                                )}
                                <Button
                                    onClick={handleOpenContactModal}
                                    variant="contained"
                                    size="small"
                                    style={{ 
                                        backgroundColor: "#4ade80",
                                        color: "#ffffff",
                                        textTransform: "uppercase",
                                        fontWeight: 600,
                                        borderRadius: "8px"
                                    }}
                                    startIcon={<UserPlus className="w-4 h-4" />}
                                    aria-label="Novo Contato"
                                >
                                    {i18n.t("contactLists.buttons.add") || "Adicionar"}
                                </Button>
                            </div>
                                    </Grid>
                                </Grid>
                            </Grid>
                        </Grid>
                    </MainHeader>

                    {/* Filtros Ativos - Unificado (Responsivo) */}
                    {hasActiveFilters && filtersSummary.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300 mb-4">
                            <SlidersHorizontal className="w-4 h-4 text-green-600" />
                            {filtersSummary.map((item, index) => (
                                <span
                                    key={`${item.label}-${index}`}
                                    className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded dark:bg-green-900/20 dark:text-green-300 dark:border-green-700"
                                >
                                    <span className="font-semibold">{item.label}:</span> {item.value}
                                </span>
                            ))}
                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                            >
                                Limpar filtros
                            </button>
                        </div>
                    )}

                    {/* Lista de Contatos - Desktop (Tabela) */}
                    {isDesktop ? (
                        <Paper className={classes.mainPaper} variant="outlined">
                            <Box style={{ overflowX: "auto" }}>
                                <table className={classes.table}>
                                    <thead className={classes.tableHead}>
                                        <tr>
                                            <th scope="col" style={{ width: "48px", textAlign: "center" }}>
                                                <input type="checkbox"
                                                    checked={isSelectAllChecked}
                                                    onChange={handleSelectAllContacts}
                                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
                                            </th>
                                            <th scope="col" style={{ width: "300px" }}>
                                                <button 
                                                    onClick={() => handleSort('name')} 
                                                    className={classes.sortButton}
                                                >
                                                    NOME
                                                    <span className={classes.sortIcon}>
                                                        {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </button>
                                            </th>
                                            <th scope="col" style={{ width: "167px" }}>
                                                <button 
                                                    onClick={() => handleSort('number')} 
                                                    className={classes.sortButton}
                                                    style={{ width: "100%" }}
                                                >
                                                    WHATSAPP
                                                    <span className={classes.sortIcon}>
                                                        {sortField === 'number' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </button>
                                            </th>
                                            <th scope="col" className="hidden lg:table-cell" style={{ width: "140px" }}>
                                                <button 
                                                    onClick={() => handleSort('email')} 
                                                    className={classes.sortButton}
                                                >
                                                    EMAIL
                                                    <span className={classes.sortIcon}>
                                                        {sortField === 'email' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </button>
                                            </th>
                                            <th scope="col" style={{ width: "100px" }}>
                                                <button 
                                                    onClick={() => handleSort('city')} 
                                                    className={classes.sortButton}
                                                >
                                                    CIDADE/UF
                                                    <span className={classes.sortIcon}>
                                                        {sortField === 'city' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </button>
                                            </th>
                                            <th scope="col" style={{ textAlign: "center", width: "auto", minWidth: "80px", maxWidth: "200px" }}>
                                                <button 
                                                    onClick={() => handleSort('tags')} 
                                                    className={classes.sortButton}
                                                    style={{ width: "100%", justifyContent: "center" }}
                                                >
                                                    TAGS
                                                    <span className={classes.sortIcon}>
                                                        {sortField === 'tags' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </button>
                                            </th>
                                            <th scope="col" style={{ textAlign: "center", width: "80px" }}>
                                                <button 
                                                    onClick={() => handleSort('status')} 
                                                    className={classes.sortButton}
                                                    style={{ width: "100%", justifyContent: "center" }}
                                                >
                                                    STATUS
                                                    <span className={classes.sortIcon}>
                                                        {sortField === 'status' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                                                    </span>
                                                </button>
                                            </th>
                                            <th scope="col" style={{ textAlign: "center", width: "120px" }}>AÇÕES</th>
                                        </tr>
                                    </thead>
                                    <tbody className={classes.tableBody}>
                                        {!loading && sortedContacts.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className={classes.emptyState}>
                                                    Nenhum contato encontrado com os filtros selecionados. Tente ajustar os campos.
                                                </td>
                                            </tr>
                                        )}
                                        {sortedContacts.map((contact, rowIndex) => (
                                            <ContactRow
                                                key={contact.id}
                                                contact={contact}
                                                selectedContactIds={selectedContactIds}
                                                onToggleSelect={(id, _i, e) => handleToggleSelectContact(id, rowIndex, e)}
                                                onEdit={handleEditContact}
                                                onSendMessage={handleStartNewTicket}
                                                onDelete={handleShowDeleteConfirm}
                                                onBlock={handleShowBlockConfirm}
                                                onUnblock={handleShowUnblockConfirm}
                                                formatPhoneNumber={formatPhoneNumber}
                                                CustomTooltipProps={CustomTooltipProps}
                                                rowIndex={rowIndex}
                                            />
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
                                    <strong>{totalContacts}</strong> contatos
                                </span>
                                <Box className={classes.paginationControls}>
                                    <span style={{ fontSize: "0.875rem", marginRight: 8 }}>Itens por página:</span>
                                    <select
                                        value={contactsPerPage}
                                        onChange={(e) => {
                                            setContactsPerPage(Number(e.target.value));
                                            setPageNumber(1);
                                        }}
                                        style={{ fontSize: "0.875rem", padding: "4px 8px", border: "1px solid #E5E7EB", borderRadius: "4px" }}
                                    >
                                        <option value={5}>5</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                        <option value={500}>500</option>
                                        <option value={1000}>1000</option>
                                    </select>
                                </Box>
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
                                            className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <ChevronLeft className="w-5 h-5" />
                                        </button>
                                    </li>
                                    {renderPageNumbers().map((page, index) => (
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
                                            style={{ borderRadius: "0 4px 4px 0" }}
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
                        /* Lista de Contatos - Mobile (Cards) */
                        <>
                            <div className="flex flex-col gap-1.5 mt-3 w-full max-w-[375px] mx-auto">
                        {!loading && sortedContacts.length === 0 && (
                            <div className="text-center text-sm text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                Nenhum contato encontrado com os filtros selecionados. Tente ajustar os campos.
                            </div>
                        )}
                        {sortedContacts.map((contact) => (
                            <ContactCard
                                key={contact.id}
                                contact={contact}
                                onEdit={handleEditContact}
                                onSendMessage={handleStartNewTicket}
                                onDelete={handleShowDeleteConfirm}
                                onBlock={handleShowBlockConfirm}
                                onUnblock={handleShowUnblockConfirm}
                                formatPhoneNumber={formatPhoneNumber}
                                CustomTooltipProps={CustomTooltipProps}
                                isSelectionMode={isSelectionMode}
                                onLongPressStart={handleCardLongPressStart}
                                onDragSelect={handleCardDragSelect}
                                onLongPressEnd={handleCardLongPressEnd}
                                onTapWhileSelection={handleTapWhileSelection}
                                isSelected={selectedContactIds.includes(contact.id)}
                            />
                        ))}
                    </div>
                            {/* Paginação Mobile */}
                            <nav className="flex items-center justify-between p-3 mt-2 w-full max-w-[375px] mx-auto" aria-label="Mobile navigation">
                        <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                            Página <span className="font-semibold text-gray-900 dark:text-white">{pageNumber}</span>
                            {" "} de {" "}
                            <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
                            {" "} • {" "}
                            <span className="font-semibold text-gray-900 dark:text-white">{totalContacts}</span> contatos
                        </span>
                        <div className="flex items-center gap-2">
                            <select
                                value={contactsPerPage}
                                onChange={(e) => {
                                    setContactsPerPage(Number(e.target.value));
                                    setPageNumber(1);
                                }}
                                className="text-xs bg-gray-50 border border-gray-300 rounded-md p-1 dark:bg-gray-700 dark:border-gray-600"
                            >
                                <option value={5}>5</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
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
                </Box>
            </MainContainer>
        </Box>
    );
};

export default Contacts;
