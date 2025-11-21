import React, { useState, useEffect, useReducer, useContext, useMemo } from "react";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Paper, Button, Chip, Typography, Grid, Box, Card, CardContent, CardHeader, Divider, Avatar, CircularProgress, Tooltip, useMediaQuery } from "@material-ui/core";

// Ícones
import PaymentIcon from "@material-ui/icons/Payment";
import ReceiptIcon from "@material-ui/icons/Receipt";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import ErrorIcon from "@material-ui/icons/Error";
import HourglassEmptyIcon from "@material-ui/icons/HourglassEmpty";
import PersonIcon from "@material-ui/icons/Person";
import DevicesIcon from "@material-ui/icons/Devices";
import QueueIcon from "@material-ui/icons/Queue";
import MoneyIcon from "@material-ui/icons/Money";
import DateRangeIcon from "@material-ui/icons/DateRange";
import InfoIcon from "@material-ui/icons/Info";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import SubscriptionModal from "../../components/SubscriptionModal";
import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

import moment from "moment";

const reducer = (state, action) => {
  if (action.type === "LOAD_INVOICES") {
    const invoices = action.payload;
    const newUsers = [];

    invoices.forEach((user) => {
      const userIndex = state.findIndex((u) => u.id === user.id);
      if (userIndex !== -1) {
        state[userIndex] = user;
      } else {
        newUsers.push(user);
      }
    });

    return [...state, ...newUsers];
  }

  if (action.type === "UPDATE_USERS") {
    const user = action.payload;
    const userIndex = state.findIndex((u) => u.id === user.id);

    if (userIndex !== -1) {
      state[userIndex] = user;
      return [...state];
    } else {
      return [user, ...state];
    }
  }

  if (action.type === "DELETE_USER") {
    const userId = action.payload;

    const userIndex = state.findIndex((u) => u.id === userId);
    if (userIndex !== -1) {
      state.splice(userIndex, 1);
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
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHead: {
    backgroundColor: theme.palette.grey[100],
    "& th": {
      padding: theme.spacing(1.5),
      textAlign: "left",
      fontSize: "0.75rem",
      fontWeight: 600,
      textTransform: "uppercase",
    color: theme.palette.text.secondary,
      borderBottom: `2px solid ${theme.palette.divider}`,
    },
  },
  tableBody: {
    "& tr": {
      borderBottom: `1px solid ${theme.palette.divider}`,
      transition: "background-color 0.2s",
    "&:hover": {
        backgroundColor: theme.palette.action.hover,
      },
      "&:last-child": {
        borderBottom: "none",
    },
    },
    "& td": {
      padding: theme.spacing(1.5),
      fontSize: "0.875rem",
      color: theme.palette.text.primary,
    },
  },
  emptyState: {
    padding: theme.spacing(4),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
  chipPaid: {
    backgroundColor: theme.palette.success.main,
    color: "#fff",
    fontWeight: "bold",
  },
  chipPending: {
    backgroundColor: theme.palette.warning.main,
    color: "#fff",
    fontWeight: "bold",
  },
  chipOverdue: {
    backgroundColor: theme.palette.error.main,
    color: "#fff",
    fontWeight: "bold",
  },
  avatarIcon: {
    backgroundColor: theme.palette.primary.main,
    marginRight: theme.spacing(1),
  },
  paymentButton: {
    borderRadius: 20,
    textTransform: "none",
    fontWeight: "bold",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    color: "#fff",
    background: `linear-gradient(45deg, ${theme.palette.secondary.main} 30%, ${theme.palette.secondary.light} 90%)`,
    "&:hover": {
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    },
  },
  paidButton: {
    borderRadius: 20,
    textTransform: "none",
    fontWeight: "bold",
    color: theme.palette.success.main,
    borderColor: theme.palette.success.main,
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: theme.spacing(3),
    padding: theme.spacing(2, 0),
    [theme.breakpoints.down("xs")]: {
      gridTemplateColumns: "1fr",
    },
  },
  card: {
    borderRadius: 16,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
    transition: "transform 0.2s, box-shadow 0.2s",
    "&:hover": {
      transform: "translateY(-4px)",
      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
    },
  },
  cardHeader: {
    paddingBottom: 0,
  },
  cardAvatar: {
    backgroundColor: theme.palette.primary.main,
  },
  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  detailItem: {
    display: "flex",
    alignItems: "center",
    marginBottom: theme.spacing(1),
  },
  detailIcon: {
    marginRight: theme.spacing(1),
    color: theme.palette.primary.main,
    fontSize: 18,
  },
  bold: {
    fontWeight: "bold",
  },
  statusDivider: {
    margin: theme.spacing(2, 0),
  },
  cardActions: {
    display: "flex",
    justifyContent: "flex-end",
    padding: theme.spacing(2),
  },
  mobileView: {
    display: "none",
    [theme.breakpoints.down("sm")]: {
      display: "block",
    },
  },
  desktopView: {
    display: "block",
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  title: {
    display: "flex",
    alignItems: "center",
    "& svg": {
      marginRight: theme.spacing(1),
      color: theme.palette.primary.main,
    },
  },
  invoiceCount: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    borderRadius: 20,
    padding: theme.spacing(0.5, 1.5),
    fontSize: 14,
    marginLeft: theme.spacing(1),
  },
}));

const Invoices = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDesktop = useMediaQuery(theme.breakpoints.up(1200));
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchParam] = useState("");
  const [invoices, dispatch] = useReducer(reducer, []);
  const [storagePlans, setStoragePlans] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [companyPlan, setCompanyPlan] = useState(null);

  const handleOpenContactModal = (invoice) => {
    // Create a copy of the invoice but replace the value with the plan amount
    const invoiceWithPlanValue = {
      ...invoice,
      value: companyPlan && companyPlan.amount ? parseFloat(companyPlan.amount) : invoice.value
    };
    
    setStoragePlans(invoiceWithPlanValue);
    setSelectedContactId(null);
    setContactModalOpen(true);
  };

  const handleCloseContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(false);
  };
  
  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  // Fetch Company info first, then get the plan using the planId
  useEffect(() => {
    const fetchCompanyPlan = async () => {
      try {
        if (user && user.companyId) {
          // First get the company info to access its planId
          const companyResponse = await api.get(`/companies/${user.companyId}`);
          const company = companyResponse.data;
          
          if (company && company.planId) {
            // Now use the planId to get the plan details
            const planResponse = await api.get(`/plans/${company.planId}`);
            setCompanyPlan(planResponse.data);
          }
        }
      } catch (err) {
        toastError(err);
      }
    };
    fetchCompanyPlan();
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchInvoices = async () => {
        try {
          const { data } = await api.get("/invoices/all", {
            params: { searchParam, pageNumber },
          });

          dispatch({ type: "LOAD_INVOICES", payload: data });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchInvoices();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);
  useEffect(() => {
    window.addEventListener("error", (e) => {
      console.error("Erro global capturado:", e.message, e.error);
    });
  }, []);

  const isLoadingFallback = !user || !user.companyId || !companyPlan;

  if (isLoadingFallback) {
    return (
      <MainContainer>
        <MainHeader>
          <Title>Faturas</Title>
        </MainHeader>
        <Box display="flex" justifyContent="center" my={6}>
          <CircularProgress />
        </Box>
      </MainContainer>
    );
  }


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

  const rowStyle = (record) => {
    const hoje = moment(moment()).format("DD/MM/yyyy");
    const vencimento = moment(record.dueDate).format("DD/MM/yyyy");
    var diff = moment(vencimento, "DD/MM/yyyy").diff(moment(hoje, "DD/MM/yyyy"));
    var dias = moment.duration(diff).asDays();
    if (dias < 0 && record.status !== "paid") {
      return { backgroundColor: "rgba(255, 188, 188, 0.15)" };
    }
  };

  const getInvoiceStatus = (record) => {
    const hoje = moment(moment()).format("DD/MM/yyyy");
    const vencimento = moment(record.dueDate).format("DD/MM/yyyy");
    var diff = moment(vencimento, "DD/MM/yyyy").diff(moment(hoje, "DD/MM/yyyy"));
    var dias = moment.duration(diff).asDays();
    const status = record.status;
    if (status === "paid") {
      return { text: "Pago", chip: classes.chipPaid, icon: <CheckCircleIcon /> };
    }
    if (dias < 0) {
      return { text: "Vencido", chip: classes.chipOverdue, icon: <ErrorIcon /> };
    } else {
      return { text: "Em Aberto", chip: classes.chipPending, icon: <HourglassEmptyIcon /> };
    }
  };

  const renderDaysLeft = (record) => {
    const hoje = moment(moment()).format("DD/MM/yyyy");
    const vencimento = moment(record.dueDate).format("DD/MM/yyyy");
    var diff = moment(vencimento, "DD/MM/yyyy").diff(moment(hoje, "DD/MM/yyyy"));
    var dias = moment.duration(diff).asDays();
    
    if (record.status === "paid") {
      return null;
    }
    
    if (dias < 0) {
      return `Vencido há ${Math.abs(Math.floor(dias))} dias`;
    } else if (dias === 0) {
      return "Vence hoje";
    } else {
      return `Vence em ${Math.floor(dias)} dias`;
    }
  };

  // Renderização de cards para visualização móvel
  const renderMobileCards = () => {
    if (loading && invoices.length === 0) {
      return (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      );
    }

    return (
      <div className={classes.cardGrid}>
        {invoices.map((invoice) => {
          const statusInfo = getInvoiceStatus(invoice);
          return (
            <Card key={invoice.id} className={classes.card}>
              <CardHeader
                className={classes.cardHeader}
                avatar={
                  <Avatar className={classes.cardAvatar}>
                    <ReceiptIcon />
                  </Avatar>
                }
                title={
                  <Typography variant="h6" component="h2">
                    {invoice.detail}
                  </Typography>
                }
                subheader={
                  <Typography variant="caption">
                    ID: {invoice.id}
                  </Typography>
                }
              />
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Chip
                    icon={statusInfo.icon}
                    label={statusInfo.text}
                    className={statusInfo.chip}
                    size="small"
                  />
                  <Typography variant="body2" color="textSecondary">
                    {renderDaysLeft(invoice)}
                  </Typography>
                </Box>

                <Divider className={classes.statusDivider} />

                <div className={classes.detailsGrid}>
                  <div className={classes.detailItem}>
                    <PersonIcon className={classes.detailIcon} />
                    <Typography variant="body2">
                      {companyPlan && companyPlan.users} usuários
                    </Typography>
                  </div>
                  <div className={classes.detailItem}>
                    <DevicesIcon className={classes.detailIcon} />
                    <Typography variant="body2">
                      {companyPlan && companyPlan.connections} conexões
                    </Typography>
                  </div>
                  <div className={classes.detailItem}>
                    <QueueIcon className={classes.detailIcon} />
                    <Typography variant="body2">
                      {companyPlan && companyPlan.queues} filas
                    </Typography>
                  </div>
                  <div className={classes.detailItem}>
                    <DateRangeIcon className={classes.detailIcon} />
                    <Typography variant="body2">
                      {moment(invoice.dueDate).format("DD/MM/YYYY")}
                    </Typography>
                  </div>
                </div>

                <Box mt={3}>
                  <Typography variant="h6" className={classes.bold} color="primary">
                    <MoneyIcon className={classes.detailIcon} />
                    {companyPlan && companyPlan.amount 
                      ? parseFloat(companyPlan.amount).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })
                      : invoice.value.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })}
                  </Typography>
                </Box>

                <Box mt={3} display="flex" justifyContent="flex-end">
                  {statusInfo.text !== "Pago" ? (
                    <Button
                      variant="contained"
                      className={classes.paymentButton}
                      startIcon={<PaymentIcon />}
                      onClick={() => handleOpenContactModal(invoice)}
                    >
                      PAGAR AGORA
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      className={classes.paidButton}
                      startIcon={<CheckCircleIcon />}
                    >
                      PAGO
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <Box className={classes.root}>
      <MainContainer useWindowScroll>
        <Box className={classes.container}>
      <SubscriptionModal
        open={contactModalOpen}
        onClose={handleCloseContactModal}
        aria-labelledby="form-dialog-title"
        Invoice={storagePlans}
        contactId={selectedContactId}
      />
      
      <MainHeader>
            <Grid style={{ width: "99.6%" }} container>
              <Grid xs={12} sm={8} item>
        <Box className={classes.title}>
          <ReceiptIcon fontSize="large" />
                  <Title>Faturas ({invoices.length})</Title>
        </Box>
              </Grid>
            </Grid>
      </MainHeader>
      
          {isMobile ? (
            /* Mobile View - Cards */
            <div className={classes.cardGrid}>
          {renderMobileCards()}
        </div>
          ) : (
            /* Desktop View - Table */
            <Paper className={classes.mainPaper} variant="outlined">
              <Box style={{ overflowX: "auto" }}>
                <table className={classes.table}>
                  <thead className={classes.tableHead}>
                    <tr>
                      <th scope="col">
                    <Tooltip title="Detalhes da fatura">
                      <Box display="flex" alignItems="center">
                        <InfoIcon fontSize="small" style={{ marginRight: 8 }} />
                            DETALHES
                      </Box>
                    </Tooltip>
                      </th>
                      <th scope="col" style={{ textAlign: "center" }}>
                    <Tooltip title="Número de usuários">
                      <Box display="flex" alignItems="center" justifyContent="center">
                        <PersonIcon fontSize="small" style={{ marginRight: 8 }} />
                            USUÁRIOS
                      </Box>
                    </Tooltip>
                      </th>
                      <th scope="col" style={{ textAlign: "center" }}>
                    <Tooltip title="Número de conexões">
                      <Box display="flex" alignItems="center" justifyContent="center">
                        <DevicesIcon fontSize="small" style={{ marginRight: 8 }} />
                            CONEXÕES
                      </Box>
                    </Tooltip>
                      </th>
                      <th scope="col" style={{ textAlign: "center" }}>
                    <Tooltip title="Número de filas">
                      <Box display="flex" alignItems="center" justifyContent="center">
                        <QueueIcon fontSize="small" style={{ marginRight: 8 }} />
                            FILAS
                      </Box>
                    </Tooltip>
                      </th>
                      <th scope="col" style={{ textAlign: "center" }}>
                    <Tooltip title="Valor da fatura">
                      <Box display="flex" alignItems="center" justifyContent="center">
                        <MoneyIcon fontSize="small" style={{ marginRight: 8 }} />
                            VALOR
                      </Box>
                    </Tooltip>
                      </th>
                      <th scope="col" style={{ textAlign: "center" }}>
                    <Tooltip title="Data de vencimento">
                      <Box display="flex" alignItems="center" justifyContent="center">
                        <DateRangeIcon fontSize="small" style={{ marginRight: 8 }} />
                            VENCIMENTO
                      </Box>
                    </Tooltip>
                      </th>
                      <th scope="col" style={{ textAlign: "center" }}>STATUS</th>
                      <th scope="col" style={{ textAlign: "center" }}>AÇÃO</th>
                    </tr>
                  </thead>
                  <tbody className={classes.tableBody}>
                    {!loading && invoices.length === 0 && (
                      <tr>
                        <td colSpan={8} className={classes.emptyState}>
                          Nenhuma fatura encontrada.
                        </td>
                      </tr>
                    )}
                {invoices.map((invoice) => {
                  const statusInfo = getInvoiceStatus(invoice);
                  return (
                        <tr 
                      key={invoice.id} 
                      style={rowStyle(invoice)} 
                    >
                          <td>{companyPlan.name}</td>
                          <td style={{ textAlign: "center" }}>{companyPlan && companyPlan.users}</td>
                          <td style={{ textAlign: "center" }}>{companyPlan && companyPlan.connections}</td>
                          <td style={{ textAlign: "center" }}>{companyPlan && companyPlan.queues}</td>
                          <td style={{ textAlign: "center", fontWeight: 'bold' }}>
                        {companyPlan && companyPlan.amount 
                          ? parseFloat(companyPlan.amount).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })
                          : invoice.value.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td style={{ textAlign: "center" }}>
                        <Box display="flex" flexDirection="column">
                          <Typography variant="body2">
                            {moment(invoice.dueDate).format("DD/MM/YYYY")}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {renderDaysLeft(invoice)}
                          </Typography>
                        </Box>
                          </td>
                          <td style={{ textAlign: "center" }}>
                        <Chip
                          icon={statusInfo.icon}
                          label={statusInfo.text}
                          className={statusInfo.chip}
                          size="small"
                        />
                          </td>
                          <td style={{ textAlign: "center" }}>
                        {statusInfo.text !== "Pago" ? (
                          <Button
                            size="small"
                            variant="contained"
                            className={classes.paymentButton}
                            startIcon={<PaymentIcon />}
                            onClick={() => handleOpenContactModal(invoice)}
                          >
                            PAGAR
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            className={classes.paidButton}
                            startIcon={<CheckCircleIcon />}
                          >
                            PAGO
                          </Button>
                        )}
                          </td>
                        </tr>
                  );
                })}
                    {loading && (
                      <tr>
                        <td colSpan={8}>
                          <TableRowSkeleton columns={8} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Box>
      </Paper>
          )}
        </Box>
    </MainContainer>
    </Box>
  );
};

export default Invoices;