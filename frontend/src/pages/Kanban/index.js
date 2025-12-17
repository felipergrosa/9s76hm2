import React, { useState, useEffect, useContext, useMemo, useRef } from "react";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import Board from 'react-trello';
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import { useHistory } from 'react-router-dom';
import { Facebook, Instagram, WhatsApp, FilterList } from "@material-ui/icons";
import { Badge, Tooltip, Typography, Button, TextField, Box, InputBase, Select, MenuItem, Paper, FormControl, InputLabel, Checkbox, ListItemText, Popover } from "@material-ui/core";
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
    padding: "0 10px",
    paddingRight: 350, // Espaço extra para última coluna aparecer inteira
    overflowX: "auto",
    overflowY: "hidden",
    width: "100%",
    height: "100%",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    "&::-webkit-scrollbar": {
      width: 0,
      height: 0,
      display: "none",
    },
    // CSS para forçar layout horizontal no react-trello
    "& .react-trello-board": {
      display: "flex !important",
      flexDirection: "row !important",
      flexWrap: "nowrap !important",
      alignItems: "flex-start !important",
      height: "100% !important",
      width: "100% !important",
      minWidth: "fit-content !important",
      minHeight: "0 !important",
      padding: "0 !important",
      backgroundColor: "transparent !important",
    },
    "& .smooth-dnd-container.horizontal": {
      display: "flex !important",
      flexDirection: "row !important",
      flexWrap: "nowrap !important",
      gap: "6px !important",
      height: "100% !important",
      width: "100% !important",
      minWidth: "fit-content !important",
      minHeight: "0 !important",
    },
    "& .react-trello-lane": {
      minWidth: "350px !important",
      width: "350px !important",
      maxWidth: "350px !important",
      flex: "0 0 350px !important",
      height: "100% !important",
      maxHeight: "100% !important",
      minHeight: "0 !important",
      marginRight: "0px !important",
      display: "flex !important",
      flexDirection: "column !important",
    },
    "& section": {
      minWidth: "350px !important",
      width: "350px !important",
      flex: "0 0 350px !important",
      marginRight: "0px !important",
    },
    // Aproximar visual do /moments: padding interno da lista e scroll vertical dentro da coluna
    "& .react-trello-lane__cards": {
      padding: `${theme.spacing(1)}px !important`,
      paddingBottom: `${theme.spacing(2)}px !important`,
      boxSizing: "border-box !important",
      flex: "1 1 auto !important",
      minHeight: "0 !important",
      overflowY: "auto !important",
      overflowX: "hidden !important",
      scrollbarWidth: "none",
      msOverflowStyle: "none",
      "&::-webkit-scrollbar": {
        width: 0,
        height: 0,
        display: "none",
      },
    },
    // Corrige card esticando durante drag (smooth-dnd ghost herda widths grandes)
    "& .smooth-dnd-ghost": {
      width: "350px !important",
      maxWidth: "350px !important",
      flex: "0 0 350px !important",
      boxSizing: "border-box !important",
    },
    "& .smooth-dnd-ghost > *": {
      width: "350px !important",
      maxWidth: "350px !important",
    },
    "& .smooth-dnd-dragging": {
      width: "auto !important",
      maxWidth: "none !important",
      flex: "initial !important",
    },
    "& .smooth-dnd-ghost .react-trello-card": {
      width: "350px !important",
      maxWidth: "350px !important",
    },
    "& .smooth-dnd-ghost .smooth-dnd-draggable-wrapper": {
      width: "350px !important",
      maxWidth: "350px !important",
    },
    // Restaurar largura dos cards (350px)
    "& .smooth-dnd-draggable-wrapper": {
      width: "100% !important",
      maxWidth: "100% !important",
      marginBottom: `${theme.spacing(1)}px !important`,
    },
    "& .react-trello-card": {
      width: "100% !important",
      maxWidth: "100% !important",
      margin: "0 !important",
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
    padding: "6px 10px",
    borderRadius: 8,
    background: theme.palette.action.hover,
    minWidth: 200,
    maxWidth: 300,
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
  const [range, setRange] = useState({ startDate: parseISO(format(startOfMonth(new Date()), "yyyy-MM-dd")), endDate: parseISO(format(endOfMonth(new Date()), "yyyy-MM-dd")) });
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);

  const jsonString = user.queues.map(queue => queue.UserQueue.queueId);

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

  useEffect(() => {
    fetchTags();
  }, [user]);

  const fetchTags = async () => {
    try {
      const response = await api.get("/tag/kanban/");
      const fetchedTags = response.data.lista || [];
      setTags(fetchedTags);
      fetchTickets();
    } catch (error) {
      console.log(error);
    }
  };

  const fetchTickets = async () => {
    try {
      const { data } = await api.get("/ticket/kanban", {
        params: {
          queueIds: JSON.stringify(jsonString),
          dateStart: startDate,
          dateEnd: endDate,
        }
      });
      setTickets(data.tickets);
      return data.tickets;
    } catch (err) {
      console.log(err);
      setTickets([]);
      return [];
    }
  };

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
  }, [socket, startDate, endDate]);

  const handleSearchClick = () => {
    fetchTickets();
  };

  const handleStartDateChange = (event) => {
    setStartDate(event.target.value);
  };

  const handleEndDateChange = (event) => {
    setEndDate(event.target.value);
  };

  useEffect(() => {
    fetchTickets();
  }, [startDate, endDate]);

  const lighten = (hex, amount = 0.85) => {
    if (!hex) return '#f5f5f5';
    let c = hex.replace('#','');
    if (c.length === 3) c = c.split('').map(ch=>ch+ch).join('');
    const num = parseInt(c, 16);
    let r = (num >> 16) & 0xff;
    let g = (num >> 8) & 0xff;
    let b = num & 0xff;
    r = Math.round(r + (255 - r) * amount);
    g = Math.round(g + (255 - g) * amount);
    b = Math.round(b + (255 - b) * amount);
    const toHex = (v) => v.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const applySearchAndSort = (list) => {
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
      filtered = filtered.slice().sort((a, b) => (Number(b.unreadMessages||0) - Number(a.unreadMessages||0)));
    } else if (sortBy === "priority") {
      const p = (u) => { u = Number(u)||0; return u>5?2:(u>0?1:0); };
      filtered = filtered.slice().sort((a,b) => (p(b.unreadMessages) - p(a.unreadMessages)) || (new Date(b.updatedAt) - new Date(a.updatedAt)));
    }
    return filtered;
  };

  const popularCards = (jsonString, ticketsSource = tickets) => {
    const filteredTickets = applySearchAndSort((ticketsSource || []).filter(ticket => ticket.tags.length === 0));

    // Estilo padrão das lanes (colunas)
    const laneStyle = {
      backgroundColor: "#f5f5f5", // Fundo neutro
      borderRadius: 8,
      border: "1px solid rgba(0,0,0,0.12)",
      maxHeight: "100%",
      display: "flex",
      flexDirection: "column",
      minWidth: 350,
      width: 350,
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
            <KanbanCard ticket={ticket} allTags={tags} onMoveRequest={(tagId)=>quickMove(ticket, tagId)} onClick={() => handleCardClick(ticket.uuid)} />
          ),
          title: "",
          draggable: true,
          href: "/tickets/" + ticket.uuid,
          style: { background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 },
        })),
      },
      ...tags.map(tag => {
        const filteredTickets = applySearchAndSort((ticketsSource || []).filter(ticket => {
          const tagIds = ticket.tags.map(tag => tag.id);
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
              <KanbanCard ticket={ticket} allTags={tags} onMoveRequest={(tagId)=>quickMove(ticket, tagId)} onClick={() => handleCardClick(ticket.uuid)} />
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
    } catch (e) {}

    setFile({ lanes });
  };

  const handleCardClick = (uuid) => {
    history.push('/tickets/' + uuid);
  };

  useEffect(() => {
    popularCards(jsonString);
  }, [tags, tickets, searchText, sortBy, filterQueues, filterUsers, filterTags]);

  const handleCardMove = async (...args) => {
    try {
      // Compatibilidade: algumas versões do react-trello chamam:
      // (fromLaneId, toLaneId, cardId, index)
      // outras chamam:
      // (cardId, fromLaneId, toLaneId, position, cardDetails)
      const laneIds = new Set((file?.lanes || []).map(l => String(l.id)));
      let sourceLaneId;
      let targetLaneId;
      let cardId;

      if (args.length >= 3 && laneIds.has(String(args[0])) && laneIds.has(String(args[1]))) {
        sourceLaneId = String(args[0]);
        targetLaneId = String(args[1]);
        cardId = String(args[2]);
      } else if (args.length >= 3 && laneIds.has(String(args[1])) && laneIds.has(String(args[2]))) {
        cardId = String(args[0]);
        sourceLaneId = String(args[1]);
        targetLaneId = String(args[2]);
      } else {
        // fallback (mantém compat com a assinatura antiga)
        sourceLaneId = String(args[0]);
        targetLaneId = String(args[1]);
        cardId = String(args[2]);
      }

      const ticketId = String(cardId);
      await api.delete(`/ticket-tags/${ticketId}`);
      if (String(targetLaneId) !== 'lane0') {
        await api.put(`/ticket-tags/${ticketId}/${targetLaneId}`);
      }
      const updatedTickets = await fetchTickets();
      popularCards(jsonString, updatedTickets);
    } catch (err) {
      console.log(err);
    }
  };

  const handleAddConnectionClick = () => {
    history.push('/tagsKanban');
  };

  const quickMove = async (ticket, targetTagId) => {
    try {
      const source = (ticket.tags && ticket.tags[0]?.id) ? String(ticket.tags[0].id) : 'lane0';
      await handleCardMove(source, String(targetTagId), String(ticket.id));
      await fetchTickets();
    } catch (e) { console.log(e); }
  };

  const handleResetHiddenLanes = () => {
    try {
      localStorage.removeItem('kanbanHiddenLanes');
      popularCards(jsonString);
    } catch (e) {}
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
    } catch (_) {}

    return () => {
      try {
        document.body.style.cursor = bodyStyleRef.current.cursor || "";
        document.body.style.userSelect = bodyStyleRef.current.userSelect || "";
      } catch (_) {}
    };
  }, []);

  useEffect(() => {
    const onHiddenChanged = () => popularCards(jsonString);
    window.addEventListener('kanban:lanesHiddenChanged', onHiddenChanged);
    const onPriorityChanged = () => popularCards(jsonString);
    window.addEventListener('kanban:priorityChanged', onPriorityChanged);
    return () => {
      window.removeEventListener('kanban:lanesHiddenChanged', onHiddenChanged);
      window.removeEventListener('kanban:priorityChanged', onPriorityChanged);
    };
  }, [tags, tickets]);

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

          <Can role={user.profile} perform="dashboard:view" yes={() => (
            <Button variant="outlined" color="primary" onClick={handleAddConnectionClick}>
              {i18n.t('kanban.addColumns')}
            </Button>
          )} />

          <Button variant="text" color="primary" onClick={handleResetHiddenLanes}>
            {i18n.t('kanban.resetColumns')}
          </Button>

          <Button
            variant="outlined"
            size="small"
            startIcon={<FilterList />}
            onClick={() => setFiltersModalOpen(true)}
          >
            Filtrar e ordenar
          </Button>
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
              style={{ backgroundColor: 'transparent', height: '100%', padding: 0 }}
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
