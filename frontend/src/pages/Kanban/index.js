import React, { useState, useEffect, useContext, useMemo } from "react";
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

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    padding: "16px",
  },
  kanbanContainer: {
    width: "100%",
  },
  topbar: {
    width: "100%",
    margin: "0 0 16px",
  },
  tabsWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  actionsBar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 12,
    background: theme.palette.background.paper,
    borderRadius: 12,
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  },
  searchInput: {
    padding: "6px 10px",
    borderRadius: 8,
    background: theme.palette.action.hover,
    minWidth: 240,
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
  const theme = useTheme(); // Obter o tema atual
  const history = useHistory();
  const { user, socket } = useContext(AuthContext);
  const [tags, setTags] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [ticketNot, setTicketNot] = useState(0);
  const [file, setFile] = useState({ lanes: [] });
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState("recent"); // recent | oldest | unread | priority
  const [filterQueues, setFilterQueues] = useState([]); // ids
  const [filterUsers, setFilterUsers] = useState([]); // ids
  const [filterTags, setFilterTags] = useState([]); // ids
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
    } catch (err) {
      console.log(err);
      setTickets([]);
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

  // Atualiza a lista de tickets ao alterar intervalo de datas
  useEffect(() => {
    fetchTickets();
  }, [startDate, endDate]);

  const IconChannel = (channel) => {
    switch (channel) {
      case "facebook":
        return <Facebook style={{ color: "#3b5998", verticalAlign: "middle", fontSize: "16px" }} />;
      case "instagram":
        return <Instagram style={{ color: "#e1306c", verticalAlign: "middle", fontSize: "16px" }} />;
      case "whatsapp":
        return <WhatsApp style={{ color: "#25d366", verticalAlign: "middle", fontSize: "16px" }} />
      default:
        return "error";
    }
  };

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
    // filtros avançados
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

  const popularCards = (jsonString) => {
    const filteredTickets = applySearchAndSort(tickets.filter(ticket => ticket.tags.length === 0));

    let lanes = [
      {
        id: "lane0",
        title: i18n.t("tagsKanban.laneDefault"),
        label: filteredTickets.length.toString(),
        unreadCount: filteredTickets.reduce((acc, t) => acc + Number(t.unreadMessages || 0), 0),
        laneColor: '#e9d5ff',
        style: { backgroundColor: lighten('#8b5cf6', 0.88), borderRadius: 16, padding: 8 },
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
        const filteredTickets = applySearchAndSort(tickets.filter(ticket => {
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
          style: { backgroundColor: lighten(tag.color, 0.88), borderRadius: 16, padding: 8 },
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
    // Filtra colunas ocultas via localStorage
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
    // Recalcula o board sempre que filtros/ordenação/busca mudarem
    popularCards(jsonString);
  }, [tags, tickets, searchText, sortBy, filterQueues, filterUsers, filterTags]);

  const handleCardMove = async (sourceLaneId, targetLaneId, cardId) => {
    try {
      const ticketId = String(cardId);

      // Remove tag(s) atuais do ticket
      await api.delete(`/ticket-tags/${ticketId}`);
      // Se destino não for "sem tag" (lane0), adiciona nova tag
      if (String(targetLaneId) !== 'lane0') {
        await api.put(`/ticket-tags/${ticketId}/${targetLaneId}`);
      }
      await fetchTickets();
      popularCards(jsonString);
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
    const onHiddenChanged = () => popularCards(jsonString);
    window.addEventListener('kanban:lanesHiddenChanged', onHiddenChanged);
    const onPriorityChanged = () => popularCards(jsonString);
    window.addEventListener('kanban:priorityChanged', onPriorityChanged);
    return () => {
      window.removeEventListener('kanban:lanesHiddenChanged', onHiddenChanged);
      window.removeEventListener('kanban:priorityChanged', onPriorityChanged);
    };
  }, [tags, tickets]);

  return (
    <div className={classes.root}>
      <div className={classes.topbar}>
        <div className={classes.tabsWrap}>
          <Typography variant="h6" style={{ fontWeight: 800 }}>{i18n.t('kanban.title')}</Typography>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Can role={user.profile} perform="dashboard:view" yes={() => (
              <Button variant="outlined" color="default" onClick={handleAddConnectionClick}>
                {i18n.t('kanban.addColumns')}
              </Button>
            )} />
            <Button variant="text" color="primary" onClick={handleResetHiddenLanes}>{i18n.t('kanban.resetColumns')}</Button>
          </div>
        </div>
        {/* Filtros removidos da barra principal — agora acessíveis via modal */}
        {/* Menu de abas removido conforme solicitação */}
        <div className={classes.actionsBar}>
          <InputBase
            placeholder={i18n.t('kanban.searchContact')}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className={classes.searchInput}
          />
          <div style={{ flex: 1 }} />
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
      <div className={classes.kanbanContainer}>
        {!file || !file.lanes ? (
          // Loader simples: blocos placeholder
          <div style={{ display: 'flex', gap: 12 }}>
            {[1,2,3].map(i=> (
              <div key={i} style={{ width: 320, borderRadius: 16, padding: 8, background: '#f5f5f5' }}>
                <div style={{ height: 28, background: '#e9e9e9', borderRadius: 8, marginBottom: 8 }} />
                {[1,2,3].map(j=> (
                  <div key={j} style={{ height: 80, background: '#ededed', borderRadius: 12, margin: '8px 0' }} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          file.lanes.length === 0 || file.lanes.every(l=> (l.cards||[]).length===0) ? (
            <Typography variant="body2" color="textSecondary">{i18n.t('kanban.empty.noTickets')}</Typography>
          ) : (
            <Board
              data={file}
              onCardMoveAcrossLanes={handleCardMove}
              components={{ LaneHeader: KanbanLaneHeader }}
              customCardLayout
              hideCardDeleteIcon
              style={{ backgroundColor: 'rgba(252, 252, 252, 0.03)' }}
            />
          )
        )}
      </div>
      {/* Modal de filtros */}
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
