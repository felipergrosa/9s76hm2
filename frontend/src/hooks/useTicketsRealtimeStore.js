import { useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import api from "../services/api";
import { AuthContext } from "../context/Auth/AuthContext";

const ALL_STATUS_KEYS = ["open", "pending", "group", "bot", "campaign", "closed"];

const createSliceState = () => ({
  ids: [],
  loading: false,
  hasMore: false,
  count: 0,
  pageNumber: 1,
  initialized: false,
});

const createInitialState = () => ({
  ticketsById: {},
  metaByStatus: ALL_STATUS_KEYS.reduce((acc, key) => {
    acc[key] = createSliceState();
    return acc;
  }, {}),
});

const getTicketTimestamp = (ticket) => {
  if (ticket._updatedAtTimestamp) return ticket._updatedAtTimestamp;
  ticket._updatedAtTimestamp = new Date(ticket.updatedAt).getTime();
  return ticket._updatedAtTimestamp;
};

const sortTicketIds = (ids, ticketsById, sortDir) => {
  const direction = sortDir === "ASC" ? 1 : -1;

  return [...ids].sort((leftId, rightId) => {
    const left = ticketsById[leftId];
    const right = ticketsById[rightId];

    if (!left || !right) return 0;
    const leftTime = getTicketTimestamp(left);
    const rightTime = getTicketTimestamp(right);

    if (leftTime === rightTime) {
      return left.id > right.id ? direction : -direction;
    }

    return leftTime > rightTime ? direction : -direction;
  });
};

const mergeTicketsById = (current, tickets) => {
  const next = { ...current };
  tickets.forEach(ticket => {
    // Pré-calcula timestamp para evitar new Date() no sort
    ticket._updatedAtTimestamp = new Date(ticket.updatedAt).getTime();
    next[ticket.id] = ticket;
  });
  return next;
};

const reducer = (state, action) => {
  switch (action.type) {
    case "RESET_STATUS": {
      return {
        ...state,
        metaByStatus: {
          ...state.metaByStatus,
          [action.statusKey]: createSliceState(),
        },
      };
    }

    case "FETCH_START": {
      return {
        ...state,
        metaByStatus: {
          ...state.metaByStatus,
          [action.statusKey]: {
            ...state.metaByStatus[action.statusKey],
            loading: true,
          },
        },
      };
    }

    case "FETCH_SUCCESS": {
      const ticketsById = mergeTicketsById(state.ticketsById, action.tickets);
      const currentIds = action.append ? state.metaByStatus[action.statusKey].ids : [];
      const mergedIds = [...currentIds, ...action.tickets.map(ticket => ticket.id)];
      const uniqueIds = [...new Set(mergedIds)].filter(id => ticketsById[id]);

      return {
        ticketsById,
        metaByStatus: {
          ...state.metaByStatus,
          [action.statusKey]: {
            ids: sortTicketIds(uniqueIds, ticketsById, action.sortDir),
            loading: false,
            hasMore: action.hasMore,
            count: action.count,
            pageNumber: action.pageNumber,
            initialized: true,
          },
        },
      };
    }

    case "FETCH_ERROR": {
      return {
        ...state,
        metaByStatus: {
          ...state.metaByStatus,
          [action.statusKey]: {
            ...state.metaByStatus[action.statusKey],
            loading: false,
            initialized: true,
          },
        },
      };
    }

    case "BATCH_UPSERT_TICKETS": {
      const nextTicketsById = { ...state.ticketsById };
      const metaByStatus = { ...state.metaByStatus };
      const affectedStatusKeys = new Set();

      action.payload.forEach(({ ticket, statusDecisions, sortDir, adjustCount }) => {
        // Pré-calcula timestamp
        ticket._updatedAtTimestamp = new Date(ticket.updatedAt).getTime();
        nextTicketsById[ticket.id] = ticket;

        ALL_STATUS_KEYS.forEach(statusKey => {
          const slice = metaByStatus[statusKey];
          const shouldInclude = Boolean(statusDecisions[statusKey]);
          const hadTicket = slice.ids.includes(ticket.id);

          if (!shouldInclude && !hadTicket) return;

          affectedStatusKeys.add(statusKey);

          let nextIds = slice.ids.filter(id => id !== ticket.id);
          let nextCount = slice.count;

          if (shouldInclude) {
            nextIds.unshift(ticket.id);
            if (!hadTicket && adjustCount) {
              nextCount += 1;
            }
          } else if (hadTicket && adjustCount) {
            nextCount = Math.max(0, nextCount - 1);
          }

          metaByStatus[statusKey] = {
            ...slice,
            ids: nextIds, // Vamos ordenar fora do loop interno para performance
            count: Math.max(nextCount, nextIds.length),
          };
        });
      });

      // Ordena apenas as listas afetadas, uma vez por batch
      affectedStatusKeys.forEach(statusKey => {
        const slice = metaByStatus[statusKey];
        metaByStatus[statusKey] = {
          ...slice,
          ids: sortTicketIds(slice.ids, nextTicketsById, action.sortDir),
        };
      });

      return {
        ticketsById: nextTicketsById,
        metaByStatus,
      };
    }

    case "DELETE_TICKET_FROM_SOCKET": {
      const metaByStatus = { ...state.metaByStatus };

      ALL_STATUS_KEYS.forEach(statusKey => {
        const slice = metaByStatus[statusKey];
        const hadTicket = slice.ids.includes(action.ticketId);
        const nextIds = slice.ids.filter(id => id !== action.ticketId);

        metaByStatus[statusKey] = {
          ...slice,
          ids: nextIds,
          count: hadTicket ? Math.max(0, slice.count - 1) : slice.count,
        };
      });

      return {
        ...state,
        metaByStatus,
      };
    }

    case "RESET_UNREAD": {
      const ticket = state.ticketsById[action.ticketId];
      if (!ticket) {
        return state;
      }

      return {
        ...state,
        ticketsById: {
          ...state.ticketsById,
          [action.ticketId]: {
            ...ticket,
            unreadMessages: 0,
          },
        },
      };
    }

    case "UPDATE_CONTACT": {
      const ticketsById = { ...state.ticketsById };
      let changed = false;

      // Otimização: Só itera se o contato realmente estiver em algum ticket
      // Em uma versão futura, poderíamos ter um índice contactId -> ticketIds
      Object.keys(ticketsById).forEach(id => {
        const ticket = ticketsById[id];
        if (ticket?.contactId === action.contact.id) {
          ticketsById[id] = {
            ...ticket,
            contact: {
              ...(ticket.contact || {}),
              ...action.contact,
            },
          };
          changed = true;
        }
      });

      if (!changed) return state;

      return {
        ...state,
        ticketsById,
      };
    }

    default:
      return state;
  }
};

const canViewTicket = ({ ticket, user, showAll }) => {
  // 1. Filtro de Conexões (replicando backend: SuperAdmin vê tudo, outros respeitam allowedConnectionIds)
  if (!user?.super) {
    const allowedConnectionIds = user?.allowedConnectionIds || [];
    if (allowedConnectionIds.length > 0 && ticket?.whatsappId) {
      if (!allowedConnectionIds.includes(ticket.whatsappId)) {
        return false;
      }
    }
  }

  const isBeingAttended = (ticket?.status === "open" || ticket?.status === "group") && ticket?.userId;

  if (isBeingAttended) {
    if (showAll && (user?.profile === "admin" || user?.super)) return true;
    return ticket?.userId === user?.id;
  }

  if (user?.profile === "admin" && (!user?.allowedContactTags || user?.allowedContactTags?.length === 0)) {
    return true;
  }

  if (showAll) return true;
  if (!user?.allowedContactTags || user?.allowedContactTags?.length === 0) return true;

  const contactTags = ticket?.contact?.tags || [];
  if (contactTags.length === 0) return true;

  const userTagIds = user?.allowedContactTags || [];
  return contactTags.some(tag => userTagIds.includes(tag.id));
};

const shouldIncludeTicketInStatus = ({
  ticket,
  statusKey,
  statusConfigs,
  selectedQueueIds,
  showTicketWithoutQueue,
  user,
}) => {
  const config = statusConfigs[statusKey];
  if (!config?.enabled) return false;
  if (ticket?.status !== (config.status || statusKey)) return false;
  if (!canViewTicket({ ticket, user, showAll: config.showAll })) return false;
  if (ticket?.userId && ticket.userId === user?.id) return true;

  return (!ticket?.queueId && showTicketWithoutQueue) || selectedQueueIds.includes(ticket?.queueId);
};

const buildRequestParams = ({ status, selectedQueueIds, showAll, sortTickets }) => ({
  pageNumber: 1,
  status,
  showAll: showAll ? "true" : "false",
  queueIds: JSON.stringify(selectedQueueIds),
  sortTickets,
});

const useTicketsRealtimeStore = ({
  statusConfigs,
  selectedQueueIds,
  sortTickets,
  showTicketWithoutQueue,
}) => {
  const { user, socket } = useContext(AuthContext);
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const requestVersionRef = useRef(0);
  const mountedRef = useRef(true);

  const statusConfigsRef = useRef(statusConfigs);
  const selectedQueueIdsRef = useRef(selectedQueueIds);
  const sortTicketsRef = useRef(sortTickets);
  const userRef = useRef(user);
  const showTicketWithoutQueueRef = useRef(showTicketWithoutQueue);
  const eventBufferRef = useRef([]);
  const bufferTimeoutRef = useRef(null);

  const flushBuffer = useCallback(() => {
    if (eventBufferRef.current.length === 0) return;

    const buffer = eventBufferRef.current;
    eventBufferRef.current = [];
    bufferTimeoutRef.current = null;

    dispatch({
      type: "BATCH_UPSERT_TICKETS",
      payload: buffer,
      sortDir: sortTicketsRef.current,
    });
  }, []);

  const addToBuffer = useCallback((item) => {
    // De-duplicar: se o mesmo ticket já está no buffer, remove o antigo
    eventBufferRef.current = eventBufferRef.current.filter(i => i.ticket.id !== item.ticket.id);
    eventBufferRef.current.push(item);

    if (!bufferTimeoutRef.current) {
      bufferTimeoutRef.current = setTimeout(flushBuffer, 250);
    }
  }, [flushBuffer]);

  useEffect(() => {
    statusConfigsRef.current = statusConfigs;
    selectedQueueIdsRef.current = selectedQueueIds;
    sortTicketsRef.current = sortTickets;
    userRef.current = user;
    showTicketWithoutQueueRef.current = showTicketWithoutQueue;
  }, [selectedQueueIds, showTicketWithoutQueue, sortTickets, statusConfigs, user]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const enabledStatusKeys = useMemo(
    () => ALL_STATUS_KEYS.filter(statusKey => statusConfigs[statusKey]?.enabled),
    [statusConfigs]
  );

  const enabledStatusKeysRef = useRef(enabledStatusKeys);
  useEffect(() => {
    enabledStatusKeysRef.current = enabledStatusKeys;
  }, [enabledStatusKeys]);

  const fetchStatusPage = useCallback(async (statusKey, pageNumber = 1, append = false, versionOverride = null) => {
    const config = statusConfigsRef.current[statusKey];
    if (!config?.enabled) return;

    dispatch({ type: "FETCH_START", statusKey });

    try {
      const { data } = await api.get("/tickets", {
        params: {
          ...buildRequestParams({
            status: config.status || statusKey,
            selectedQueueIds: selectedQueueIdsRef.current,
            showAll: config.showAll,
            sortTickets: sortTicketsRef.current,
          }),
          pageNumber,
        },
      });

      const currentVersion = versionOverride ?? requestVersionRef.current;
      if (!mountedRef.current || currentVersion !== requestVersionRef.current) {
        return;
      }

      dispatch({
        type: "FETCH_SUCCESS",
        statusKey,
        tickets: data.tickets || [],
        count: data.count || 0,
        hasMore: data.hasMore || false,
        pageNumber,
        append,
        sortDir: sortTicketsRef.current,
      });
    } catch (error) {
      if (!mountedRef.current) return;

      console.error(`[useTicketsRealtimeStore] Erro ao carregar tickets de ${statusKey}:`, error);
      dispatch({ type: "FETCH_ERROR", statusKey });
    }
  }, []);

  const refreshAll = useCallback(() => {
    requestVersionRef.current += 1;
    const version = requestVersionRef.current;

    enabledStatusKeys.forEach(statusKey => {
      dispatch({ type: "RESET_STATUS", statusKey });
    });

    enabledStatusKeys.forEach(statusKey => {
      fetchStatusPage(statusKey, 1, false, version);
    });
  }, [enabledStatusKeys, fetchStatusPage]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const loadMore = useCallback((statusKey) => {
    const slice = state.metaByStatus[statusKey];
    if (!slice || slice.loading || !slice.hasMore) {
      return;
    }

    fetchStatusPage(statusKey, slice.pageNumber + 1, true, requestVersionRef.current);
  }, [fetchStatusPage, state.metaByStatus]);

  useEffect(() => {
    if (!socket || typeof socket.on !== "function" || !user?.companyId) {
      return;
    }

    const joinConfiguredRooms = () => {
      enabledStatusKeysRef.current.forEach(statusKey => {
        const config = statusConfigsRef.current[statusKey];
        if (config?.enabled) {
          socket.emit("joinTickets", config.status || statusKey);
        }
      });
    };

    const leaveConfiguredRooms = () => {
      enabledStatusKeysRef.current.forEach(statusKey => {
        const config = statusConfigsRef.current[statusKey];
        if (config?.enabled) {
          socket.emit("joinTicketsLeave", config.status || statusKey);
        }
      });
    };

    const buildStatusDecisions = (ticket) => {
      const decisions = {};
      ALL_STATUS_KEYS.forEach(statusKey => {
        decisions[statusKey] = shouldIncludeTicketInStatus({
          ticket,
          statusKey,
          statusConfigs: statusConfigsRef.current,
          selectedQueueIds: selectedQueueIdsRef.current,
          showTicketWithoutQueue: showTicketWithoutQueueRef.current,
          user: userRef.current,
        });
      });
      return decisions;
    };

    const onCompanyTicket = (data) => {
      if (data.action === "updateUnread") {
        dispatch({ type: "RESET_UNREAD", ticketId: data.ticketId });
        return;
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_TICKET_FROM_SOCKET", ticketId: data.ticketId });
        return;
      }

      if (!data.ticket) {
        return;
      }

      // Em vez de dispatch imediato, adiciona ao buffer
      addToBuffer({
        ticket: data.ticket,
        statusDecisions: buildStatusDecisions(data.ticket),
        adjustCount: data.action === "create" || data.oldStatus !== data.ticket.status,
      });
    };

    const onCompanyAppMessage = (data) => {
      if (data.action !== "create" || !data.ticket) {
        return;
      }

      addToBuffer({
        ticket: data.ticket,
        statusDecisions: buildStatusDecisions(data.ticket),
        adjustCount: false,
      });
    };

    const onCompanyContact = (data) => {
      if (data.action === "update" && data.contact) {
        dispatch({ type: "UPDATE_CONTACT", contact: data.contact });
      }
    };

    socket.on("connect", joinConfiguredRooms);
    socket.on(`company-${user.companyId}-ticket`, onCompanyTicket);
    socket.on(`company-${user.companyId}-appMessage`, onCompanyAppMessage);
    socket.on(`company-${user.companyId}-contact`, onCompanyContact);

    if (socket.connected) {
      joinConfiguredRooms();
    }

    return () => {
      leaveConfiguredRooms();
      if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
      socket.off("connect", joinConfiguredRooms);
      socket.off(`company-${user.companyId}-ticket`, onCompanyTicket);
      socket.off(`company-${user.companyId}-appMessage`, onCompanyAppMessage);
      socket.off(`company-${user.companyId}-contact`, onCompanyContact);
    };
  }, [socket, user?.companyId]);

  const lastTicketsByStatusRef = useRef({});
  const lastMetaByStatusRef = useRef({});
  const lastTicketsByIdRef = useRef({});

  const ticketsByStatus = useMemo(() => {
    const next = {};
    let anyChanged = false;

    ALL_STATUS_KEYS.forEach(statusKey => {
      const slice = state.metaByStatus[statusKey];
      const prevSlice = lastMetaByStatusRef.current[statusKey];
      const prevList = lastTicketsByStatusRef.current[statusKey];

      // Se IDs mudaram ou se algum ticket nesta lista mudou no ticketsById
      // (Podemos simplificar: se ticketsById mudou, verificamos se os IDs deste status apontam para novos objetos)
      const idsChanged = slice.ids !== prevSlice?.ids;
      let ticketsChanged = idsChanged;

      if (!ticketsChanged && state.ticketsById !== lastTicketsByIdRef.current) {
        // Verifica se algum ticket do status atual foi atualizado (referência mudou)
        ticketsChanged = slice.ids.some(id => state.ticketsById[id] !== lastTicketsByIdRef.current[id]);
      }

      if (ticketsChanged || !prevList) {
        next[statusKey] = slice.ids.map(id => state.ticketsById[id]).filter(Boolean);
        anyChanged = true;
      } else {
        next[statusKey] = prevList;
      }
    });

    if (anyChanged) {
      lastTicketsByStatusRef.current = next;
      lastMetaByStatusRef.current = state.metaByStatus;
      lastTicketsByIdRef.current = state.ticketsById;
      return next;
    }
    return lastTicketsByStatusRef.current;
  }, [state.metaByStatus, state.ticketsById]);

  return {
    ticketsByStatus,
    metaByStatus: state.metaByStatus,
    loadMore,
    refreshAll,
  };
};

export default useTicketsRealtimeStore;
