import React, { useState, useEffect, useReducer, useContext, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import {
    Search,
    Users,
    MessageSquare,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    RefreshCw,
} from "lucide-react";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import useDebounce from "../../hooks/useDebounce";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ContactAvatar from "../../components/ContactAvatar";

const reducer = (state, action) => {
    if (action.type === "SET_GROUPS") {
        return [...action.payload];
    }
    if (action.type === "UPDATE_GROUP") {
        const group = action.payload;
        const idx = state.findIndex((g) => g.id === group.id);
        if (idx !== -1) {
            state[idx] = group;
            return [...state];
        }
        return [group, ...state];
    }
    if (action.type === "DELETE_GROUP") {
        return state.filter((g) => g.id !== action.payload);
    }
    if (action.type === "RESET") {
        return [];
    }
    return state;
};

const Groups = () => {
    const history = useHistory();
    const { user } = useContext(AuthContext);

    const [loading, setLoading] = useState(false);
    const [searchParam, setSearchParam] = useState("");
    const debouncedSearchParam = useDebounce(searchParam, 400);
    const [groups, dispatch] = useReducer(reducer, []);
    const [pageNumber, setPageNumber] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [totalGroups, setTotalGroups] = useState(0);
    const [groupsPerPage] = useState(20);
    const requestIdRef = useRef(0);

    // Buscar grupos
    useEffect(() => {
        setLoading(true);
        const currentId = ++requestIdRef.current;

        const fetchGroups = async () => {
            try {
                const { data } = await api.get("/contacts/", {
                    params: {
                        searchParam: debouncedSearchParam,
                        pageNumber,
                        limit: groupsPerPage,
                        isGroup: "true", // Filtrar apenas grupos
                    },
                });

                if (currentId !== requestIdRef.current) return;

                dispatch({ type: "SET_GROUPS", payload: data.contacts });
                setHasMore(data.hasMore);
                setTotalGroups(data.count);
            } catch (err) {
                toastError(err);
            } finally {
                if (currentId === requestIdRef.current) setLoading(false);
            }
        };

        fetchGroups();
    }, [debouncedSearchParam, pageNumber, groupsPerPage]);

    // Resetar página quando busca muda
    useEffect(() => {
        setPageNumber(1);
    }, [searchParam]);

    const handleSearch = (event) => {
        setSearchParam(event.target.value.toLowerCase());
    };

    const handleRefresh = () => {
        dispatch({ type: "RESET" });
        setPageNumber(1);
    };

    const handleOpenTicket = async (groupId) => {
        try {
            const { data: ticket } = await api.post("/tickets", {
                contactId: groupId,
                userId: user?.id,
                status: "open",
            });
            history.push(`/tickets/${ticket.uuid}`);
        } catch (err) {
            toastError(err);
        }
    };

    // Paginação
    const totalPages = Math.ceil(totalGroups / groupsPerPage);
    const handleFirstPage = () => setPageNumber(1);
    const handlePrevPage = () => setPageNumber((prev) => Math.max(prev - 1, 1));
    const handleNextPage = () => setPageNumber((prev) => Math.min(prev + 1, totalPages));
    const handleLastPage = () => setPageNumber(totalPages);

    return (
        <MainContainer>
            <Can
                role={user.profile}
                perform="contacts-page:view"
                yes={() => (
                    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 gap-4">
                            <div className="flex items-center gap-3">
                                <Users className="w-6 h-6 text-blue-600" />
                                <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
                                    Grupos do WhatsApp
                                </h1>
                                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                                    {totalGroups} grupos
                                </span>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                {/* Busca */}
                                <div className="relative flex-1 sm:w-64">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar grupos..."
                                        value={searchParam}
                                        onChange={handleSearch}
                                        className="w-full h-10 pl-10 pr-4 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                {/* Refresh */}
                                <button
                                    onClick={handleRefresh}
                                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    title="Atualizar lista"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Lista de Grupos */}
                        <div className="flex-1 overflow-auto p-4">
                            {loading ? (
                                <div className="space-y-2">
                                    {[...Array(5)].map((_, i) => (
                                        <TableRowSkeleton key={i} columns={3} />
                                    ))}
                                </div>
                            ) : groups.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                    <Users className="w-16 h-16 mb-4 text-gray-300" />
                                    <p className="text-lg font-medium">Nenhum grupo encontrado</p>
                                    <p className="text-sm">
                                        {searchParam
                                            ? "Tente uma busca diferente"
                                            : "Os grupos do WhatsApp aparecerão aqui"}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {groups.map((group) => (
                                        <div
                                            key={group.id}
                                            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
                                        >
                                            <div className="flex items-start gap-3">
                                                <ContactAvatar contact={group} size={48} />
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-medium text-gray-900 dark:text-white truncate">
                                                        {group.name || "Grupo sem nome"}
                                                    </h3>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                        {group.number}
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        Criado em:{" "}
                                                        {new Date(group.createdAt).toLocaleDateString("pt-BR")}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleOpenTicket(group.id)}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                >
                                                    <MessageSquare className="w-4 h-4" />
                                                    Abrir Conversa
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Paginação */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                    Página {pageNumber} de {totalPages} ({totalGroups} grupos)
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={handleFirstPage}
                                        disabled={pageNumber === 1}
                                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronsLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={handlePrevPage}
                                        disabled={pageNumber === 1}
                                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-lg">
                                        {pageNumber}
                                    </span>
                                    <button
                                        onClick={handleNextPage}
                                        disabled={pageNumber === totalPages}
                                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={handleLastPage}
                                        disabled={pageNumber === totalPages}
                                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronsRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                no={() => (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500">Você não tem permissão para visualizar grupos.</p>
                    </div>
                )}
            />
        </MainContainer>
    );
};

export default Groups;
