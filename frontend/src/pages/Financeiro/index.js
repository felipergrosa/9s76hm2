import React, { useState, useEffect, useReducer, useContext, useMemo } from "react";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Box from "@material-ui/core/Box";
import CircularProgress from "@material-ui/core/CircularProgress";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";

// Ícones
import PaymentIcon from "@material-ui/icons/Payment";
import ReceiptIcon from "@material-ui/icons/Receipt";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import ErrorIcon from "@material-ui/icons/Error";
import HourglassEmptyIcon from "@material-ui/icons/HourglassEmpty";
import PersonIcon from "@material-ui/icons/Person";
import DevicesIcon from "@material-ui/icons/Devices";
import QueueIcon from "@material-ui/icons/Queue";
import DateRangeIcon from "@material-ui/icons/DateRange";
import {
  Search as SearchIcon,
  FileText as FileTextIcon,
  CheckCircle2 as CheckCircle2Icon,
  Clock as ClockIcon,
  AlertTriangle as AlertTriangleIcon,
} from "lucide-react";

import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import SubscriptionModal from "../../components/SubscriptionModal";
import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { motion, useReducedMotion } from "framer-motion";
import StatCard from "../../components/bento/StatCard";
import { bentoContainer, bentoItem, bentoItemReduced } from "../../components/bento/motionPresets";
import "../../components/bento/bento.css";

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

// ===== Estilos no padrão de listagem (referência: Connections/index.js) =====
const useStyles = makeStyles((theme) => ({
  paper: {
    flex: 1,
    padding: 0,
    // overflowY auto no Paper: habilita o scroll que dispara a paginação infinita (handleScroll)
    overflowY: "auto",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    ...theme.scrollbarStyles,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    padding: theme.spacing(2, 2.5),
  },
  headerText: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: "0.85rem",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    flexWrap: "wrap",
    padding: theme.spacing(1.5, 2.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    borderBottom: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : "#fafafa",
  },
  searchField: {
    minWidth: 220,
    flex: "1 1 280px",
    maxWidth: 380,
  },
  filterSelect: {
    minWidth: 150,
  },
  headCell: {
    fontWeight: 600,
    fontSize: "0.72rem",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    borderBottom: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.type === "dark"
        ? theme.palette.background.default
        : "#fafafa",
    whiteSpace: "nowrap",
  },
  bodyCell: {
    fontSize: "0.85rem",
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
    borderBottom: `1px solid ${theme.palette.divider}`,
    verticalAlign: "middle",
  },
  rowHover: {
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    transition: "background-color 120ms ease",
  },
  actionsCell: {
    whiteSpace: "nowrap",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(8, 2),
    color: theme.palette.text.secondary,
    textAlign: "center",
  },
  // Cards mobile
  mobileList: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    [theme.breakpoints.up("sm")]: {
      display: "none",
    },
  },
  desktopTableWrapper: {
    overflowX: "auto",
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  card: {
    borderRadius: 12,
    padding: theme.spacing(1.75),
    border: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.25),
    background: theme.palette.background.paper,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
  },
  cardTitle: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
    minWidth: 0,
  },
  cardName: {
    fontWeight: 700,
    fontSize: "1rem",
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 190,
  },
  cardMeta: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: theme.spacing(1),
  },
  metaLabel: {
    fontSize: "0.72rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: theme.palette.text.secondary,
  },
  metaValue: {
    fontSize: "0.9rem",
    fontWeight: 600,
    wordBreak: "break-word",
  },
  cardActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing(0.5),
    flexWrap: "wrap",
  },
  actionButton: {
    minWidth: 44,
    minHeight: 44,
  },
  // Específicos do Financeiro
  invoiceIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    backgroundColor: `${theme.palette.primary.main}1a`,
    color: theme.palette.primary.main,
    "& svg": { fontSize: 18 },
  },
  mutedText: {
    color: theme.palette.text.secondary,
    fontSize: "0.78rem",
    marginTop: 2,
  },
  detailIcon: {
    marginRight: theme.spacing(0.5),
    color: theme.palette.primary.main,
    fontSize: 16,
    verticalAlign: "middle",
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
}));

// Diferença em dias entre hoje e o vencimento da fatura (mesma lógica original)
const daysUntilDue = (record) => {
  const hoje = moment(moment()).format("DD/MM/yyyy");
  const vencimento = moment(record.dueDate).format("DD/MM/yyyy");
  var diff = moment(vencimento, "DD/MM/yyyy").diff(moment(hoje, "DD/MM/yyyy"));
  return moment.duration(diff).asDays();
};

// Status da fatura → rótulo + chip tailwind (Pago / Vencido / Em Aberto)
const getInvoiceStatus = (record) => {
  const dias = daysUntilDue(record);
  if (record.status === "paid") {
    return {
      key: "paid",
      text: "Pago",
      cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
      icon: <CheckCircleIcon style={{ fontSize: 14 }} />,
    };
  }
  if (dias < 0) {
    return {
      key: "overdue",
      text: "Vencido",
      cls: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      icon: <ErrorIcon style={{ fontSize: 14 }} />,
    };
  }
  return {
    key: "open",
    text: "Em Aberto",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    icon: <HourglassEmptyIcon style={{ fontSize: 14 }} />,
  };
};

// Chip de status no padrão das telas de Conexões/Campanhas
const InvoiceStatusChip = ({ invoice }) => {
  const st = getInvoiceStatus(invoice);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}
      style={{ gap: 4 }}
    >
      {st.icon}
      {st.text}
    </span>
  );
};

// Texto auxiliar com os dias restantes/atraso da fatura
const renderDaysLeft = (record) => {
  const dias = daysUntilDue(record);

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

// Destaque de linha para faturas vencidas e não pagas
const rowStyle = (record) => {
  const dias = daysUntilDue(record);
  if (dias < 0 && record.status !== "paid") {
    return { backgroundColor: "rgba(255, 188, 188, 0.15)" };
  }
};

const Invoices = () => {
  const classes = useStyles();
  const theme = useTheme();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [invoices, dispatch] = useReducer(reducer, []);
  const [storagePlans, setStoragePlans] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [companyPlan, setCompanyPlan] = useState(null);

  const handleOpenContactModal = (invoice) => {
    // Cria cópia da fatura substituindo o valor pelo valor do plano da empresa
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

  // Busca os dados da empresa e depois o plano via planId
  useEffect(() => {
    const fetchCompanyPlan = async () => {
      try {
        if (user && user.companyId) {
          // Primeiro busca a empresa para acessar o planId
          const companyResponse = await api.get(`/companies/${user.companyId}`);
          const company = companyResponse.data;

          if (company && company.planId) {
            // Com o planId, busca os detalhes do plano
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

  // O endpoint /invoices/all retorna todas as faturas (ignora searchParam),
  // então a busca e o filtro de status da toolbar são aplicados client-side
  const filteredInvoices = useMemo(() => {
    const search = searchParam.trim().toLowerCase();
    return (invoices || []).filter((invoice) => {
      const statusInfo = getInvoiceStatus(invoice);
      if (statusFilter && statusInfo.key !== statusFilter) return false;
      if (search) {
        const hay = `${invoice.id} ${invoice.detail || ""} ${statusInfo.text} ${moment(invoice.dueDate).format("DD/MM/YYYY")}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }, [invoices, searchParam, statusFilter]);

  // KPIs do strip bento — derivados das faturas já carregadas (mesma fonte da listagem)
  const invoiceStats = useMemo(() => {
    const list = invoices || [];
    return {
      total: list.length,
      paid: list.filter((inv) => getInvoiceStatus(inv).key === "paid").length,
      open: list.filter((inv) => getInvoiceStatus(inv).key === "open").length,
      overdue: list.filter((inv) => getInvoiceStatus(inv).key === "overdue").length,
    };
  }, [invoices]);

  // Respeita prefers-reduced-motion: troca o spring por um fade simples
  const reducedMotion = useReducedMotion();
  const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

  const isLoadingFallback = !user || !user.companyId || !companyPlan;

  if (isLoadingFallback) {
    return (
      <MainContainer>
        <Paper className={`${classes.paper} bento-panel`} variant="outlined">
          <div className={classes.header}>
            <div className={classes.headerText}>
              <Title>Faturas</Title>
              <span className={classes.subtitle}>
                Acompanhe as faturas da assinatura, vencimentos e status de pagamento.
              </span>
            </div>
          </div>
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        </Paper>
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

  // Valor exibido: prioriza o amount do plano da empresa, senão o valor da fatura
  const renderInvoiceValue = (invoice) =>
    companyPlan && companyPlan.amount
      ? parseFloat(companyPlan.amount).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })
      : invoice.value.toLocaleString('pt-br', { style: 'currency', currency: 'BRL' });

  // Botão de ação por status — "PAGAR"/"PAGAR AGORA" abre o modal de assinatura
  const renderActionButton = (invoice, isMobileView) => {
    const statusInfo = getInvoiceStatus(invoice);
    // No card mobile garante área de toque mínima de 44px
    const mobileTouch = isMobileView ? classes.actionButton : "";
    return statusInfo.text !== "Pago" ? (
      <Button
        size="small"
        variant="contained"
        className={`${classes.paymentButton} ${mobileTouch}`}
        startIcon={<PaymentIcon />}
        onClick={() => handleOpenContactModal(invoice)}
      >
        {isMobileView ? "PAGAR AGORA" : "PAGAR"}
      </Button>
    ) : (
      <Button
        size="small"
        variant="outlined"
        className={`${classes.paidButton} ${mobileTouch}`}
        startIcon={<CheckCircleIcon />}
      >
        PAGO
      </Button>
    );
  };

  return (
    <MainContainer>
      <SubscriptionModal
        open={contactModalOpen}
        onClose={handleCloseContactModal}
        aria-labelledby="form-dialog-title"
        Invoice={storagePlans}
        contactId={selectedContactId}
      />

      <motion.div
        variants={bentoContainer}
        initial="hidden"
        animate="show"
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 12 }}
      >
        {/* Strip de KPIs bento — espelha o status das faturas carregadas */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard label="Faturas" value={invoiceStats.total} icon={<FileTextIcon size={20} />} accent="var(--primary-color)" loading={loading && invoices.length === 0} />
          <StatCard label="Pagas" value={invoiceStats.paid} icon={<CheckCircle2Icon size={20} />} accent="#26c281" loading={loading && invoices.length === 0} />
          <StatCard label="Em aberto" value={invoiceStats.open} icon={<ClockIcon size={20} />} accent="#f39c12" loading={loading && invoices.length === 0} />
          <StatCard label="Vencidas" value={invoiceStats.overdue} icon={<AlertTriangleIcon size={20} />} accent="#e7505a" loading={loading && invoices.length === 0} />
        </div>

      <motion.div variants={itemVariant} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <Paper
        className={`${classes.paper} bento-panel`}
        variant="outlined"
        onScroll={handleScroll}
      >
        {/* Cabeçalho no padrão: título + subtítulo + ações */}
        <div className={classes.header}>
          <div className={classes.headerText}>
            <Title>Faturas ({filteredInvoices.length})</Title>
            <span className={classes.subtitle}>
              Acompanhe as faturas da assinatura, vencimentos e status de pagamento.
            </span>
          </div>
          <div className={classes.headerActions} />
        </div>

        {/* Toolbar: busca + filtro de status (client-side) */}
        <div className={classes.toolbar}>
          <TextField
            className={classes.searchField}
            size="small"
            variant="outlined"
            placeholder="Buscar por detalhes, ID ou vencimento…"
            value={searchParam}
            onChange={(e) => setSearchParam(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon size={16} />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" variant="outlined" className={classes.filterSelect}>
            <Select
              native
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              displayEmpty
            >
              <option value="">Todos os status</option>
              <option value="paid">Pago</option>
              <option value="open">Em Aberto</option>
              <option value="overdue">Vencido</option>
            </Select>
          </FormControl>
        </div>

        {loading && invoices.length === 0 ? (
          <Table>
            <TableBody>
              <TableRowSkeleton columns={8} />
            </TableBody>
          </Table>
        ) : filteredInvoices.length === 0 ? (
          <div className={classes.emptyState}>
            <ReceiptIcon style={{ fontSize: 44, color: theme.palette.text.disabled }} />
            <div>Nenhuma fatura encontrada.</div>
          </div>
        ) : (
          <>
            {/* Cards — mobile */}
            <div className={classes.mobileList}>
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className={classes.card}>
                  <div className={classes.cardHeader}>
                    <div className={classes.cardTitle}>
                      <span className={classes.invoiceIcon}>
                        <ReceiptIcon />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className={classes.cardName} title={invoice.detail}>
                          {invoice.detail}
                        </div>
                        <div className={classes.mutedText}>ID: {invoice.id}</div>
                      </div>
                    </div>
                    <InvoiceStatusChip invoice={invoice} />
                  </div>

                  <div className={classes.cardMeta}>
                    <div>
                      <div className={classes.metaLabel}>Usuários</div>
                      <div className={classes.metaValue}>
                        <PersonIcon className={classes.detailIcon} />
                        {companyPlan && companyPlan.users}
                      </div>
                    </div>
                    <div>
                      <div className={classes.metaLabel}>Conexões</div>
                      <div className={classes.metaValue}>
                        <DevicesIcon className={classes.detailIcon} />
                        {companyPlan && companyPlan.connections}
                      </div>
                    </div>
                    <div>
                      <div className={classes.metaLabel}>Filas</div>
                      <div className={classes.metaValue}>
                        <QueueIcon className={classes.detailIcon} />
                        {companyPlan && companyPlan.queues}
                      </div>
                    </div>
                    <div>
                      <div className={classes.metaLabel}>Vencimento</div>
                      <div className={classes.metaValue}>
                        <DateRangeIcon className={classes.detailIcon} />
                        {moment(invoice.dueDate).format("DD/MM/YYYY")}
                      </div>
                      <div className={classes.mutedText}>{renderDaysLeft(invoice)}</div>
                    </div>
                    <div>
                      <div className={classes.metaLabel}>Valor</div>
                      <div className={classes.metaValue}>
                        {renderInvoiceValue(invoice)}
                      </div>
                    </div>
                  </div>

                  <div className={classes.cardActions}>
                    {renderActionButton(invoice, true)}
                  </div>
                </div>
              ))}
            </div>

            {/* Tabela — desktop */}
            <div className={classes.desktopTableWrapper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell className={classes.headCell}>Detalhes</TableCell>
                    <TableCell className={classes.headCell} align="center">Usuários</TableCell>
                    <TableCell className={classes.headCell} align="center">Conexões</TableCell>
                    <TableCell className={classes.headCell} align="center">Filas</TableCell>
                    <TableCell className={classes.headCell} align="center">Valor</TableCell>
                    <TableCell className={classes.headCell} align="center">Vencimento</TableCell>
                    <TableCell className={classes.headCell} align="center">Status</TableCell>
                    <TableCell className={classes.headCell} align="center">Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      style={rowStyle(invoice)}
                      className={classes.rowHover}
                    >
                      <TableCell className={classes.bodyCell}>{companyPlan.name}</TableCell>
                      <TableCell className={classes.bodyCell} align="center">{companyPlan && companyPlan.users}</TableCell>
                      <TableCell className={classes.bodyCell} align="center">{companyPlan && companyPlan.connections}</TableCell>
                      <TableCell className={classes.bodyCell} align="center">{companyPlan && companyPlan.queues}</TableCell>
                      <TableCell className={classes.bodyCell} align="center" style={{ fontWeight: 'bold' }}>
                        {renderInvoiceValue(invoice)}
                      </TableCell>
                      <TableCell className={classes.bodyCell} align="center">
                        <Box display="flex" flexDirection="column">
                          <span>{moment(invoice.dueDate).format("DD/MM/YYYY")}</span>
                          <span className={classes.mutedText}>{renderDaysLeft(invoice)}</span>
                        </Box>
                      </TableCell>
                      <TableCell className={classes.bodyCell} align="center">
                        <InvoiceStatusChip invoice={invoice} />
                      </TableCell>
                      <TableCell className={`${classes.bodyCell} ${classes.actionsCell}`} align="center">
                        {renderActionButton(invoice, false)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {loading && <TableRowSkeleton columns={8} />}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Paper>
      </motion.div>
      </motion.div>
    </MainContainer>
  );
};

export default Invoices;
