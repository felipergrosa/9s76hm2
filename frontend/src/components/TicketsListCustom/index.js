import React, { useState, useEffect, useReducer, useMemo, useRef, useCallback } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import { FixedSizeList as VirtualList } from "react-window";

import TicketListItem from "../TicketListItemCustom";
import TicketsListSkeleton from "../TicketsListSkeleton";

import useTickets from "../../hooks/useTickets";
import { i18n } from "../../translate/i18n";

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
        overflowX: "hidden",
        ...theme.scrollbarStyles,
        borderTop: "1px solid rgba(0, 0, 0, 0.05)",
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
        margin: 40,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
    },

    virtualRow: {
        boxSizing: "border-box",
        display: "flex",
        alignItems: "stretch",
        overflow: "hidden",
        width: "100%",
        "& .ticket-list-item-core": {
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
        },
    },

    loadingWrapper: {
        paddingTop: 0,
    },
}));

const ROW_HEIGHT = 88;

const ticketSortAsc = (a, b) => {
    if (a.updatedAt < b.updatedAt) {
        return -1;
    }
    if (a.updatedAt > b.updatedAt) {
        return 1;
    }
    return 0;
};

const ticketSortDesc = (a, b) => {
    if (a.updatedAt > b.updatedAt) {
        return -1;
    }
    if (a.updatedAt < b.updatedAt) {
        return 1;
    }
    return 0;
};

const reducer = (state, action) => {
    const sortDir = action.sortDir;

    if (action.type === "LOAD_TICKETS") {
        const newTickets = action.payload;
        let nextState = [...state];

        newTickets.forEach((ticket) => {
            const ticketIndex = nextState.findIndex((currentTicket) => currentTicket.id === ticket.id);
            if (ticketIndex !== -1) {
                nextState[ticketIndex] = ticket;
            } else {
                nextState.push(ticket);
            }
        });

        if (sortDir && ["ASC", "DESC"].includes(sortDir)) {
            nextState.sort(sortDir === "ASC" ? ticketSortAsc : ticketSortDesc);
        }

        return nextState;
    }

    if (action.type === "RESET") {
        return [];
    }

    return state;
};

const TicketsListViewport = ({
    tickets,
    loading,
    hasMore,
    onLoadMore,
    setTabOpen,
    style,
    resetScrollKey,
}) => {
    const classes = useStyles();
    const [listHeight, setListHeight] = useState(0);
    const listContainerRef = useRef(null);
    const virtualListRef = useRef(null);

    useEffect(() => {
        const container = listContainerRef.current;
        if (!container) return;

        const updateHeight = () => {
            if (container) {
                setListHeight(container.clientHeight);
            }
        };

        updateHeight();

        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", updateHeight);
            return () => window.removeEventListener("resize", updateHeight);
        }

        const resizeObserver = new ResizeObserver(updateHeight);
        resizeObserver.observe(container);

        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        if (virtualListRef.current) {
            virtualListRef.current.scrollToItem(0, "start");
        }
    }, [resetScrollKey]);

    const handleItemsRendered = useCallback(({ overscanStopIndex }) => {
        if (!hasMore || loading || typeof onLoadMore !== "function") return;
        if (overscanStopIndex >= tickets.length - 5) {
            onLoadMore();
        }
    }, [hasMore, loading, onLoadMore, tickets.length]);

    const itemData = useMemo(() => ({
        tickets,
        setTabOpen,
        classes,
    }), [tickets, setTabOpen, classes]);

    const Row = useCallback(({ index, style: rowStyle, data }) => {
        const ticket = data.tickets[index];

        return (
            <div style={{ ...rowStyle, width: "100%" }} className={data.classes.virtualRow}>
                <TicketListItem
                    ticket={ticket}
                    setTabOpen={data.setTabOpen}
                />
            </div>
        );
    }, []);

    return (
        <Paper className={`${classes.ticketsListWrapper} tickets-list-wrapper`} style={style}>
            <Paper
                square
                name="closed"
                elevation={0}
                className={`${classes.ticketsList} tickets-list`}
                ref={listContainerRef}
            >
                {tickets.length === 0 && !loading ? (
                    <div className={classes.noTicketsDiv}>
                        <span className={classes.noTicketsTitle}>
                            {i18n.t("ticketsList.noTicketsTitle")}
                        </span>
                        <p className={classes.noTicketsText}>
                            {i18n.t("ticketsList.noTicketsMessage")}
                        </p>
                    </div>
                ) : (
                    <VirtualList
                        ref={virtualListRef}
                        height={Math.max(listHeight, 320)}
                        width="100%"
                        itemCount={tickets.length}
                        itemSize={ROW_HEIGHT}
                        itemData={itemData}
                        overscanCount={8}
                        onItemsRendered={handleItemsRendered}
                    >
                        {Row}
                    </VirtualList>
                )}
                {loading && (
                    <div className={classes.loadingWrapper}>
                        <TicketsListSkeleton />
                    </div>
                )}
            </Paper>
        </Paper>
    );
};

const InternalTicketsList = (props) => {
    const {
        setTabOpen,
        status,
        searchParam,
        searchOnMessages,
        tags,
        users,
        showAll,
        updateCount,
        style,
        selectedQueueIds,
        whatsappIds,
        forceSearch,
        statusFilter,
        userFilter,
        sortTickets,
    } = props;

    const [pageNumber, setPageNumber] = useState(1);
    const [ticketsList, dispatch] = useReducer(reducer, []);

    const tagsKey = JSON.stringify(tags);
    const usersKey = JSON.stringify(users);
    const queueIdsKey = JSON.stringify(selectedQueueIds);
    const whatsappIdsKey = JSON.stringify(whatsappIds);
    const statusFilterKey = JSON.stringify(statusFilter);
    const resetScrollKey = JSON.stringify({
        status,
        searchParam,
        showAll,
        forceSearch,
        sortTickets,
        searchOnMessages,
        tagsKey,
        usersKey,
        queueIdsKey,
        whatsappIdsKey,
        statusFilterKey,
    });

    useEffect(() => {
        dispatch({ type: "RESET" });
        setPageNumber(1);
    }, [forceSearch, queueIdsKey, searchOnMessages, searchParam, showAll, sortTickets, status, statusFilterKey, tagsKey, usersKey, whatsappIdsKey]);

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
        sortTickets,
    });

    useEffect(() => {
        dispatch({
            type: "LOAD_TICKETS",
            payload: tickets,
            sortDir: sortTickets,
        });
    }, [sortTickets, tickets]);

    useEffect(() => {
        if (typeof updateCount === "function") {
            updateCount(ticketsList.length);
        }
    }, [ticketsList.length, updateCount]);

    const onLoadMore = useCallback(() => {
        setPageNumber(prevState => prevState + 1);
    }, []);

    const filteredTickets = useMemo(() => {
        if (status && status !== "search") {
            return ticketsList.filter(ticket => ticket.status === status);
        }
        return ticketsList;
    }, [status, ticketsList]);

    return (
        <TicketsListViewport
            tickets={filteredTickets}
            loading={loading}
            hasMore={hasMore}
            onLoadMore={onLoadMore}
            setTabOpen={setTabOpen}
            style={style}
            resetScrollKey={resetScrollKey}
        />
    );
};

const ExternalTicketsList = ({
    externalTickets,
    externalLoading,
    externalHasMore,
    onLoadMore,
    setTabOpen,
    style,
    resetScrollKey,
}) => {
    return (
        <TicketsListViewport
            tickets={externalTickets || []}
            loading={Boolean(externalLoading)}
            hasMore={Boolean(externalHasMore)}
            onLoadMore={onLoadMore}
            setTabOpen={setTabOpen}
            style={style}
            resetScrollKey={resetScrollKey}
        />
    );
};

const TicketsListCustom = (props) => {
    if (props.externalMode) {
        return <ExternalTicketsList {...props} />;
    }

    return <InternalTicketsList {...props} />;
};

export default TicketsListCustom;
