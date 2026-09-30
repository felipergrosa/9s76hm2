import React, {
  useState,
  useEffect,
  useReducer,
  useMemo,
  useCallback,
} from "react";
import { toast } from "react-toastify";
import moment from "moment";

import {
  Box,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  InputAdornment,
  Tooltip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import SearchIcon from "@material-ui/icons/Search";
import VisibilityIcon from "@material-ui/icons/Visibility";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";
import ReceiptIcon from "@material-ui/icons/Receipt";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import TableRowSkeleton from "../../../components/TableRowSkeleton";
import ConfirmationModal from "../../../components/ConfirmationModal";
import useCompanies from "../../../hooks/useCompanies";
import useDebounce from "../../../hooks/useDebounce";

// Mesmo padrão de acumulação de páginas da página Financeiro (tenant),
// mas alimentado por GET /invoices que — para super — retorna todas as empresas.
const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD_INVOICES": {
      const invoices = action.payload;
      const newInvoices = [];

      invoices.forEach((invoice) => {
        const index = state.findIndex((i) => i.id === invoice.id);
        if (index !== -1) {
          state[index] = invoice;
        } else {
          newInvoices.push(invoice);
        }
      });

      return [...state, ...newInvoices];
    }
    case "UPDATE_INVOICE": {
      const invoice = action.payload;
      const index = state.findIndex((i) => i.id === invoice.id);
      if (index !== -1) {
        state[index] = invoice;
        return [...state];
      }
      return [invoice, ...state];
    }
    case "RESET":
      return [];
    default:
      return state;
  }
};

const useStyles = makeStyles((theme) => ({
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
    flexWrap: "wrap",
  },
  searchField: {
    minWidth: 220,
    flex: "1 1 220px",
    maxWidth: 360,
  },
  countText: {
    color: theme.palette.text.secondary,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  tablePaper: {
    borderRadius: 12,
    overflow: "hidden",
    border: `1px solid ${theme.palette.divider}`,
  },
  tableScroll: {
    overflowX: "auto",
    ...theme.scrollbarStyles,
  },
  headCell: {
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: "0.03em",
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
    borderBottom: `1px solid ${theme.palette.divider}`,
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
    whiteSpace: "nowrap",
  },
  bodyCell: {
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
    whiteSpace: "nowrap",
  },
  cellCaption: {
    color: theme.palette.text.secondary,
    fontSize: 11.5,
    lineHeight: 1.35,
  },
  rowHover: {
    transition: "background-color 120ms ease",
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  overdueRow: {
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(244, 67, 54, 0.08)"
        : "rgba(255, 188, 188, 0.15)",
  },
  emptyState: {
    padding: theme.spacing(8, 4),
    textAlign: "center",
    color: theme.palette.text.secondary,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: theme.spacing(1.5),
  },
  emptyIcon: {
    fontSize: 44,
    opacity: 0.35,
  },
  loadMore: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(2),
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: theme.palette.text.secondary,
  },
  detailValue: {
    fontSize: 14,
    wordBreak: "break-word",
  },
}));

// Chips de status no padrão novo (tailwind + dark:)
const chipBaseClass =
  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium";

const STATUS_CHIP = {
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  open: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const StatusChip = ({ status }) => (
  <span className={`${chipBaseClass} ${STATUS_CHIP[status]}`}>
    {{ paid: "Pago", open: "Em Aberto", overdue: "Vencido" }[status]}
  </span>
);

// Deriva o status visual: pago, vencido (dueDate passada) ou em aberto
const getInvoiceStatus = (invoice) => {
  if (invoice.status === "paid") return "paid";
  const dias = moment(invoice.dueDate).startOf("day").diff(moment().startOf("day"), "days");
  return dias < 0 ? "overdue" : "open";
};

const renderDaysLeft = (invoice) => {
  if (invoice.status === "paid") return null;
  const dias = moment(invoice.dueDate).startOf("day").diff(moment().startOf("day"), "days");
  if (dias < 0) return `Vencida há ${Math.abs(dias)} dia(s)`;
  if (dias === 0) return "Vence hoje";
  return `Vence em ${dias} dia(s)`;
};

const formatBrl = (value) =>
  Number(value || 0).toLocaleString("pt-br", {
    style: "currency",
    currency: "BRL",
  });

// Visão GLOBAL de faturas para o superadmin. Reusa a ideia da página
// Financeiro (tenant), mas lista faturas de todas as empresas — o backend
// já libera isso quando req.user.super (ListInvoicesServices ignora companyId).
// Checkout/pagamento não se aplica aqui: ficam apenas ver detalhes e marcar pago.
const FinanceiroTab = () => {
  const classes = useStyles();
  const { list: listCompanies } = useCompanies();

  const [invoices, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [count, setCount] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const searchParam = useDebounce(searchInput, 500);

  // Mapa companyId -> nome da empresa: ListInvoicesServices não inclui
  // a associação `company`, então resolvemos via GET /companies/list.
  const [companiesById, setCompaniesById] = useState({});

  const [detailInvoice, setDetailInvoice] = useState(null);
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [markingPaid, setMarkingPaid] = useState(false);

  const companyName = useCallback(
    (invoice) =>
      invoice?.company?.name ||
      companiesById[invoice?.companyId] ||
      (invoice?.companyId ? `#${invoice.companyId}` : "-"),
    [companiesById]
  );

  useEffect(() => {
    (async () => {
      try {
        const data = await listCompanies();
        const map = {};
        (Array.isArray(data) ? data : []).forEach((c) => {
          map[c.id] = c.name;
        });
        setCompaniesById(map);
      } catch (err) {
        // Sem a lista de empresas a coluna cai no fallback #id — não bloqueia a aba
        if (err?.response?.status !== 403) {
          toastError(err);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nova busca volta para a primeira página
  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const { data } = await api.get("/invoices", {
          params: { searchParam, pageNumber },
        });
        dispatch({ type: "LOAD_INVOICES", payload: data.invoices || [] });
        setHasMore(data.hasMore);
        setCount(data.count || 0);
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [searchParam, pageNumber]);

  const handleMarkAsPaid = async () => {
    if (!payingInvoice) return;
    setMarkingPaid(true);
    try {
      // PUT /invoices/:id { status } — super pode atualizar fatura de qualquer empresa
      const { data } = await api.put(`/invoices/${payingInvoice.id}`, {
        status: "paid",
      });
      dispatch({ type: "UPDATE_INVOICE", payload: data });
      toast.success("Fatura marcada como paga.");
    } catch (err) {
      toastError(err);
    } finally {
      setMarkingPaid(false);
      setPayingInvoice(null);
    }
  };

  const empty = !loading && invoices.length === 0;

  const detailFields = useMemo(() => {
    if (!detailInvoice) return [];
    return [
      { label: "ID", value: detailInvoice.id },
      { label: "Empresa", value: companyName(detailInvoice) },
      { label: "Detalhes", value: detailInvoice.detail || "-" },
      { label: "Valor", value: formatBrl(detailInvoice.value) },
      {
        label: "Vencimento",
        value: detailInvoice.dueDate
          ? moment(detailInvoice.dueDate).format("DD/MM/YYYY")
          : "-",
      },
      {
        label: "Usuários / Conexões / Filas",
        value: `${detailInvoice.users ?? "-"} / ${detailInvoice.connections ?? "-"} / ${detailInvoice.queues ?? "-"}`,
      },
      { label: "Link da fatura", value: detailInvoice.linkInvoice || "-" },
      {
        label: "Criada em",
        value: detailInvoice.createdAt
          ? moment(detailInvoice.createdAt).format("DD/MM/YYYY HH:mm")
          : "-",
      },
    ];
  }, [detailInvoice, companyName]);

  return (
    <Box>
      <ConfirmationModal
        title="Marcar fatura como paga"
        open={Boolean(payingInvoice)}
        onClose={() => setPayingInvoice(null)}
        onConfirm={handleMarkAsPaid}
      >
        {payingInvoice &&
          `Confirmar pagamento da fatura #${payingInvoice.id} de ${companyName(
            payingInvoice
          )} (${formatBrl(payingInvoice.value)})?`}
      </ConfirmationModal>

      <Dialog
        open={Boolean(detailInvoice)}
        onClose={() => setDetailInvoice(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Fatura #{detailInvoice?.id} — {detailInvoice && companyName(detailInvoice)}
        </DialogTitle>
        <DialogContent dividers>
          {detailInvoice && (
            <Box mb={2}>
              <StatusChip status={getInvoiceStatus(detailInvoice)} />
            </Box>
          )}
          <Grid container spacing={2}>
            {detailFields.map((f) => (
              <Grid item xs={12} sm={6} key={f.label}>
                <Typography className={classes.detailLabel}>{f.label}</Typography>
                <Typography className={classes.detailValue}>{f.value}</Typography>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailInvoice(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>

      {/* Busca server-side (LIKE em detail) + total retornado pelo backend */}
      <Box className={classes.toolbar}>
        <TextField
          placeholder="Buscar por detalhes da fatura"
          type="search"
          variant="outlined"
          size="small"
          className={classes.searchField}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon style={{ color: "gray" }} fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Typography className={classes.countText}>
          {count} fatura(s) — todas as empresas
        </Typography>
      </Box>

      <Paper className={classes.tablePaper} variant="outlined" elevation={0}>
        {empty ? (
          <Box className={classes.emptyState}>
            <ReceiptIcon className={classes.emptyIcon} />
            <Typography variant="subtitle1">Nenhuma fatura encontrada</Typography>
            <Typography variant="body2">
              Ajuste a busca ou aguarde a geração de novas faturas.
            </Typography>
          </Box>
        ) : (
          <Box className={classes.tableScroll}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell className={classes.headCell}>Empresa</TableCell>
                  <TableCell className={classes.headCell}>Detalhes</TableCell>
                  <TableCell className={classes.headCell} align="center">
                    Usuários
                  </TableCell>
                  <TableCell className={classes.headCell} align="center">
                    Conexões
                  </TableCell>
                  <TableCell className={classes.headCell} align="center">
                    Filas
                  </TableCell>
                  <TableCell className={classes.headCell} align="center">
                    Valor
                  </TableCell>
                  <TableCell className={classes.headCell} align="center">
                    Vencimento
                  </TableCell>
                  <TableCell className={classes.headCell} align="center">
                    Status
                  </TableCell>
                  <TableCell className={classes.headCell} align="center">
                    Ações
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((invoice) => {
                  const status = getInvoiceStatus(invoice);
                  return (
                    <TableRow
                      key={invoice.id}
                      className={`${classes.rowHover} ${
                        status === "overdue" ? classes.overdueRow : ""
                      }`}
                    >
                      <TableCell className={classes.bodyCell}>
                        {companyName(invoice)}
                      </TableCell>
                      <TableCell className={classes.bodyCell}>
                        <Box display="flex" flexDirection="column">
                          <span>{invoice.detail || "-"}</span>
                          <span className={classes.cellCaption}>
                            Fatura #{invoice.id}
                          </span>
                        </Box>
                      </TableCell>
                      <TableCell className={classes.bodyCell} align="center">
                        {invoice.users ?? "-"}
                      </TableCell>
                      <TableCell className={classes.bodyCell} align="center">
                        {invoice.connections ?? "-"}
                      </TableCell>
                      <TableCell className={classes.bodyCell} align="center">
                        {invoice.queues ?? "-"}
                      </TableCell>
                      <TableCell
                        className={classes.bodyCell}
                        align="center"
                        style={{ fontWeight: "bold" }}
                      >
                        {formatBrl(invoice.value)}
                      </TableCell>
                      <TableCell className={classes.bodyCell} align="center">
                        <Box display="flex" flexDirection="column" alignItems="center">
                          <span>
                            {invoice.dueDate
                              ? moment(invoice.dueDate).format("DD/MM/YYYY")
                              : "-"}
                          </span>
                          <span className={classes.cellCaption}>
                            {renderDaysLeft(invoice)}
                          </span>
                        </Box>
                      </TableCell>
                      <TableCell className={classes.bodyCell} align="center">
                        <StatusChip status={status} />
                      </TableCell>
                      <TableCell className={classes.bodyCell} align="center">
                        <Tooltip title="Ver detalhes">
                          <IconButton
                            size="small"
                            onClick={() => setDetailInvoice(invoice)}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {status !== "paid" && (
                          <Tooltip title="Marcar como paga">
                            <IconButton
                              size="small"
                              onClick={() => setPayingInvoice(invoice)}
                              disabled={markingPaid}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {loading && <TableRowSkeleton columns={9} />}
              </TableBody>
            </Table>
          </Box>
        )}

        {hasMore && !loading && (
          <Box className={classes.loadMore}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setPageNumber((prev) => prev + 1)}
            >
              Carregar mais
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default FinanceiroTab;
