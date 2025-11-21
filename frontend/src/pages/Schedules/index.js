import React, { useState, useEffect, useReducer, useCallback, useContext } from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Paper, Box, useMediaQuery, TextField, InputAdornment, Grid, Button, Tooltip } from "@material-ui/core";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import ScheduleModal from "../../components/ScheduleModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import moment from "moment";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePlans from "../../hooks/usePlans";
import { Calendar, momentLocalizer } from "react-big-calendar";
import "moment/locale/pt-br";
import "react-big-calendar/lib/css/react-big-calendar.css";
import SearchIcon from "@material-ui/icons/Search";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import { Plus } from "lucide-react";

import "./Schedules.css"; // Importe o arquivo CSS

// Defina a função getUrlParam antes de usá-la
function getUrlParam(paramName) {
  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get(paramName);
}

const eventTitleStyle = {
  fontSize: "14px", // Defina um tamanho de fonte menor
  overflow: "hidden", // Oculte qualquer conteúdo excedente
  whiteSpace: "nowrap", // Evite a quebra de linha do texto
  textOverflow: "ellipsis", // Exiba "..." se o texto for muito longo
};

const localizer = momentLocalizer(moment);
var defaultMessages = {
  date: "Data",
  time: "Hora",
  event: "Evento",
  allDay: "Dia Todo",
  week: "Semana",
  work_week: "Agendamentos",
  day: "Dia",
  month: "Mês",
  previous: "Anterior",
  next: "Próximo",
  yesterday: "Ontem",
  tomorrow: "Amanhã",
  today: "Hoje",
  agenda: "Agenda",
  noEventsInRange: "Não há agendamentos no período.",
  showMore: function showMore(total) {
    return "+" + total + " mais";
  }
};

const reducer = (state, action) => {
  if (action.type === "LOAD_SCHEDULES") {
    const schedules = action.payload;
    const newSchedules = [];

    schedules.forEach((schedule) => {
      const scheduleIndex = state.findIndex((s) => s.id === schedule.id);
      if (scheduleIndex !== -1) {
        state[scheduleIndex] = schedule;
      } else {
        newSchedules.push(schedule);
      }
    });

    return [...state, ...newSchedules];
  }

  if (action.type === "UPDATE_SCHEDULES") {
    const schedule = action.payload;
    const scheduleIndex = state.findIndex((s) => s.id === schedule.id);

    if (scheduleIndex !== -1) {
      state[scheduleIndex] = schedule;
      return [...state];
    } else {
      return [schedule, ...state];
    }
  }

  if (action.type === "DELETE_SCHEDULE") {
    const scheduleId = action.payload;

    const scheduleIndex = state.findIndex((s) => s.id === scheduleId);
    if (scheduleIndex !== -1) {
      state.splice(scheduleIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
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
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  calendarToolbar: {
    '& .rbc-toolbar-label': {
      color: theme.mode === "light" ? theme.palette.light : "white",
    },
    '& .rbc-btn-group button': {
      color: theme.mode === "light" ? theme.palette.light : "white",
      '&:hover': {
        color: theme.palette.mode === 'dark' ? '#fff' : '#000',
      },
      '&:active': {
        color: theme.palette.mode === 'dark' ? '#fff' : '#000',
      },
      '&:focus': {
        color: theme.palette.mode === 'dark' ? '#fff' : '#000',
      },
      '&.rbc-active': {
        color: theme.palette.mode === 'dark' ? '#fff' : '#000',
      },
    },
  },
}));

const CustomTooltipProps = {
  arrow: true,
  enterTouchDelay: 0,
  leaveTouchDelay: 5000,
  enterDelay: 300,
  leaveDelay: 100,
};

const Schedules = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up(1200));
  const history = useHistory();
  const { user, socket } = useContext(AuthContext);


  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [deletingSchedule, setDeletingSchedule] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [schedules, dispatch] = useReducer(reducer, []);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [contactId, setContactId] = useState(+getUrlParam("contactId"));

  const { getPlanCompany } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useSchedules) {
        toast.error("Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando.");
        setTimeout(() => {
          history.push(`/`)
        }, 1000);
      }
    }
    fetchData();
  }, [user, history, getPlanCompany]);

  const fetchSchedules = useCallback(async () => {
    try {
      const { data } = await api.get("/schedules", {
        params: { searchParam, pageNumber },
      });

      dispatch({ type: "LOAD_SCHEDULES", payload: data.schedules });
      setHasMore(data.hasMore);
      setLoading(false);
    } catch (err) {
      toastError(err);
    }
  }, [searchParam, pageNumber]);

  const handleOpenScheduleModalFromContactId = useCallback(() => {
    if (contactId) {
      handleOpenScheduleModal();
    }
  }, [contactId]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchSchedules();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [
    searchParam,
    pageNumber,
    contactId,
    fetchSchedules,
    handleOpenScheduleModalFromContactId,
  ]);

  useEffect(() => {
    // handleOpenScheduleModalFromContactId();
    // const socket = socketManager.GetSocket(user.companyId, user.id);


    const onCompanySchedule = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_SCHEDULES", payload: data.schedule });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_SCHEDULE", payload: +data.scheduleId });
      }
    }

    socket.on(`company${user.companyId}-schedule`, onCompanySchedule)

    return () => {
      socket.off(`company${user.companyId}-schedule`, onCompanySchedule)
    };
  }, [socket]);

  const cleanContact = () => {
    setContactId("");
  };

  const handleOpenScheduleModal = () => {
    setSelectedSchedule(null);
    setScheduleModalOpen(true);
  };

  const handleCloseScheduleModal = () => {
    setSelectedSchedule(null);
    setScheduleModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditSchedule = (schedule) => {
    setSelectedSchedule(schedule);
    setScheduleModalOpen(true);
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      await api.delete(`/schedules/${scheduleId}`);
      toast.success(i18n.t("schedules.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingSchedule(null);
    setSearchParam("");
    setPageNumber(1);

    dispatch({ type: "RESET" });
    setPageNumber(1);
    await fetchSchedules();
  };

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

  const truncate = (str, len) => {
    if (str.length > len) {
      return str.substring(0, len) + "...";
    }
    return str;
  };

  return (
    <Box className={classes.root}>
      <MainContainer useWindowScroll>
        <Box className={classes.container}>
          <ConfirmationModal
            title={
              deletingSchedule &&
              `${i18n.t("schedules.confirmationModal.deleteTitle")}`
            }
            open={confirmModalOpen}
            onClose={() => setConfirmModalOpen(false)}
            onConfirm={() => handleDeleteSchedule(deletingSchedule.id)}
          >
            {i18n.t("schedules.confirmationModal.deleteMessage")}
          </ConfirmationModal>
          {scheduleModalOpen && (
            <ScheduleModal
              open={scheduleModalOpen}
              onClose={handleCloseScheduleModal}
              reload={fetchSchedules}
              scheduleId={
                selectedSchedule ? selectedSchedule.id : null
              }
              contactId={contactId}
              cleanContact={cleanContact}
            />
          )}
          <MainHeader>
            <Grid style={{ width: "99.6%" }} container>
              <Grid xs={12} sm={5} item>
                <Title>
                  {i18n.t("schedules.title")} ({schedules.length})
                </Title>
              </Grid>
              <Grid xs={12} sm={7} item>
                <Grid container alignItems="center" spacing={2}>
                  <Grid item xs>
                    <TextField
                      fullWidth
                      placeholder={i18n.t("contacts.searchPlaceholder")}
                      type="search"
                      value={searchParam}
                      onChange={handleSearch}
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
                    <Tooltip {...CustomTooltipProps} title={i18n.t("schedules.buttons.add")}>
                      <Button
                        onClick={handleOpenScheduleModal}
                        variant="contained"
                        size="small"
                        style={{ 
                          backgroundColor: "#4ade80",
                          color: "#ffffff",
                          textTransform: "uppercase",
                          fontWeight: 600,
                          borderRadius: "8px"
                        }}
                        startIcon={<Plus className="w-4 h-4" />}
                        aria-label={i18n.t("schedules.buttons.add")}
                      >
                        {i18n.t("schedules.buttons.add")}
                      </Button>
                    </Tooltip>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </MainHeader>
          <Paper className={classes.mainPaper} variant="outlined" onScroll={handleScroll}>
            <Calendar
              messages={defaultMessages}
              formats={{
                agendaDateFormat: "DD/MM ddd",
                weekdayFormat: "dddd"
              }}
              localizer={localizer}
              events={schedules.map((schedule) => ({
                title: (
                  <div key={schedule.id} className="event-container">
                    <div style={eventTitleStyle}>{schedule?.contact?.name}</div>
                    <DeleteOutlineIcon
                      onClick={() => handleDeleteSchedule(schedule.id)}
                      className="delete-icon"
                    />
                    <EditIcon
                      onClick={() => {
                        handleEditSchedule(schedule);
                        setScheduleModalOpen(true);
                      }}
                      className="edit-icon"
                    />
                  </div>
                ),
                start: new Date(schedule.sendAt),
                end: new Date(schedule.sendAt),
              }))}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 500 }}
              className={classes.calendarToolbar}
            />
          </Paper>
        </Box>
      </MainContainer>
    </Box>
  );
};

export default Schedules;