import React, { useState, useEffect, useReducer, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Typography,
  Chip,
  InputAdornment
} from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import GetAppIcon from "@material-ui/icons/GetApp";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { format } from "date-fns";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  filtersContainer: {
    marginBottom: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.background.default,
  },
  filterField: {
    marginBottom: theme.spacing(1),
  },
  tableRow: {
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  actionChip: {
    fontWeight: 600,
  },
  exportButton: {
    marginLeft: theme.spacing(2),
  },
}));

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
  const { user } = useContext(AuthContext);

  const [logs, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Filtros
  const [searchParam, setSearchParam] = useState("");
  const [actionFilter, setActionFilter] = useState("Todos");
  const [entityFilter, setEntityFilter] = useState("Todos");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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

  const loadMore = () => {
    setPageNumber((prev) => prev + 1);
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>Logs de Auditoria</Title>
        <Typography variant="body2" color="textSecondary">
          Rastreie todas as ações realizadas no sistema
        </Typography>
      </MainHeader>

      <Paper className={classes.filtersContainer}>
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
                    <SearchIcon />
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
          <Button
            variant="outlined"
            color="primary"
            startIcon={<GetAppIcon />}
            onClick={handleExportCsv}
            className={classes.exportButton}
          >
            Exportar CSV
          </Button>
        </Grid>
      </Paper>

      <Paper className={classes.mainPaper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Data/Hora</TableCell>
              <TableCell>Usuário</TableCell>
              <TableCell>Ação</TableCell>
              <TableCell>Entidade</TableCell>
              <TableCell>Código</TableCell>
              <TableCell>Detalhes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id} className={classes.tableRow}>
                <TableCell>
                  {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss")}
                </TableCell>
                <TableCell>{log.userName}</TableCell>
                <TableCell>
                  <Chip
                    label={log.action}
                    size="small"
                    color={getActionColor(log.action)}
                    className={classes.actionChip}
                  />
                </TableCell>
                <TableCell>{log.entity}</TableCell>
                <TableCell>{log.entityId || "-"}</TableCell>
                <TableCell>
                  {log.details ? (
                    <Typography variant="caption" style={{ maxWidth: 300, display: "block" }}>
                      {log.details.length > 100
                        ? log.details.substring(0, 100) + "..."
                        : log.details}
                    </Typography>
                  ) : (
                    "-"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {loading && <Typography align="center" style={{ padding: 16 }}>Carregando...</Typography>}
        
        {hasMore && !loading && (
          <Grid container justifyContent="center" style={{ padding: 16 }}>
            <Button variant="outlined" onClick={loadMore}>
              Carregar Mais
            </Button>
          </Grid>
        )}
      </Paper>
    </MainContainer>
  );
};

export default AuditLogs;
