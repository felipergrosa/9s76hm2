import React, { useState, useEffect, useReducer, useContext, useMemo } from "react";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Paper, TextField, Button, Select, MenuItem, FormControl, InputLabel, Grid, Typography, Chip, InputAdornment, Box, useMediaQuery, Tooltip, IconButton } from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import GetAppIcon from "@material-ui/icons/GetApp";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { format } from "date-fns";
import { AuthContext } from "../../context/Auth/AuthContext";

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
  filtersContainer: {
    marginBottom: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
  },
  filterField: {
    marginBottom: theme.spacing(1),
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
  actionChip: {
    fontWeight: 600,
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[1],
    marginTop: theme.spacing(2),
  },
  paginationInfo: {
    fontSize: "0.875rem",
    color: theme.palette.text.secondary,
  },
  paginationControls: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  pageButton: {
    minWidth: 32,
    height: 32,
    padding: theme.spacing(0.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    cursor: "pointer",
    transition: "all 0.2s",
    "&:hover:not(:disabled)": {
      backgroundColor: theme.palette.action.hover,
    },
    "&:disabled": {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  },
  pageButtonActive: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    borderColor: theme.palette.primary.main,
    "&:hover": {
      backgroundColor: theme.palette.primary.dark,
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

const reducer = (state, action) => {
  if (action.type === "LOAD_LOGS") {
    return [...state, ...action.payload];
  }
  if (action.type === "RESET") {
    return [];
  }
  return state;
};

const AuditLogs = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up(1200));
  const { user } = useContext(AuthContext);

  const [logs, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Filtros
  const [searchParam, setSearchParam] = useState("");
  const [actionFilter, setActionFilter] = useState("Todos");
  const [entityFilter, setEntityFilter] = useState("Todos");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const totalPages = useMemo(() => {
    return totalCount === 0 ? 1 : Math.ceil(totalCount / itemsPerPage);
  }, [totalCount, itemsPerPage]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setPageNumber(page);
    }
  };

  const renderPageNumbers = useMemo(() => {
    const pages = [];
    if (totalPages <= 3) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const start = Math.max(1, Math.min(pageNumber - 1, totalPages - 2));
      const end = Math.min(totalPages, start + 2);
      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  }, [pageNumber, totalPages]);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam, actionFilter, entityFilter, startDate, endDate, user?.companyId, user?.id]);

  useEffect(() => {
    if (!user?.companyId) return;
    setLoading(true);
    const fetchLogs = async () => {
      try {
        const { data } = await api.get("/audit-logs", {
          params: {
            searchParam,
            action: actionFilter !== "Todos" ? actionFilter : undefined,
            entity: entityFilter !== "Todos" ? entityFilter : undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            pageNumber,
          },
        });
        dispatch({ type: "LOAD_LOGS", payload: data.logs });
        setHasMore(data.hasMore);
        setTotalCount(data.count);
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [searchParam, actionFilter, entityFilter, startDate, endDate, pageNumber, user?.companyId, user?.id]);

  const handleExportCsv = async () => {
    try {
      const response = await api.get("/audit-logs/export", {
        params: {
          searchParam,
          action: actionFilter !== "Todos" ? actionFilter : undefined,
          entity: entityFilter !== "Todos" ? entityFilter : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `audit-logs-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      toastError(err);
    }
  };

  const getActionColor = (action) => {
    const colors = {
      "Criação": "primary",
      "Atualização": "default",
      "Deleção": "secondary",
      "Login": "primary",
      "Logout": "default",
    };
    return colors[action] || "default";
  };

  return (
    <Box className={classes.root}>
      <MainContainer useWindowScroll>
        <Box className={classes.container}>
      <MainHeader>
            <Grid style={{ width: "99.6%" }} container>
              <Grid xs={12} sm={8} item>
                <Title>Logs de Auditoria ({totalCount})</Title>
        <Typography variant="body2" color="textSecondary">
          Rastreie todas as ações realizadas no sistema
        </Typography>
              </Grid>
            </Grid>
      </MainHeader>

          <Paper className={classes.filtersContainer} variant="outlined">
        <Typography variant="h6" gutterBottom>
          Filtros
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth className={classes.filterField}>
              <InputLabel>Ação</InputLabel>
              <Select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                <MenuItem value="Todos">Todos</MenuItem>
                <MenuItem value="Criação">Criação</MenuItem>
                <MenuItem value="Atualização">Atualização</MenuItem>
                <MenuItem value="Deleção">Deleção</MenuItem>
                <MenuItem value="Login">Login</MenuItem>
                <MenuItem value="Logout">Logout</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth className={classes.filterField}>
              <InputLabel>Entidade</InputLabel>
              <Select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
              >
                <MenuItem value="Todos">Todos</MenuItem>
                <MenuItem value="Usuário">Usuário</MenuItem>
                <MenuItem value="Contato">Contato</MenuItem>
                <MenuItem value="Campanha">Campanha</MenuItem>
                <MenuItem value="Atendimento">Atendimento</MenuItem>
                <MenuItem value="Conexão">Conexão</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Data Início"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              className={classes.filterField}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Data Fim"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              className={classes.filterField}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              placeholder="Buscar por usuário, código..."
              value={searchParam}
              onChange={(e) => setSearchParam(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                        <SearchIcon style={{ color: "gray" }} />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
        </Grid>

        <Grid container justifyContent="space-between" alignItems="center" style={{ marginTop: 16 }}>
          <Typography variant="body2">
            {totalCount} registro(s) encontrado(s)
          </Typography>
              <Tooltip {...CustomTooltipProps} title="Exportar CSV">
          <Button
            variant="outlined"
            color="primary"
            startIcon={<GetAppIcon />}
            onClick={handleExportCsv}
          >
            Exportar CSV
          </Button>
              </Tooltip>
        </Grid>
      </Paper>

          {isDesktop ? (
            <Paper className={classes.mainPaper} variant="outlined">
              <Box style={{ overflowX: "auto" }}>
                <table className={classes.table}>
                  <thead className={classes.tableHead}>
                    <tr>
                      <th scope="col">DATA/HORA</th>
                      <th scope="col">USUÁRIO</th>
                      <th scope="col">AÇÃO</th>
                      <th scope="col">ENTIDADE</th>
                      <th scope="col">CÓDIGO</th>
                      <th scope="col">DETALHES</th>
                    </tr>
                  </thead>
                  <tbody className={classes.tableBody}>
                    {!loading && logs.length === 0 && (
                      <tr>
                        <td colSpan={6} className={classes.emptyState}>
                          Nenhum log encontrado.
                        </td>
                      </tr>
                    )}
            {logs.map((log) => (
                      <tr key={log.id}>
                        <td>
                  {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss")}
                        </td>
                        <td>{log.userName}</td>
                        <td>
                  <Chip
                    label={log.action}
                    size="small"
                    color={getActionColor(log.action)}
                    className={classes.actionChip}
                  />
                        </td>
                        <td>{log.entity}</td>
                        <td>{log.entityId || "-"}</td>
                        <td>
                  {log.details ? (
                    <Typography variant="caption" style={{ maxWidth: 300, display: "block" }}>
                      {log.details.length > 100
                        ? log.details.substring(0, 100) + "..."
                        : log.details}
                    </Typography>
                  ) : (
                    "-"
                  )}
                        </td>
                      </tr>
            ))}
                    {loading && (
                      <tr>
                        <td colSpan={6}>
                          <TableRowSkeleton columns={6} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Box>
              {/* Paginação Desktop */}
        {hasMore && !loading && (
                <Box className={classes.pagination} component="nav" aria-label="Table navigation">
                  <span className={classes.paginationInfo}>
                    Página <strong>{pageNumber}</strong> de <strong>{totalPages}</strong> • 
                    <strong>{totalCount}</strong> registros
                  </span>
                  <Box className={classes.paginationControls} component="ul" style={{ listStyle: "none", display: "flex", gap: 4, margin: 0, padding: 0 }}>
                    <li>
                      <button
                        onClick={() => handlePageChange(1)}
                        disabled={pageNumber === 1}
                        className={classes.pageButton}
                      >
                        <ChevronsLeft className="w-5 h-5" />
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => handlePageChange(pageNumber - 1)}
                        disabled={pageNumber === 1}
                        className={classes.pageButton}
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    </li>
                    {renderPageNumbers.map((page, index) => (
                      <li key={index}>
                        <button
                          onClick={() => handlePageChange(page)}
                          className={`${classes.pageButton} ${page === pageNumber ? classes.pageButtonActive : ""}`}
                        >
                          {page}
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        onClick={() => handlePageChange(pageNumber + 1)}
                        disabled={pageNumber === totalPages}
                        className={classes.pageButton}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => handlePageChange(totalPages)}
                        disabled={pageNumber === totalPages}
                        className={classes.pageButton}
                      >
                        <ChevronsRight className="w-5 h-5" />
                      </button>
                    </li>
                  </Box>
                </Box>
        )}
      </Paper>
          ) : (
            /* Mobile View */
            <>
              <div className="flex flex-col gap-1.5 mt-3 w-full max-w-[375px] mx-auto">
                {!loading && logs.length === 0 && (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    Nenhum log encontrado.
                  </div>
                )}
                {logs.map((log) => (
                  <div key={log.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-semibold text-sm">{format(new Date(log.createdAt), "dd/MM/yyyy HH:mm")}</span>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{log.userName}</div>
                      </div>
                      <Chip
                        label={log.action}
                        size="small"
                        color={getActionColor(log.action)}
                        className={classes.actionChip}
                      />
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div>Entidade: {log.entity}</div>
                      <div>Código: {log.entityId || "—"}</div>
                      {log.details && (
                        <div>Detalhes: {log.details.length > 100 ? log.details.substring(0, 100) + "..." : log.details}</div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && <TableRowSkeleton columns={6} />}
              </div>
              {/* Paginação Mobile */}
              {hasMore && !loading && (
                <nav className="flex items-center justify-between p-3 mt-2 w-full max-w-[375px] mx-auto" aria-label="Mobile navigation">
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                    Página <span className="font-semibold text-gray-900 dark:text-white">{pageNumber}</span>
                    {" "} de {" "}
                    <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
                  </span>
                  <ul className="inline-flex items-center -space-x-px">
                    <li>
                      <button
                        onClick={() => handlePageChange(1)}
                        disabled={pageNumber === 1}
                        className="flex items-center justify-center px-2 h-8 ml-0 leading-tight text-gray-500 bg-white border border-gray-300 rounded-l-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronsLeft className="w-4 h-4" />
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => handlePageChange(pageNumber - 1)}
                        disabled={pageNumber === 1}
                        className="flex items-center justify-center px-2 h-8 leading-tight text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </li>
                    {renderPageNumbers.map((page, index) => (
                      <li key={index}>
                        <button
                          onClick={() => handlePageChange(page)}
                          className={`flex items-center justify-center px-2 h-8 leading-tight border
                            ${page === pageNumber
                                ? "text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
                                : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                              }`}
                        >
                          {page}
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        onClick={() => handlePageChange(pageNumber + 1)}
                        disabled={pageNumber === totalPages}
                        className="flex items-center justify-center px-2 h-8 leading-tight text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => handlePageChange(totalPages)}
                        disabled={pageNumber === totalPages}
                        className="flex items-center justify-center px-2 h-8 leading-tight text-gray-500 bg-white border border-gray-300 rounded-r-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronsRight className="w-4 h-4" />
                      </button>
                    </li>
                  </ul>
                </nav>
              )}
            </>
          )}
        </Box>
    </MainContainer>
    </Box>
  );
};

export default AuditLogs;
