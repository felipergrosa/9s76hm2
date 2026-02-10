import React, { useState, useEffect, useReducer, useContext, useMemo, useRef } from "react";

import { makeStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import Paper from "@material-ui/core/Paper";

import TicketListItem from "../TicketListItemCustom";
import TicketsListSkeleton from "../TicketsListSkeleton";

import useTickets from "../../hooks/useTickets";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
    ticketsListWrapper: {
        position: "relative",
        display: "flex",
        height: "100%",
        flexDirection: "column",
        overflow: "hidden",
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
    },

    ticketsList: {
        flex: 1,
        maxHeight: "100%",
        overflowY: "scroll",
        ...theme.scrollbarStyles,
        borderTop: "1px solid rgba(0, 0, 0, 0.05)",
    },

    ticketsListHeader: {
        color: "rgb(67, 83, 105)",
        zIndex: 2,
        backgroundColor: "white",
        borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },

    ticketsCount: {
        fontWeight: "normal",
        color: "rgb(104, 121, 146)",
        marginLeft: "8px",
        fontSize: "14px",
    },

    noTicketsText: {
        textAlign: "center",
        color: "rgb(104, 121, 146)",
        fontSize: "14px",
        lineHeight: "1.4",
    },

    noTicketsTitle: {
        textAlign: "center",
        fontSize: "16px",
        fontWeight: "600",
        margin: "0px",
    },

    noTicketsDiv: {
        display: "flex",
        // height: "190px",
        margin: 40,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
    },
}));

const ticketSortAsc = (a, b) => {

    if (a.updatedAt < b.updatedAt) {
        return -1;
    }
    if (a.updatedAt > b.updatedAt) {
        return 1;
    }
    return 0;
}

const ticketSortDesc = (a, b) => {

    if (a.updatedAt > b.updatedAt) {
        return -1;
    }
    if (a.updatedAt < b.updatedAt) {
        return 1;
    }
    return 0;
}

const reducer = (state, action) => {
    console.log(`[Reducer DEBUG] action=${action.type} status=${action.status || ''} payloadCount=${Array.isArray(action.payload) ? action.payload.length : (action.payload?.id || action.payload)} stateCount=${state.length}`);
    const sortDir = action.sortDir;

    if (action.type === "LOAD_TICKETS") {
        const newTickets = action.payload;
        // BUG-24 fix: Trabalhar sobre cópia para evitar mutação direta do state
        let nextState = [...state];

        newTickets.forEach((ticket) => {
            const ticketIndex = nextState.findIndex((t) => t.id === ticket.id);
            if (ticketIndex !== -1) {
                nextState[ticketIndex] = ticket;
                if (ticket.unreadMessages > 0) {
                    const [moved] = nextState.splice(ticketIndex, 1);
                    nextState.unshift(moved);
                }
            } else {
                nextState.push(ticket);
            }
        });
        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            nextState.sort(sortDir === 'ASC' ? ticketSortAsc : ticketSortDesc);
        }

        return nextState;
    }

    if (action.type === "RESET_UNREAD") {
        const ticketId = action.payload;
        let nextState = [...state];

        const ticketIndex = nextState.findIndex((t) => t.id === ticketId);
        if (ticketIndex !== -1) {
            nextState[ticketIndex] = { ...nextState[ticketIndex], unreadMessages: 0 };
        }

        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            nextState.sort(sortDir === 'ASC' ? ticketSortAsc : ticketSortDesc);
        }

        return nextState;
    }

    if (action.type === "UPDATE_TICKET") {
        const ticket = action.payload;
        let nextState = [...state];

        const ticketIndex = nextState.findIndex((t) => t.id === ticket.id);
        if (ticketIndex !== -1) {
            nextState[ticketIndex] = ticket;
        } else {
            nextState.unshift(ticket);
        }
        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            nextState.sort(sortDir === 'ASC' ? ticketSortAsc : ticketSortDesc);
        }

        return nextState;
    }

    if (action.type === "UPDATE_TICKET_UNREAD_MESSAGES") {
        const ticket = action.payload;
        let nextState = [...state];

        const ticketIndex = nextState.findIndex((t) => t.id === ticket.id);
        if (ticketIndex !== -1) {
            nextState[ticketIndex] = ticket;
            const [moved] = nextState.splice(ticketIndex, 1);
            nextState.unshift(moved);
        } else {
            if (action.status === action.payload.status) {
                nextState.unshift(ticket);
            }
        }
        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            nextState.sort(sortDir === 'ASC' ? ticketSortAsc : ticketSortDesc);
        }

        return nextState;
    }

    if (action.type === "UPDATE_TICKET_CONTACT") {
        const contact = action.payload;
        let nextState = [...state];
        const ticketIndex = nextState.findIndex((t) => t.contactId === contact.id);
        if (ticketIndex !== -1) {
            nextState[ticketIndex] = { ...nextState[ticketIndex], contact };
        }
        return nextState;
    }

    if (action.type === "DELETE_TICKET") {
        const ticketId = action.payload;
        let nextState = state.filter((t) => t.id !== ticketId);

        if (sortDir && ['ASC', 'DESC'].includes(sortDir)) {
            nextState.sort(sortDir === 'ASC' ? ticketSortAsc : ticketSortDesc);
        }

        return nextState;
    }

    if (action.type === "RESET") {
        return [];
    }
};

const TicketsListCustom = (props) => {
    const {
        setTabOpen,
        status,
        searchParam,
        searchOnMessages,
        tags,
        users,
        showAll,
        selectedQueueIds,
        updateCount,
        style,
        whatsappIds,
        forceSearch,
        statusFilter,
        userFilter,
        sortTickets
    } = props;

    const classes = useStyles();
    const [pageNumber, setPageNumber] = useState(1);
    let [ticketsList, dispatch] = useReducer(reducer, []);
    //   const socketManager = useContext(SocketContext);
    const { user, socket } = useContext(AuthContext);

    const { profile, queues } = user;
    const showTicketWithoutQueue = user.allTicket === 'enable';
    const companyId = user.companyId;

    // Refs para valores mutáveis - evita stale closures nos handlers de socket
    const userRef = useRef(user);
    const selectedQueueIdsRef = useRef(selectedQueueIds);
    const showAllRef = useRef(showAll);
    const showTicketWithoutQueueRef = useRef(showTicketWithoutQueue);
    const sortTicketsRef = useRef(sortTickets);
    useEffect(() => {
        userRef.current = user;
        selectedQueueIdsRef.current = selectedQueueIds;
        showAllRef.current = showAll;
        showTicketWithoutQueueRef.current = showTicketWithoutQueue;
        sortTicketsRef.current = sortTickets;
    });

    // Serializar deps instáveis para evitar RESET desnecessário
    const tagsKey = JSON.stringify(tags);
    const usersKey = JSON.stringify(users);
    const queueIdsKey = JSON.stringify(selectedQueueIds);
    const whatsappIdsKey = JSON.stringify(whatsappIds);
    const statusFilterKey = JSON.stringify(statusFilter);

    useEffect(() => {
        dispatch({ type: "RESET" });
        setPageNumber(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, searchParam, dispatch, showAll, tagsKey, usersKey, forceSearch, queueIdsKey, whatsappIdsKey, statusFilterKey, sortTickets, searchOnMessages]);

    const { tickets, hasMore, loading } = useTickets({
        pageNumber,
        searchParam,
        status,
        showAll,
        searchOnMessages: searchOnMessages ? "true" : "false",
        tags: JSON.stringify(tags),
        users: JSON.stringify(users),
        queueIds: JSON.stringify(selectedQueueIds),
        whatsappIds: JSON.stringify(whatsappIds),
        statusFilter: JSON.stringify(statusFilter),
        userFilter,
        sortTickets
    });


    useEffect(() => {
        // const queueIds = queues.map((q) => q.id);
        // const filteredTickets = tickets.filter(
        //     (t) => queueIds.indexOf(t.queueId) > -1
        // );
        // const allticket = user.allTicket === 'enabled';
        // if (profile === "admin" || allTicket || allowGroup || allHistoric) {
        if (companyId) {
            dispatch({
                type: "LOAD_TICKETS",
                payload: tickets,
                status,
                sortDir: sortTickets
            });
        }
        // } else {
        //  dispatch({ type: "LOAD_TICKETS", payload: filteredTickets });
        // }

    }, [tickets]);

    useEffect(() => {
        if (!socket || typeof socket.on !== "function") return;
        if (!companyId) return;

        // Funções de filtro usando refs para valores atuais (evita stale closures)
        const canViewTicket = (ticket) => {
            const _user = userRef.current;
            const _showAll = showAllRef.current;
            const isBeingAttended = (ticket?.status === "open" || ticket?.status === "group") && ticket?.userId;

            if (isBeingAttended) {
                // Admin com showAll pode ver todos os tickets em atendimento
                if (_showAll && (_user?.profile === 'admin' || _user?.super)) return true;
                return ticket?.userId === _user?.id;
            }

            if (_user?.profile === 'admin' && (!_user?.allowedContactTags || _user?.allowedContactTags?.length === 0)) {
                return true;
            }
            if (_showAll) return true;
            if (!_user?.allowedContactTags || _user?.allowedContactTags?.length === 0) return true;

            const contactTags = ticket?.contact?.tags || [];
            if (contactTags.length === 0) return true;

            const userTagIds = _user?.allowedContactTags || [];
            return contactTags.some(tag => userTagIds.includes(tag.id));
        };

        const shouldUpdateTicket = (ticket) => {
            if (!canViewTicket(ticket)) return false;
            const _user = userRef.current;
            // Tickets atribuídos diretamente ao usuário SEMPRE aparecem (ex: transferência)
            if (ticket?.userId && ticket.userId === _user?.id) return true;
            const _selectedQueueIds = selectedQueueIdsRef.current;
            const _showTicketWithoutQueue = showTicketWithoutQueueRef.current;
            return ((!ticket?.queueId && _showTicketWithoutQueue) || _selectedQueueIds.indexOf(ticket?.queueId) > -1);
        };

        const onCompanyTicketTicketsList = (data) => {
            const _sortTickets = sortTicketsRef.current;
            const _user = userRef.current;

            if (data.action === "update" || data.action === "delete" || data.action === "create") {
                const t = data.ticket;
                console.log(`[TicketsList] aba="${status}" evento="${data.action}" ticketId=${data.ticketId || t?.id} ticketStatus="${t?.status}" oldStatus="${data.oldStatus}" statusMatch=${t?.status === status} userId=${t?.userId} myId=${_user?.id}`);
            }

            if (data.action === "updateUnread") {
                dispatch({
                    type: "RESET_UNREAD",
                    payload: data.ticketId,
                    status: status,
                    sortDir: _sortTickets
                });
            }

            if (data.action === "create" &&
                data.ticket && shouldUpdateTicket(data.ticket) && data.ticket.status === status) {
                dispatch({
                    type: "UPDATE_TICKET",
                    payload: data.ticket,
                    status: status,
                    sortDir: _sortTickets
                });
            }

            if (data.action === "update" && data.ticket) {
                if (shouldUpdateTicket(data.ticket) && data.ticket.status === status) {
                    // Ticket pertence a esta aba → adicionar/atualizar
                    // Mover ao topo se tem mensagens não lidas
                    // (tickets novos na lista já vão ao topo via unshift no reducer UPDATE_TICKET)
                    const shouldMoveToTop = data.ticket.unreadMessages > 0;
                    dispatch({
                        type: shouldMoveToTop ? "UPDATE_TICKET_UNREAD_MESSAGES" : "UPDATE_TICKET",
                        payload: data.ticket,
                        status: status,
                        sortDir: _sortTickets
                    });
                } else {
                    // Ticket não pertence (mais) a esta aba → remover se estiver na lista
                    dispatch({
                        type: "DELETE_TICKET",
                        payload: data.ticket?.id,
                        status: status,
                        sortDir: _sortTickets
                    });
                }
            }

            if (data.action === "delete") {
                // Se oldStatus veio no evento, só remove da aba correspondente
                if (!data.oldStatus || data.oldStatus === status) {
                    dispatch({
                        type: "DELETE_TICKET",
                        payload: data?.ticketId,
                        status: status,
                        sortDir: _sortTickets
                    });
                }
            }
        };

        const onCompanyAppMessageTicketsList = (data) => {
            const _sortTickets = sortTicketsRef.current;
            if (data.action === "create" &&
                shouldUpdateTicket(data.ticket) && data.ticket.status === status) {
                dispatch({
                    type: "UPDATE_TICKET_UNREAD_MESSAGES",
                    payload: data.ticket,
                    status: status,
                    sortDir: _sortTickets
                });
            }
        };

        const onCompanyContactTicketsList = (data) => {
            const _sortTickets = sortTicketsRef.current;
            if (data.action === "update" && data.contact) {
                dispatch({
                    type: "UPDATE_TICKET_CONTACT",
                    payload: data.contact,
                    status: status,
                    sortDir: _sortTickets
                });
            }
        };

        const onConnectTicketsList = () => {
            if (status) {
                socket.emit("joinTickets", status);
            } else {
                socket.emit("joinNotification");
            }
        };

        socket.on("connect", onConnectTicketsList);
        socket.on(`company-${companyId}-ticket`, onCompanyTicketTicketsList);
        socket.on(`company-${companyId}-appMessage`, onCompanyAppMessageTicketsList);
        socket.on(`company-${companyId}-contact`, onCompanyContactTicketsList);

        // Se já estiver conectado, faz join imediato
        if (socket.connected) {
            onConnectTicketsList();
        }

        return () => {
            if (status) {
                socket.emit("leaveTickets", status);
            } else {
                socket.emit("leaveNotification");
            }
            socket.off("connect", onConnectTicketsList);
            socket.off(`company-${companyId}-ticket`, onCompanyTicketTicketsList);
            socket.off(`company-${companyId}-appMessage`, onCompanyAppMessageTicketsList);
            socket.off(`company-${companyId}-contact`, onCompanyContactTicketsList);
        };
    // Deps mínimas: valores mutáveis acessados via refs para evitar re-registro frequente
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, companyId, socket]);

    useEffect(() => {
        if (typeof updateCount === "function") {
            updateCount(ticketsList.length);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticketsList]);

    const loadMore = () => {
        setPageNumber((prevState) => prevState + 1);
    };

    const handleScroll = (e) => {
        if (!hasMore || loading) return;

        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

        if (scrollHeight - (scrollTop + 100) < clientHeight) {
            loadMore();
        }
    };

    if (status && status !== "search") {
        ticketsList = ticketsList.filter(ticket => ticket.status === status)
    }

    return (
        <Paper className={`${classes.ticketsListWrapper} tickets-list-wrapper`} style={style}>
            <Paper
                square
                name="closed"
                elevation={0}
                className={classes.ticketsList}
                onScroll={handleScroll}
            >
                <List style={{ paddingTop: 0 }} >
                    {ticketsList.length === 0 && !loading ? (
                        <div className={classes.noTicketsDiv}>
                            <span className={classes.noTicketsTitle}>
                                {i18n.t("ticketsList.noTicketsTitle")}
                            </span>
                            <p className={classes.noTicketsText}>
                                {i18n.t("ticketsList.noTicketsMessage")}
                            </p>
                        </div>
                    ) : (
                        <>
                            {ticketsList.map((ticket) => (
                                // <List key={ticket.id}>
                                //     {console.log(ticket)}
                                <TicketListItem
                                    ticket={ticket}
                                    key={ticket.id}
                                    setTabOpen={setTabOpen}
                                />
                                // </List>
                            ))}
                        </>
                    )}
                    {loading && <TicketsListSkeleton />}
                </List>
            </Paper>
        </Paper>
    );
};

export default TicketsListCustom;
