import React, { useState, useEffect, useContext, useMemo, useRef, useCallback } from "react";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import Board from 'react-trello';
import { toast } from "react-toastify";
import ColorModeContext from "../../layout/themeContext";
import { i18n } from "../../translate/i18n";
import { useHistory } from 'react-router-dom';
import { Facebook, Instagram, WhatsApp, FilterList, Add, Refresh } from "@material-ui/icons";
import { Badge, Tooltip, Typography, IconButton, TextField, Box, InputBase, Select, MenuItem, Paper, FormControl, InputLabel, Checkbox, ListItemText, Popover } from "@material-ui/core";
import { DateRangePicker } from 'materialui-daterange-picker';
import KanbanCard from "./KanbanCard";
import KanbanLaneHeader from "./KanbanLaneHeader";
import { format, isSameDay, parseISO, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { Can } from "../../components/Can";
import KanbanFiltersModal from "./KanbanFiltersModal";
import Title from "../../components/Title"; // Importando Title

const useStyles = makeStyles(theme => ({
  '@global': {
    '.smooth-dnd-ghost': {
      width: '350px !important',
      maxWidth: '350px !important',
      flex: '0 0 350px !important',
      boxSizing: 'border-box !important',
    },
    '.smooth-dnd-ghost > *': {
      width: '350px !important',
      maxWidth: '350px !important',
    },
    '.smooth-dnd-ghost .react-trello-card': {
      width: '350px !important',
      maxWidth: '350px !important',
    },
    '.smooth-dnd-ghost .smooth-dnd-draggable-wrapper': {
      width: '350px !important',
      maxWidth: '350px !important',
    },
    // Ocultar scrollbars do Kanban (Windows/Chrome/Edge) sem perder o scroll
    '.react-trello-board': {
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    },
    '.react-trello-board::-webkit-scrollbar': {
      width: '0px !important',
      height: '0px !important',
      display: 'none !important',
    },
    '.react-trello-lane__cards': {
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    },
    '.react-trello-lane__cards::-webkit-scrollbar': {
      width: '0px !important',
      height: '0px !important',
      display: 'none !important',
    },
    '.react-trello-lane__cards *::-webkit-scrollbar': {
      width: '0px !important',
      height: '0px !important',
      display: 'none !important',
    },
    '.smooth-dnd-container': {
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    },
    '.smooth-dnd-container::-webkit-scrollbar': {
      width: '0px !important',
      height: '0px !important',
      display: 'none !important',
    },
    '.smooth-dnd-container *::-webkit-scrollbar': {
      width: '0px !important',
      height: '0px !important',
      display: 'none !important',
    },
  },
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    height: "100vh",
    padding: theme.spacing(1),
    overflow: "hidden",
  },
  headerContainer: {
    padding: "0 10px",
    marginBottom: theme.spacing(1),
    textAlign: "left",
  },
  kanbanContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    overflowX: "auto",
    overflowY: "hidden",
    padding: "0 10px",
    paddingRight: 360, // Espaço extra no final para última coluna
    gap: 8,
    height: "100%",
    alignItems: "stretch",
    // Esconder scrollbar mas manter funcionalidade
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    "&::-webkit-scrollbar": {
      display: "none",
    },
    // Força react-trello board a ser inline
    "& .react-trello-board": {
      display: "flex !important",
      flexDirection: "row !important",
      flexWrap: "nowrap !important",
      gap: "8px !important",
      height: "100% !important",
      backgroundColor: "transparent !important",
      padding: "0 !important",
      margin: "0 !important",
      overflow: "visible !important",
    },
    // Container horizontal das lanes
    "& .smooth-dnd-container.horizontal": {
      display: "flex !important",
      flexDirection: "row !important",
      flexWrap: "nowrap !important",
      gap: "8px !important",
      height: "100% !important",
      overflow: "visible !important",
    },
    // CRUCIAL: flex-shrink: 0 impede que as colunas encolham
    "& .react-trello-lane, & section": {
      flexShrink: "0 !important",
      width: "350px !important",
      minWidth: "350px !important",
      maxWidth: "350px !important",
      height: "100% !important",
      display: "flex !important",
      flexDirection: "column !important",
      marginRight: "0 !important",
    },
    // Header da lane
    "& header": {
      width: "100% !important",
      flexShrink: "0 !important",
    },
    // Área de cards dentro da lane
    "& .react-trello-lane__cards": {
      flex: "1 1 auto !important",
      overflowY: "auto !important",
      overflowX: "hidden !important",
      padding: "8px !important",
      scrollbarWidth: "none",
      "&::-webkit-scrollbar": {
        display: "none",
      },
    },
    // Cards
    "& .react-trello-card": {
      width: "100% !important",
      background: "transparent !important",
      boxShadow: "none !important",
      border: "none !important",
    },
    "& .smooth-dnd-draggable-wrapper": {
      width: "100% !important",
    },
  },
  actionsBar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    rowGap: 8,
    padding: 12,
    background: theme.palette.background.paper,
    borderRadius: 12,
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    marginBottom: theme.spacing(2),
  },
  searchInput: {
    flex: 1,
    padding: "6px 10px",
    borderRadius: 8,
    background: theme.palette.action.hover,
    minWidth: 150,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    border: `1px solid ${theme.palette.divider}`,
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  connectionTag: {
    background: "green",
    color: "#FFF",
    marginRight: 1,
    padding: 1,
    fontWeight: 'bold',
    borderRadius: 3,
    fontSize: "0.6em",
  },
  lastMessageTime: {
    justifySelf: "flex-end",
    textAlign: "right",
    position: "relative",
    marginLeft: "auto",
    color: theme.palette.text.secondary,
  },
  lastMessageTimeUnread: {
    justifySelf: "flex-end",
    textAlign: "right",
    position: "relative",
    color: theme.palette.success.main,
    fontWeight: "bold",
    marginLeft: "auto"
  },
  cardButton: {
    marginRight: theme.spacing(1),
    color: theme.palette.common.white,
    backgroundColor: theme.palette.primary.main,
    "&:hover": {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  dateInput: {
    marginRight: theme.spacing(2),
  },
}));

const Kanban = () => {
  const classes = useStyles();
  const theme = useTheme();
  const history = useHistory();
  const { user, socket } = useContext(AuthContext);
  const kanbanScrollRef = useRef(null);
  const panRef = useRef({ active: false, startX: 0, scrollLeft: 0 });
  const bodyStyleRef = useRef({ cursor: "", userSelect: "" });
  const [tags, setTags] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [ticketNot, setTicketNot] = useState(0);
  const { colorMode } = useContext(ColorModeContext);
  const { viewMode } = colorMode || {};
  const [file, setFile] = useState({ lanes: [] });
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [filterQueues, setFilterQueues] = useState([]);
  const [filterUsers, setFilterUsers] = useState([]);
  const [filterTags, setFilterTags] = useState([]);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeAnchor, setRangeAnchor] = useState(null);
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);

  // Kanban Pessoal
  const [viewingUserId, setViewingUserId] = useState(user.id);
  const [selectableUsers, setSelectableUsers] = useState([]);

  useEffect(() => {
    if (user.profile === "admin" || (user.managedUserIds && user.managedUserIds.length > 0)) {
      const fetchUsers = async () => {
        try {
          const { data } = await api.get("/users", { params: { pageNumber: 1, pageSize: 1000 } });
          let allowedUsers = data.users;
          if (user.profile !== "admin") {
            const permissions = user.managedUserIds || [];
            // permissions pode ser array de strings ou ints, converte para int
            const permissionsInt = permissions.map(p => Number(p));
            allowedUsers = allowedUsers.filter(u => permissionsInt.includes(u.id));
          }
          setSelectableUsers(allowedUsers);
        } catch (err) {
          console.error("Erro ao buscar usuários para kanban", err);
        }
      };
      fetchUsers();
    }
  }, [user]);

  const jsonString = useMemo(() => user.queues.map(queue => queue.UserQueue.queueId), [user.queues]);

  const queueOptions = useMemo(() => {
    const map = new Map();
    tickets.forEach(t => {
      const id = String(t.queue?.id || t.whatsappId || t.queueId || '');
      const name = t.queue?.name || t.whatsapp?.name || (id ? `Fila ${id}` : '');
      if (id) map.set(id, name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [tickets]);

  const userOptions = useMemo(() => {
    const map = new Map();
    tickets.forEach(t => {
      const id = String(t.user?.id || t.userId || '');
      const name = t.user?.name || (id ? `Usuário ${id}` : '');
      if (id) map.set(id, name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [tickets]);

  const tagOptions = useMemo(() => (tags || []).map(t => ({ id: String(t.id), name: t.name })), [tags]);

  const fetchTags = useCallback(async () => {
    try {
      const response = await api.get("/tag/kanban/", { params: { viewingUserId } });
      const fetchedTags = response.data.lista || [];
      setTags(fetchedTags);
    } catch (error) {
      console.log(error);
    }
  }, [viewingUserId]);

  const fetchTickets = useCallback(async () => {
    try {
      const { data } = await api.get("/ticket/kanban", {
        params: {
          queueIds: JSON.stringify(jsonString),
          dateStart: startDate,
          dateEnd: endDate,
          viewingUserId
        }
      });
      setTickets(data.tickets);
      return data.tickets;
    } catch (err) {
      console.log(err);
      setTickets([]);
      return [];
    }
  }, [jsonString, startDate, endDate, viewingUserId]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    const companyId = user.companyId;
    const onAppMessage = (data) => {
      if (data.action === "create" || data.action === "update" || data.action === "delete") {
        fetchTickets();
      }
    };
    socket.on(`company-${companyId}-ticket`, onAppMessage);
    socket.on(`company-${companyId}-appMessage`, onAppMessage);

    return () => {
      socket.off(`company-${companyId}-ticket`, onAppMessage);
      socket.off(`company-${companyId}-appMessage`, onAppMessage);
    };
  }, [socket, user.companyId, fetchTickets]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleCardClick = useCallback((uuid) => {
    history.push('/tickets/' + uuid);
  }, [history]);

  const applySearchAndSort = useCallback((list) => {
    let filtered = list;
    if (searchText) {
      const q = searchText.toLowerCase();
      filtered = filtered.filter(t =>
        (t.contact?.name || "").toLowerCase().includes(q) ||
        (t.contact?.number || "").toLowerCase().includes(q)
      );
    }
    if (filterQueues.length) {
      filtered = filtered.filter(t => filterQueues.includes(String(t.queueId || t.whatsappId)) || filterQueues.includes(String(t.queue?.id)));
    }
    if (filterUsers.length) {
      filtered = filtered.filter(t => filterUsers.includes(String(t.userId)) || filterUsers.includes(String(t.user?.id)));
    }
    if (filterTags.length) {
      filtered = filtered.filter(t => {
        const tagIds = (t.tags || []).map(x => String(x.id));
        return filterTags.every(ft => tagIds.includes(String(ft)));
      });
    }
    if (sortBy === "recent") {
      filtered = filtered.slice().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } else if (sortBy === "oldest") {
      filtered = filtered.slice().sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
    } else if (sortBy === "unread") {
      filtered = filtered.slice().sort((a, b) => (Number(b.unreadMessages || 0) - Number(a.unreadMessages || 0)));
    } else if (sortBy === "priority") {
      const p = (u) => { u = Number(u) || 0; return u > 5 ? 2 : (u > 0 ? 1 : 0); };
      filtered = filtered.slice().sort((a, b) => (p(b.unreadMessages) - p(a.unreadMessages)) || (new Date(b.updatedAt) - new Date(a.updatedAt)));
    }
    return filtered;
  }, [searchText, filterQueues, filterUsers, filterTags, sortBy]);

  const handleCardMove = useCallback(async (...args) => {
    try {
      // Usar os IDs das tags (+ lane0) para validar os IDs das colunas, evitando dependência do estado 'file'
      const laneIds = new Set(['lane0', ...tags.map(t => String(t.id))]);
      let targetLaneId;
      let cardId;

      if (args.length >= 3 && laneIds.has(String(args[0])) && laneIds.has(String(args[1]))) {
        targetLaneId = String(args[1]);
        cardId = String(args[2]);
      } else if (args.length >= 3 && laneIds.has(String(args[1])) && laneIds.has(String(args[2]))) {
        cardId = String(args[0]);
        targetLaneId = String(args[2]);
      } else {
        targetLaneId = String(args[1]);
        cardId = String(args[2]);
      }

      const ticketId = String(cardId);
      await api.delete(`/ticket-tags/${ticketId}`);
      if (String(targetLaneId) !== 'lane0') {
        await api.put(`/ticket-tags/${ticketId}/${targetLaneId}`);
      }
      await fetchTickets();
    } catch (err) {
      console.log(err);
    }
  }, [tags, fetchTickets]);

  const quickMove = useCallback(async (ticket, targetTagId) => {
    try {
      const source = (ticket.tags && ticket.tags[0]?.id) ? String(ticket.tags[0].id) : 'lane0';
      await handleCardMove(source, String(targetTagId), String(ticket.id));
    } catch (e) { console.log(e); }
  }, [handleCardMove]);

  const popularCards = useCallback((ticketsSource = tickets) => {
    const filteredTickets = applySearchAndSort((ticketsSource || []).filter(ticket => (ticket.tags || []).length === 0));

    // Estilo padrão das lanes (colunas)
    const laneStyle = {
      backgroundColor: viewMode === "modern" ? "rgba(255, 255, 255, 0.4)" : "#f5f5f5",
      backdropFilter: viewMode === "modern" ? "blur(10px)" : "none",
      borderRadius: viewMode === "modern" ? 16 : 8,
      border: viewMode === "modern" ? "1px solid rgba(255, 255, 255, 0.3)" : "1px solid rgba(0,0,0,0.12)",
      maxHeight: "100%",
      display: "flex",
      flexDirection: "column",
      minWidth: 350,
      maxWidth: 350,
      width: 350,
      boxShadow: viewMode === "modern" ? "0 4px 20px rgba(0,0,0,0.05)" : "none",
    };

    let lanes = [
      {
        id: "lane0",
        title: i18n.t("tagsKanban.laneDefault"),
        label: filteredTickets.length.toString(),
        unreadCount: filteredTickets.reduce((acc, t) => acc + Number(t.unreadMessages || 0), 0),
        laneColor: '#5C5C5C', // Cor padrão para "Em aberto"
        style: { ...laneStyle, borderTop: `4px solid #5C5C5C` }, // Borda colorida no topo
        cards: filteredTickets.map(ticket => ({
          id: ticket.id.toString(),
          label: "",
          description: (
            <KanbanCard ticket={ticket} allTags={tags} onMoveRequest={(tagId) => quickMove(ticket, tagId)} onClick={() => handleCardClick(ticket.uuid)} />
          ),
          title: "",
          draggable: true,
          href: "/tickets/" + ticket.uuid,
          style: { background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 },
        })),
      },
      ...tags.map(tag => {
        const filteredTickets = applySearchAndSort((ticketsSource || []).filter(ticket => {
          const tagIds = (ticket.tags || []).map(tag => tag.id);
          return tagIds.includes(tag.id);
        }));

        const unreadSum = filteredTickets.reduce((acc, t) => acc + Number(t.unreadMessages || 0), 0);
        return {
          id: tag.id.toString(),
          title: tag.name,
          label: filteredTickets?.length.toString(),
          unreadCount: unreadSum,
          laneColor: tag.color,
          style: { ...laneStyle, borderTop: `4px solid ${tag.color}` }, // Borda colorida no topo
          cards: filteredTickets.map(ticket => ({
            id: ticket.id.toString(),
            label: "",
            description: (
              <KanbanCard ticket={ticket} allTags={tags} onMoveRequest={(tagId) => quickMove(ticket, tagId)} onClick={() => handleCardClick(ticket.uuid)} />
            ),
            title: "",
            draggable: true,
            href: "/tickets/" + ticket.uuid,
            style: { background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 },
          })),
        };
      }),
    ];

    try {
      const raw = localStorage.getItem('kanbanHiddenLanes');
      const hidden = raw ? JSON.parse(raw) : [];
      if (Array.isArray(hidden) && hidden.length) {
        lanes = lanes.filter(l => !hidden.includes(String(l.id)));
      }
    } catch (e) { }

    setFile({ lanes });
  }, [tickets, tags, applySearchAndSort, quickMove, handleCardClick, viewMode]);

  useEffect(() => {
    popularCards();
  }, [popularCards]);

  const handleResetHiddenLanes = () => {
    try {
      localStorage.removeItem('kanbanHiddenLanes');
      popularCards();
    } catch (e) { }
  };

  const handleAddConnectionClick = () => {
    history.push('/tagsKanban');
  };

  useEffect(() => {
    try {
      const currentCursor = document.body.style.cursor;
      const currentUserSelect = document.body.style.userSelect;

      const sanitizedCursor = (currentCursor === 'grab' || currentCursor === 'grabbing') ? '' : currentCursor;
      const sanitizedUserSelect = (currentUserSelect === 'none') ? '' : currentUserSelect;

      bodyStyleRef.current = {
        cursor: sanitizedCursor,
        userSelect: sanitizedUserSelect,
      };

      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    } catch (_) { }

    return () => {
      try {
        document.body.style.cursor = bodyStyleRef.current.cursor || "";
        document.body.style.userSelect = bodyStyleRef.current.userSelect || "";
      } catch (_) { }
    };
  }, []);

  useEffect(() => {
    const onHiddenChanged = () => popularCards();
    window.addEventListener('kanban:lanesHiddenChanged', onHiddenChanged);
    const onPriorityChanged = () => popularCards();
    window.addEventListener('kanban:priorityChanged', onPriorityChanged);
    return () => {
      window.removeEventListener('kanban:lanesHiddenChanged', onHiddenChanged);
      window.removeEventListener('kanban:priorityChanged', onPriorityChanged);
    };
  }, [popularCards]);

  const handlePanStart = (e) => {
    const evt = e?.nativeEvent || e;
    if (evt?.button != null && evt.button !== 0) return;
    const container = kanbanScrollRef.current;
    if (!container) return;
    panRef.current.active = true;
    panRef.current.startX = evt.clientX;
    panRef.current.scrollLeft = container.scrollLeft;
    panRef.current.pointerId = evt.pointerId != null ? evt.pointerId : null;
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!panRef.current.active) return;
      if (panRef.current.pointerId != null && e.pointerId != null && panRef.current.pointerId !== e.pointerId) return;
      const container = kanbanScrollRef.current;
      if (!container) return;
      const dx = e.clientX - panRef.current.startX;
      container.scrollLeft = panRef.current.scrollLeft - dx;
    };

    const onUp = (e) => {
      if (!panRef.current.active) return;
      if (panRef.current.pointerId != null && e?.pointerId != null && panRef.current.pointerId !== e.pointerId) return;
      panRef.current.active = false;
      panRef.current.pointerId = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return (
    <div className={classes.root}>
      <div className={classes.headerContainer}>
        <Title>CRM - Kanban</Title>
        <Typography
          variant="body1"
          color="textSecondary"
          style={{ marginBottom: 16, marginTop: -10, fontStyle: "italic", textAlign: "left" }}
        >
          Organize seus atendimentos por tags e etapas visuais. Arraste os cards para mover entre as colunas.
        </Typography>

        <div className={classes.actionsBar}>
          <InputBase
            placeholder={i18n.t('kanban.searchContact')}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className={classes.searchInput}
          />

          {(user.profile === "admin" || (user.managedUserIds && user.managedUserIds.length > 0)) && (
            <FormControl variant="outlined" className={classes.actionButton} style={{ marginRight: 10, minWidth: 150 }}>
              <Select
                value={viewingUserId}
                onChange={(e) => setViewingUserId(e.target.value)}
                displayEmpty
                style={{ height: 40 }}
              >
                <MenuItem value={user.id}>Meu Workspace</MenuItem>
                {selectableUsers.map(u => (
                  <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Can role={user.profile} perform="dashboard:view" yes={() => (
            <Tooltip title={i18n.t('kanban.addColumns')}>
              <IconButton className={classes.actionButton} color="primary" onClick={handleAddConnectionClick}>
                <Add />
              </IconButton>
            </Tooltip>
          )} />

          <Tooltip title={i18n.t('kanban.resetColumns')}>
            <IconButton className={classes.actionButton} color="primary" onClick={handleResetHiddenLanes}>
              <Refresh />
            </IconButton>
          </Tooltip>

          <Tooltip title="Filtrar e ordenar">
            <IconButton className={classes.actionButton} onClick={() => setFiltersModalOpen(true)}>
              <FilterList />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <div className={classes.kanbanContainer} ref={kanbanScrollRef}>
        {!file || !file.lanes ? (
          <div style={{ display: 'flex', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ width: 350, height: "100%", borderRadius: 8, padding: 8, background: '#f5f5f5' }} />
            ))}
          </div>
        ) : (
          file.lanes.length === 0 || file.lanes.every(l => (l.cards || []).length === 0) ? (
            <Typography variant="body2" color="textSecondary">{i18n.t('kanban.empty.noTickets')}</Typography>
          ) : (
            <Board
              data={file}
              onCardMoveAcrossLanes={handleCardMove}
              components={{ LaneHeader: (props) => <KanbanLaneHeader {...props} onPanStart={handlePanStart} /> }}
              customCardLayout
              hideCardDeleteIcon
              style={{ backgroundColor: 'transparent', height: '100%', padding: 0, display: 'flex', flexWrap: 'nowrap' }}
              draggable
              cardDraggable
              laneDraggable={false}
            />
          )
        )}
      </div>

      <KanbanFiltersModal
        open={filtersModalOpen}
        onClose={() => setFiltersModalOpen(false)}
        queueOptions={queueOptions}
        userOptions={userOptions}
        tagOptions={tagOptions}
        initial={{
          filterQueues,
          filterUsers,
          filterTags,
          sortBy,
          startDate,
          endDate
        }}
        onApply={({ filterQueues: fq, filterUsers: fu, filterTags: ft, sortBy: sb, startDate: sd, endDate: ed }) => {
          setFilterQueues(fq || []);
          setFilterUsers(fu || []);
          setFilterTags(ft || []);
          setSortBy(sb || 'recent');
          setStartDate(sd);
          setEndDate(ed);
          setFiltersModalOpen(false);
        }}
        onClear={({ filterQueues: fq, filterUsers: fu, filterTags: ft, sortBy: sb, startDate: sd, endDate: ed }) => {
          setFilterQueues(fq || []);
          setFilterUsers(fu || []);
          setFilterTags(ft || []);
          setSortBy(sb || 'recent');
          setStartDate(sd);
          setEndDate(ed);
        }}
      />
    </div>
  );
};

export default Kanban;
