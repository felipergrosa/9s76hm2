import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import toastError from "../../errors/toastError";
import { format, sub } from 'date-fns'
import api from "../../services/api";

/**
 * Hook otimizado para buscar tickets
 * Mudanças: 
 * - Memoização de params para evitar re-fetches desnecessários
 * - AbortController para cancelar requests pendentes
 * - Debounce aumentado para 800ms
 * - Cleanup adequado
 */
const useTickets = ({
  searchParam,
  tags,
  users,
  pageNumber,
  status,
  date,
  updatedAt,
  showAll,
  queueIds,
  withUnreadMessages,
  whatsappIds,
  statusFilter,
  forceSearch,
  userFilter,
  sortTickets,
  searchOnMessages
}) => {
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [count, setCount] = useState(0);

  // Ref para controlar requests em andamento
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  // Memoizar params para evitar referências diferentes a cada render
  const paramsKey = useMemo(() => {
    return JSON.stringify({
      searchParam,
      tags,
      users,
      pageNumber,
      status,
      date,
      updatedAt,
      showAll,
      queueIds,
      withUnreadMessages,
      whatsappIds,
      statusFilter,
      forceSearch,
      sortTickets,
      searchOnMessages,
      userFilter
    });
  }, [
    searchParam, tags, users, pageNumber, status, date, updatedAt,
    showAll, queueIds, withUnreadMessages, whatsappIds, statusFilter,
    forceSearch, sortTickets, searchOnMessages, userFilter
  ]);

  const fetchTickets = useCallback(async () => {
    // Cancelar request anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Criar novo controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);

    try {
      const params = JSON.parse(paramsKey);

      if (params.userFilter === undefined || params.userFilter === null) {
        const { data } = await api.get("/tickets", {
          params: {
            searchParam: params.searchParam,
            pageNumber: params.pageNumber,
            tags: params.tags,
            users: params.users,
            status: params.status,
            date: params.date,
            updatedAt: params.updatedAt,
            showAll: params.showAll,
            queueIds: params.queueIds,
            withUnreadMessages: params.withUnreadMessages,
            whatsapps: params.whatsappIds,
            statusFilter: params.statusFilter,
            sortTickets: params.sortTickets,
            searchOnMessages: params.searchOnMessages
          },
          signal
        });

        if (isMountedRef.current) {
          setTickets(data.tickets || []);
          setHasMore(data.hasMore || false);
          setCount(data.count || 0);
        }
      } else {
        const { data } = await api.get("/dashboard/moments", {
          params: {
            status: params.status,
            showAll: params.showAll,
            queueIds: params.queueIds,
            dateStart: format(sub(new Date(), { days: 30 }), 'yyyy-MM-dd'),
            dateEnd: format(new Date(), 'yyyy-MM-dd'),
            userId: params.userFilter
          },
          signal
        });

        if (isMountedRef.current) {
          const filteredTickets = (data || []).filter(item => item.userId == params.userFilter);
          setTickets(filteredTickets);
          setHasMore(false);
          setCount(filteredTickets.length);
        }
      }
    } catch (err) {
      // Ignorar erros de abort (cancelamento)
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return;
      }
      if (isMountedRef.current) {
        toastError(err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [paramsKey]);

  useEffect(() => {
    isMountedRef.current = true;

    // Debounce aumentado para 800ms (era 500ms)
    const delayDebounceFn = setTimeout(fetchTickets, 800);

    return () => {
      isMountedRef.current = false;
      clearTimeout(delayDebounceFn);

      // Cancelar request pendente ao desmontar
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchTickets]);

  return { tickets, loading, hasMore, count };
};

export default useTickets;
