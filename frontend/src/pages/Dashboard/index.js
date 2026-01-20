import React, { useContext, useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Avatar,
  Button,
  IconButton,
  Paper,
  Stack,
  SvgIcon,
  Tab,
  Tabs,
  Divider,
  useTheme
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {
  Phone as CallIcon,
  Hourglass as HourglassEmptyIcon,
  CheckCircle2 as CheckCircleIcon,
  Headset as RecordVoiceOverIcon,
  UserPlus as GroupAddIcon,
  Users as Groups,
  Download as SaveAlt,
} from "lucide-react";
import * as XLSX from 'xlsx';
import { toast } from "react-toastify";
import { isArray, isEmpty } from "lodash";
import moment from "moment";
import TableAttendantsStatus from "../../components/Dashboard/TableAttendantsStatus";
import { AuthContext } from "../../context/Auth/AuthContext";
import useDashboard from "../../hooks/useDashboard";
import useContacts from "../../hooks/useContacts";
import useMessages from "../../hooks/useMessages";
import { ChatsUser } from "./ChartsUser";
import ChartDonut from "./ChartDonut";
import Filters from "./Filters";
import { ChartsDate } from "./ChartsDate";
import ForbiddenPage from "../../components/ForbiddenPage";
import { i18n } from "../../translate/i18n";
import ColorModeContext from "../../layout/themeContext";

const Dashboard = () => {
  const theme = useTheme();
  const [counters, setCounters] = useState({});
  const [attendants, setAttendants] = useState([]);
  const [showFilter, setShowFilter] = useState(false);
  const [dateStartTicket, setDateStartTicket] = useState(moment().startOf('month').format("YYYY-MM-DD"));
  const [dateEndTicket, setDateEndTicket] = useState(moment().format("YYYY-MM-DD"));
  const [queueTicket, setQueueTicket] = useState(false);
  const [fetchDataFilter, setFetchDataFilter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const { find } = useDashboard();
  const { user } = useContext(AuthContext);
  const { colorMode } = useContext(ColorModeContext);
  const { viewMode } = colorMode || {};

  let newDate = new Date();
  let date = newDate.getDate();
  let month = newDate.getMonth() + 1;
  let year = newDate.getFullYear();
  let nowIni = `${year}-${month < 10 ? `0${month}` : `${month}`}-01`;
  let now = `${year}-${month < 10 ? `0${month}` : `${month}`}-${date < 10 ? `0${date}` : `${date}`}`;

  useEffect(() => {
    async function firstLoad() {
      await fetchData();
    }
    setTimeout(() => {
      firstLoad();
    }, 1000);
  }, [fetchDataFilter]);

  async function fetchData() {
    setLoading(true);
    let params = {};
    if (!isEmpty(dateStartTicket) && moment(dateStartTicket).isValid()) {
      params = { ...params, date_from: moment(dateStartTicket).format("YYYY-MM-DD") };
    }
    if (!isEmpty(dateEndTicket) && moment(dateEndTicket).isValid()) {
      params = { ...params, date_to: moment(dateEndTicket).format("YYYY-MM-DD") };
    }
    if (Object.keys(params).length === 0) {
      toast.error("Parametrize o filtro");
      setLoading(false);
      return;
    }
    const data = await find(params);
    setCounters(data.counters);
    if (isArray(data.attendants)) {
      setAttendants(data.attendants);
    } else {
      setAttendants([]);
    }
    setLoading(false);
  }

  const exportarGridParaExcel = () => {
    const ws = XLSX.utils.table_to_sheet(document.getElementById('grid-attendants'));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RelatorioDeAtendentes');
    XLSX.writeFile(wb, 'relatorio-de-atendentes.xlsx');
  };

  function formatTime(minutes) {
    return moment().startOf("day").add(minutes, "minutes").format("HH[h] mm[m]");
  }

  const GetUsers = () => {
    let userOnline = 0;
    attendants.forEach(user => {
      if (user.online === true) {
        userOnline = userOnline + 1;
      }
    });
    return userOnline;
  };

  const GetContacts = (all) => {
    let props = all ? {} : { dateStart: dateStartTicket, dateEnd: dateEndTicket };
    const { count } = useContacts(props);
    return count;
  };

  const GetMessages = (all, fromMe) => {
    let props = all
      ? { fromMe }
      : { fromMe, dateStart: dateStartTicket, dateEnd: dateEndTicket };
    const { count } = useMessages(props);
    return count;
  };

  function toggleShowFilter() {
    setShowFilter(!showFilter);
  }

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  if (user.profile === "user" && user.showDashboard === "disabled") {
    return <ForbiddenPage />;
  }

  const statCards = [
    {
      title: i18n.t("dashboard.cards.inAttendance"),
      value: counters.supportHappening || 0,
      icon: <CallIcon />,
      color: "#3598dc"
    },
    {
      title: i18n.t("dashboard.cards.waiting"),
      value: counters.supportPending || 0,
      icon: <HourglassEmptyIcon />,
      color: "#32c5d2"
    },
    {
      title: i18n.t("dashboard.cards.finalized"),
      value: counters.supportFinished || 0,
      icon: <CheckCircleIcon />,
      color: "#26c281"
    },
    {
      title: i18n.t("dashboard.cards.groups"),
      value: counters.supportGroups || 0,
      icon: <Groups />,
      color: "#8e44ad"
    },
    {
      title: i18n.t("dashboard.cards.activeAttendants"),
      value: `${GetUsers() || 0}/${attendants.length || 0}`,
      icon: <RecordVoiceOverIcon />,
      color: "#e7505a"
    },
    {
      title: i18n.t("dashboard.cards.newContacts"),
      value: counters.leads || 0,
      icon: <GroupAddIcon />,
      color: "#f39c12"
    }
  ];

  return (
    <Box sx={{
      backgroundColor: viewMode === "modern" ? "transparent" : "#f5f7fa",
      minHeight: "100vh",
      py: 2,
      fontFamily: viewMode === "modern" ? "'Plus Jakarta Sans', sans-serif" : "inherit"
    }}>
      <Container maxWidth={false} sx={{ px: 2 }}>
        {/* Header with filter button */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Typography variant="h4" fontWeight="bold" color={viewMode === "modern" ? "text.primary" : "primary"}>
            {i18n.t("dashboard.title") || "Dashboard"}
          </Typography>

        </Box>

        {/* Filters Section */}
        {showFilter && (
          <Paper
            sx={{
              p: 2,
              mb: 3,
              borderRadius: 2,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}
          >
            <Filters
              setDateStartTicket={setDateStartTicket}
              setDateEndTicket={setDateEndTicket}
              dateStartTicket={dateStartTicket}
              dateEndTicket={dateEndTicket}
              setQueueTicket={setQueueTicket}
              queueTicket={queueTicket}
              fetchData={setFetchDataFilter}
            />
          </Paper>
        )}

        {/* Statistics Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {statCards.map((card, index) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={index}>
              <Card
                className={viewMode === "modern" ? "glass-card" : ""}
                sx={{
                  height: "100%",
                  borderRadius: viewMode === "modern" ? 4 : 2,
                  boxShadow: viewMode === "modern" ? "0 8px 32px rgba(0,0,0,0.05)" : "0 2px 8px rgba(0,0,0,0.08)",
                  transition: "transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out",
                  border: viewMode === "modern" ? "1px solid rgba(255,255,255,0.3)" : "none",
                  background: viewMode === "modern" ? "rgba(255,255,255,0.7) !important" : "white",
                  backdropFilter: viewMode === "modern" ? "blur(10px)" : "none",
                  "&:hover": {
                    transform: "translateY(-3px)",
                    boxShadow: viewMode === "modern" ? "0 12px 40px rgba(0,0,0,0.12)" : "0 4px 12px rgba(0,0,0,0.15)"
                  }
                }}
              >
                <CardContent>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    spacing={1}
                  >
                    <Box>
                      <Typography
                        variant="overline"
                        sx={{
                          fontWeight: 600,
                          fontSize: "0.7rem",
                          color: "text.secondary"
                        }}
                      >
                        {card.title}
                      </Typography>
                      <Typography
                        variant="h4"
                        sx={{
                          fontWeight: "bold",
                          color: "text.primary"
                        }}
                      >
                        {card.value}
                      </Typography>
                    </Box>
                    <Avatar
                      sx={{
                        bgcolor: card.color,
                        width: 48,
                        height: 48
                      }}
                    >
                      {card.icon}
                    </Avatar>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Tabs Navigation */}
        <Paper sx={{
          mb: 3,
          borderRadius: 2,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
        }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label={i18n.t("dashboard.tabs.performance")} />
            <Tab label={i18n.t("dashboard.tabs.assessments")} />
            <Tab label={i18n.t("dashboard.tabs.attendants")} />
          </Tabs>
        </Paper>

        {/* Tab Panels */}
        {/* Performance Tab */}
        {activeTab === 0 && (
          <Paper
            className={viewMode === "modern" ? "glass-card" : ""}
            sx={{
              p: 3,
              borderRadius: viewMode === "modern" ? 4 : 2,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              background: viewMode === "modern" ? "rgba(255,255,255,0.7) !important" : "white",
              backdropFilter: viewMode === "modern" ? "blur(10px)" : "none",
            }}
          >
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              {i18n.t("dashboard.charts.performance")}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <ChartsDate />
          </Paper>
        )}

        {/* Assessments Tab - NPS Data */}
        {activeTab === 1 && (
          <Paper
            sx={{
              p: 3,
              borderRadius: 2,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h6" fontWeight="bold">
                {i18n.t("dashboard.tabs.assessments")}
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3}>
              {/* Main NPS Score */}
              <Grid item xs={12} md={3}>
                <Card
                  sx={{
                    height: "100%",
                    borderRadius: 2,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                    bgcolor: "#f8f9fa"
                  }}
                >
                  <CardContent>
                    <ChartDonut
                      data={[
                        `{'name': 'Promotores', 'value': ${counters.npsPromotersPerc || 100}}`,
                        `{'name': 'Detratores', 'value': ${counters.npsDetractorsPerc || 0}}`,
                        `{'name': 'Neutros', 'value': ${counters.npsPassivePerc || 0}}`
                      ]}
                      value={counters.npsScore || 0}
                      title="Score"
                      color={(parseInt(counters.npsPromotersPerc || 0) + parseInt(counters.npsDetractorsPerc || 0) + parseInt(counters.npsPassivePerc || 0)) === 0 ? ["#918F94"] : ["#2EA85A", "#F73A2C", "#F7EC2C"]}
                    />
                  </CardContent>
                </Card>
              </Grid>

              {/* Promoters */}
              <Grid item xs={12} md={3}>
                <Card
                  sx={{
                    height: "100%",
                    borderRadius: 2,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                    bgcolor: "#f8f9fa"
                  }}
                >
                  <CardContent>
                    <ChartDonut
                      title={i18n.t("dashboard.assessments.prosecutors")}
                      value={counters.npsPromotersPerc || 0}
                      data={[`{'name': 'Promotores', 'value': 100}`]}
                      color={["#2EA85A"]}
                    />
                  </CardContent>
                </Card>
              </Grid>

              {/* Neutral */}
              <Grid item xs={12} md={3}>
                <Card
                  sx={{
                    height: "100%",
                    borderRadius: 2,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                    bgcolor: "#f8f9fa"
                  }}
                >
                  <CardContent>
                    <ChartDonut
                      data={[`{'name': 'Neutros', 'value': 100}`]}
                      title={i18n.t("dashboard.assessments.neutral")}
                      value={counters.npsPassivePerc || 0}
                      color={["#F7EC2C"]}
                    />
                  </CardContent>
                </Card>
              </Grid>

              {/* Detractors */}
              <Grid item xs={12} md={3}>
                <Card
                  sx={{
                    height: "100%",
                    borderRadius: 2,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                    bgcolor: "#f8f9fa"
                  }}
                >
                  <CardContent>
                    <ChartDonut
                      data={[`{'name': 'Detratores', 'value': 100}`]}
                      title={i18n.t("dashboard.assessments.detractors")}
                      value={counters.npsDetractorsPerc || 0}
                      color={["#F73A2C"]}
                    />
                  </CardContent>
                </Card>
              </Grid>

              {/* Assessment Summary */}
              <Grid item xs={12}>
                <Card
                  sx={{
                    borderRadius: 2,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                    bgcolor: "#f8f9fa"
                  }}
                >
                  <CardContent>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <Box sx={{ textAlign: "center", p: 2 }}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {i18n.t("dashboard.assessments.totalCalls")}
                          </Typography>
                          <Typography variant="h4" fontWeight="bold" color="primary">
                            {counters.tickets || 0}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box sx={{ textAlign: "center", p: 2 }}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {i18n.t("dashboard.assessments.ratedCalls")}
                          </Typography>
                          <Typography variant="h4" fontWeight="bold" color="primary">
                            {counters.withRating || 0}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box sx={{ textAlign: "center", p: 2 }}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {i18n.t("dashboard.assessments.evaluationIndex")}
                          </Typography>
                          <Typography variant="h4" fontWeight="bold" color="primary">
                            {Number(counters.percRating / 100 || 0).toLocaleString(undefined, { style: 'percent' })}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Attendants Tab */}
        {activeTab === 2 && (
          <Paper
            sx={{
              p: 3,
              borderRadius: 2,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h6" fontWeight="bold">
                {i18n.t("dashboard.tabs.attendants")}
              </Typography>

              <IconButton
                onClick={exportarGridParaExcel}
                color="primary"
                size="small"
                sx={{
                  bgcolor: "rgba(53, 152, 220, 0.1)",
                  "&:hover": {
                    bgcolor: "rgba(53, 152, 220, 0.2)"
                  }
                }}
              >
                <SaveAlt />
              </IconButton>
            </Box>
            <Divider sx={{ mb: 3 }} />

            <div id="grid-attendants">
              {attendants.length > 0 && (
                <TableAttendantsStatus
                  attendants={attendants}
                  loading={loading}
                />
              )}
            </div>

            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                {i18n.t("dashboard.charts.userPerformance")}
              </Typography>
              <ChatsUser />
            </Box>
          </Paper>
        )}
      </Container>
    </Box>
  );
};

export default Dashboard;