import React, { useState, useEffect, useContext, useMemo, useRef } from "react";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import Board from 'react-trello';
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import { useHistory } from 'react-router-dom';
import { Facebook, Instagram, WhatsApp, FilterList, Add, Refresh } from "@material-ui/icons";
import SearchIcon from "@material-ui/icons/Search";
import { Badge, Tooltip, Typography, Button, TextField, Box, Select, MenuItem, Paper, FormControl, InputLabel, Checkbox, ListItemText, Popover, Grid, useMediaQuery, InputAdornment, IconButton } from "@material-ui/core";
import { DateRangePicker } from 'materialui-daterange-picker';
import KanbanCard from "./KanbanCard";
import KanbanLaneHeader from "./KanbanLaneHeader";
import { format, isSameDay, parseISO, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { Can } from "../../components/Can";
import KanbanFiltersModal from "./KanbanFiltersModal";
import useQueues from "../../hooks/useQueues";
import toastError from "../../errors/toastError";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

const CustomTooltipProps = {
  arrow: true,
  enterTouchDelay: 0,
  leaveTouchDelay: 5000,
  enterDelay: 300,
  leaveDelay: 100,
};

const useStyles = makeStyles(theme => ({
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
  kanbanContainer: {
    width: "100%",
    marginTop: theme.spacing(2),
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
  const isDesktop = useMediaQuery(theme.breakpoints.up(1200));
  const history = useHistory();
  const { user, socket } = useContext(AuthContext);
  const { findAll: findAllQueues } = useQueues();
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
  
  // Estado para armazenar todas as filas e usuários disponíveis
  const [allQueues, setAllQueues] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const queuesLoadedRef = useRef(false);
  const usersLoadedRef = useRef(false);
  const loadingQueuesRef = useRef(false);
  const loadingUsersRef = useRef(false);

  const jsonString = user.queues.map(queue => queue.UserQueue.queueId);

  // Carregar todas as filas disponíveis (apenas uma vez)
  useEffect(() => {
    if (queuesLoadedRef.current || loadingQueuesRef.current || allQueues.length > 0) {
      return;
    }

    const loadQueues = async () => {
      loadingQueuesRef.current = true;
      try {
        const list = await findAllQueues();
        if (list && list.length > 0) {
          const queueList = list.map(q => ({ 
            id: String(q.id), 
            name: q.name || `Fila ${q.id}` 
          }));
          setAllQueues(queueList);
          queuesLoadedRef.current = true;
        }
      } catch (err) {
        // Não logar erro se backend estiver desligado - é esperado em desenvolvimento
        if (err.message && !err.message.includes('Connection refused')) {
          console.error("[Kanban] Erro ao carregar filas:", err);
        }
      } finally {
        loadingQueuesRef.current = false;
      }
    };
    loadQueues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Executar apenas uma vez ao montar

  // Carregar todos os usuários disponíveis (apenas uma vez)
  useEffect(() => {
    if (usersLoadedRef.current || loadingUsersRef.current || allUsers.length > 0) {
      return;
    }

    const loadUsers = async () => {
      loadingUsersRef.current = true;
      try {
        const { data } = await api.get("/users/list");
        if (data && Array.isArray(data) && data.length > 0) {
          const userList = data.map(u => ({ 
            id: String(u.id), 
            name: u.name || `Usuário ${u.id}` 
          }));
          setAllUsers(userList);
          usersLoadedRef.current = true;
        }
      } catch (err) {
        // Não logar erro se backend estiver desligado - é esperado em desenvolvimento
        if (err.message && !err.message.includes('Connection refused')) {
          console.error("[Kanban] Erro ao carregar usuários:", err);
          toastError(err);
        }
      } finally {
        loadingUsersRef.current = false;
      }
    };
    loadUsers();
  }, []); // Executar apenas uma vez ao montar

  // Usar todas as filas disponíveis para os filtros (não apenas as dos tickets)
  const queueOptions = useMemo(() => {
    if (allQueues.length > 0) {
      return allQueues;
    }
    // Fallback: usar filas dos tickets se ainda não carregou todas
    const map = new Map();
    tickets.forEach(t => {
      const id = String(t.queue?.id || t.whatsappId || t.queueId || '');
      const name = t.queue?.name || t.whatsapp?.name || (id ? `Fila ${id}` : '');
      if (id) map.set(id, name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [allQueues, tickets]);

  // Usar todos os usuários disponíveis para os filtros (não apenas os dos tickets)
  const userOptions = useMemo(() => {
    if (allUsers.length > 0) {
      return allUsers;
    }
    // Fallback: usar usuários dos tickets se ainda não carregou todos
    const map = new Map();
    tickets.forEach(t => {
      const id = String(t.user?.id || t.userId || '');
      const name = t.user?.name || (id ? `Usuário ${id}` : '');
      if (id) map.set(id, name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [allUsers, tickets]);

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

  const totalTickets = useMemo(() => {
    return tickets.length;
  }, [tickets]);

  return (
    <Box className={classes.root}>
      <MainContainer useWindowScroll>
        <Box className={classes.container}>
          <MainHeader>
            <Grid style={{ width: "99.6%" }} container>
              <Grid xs={12} sm={5} item>
                <Title>
                  {i18n.t('kanban.title')} ({totalTickets})
                </Title>
              </Grid>
              <Grid xs={12} sm={7} item>
                <Grid container alignItems="center" spacing={2}>
                  <Grid item xs>
                    <TextField
                      fullWidth
                      placeholder={i18n.t('kanban.searchContact')}
                      type="search"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      variant="outlined"
                      size="small"
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
                      <Tooltip {...CustomTooltipProps} title="Filtrar e ordenar">
                        <IconButton
                          size="small"
                          onClick={() => setFiltersModalOpen(true)}
                          style={{
                            color: "#374151",
                            backgroundColor: "#ffffff",
                            border: "1px solid #d1d5db",
                            borderRadius: "8px"
                          }}
                          aria-label="Filtrar e ordenar"
                        >
                          <FilterList fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Can role={user.profile} perform="dashboard:view" yes={() => (
                        <Tooltip {...CustomTooltipProps} title={i18n.t('kanban.addColumns')}>
                          <IconButton
                            size="small"
                            onClick={handleAddConnectionClick}
                            style={{
                              color: "#374151",
                              backgroundColor: "#ffffff",
                              border: "1px solid #d1d5db",
                              borderRadius: "8px"
                            }}
                            aria-label={i18n.t('kanban.addColumns')}
                          >
                            <Add fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )} />
                      <Tooltip {...CustomTooltipProps} title={i18n.t('kanban.resetColumns')}>
                        <IconButton
                          size="small"
                          onClick={handleResetHiddenLanes}
                          style={{
                            color: "#6366f1",
                            backgroundColor: "#ffffff",
                            border: "1px solid #6366f1",
                            borderRadius: "8px"
                          }}
                          aria-label={i18n.t('kanban.resetColumns')}
                        >
                          <Refresh fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </div>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </MainHeader>
          <Box className={classes.kanbanContainer}>
        {!file || !file.lanes ? (
          // Loader simples: blocos placeholder
          <div style={{ display: 'flex', gap: 12 }}>
            {[1,2,3].map(i=> (
              <div key={i} style={{ width: 320, borderRadius: 16, padding: 8, background: '#f5f5f5' }}>
                <div style={{ height: 28, background: '#e9e9e9', borderRadius: 8, marginBottom: 8 }} />
                {[1,2,3].map(j=> (
                  <div key={j} style={{ height: 80, background: '#F8FAFC', borderRadius: 12, margin: '8px 0' }} />
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
          </Box>
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
        </Box>
      </MainContainer>
    </Box>
  );
};

export default Kanban;
