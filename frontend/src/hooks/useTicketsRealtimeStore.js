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

const sortTicketIds = (ids, ticketsById, sortDir) => {
  const direction = sortDir === "ASC" ? 1 : -1;

  return [...ids].sort((leftId, rightId) => {
    const left = ticketsById[leftId];
    const right = ticketsById[rightId];

    if (!left || !right) return 0;
    const leftDate = new Date(left.updatedAt).getTime();
    const rightDate = new Date(right.updatedAt).getTime();

    if (leftDate === rightDate) {
      return left.id > right.id ? direction : -direction;
    }

    return leftDate > rightDate ? direction : -direction;
  });
};

const mergeTicketsById = (current, tickets) => {
  const next = { ...current };
  tickets.forEach(ticket => {
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

    case "UPSERT_TICKET_FROM_SOCKET": {
      const ticketsById = {
        ...state.ticketsById,
        [action.ticket.id]: action.ticket,
      };

      const metaByStatus = { ...state.metaByStatus };

      ALL_STATUS_KEYS.forEach(statusKey => {
        const slice = metaByStatus[statusKey];
        const shouldInclude = Boolean(action.statusDecisions[statusKey]);
        const hadTicket = slice.ids.includes(action.ticket.id);
        let nextIds = slice.ids.filter(id => id !== action.ticket.id);
        let nextCount = slice.count;

        if (shouldInclude) {
          nextIds.unshift(action.ticket.id);
          if (!hadTicket && action.adjustCount) {
            nextCount += 1;
          }
        } else if (hadTicket && action.adjustCount) {
          nextCount = Math.max(0, nextCount - 1);
        }

        metaByStatus[statusKey] = {
          ...slice,
          ids: sortTicketIds(nextIds, ticketsById, action.sortDir),
          count: Math.max(nextCount, nextIds.length),
        };
      });

      return {
        ticketsById,
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

      Object.values(ticketsById).forEach(ticket => {
        if (ticket?.contactId === action.contact.id) {
          ticketsById[ticket.id] = {
            ...ticket,
            contact: {
              ...(ticket.contact || {}),
              ...action.contact,
            },
          };
        }
      });

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

      dispatch({
        type: "UPSERT_TICKET_FROM_SOCKET",
        ticket: data.ticket,
        sortDir: sortTicketsRef.current,
        statusDecisions: buildStatusDecisions(data.ticket),
        adjustCount: data.action === "create" || data.oldStatus !== data.ticket.status,
      });
    };

    const onCompanyAppMessage = (data) => {
      if (data.action !== "create" || !data.ticket) {
        return;
      }

      dispatch({
        type: "UPSERT_TICKET_FROM_SOCKET",
        ticket: data.ticket,
        sortDir: sortTicketsRef.current,
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
      socket.off("connect", joinConfiguredRooms);
      socket.off(`company-${user.companyId}-ticket`, onCompanyTicket);
      socket.off(`company-${user.companyId}-appMessage`, onCompanyAppMessage);
      socket.off(`company-${user.companyId}-contact`, onCompanyContact);
    };
  }, [socket, user?.companyId]);

  const ticketsByStatus = useMemo(() => {
    return ALL_STATUS_KEYS.reduce((acc, statusKey) => {
      acc[statusKey] = state.metaByStatus[statusKey].ids
        .map(id => state.ticketsById[id])
        .filter(Boolean);
      return acc;
    }, {});
  }, [state.metaByStatus, state.ticketsById]);

  return {
    ticketsByStatus,
    metaByStatus: state.metaByStatus,
    loadMore,
    refreshAll,
  };
};

export default useTicketsRealtimeStore;
