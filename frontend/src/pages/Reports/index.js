import React, { useState, useEffect, useReducer, useContext, useMemo } from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Paper, Box, useMediaQuery, TextField, InputAdornment, Grid, IconButton, Button, Tooltip, CircularProgress, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, Typography } from "@material-ui/core";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import * as XLSX from 'xlsx';

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";


import { i18n } from "../../translate/i18n";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import { UsersFilter } from "../../components/UsersFilter";
import { TagsFilter } from "../../components/TagsFilter";
import { WhatsappsFilter } from "../../components/WhatsappsFilter";
import { StatusFilter } from "../../components/StatusFilter";
import useDashboard from "../../hooks/useDashboard";

import QueueSelectCustom from "../../components/QueueSelectCustom";
import moment from "moment";
import ShowTicketLogModal from "../../components/ShowTicketLogModal";

import { blue, green } from "@material-ui/core/colors";
import { Facebook, Forward, History, Instagram, SaveAlt, Visibility, WhatsApp } from "@material-ui/icons";
import Autocomplete, { createFilterOptions } from "@material-ui/lab/Autocomplete";
import { Field } from "formik";

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
  mainPaperFilter: {
    flex: 1,
    overflow: 'auto',
    height: '20vh',
    ...theme.scrollbarStylesSoftBig,
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
  filterItem: {
    width: 200,
    [theme.breakpoints.down('md')]: {
      width: '45%'
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

const Reports = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up(1200));
  const history = useHistory();
  const { getReport } = useDashboard();

  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10); // Defina o tamanho da página

  const [searchParam, setSearchParam] = useState("");
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [selectedWhatsapp, setSelectedWhatsapp] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);

  // const [tagIds, setTagIds] = useState([]);
  const [queueIds, setQueueIds] = useState([]);
  const [userIds, setUserIds] = useState([]);
  const [options, setOptions] = useState([]);
  const [dateFrom, setDateFrom] = useState(moment("1", "D").format("YYYY-MM-DD"));
  const [dateTo, setDateTo] = useState(moment().format("YYYY-MM-DD"));
  const [onlyRated, setOnlyRated] = useState(false);
  const [totalTickets, setTotalTickets] = useState(0);
  const [tickets, setTickets] = useState([]);

  const [openTicketMessageDialog, setOpenTicketMessageDialog] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get("contacts", {
            params: { searchParam },
          });
          setOptions(data.contacts);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam]);

  // const handleSelectedTags = (selecteds) => {
  //   const tags = selecteds.map((t) => t.id);
  //   setTagIds(tags);
  // };

  const exportarGridParaExcel = async () => {
    setLoading(true); // Define o estado de loading como true durante o carregamento

    try {
      const data = await getReport({
        searchParam,
        contactId: selectedContactId,
        whatsappId: JSON.stringify(selectedWhatsapp),
        // tags: JSON.stringify(tagIds),
        users: JSON.stringify(userIds),
        queueIds: JSON.stringify(queueIds),
        status: JSON.stringify(selectedStatus),
        // tags: tagIds,
        dateFrom,
        dateTo,
        page: 1, // Passa o número da página para a API
        pageSize: 9999999, // Passa o tamanho da página para a API
        onlyRated: onlyRated ? "true" : "false"
      });


      const ticketsData = data.tickets.map(ticket => {
        // Convertendo o campo createdAt para um objeto Date
        const createdAt = new Date(ticket.createdAt);
        const closedAt = new Date(ticket.closedAt);

        const dataFechamento = closedAt.toLocaleDateString();
        const horaFechamento = closedAt.toLocaleTimeString();
        // Obtendo a data e a hora separadamente
        const dataCriacao = createdAt.toLocaleDateString(); // Obtém a data no formato 'dd/mm/aaaa'
        const horaCriacao = createdAt.toLocaleTimeString(); // Obtém a hora no formato 'hh:mm:ss'

        return {
          id: ticket.id,
          Conexão: ticket.whatsappName,
          Contato: ticket.contactName,
          Usuário: ticket.userName,
          Fila: ticket.queueName,
          Status: ticket.status,
          ÚltimaMensagem: ticket.lastMessage,
          DataAbertura: dataCriacao,
          HoraAbertura: horaCriacao,
          DataFechamento: ticket.closedAt === null ? "" : dataFechamento,
          HoraFechamento: ticket.closedAt === null ? "" : horaFechamento,
          TempoDeAtendimento: ticket.supportTime,
          nps: ticket.NPS,
        }
      });

      console.log(ticketsData)
      const ws = XLSX.utils.json_to_sheet(ticketsData);
      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, ws, 'RelatorioDeAtendimentos');
      XLSX.writeFile(wb, 'relatorio-de-atendimentos.xlsx');


      setPageNumber(pageNumber); // Atualiza o estado da página atual
    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false); // Define o estado de loading como false após o carregamento
    }

  };


  const handleFilter = async (page) => {
    setLoading(true);
    try {
      const data = await getReport({
        searchParam,
        contactId: selectedContactId,
        whatsappId: JSON.stringify(selectedWhatsapp),
        users: JSON.stringify(userIds),
        queueIds: JSON.stringify(queueIds),
        status: JSON.stringify(selectedStatus),
        dateFrom,
        dateTo,
        page: page,
        pageSize: pageSize,
        onlyRated: onlyRated ? "true" : "false"
      });

      setTotalTickets(data.totalTickets.total);
      setHasMore(data.tickets.length === pageSize);
      setTickets(data.tickets);
      setPageNumber(page);
    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = useMemo(() => {
    return totalTickets === 0 ? 1 : Math.ceil(totalTickets / pageSize);
  }, [totalTickets, pageSize]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      handleFilter(page);
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

  const handleSelectedUsers = (selecteds) => {
    const users = selecteds.map((t) => t.id);
    setUserIds(users);
  };

  const handleSelectedWhatsapps = (selecteds) => {
    const whatsapp = selecteds.map((t) => t.id);
    setSelectedWhatsapp(whatsapp);
  };

  const handleSelectedStatus = (selecteds) => {
    const statusFilter = selecteds.map((t) => t.status);

    setSelectedStatus(statusFilter);
  };
  const IconChannel = (channel) => {
    switch (channel) {
      case "facebook":
        return <Facebook style={{ color: "#3b5998", verticalAlign: "middle" }} />;
      case "instagram":
        return <Instagram style={{ color: "#e1306c", verticalAlign: "middle" }} />;
      case "whatsapp":
        return <WhatsApp style={{ color: "#25d366", verticalAlign: "middle" }} />
      default:
        return "error";
    }
  };

  const renderOption = (option) => {
    if (option.number) {
      return <>
        {IconChannel(option.channel)}
        <Typography component="span" style={{ fontSize: 14, marginLeft: "10px", display: "inline-flex", alignItems: "center", lineHeight: "2" }}>
          {option.name} - {option.number}
        </Typography>
      </>
    } else {
      return `${i18n.t("newTicketModal.add")} ${option.name}`;
    }
  };

  const handleSelectOption = (e, newValue) => {
    setSelectedContactId(newValue.id);
    setSearchParam("");
  };

  const renderOptionLabel = option => {
    if (option.number) {
      return `${option.name} - ${option.number}`;
    } else {
      return `${option.name}`;
    }
  };
  const filter = createFilterOptions({
    trim: true,
  });

  const createAddContactOption = (filterOptions, params) => {
    const filtered = filter(filterOptions, params);
    if (params.inputValue !== "" && !loading && searchParam.length >= 3) {
      filtered.push({
        name: `${params.inputValue}`,
      });
    }
    return filtered;
  };
  const renderContactAutocomplete = () => {
    return (
      <Grid xs={12} item>
        <Autocomplete
          fullWidth
          options={options}
          loading={loading}
          clearOnBlur
          autoHighlight
          freeSolo
          size="small"
          clearOnEscape
          getOptionLabel={renderOptionLabel}
          renderOption={renderOption}
          filterOptions={createAddContactOption}
          onChange={(e, newValue) => handleSelectOption(e, newValue)}
          renderInput={params => (
            <TextField
              {...params}
              label={i18n.t("newTicketModal.fieldLabel")}
              variant="outlined"
              autoFocus
              size="small"
              onChange={e => setSearchParam(e.target.value)}
              // onKeyPress={(e, newValue) => handleSelectOption(e, newValue)}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <React.Fragment>
                    {loading ? (
                      <CircularProgress color="inherit" size={20} />
                    ) : null}
                    {params.InputProps.endAdornment}
                  </React.Fragment>
                ),
              }}
            />
          )}
        />
      </Grid>
    )
  }

  return (
    <Box className={classes.root}>
      <MainContainer useWindowScroll>
        <Box className={classes.container}>
      {openTicketMessageDialog && (
        <ShowTicketLogModal
          isOpen={openTicketMessageDialog}
          handleClose={() => setOpenTicketMessageDialog(false)}
          ticketId={ticketOpen.id}
        />
      )}
          <MainHeader>
            <Grid style={{ width: "99.6%" }} container>
              <Grid xs={12} sm={8} item>
                <Title>
                  {i18n.t("reports.title")} ({totalTickets})
                </Title>
              </Grid>
            </Grid>
          </MainHeader>

          <Paper className={classes.mainPaperFilter} variant="outlined">
          <div style={{ paddingTop: '15px' }} />
          <Grid container spacing={1}>
            <Grid item xs={12} md={3} xl={3}>
              {renderContactAutocomplete()}
            </Grid>
            <Grid item xs={12} md={3} xl={3}>
              <WhatsappsFilter onFiltered={handleSelectedWhatsapps} />
            </Grid>
            <Grid item xs={12} md={3} xl={3}>
              <StatusFilter onFiltered={handleSelectedStatus} />
            </Grid>
            <Grid item xs={12} md={3} xl={3}>
              <UsersFilter onFiltered={handleSelectedUsers} />
            </Grid>
            <Grid item xs={12} md={3} xl={3} style={{ marginTop: '-13px' }}>
              <QueueSelectCustom
                selectedQueueIds={queueIds}
                onChange={values => setQueueIds(values)}
              />
            </Grid>
            <Grid item xs={12} sm={3} md={3}>
              <TextField
                label="Data Inicial"
                type="date"
                value={dateFrom}
                variant="outlined"
                fullWidth
                size="small"
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={3} md={3}>
              <TextField
                label="Data Final"
                type="date"
                value={dateTo}
                variant="outlined"
                fullWidth
                size="small"
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
              <Grid item xs={12} sm={3} md={3} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
              <FormControlLabel
                control={
                  <Switch
                    color="primary"
                    checked={onlyRated}
                    onChange={() => setOnlyRated(!onlyRated)}
                  />
                }
                label={i18n.t("reports.buttons.onlyRated")}
              />
                <Tooltip {...CustomTooltipProps} title="Exportar para Excel">
              <IconButton onClick={exportarGridParaExcel} aria-label="Exportar para Excel">
                <SaveAlt />
              </IconButton>
                </Tooltip>
              <Button
                variant="contained"
                color="primary"
                onClick={() => handleFilter(pageNumber)}
                size="small"
                >
                  {i18n.t("reports.buttons.filter")}
                </Button>
              </Grid>
            </Grid>
        </Paper>

          {isDesktop ? (
            <Paper className={classes.mainPaper} variant="outlined">
              <Box style={{ overflowX: "auto" }}>
                <table className={classes.table} id="grid-attendants">
                  <thead className={classes.tableHead}>
                    <tr>
                      <th scope="col" style={{ textAlign: "center" }}>
                        {i18n.t("reports.table.id").toUpperCase()}
                      </th>
                      <th scope="col" style={{ textAlign: "left" }}>
                        {i18n.t("reports.table.whatsapp").toUpperCase()}
                      </th>
                      <th scope="col" style={{ textAlign: "left" }}>
                        {i18n.t("reports.table.contact").toUpperCase()}
                      </th>
                      <th scope="col" style={{ textAlign: "left" }}>
                        {i18n.t("reports.table.user").toUpperCase()}
                      </th>
                      <th scope="col" style={{ textAlign: "left" }}>
                        {i18n.t("reports.table.queue").toUpperCase()}
                      </th>
                      <th scope="col" style={{ textAlign: "center" }}>
                        {i18n.t("reports.table.status").toUpperCase()}
                      </th>
                      <th scope="col" style={{ textAlign: "left" }}>
                        {i18n.t("reports.table.lastMessage").toUpperCase()}
                      </th>
                      <th scope="col" style={{ textAlign: "center" }}>
                        {i18n.t("reports.table.dateOpen").toUpperCase()}
                      </th>
                      <th scope="col" style={{ textAlign: "center" }}>
                        {i18n.t("reports.table.dateClose").toUpperCase()}
                      </th>
                      <th scope="col" style={{ textAlign: "center" }}>
                        {i18n.t("reports.table.supportTime").toUpperCase()}
                      </th>
                      <th scope="col" style={{ textAlign: "center" }}>
                        {i18n.t("reports.table.NPS").toUpperCase()}
                      </th>
                      <th scope="col" style={{ textAlign: "center" }}>
                        {i18n.t("reports.table.actions").toUpperCase()}
                      </th>
                    </tr>
                  </thead>
                  <tbody className={classes.tableBody}>
                    {!loading && tickets.length === 0 && (
                      <tr>
                        <td colSpan={12} className={classes.emptyState}>
                          Nenhum ticket encontrado.
                        </td>
                      </tr>
                    )}
                    {tickets.map((ticket) => (
                      <tr key={ticket.id}>
                        <td style={{ textAlign: "center" }}>{ticket.id}</td>
                        <td style={{ textAlign: "left" }}>{ticket?.whatsappName}</td>
                        <td style={{ textAlign: "left" }}>{ticket?.contactName}</td>
                        <td style={{ textAlign: "left" }}>{ticket?.userName}</td>
                        <td style={{ textAlign: "left" }}>{ticket?.queueName}</td>
                        <td style={{ textAlign: "center" }}>{ticket?.status}</td>
                        <td style={{ textAlign: "left" }}>{ticket?.lastMessage}</td>
                        <td style={{ textAlign: "center" }}>{ticket?.createdAt}</td>
                        <td style={{ textAlign: "center" }}>{ticket?.closedAt}</td>
                        <td style={{ textAlign: "center" }}>{ticket?.supportTime}</td>
                        <td style={{ textAlign: "center" }}>{ticket?.NPS}</td>
                        <td style={{ textAlign: "center" }}>
                          <Tooltip {...CustomTooltipProps} title="Logs do Ticket">
                            <IconButton
                              onClick={() => {
                                setOpenTicketMessageDialog(true);
                                setTicketOpen(ticket);
                              }}
                              size="small"
                              style={{
                                color: blue[700],
                                backgroundColor: "#ffffff",
                                border: "1px solid #d1d5db",
                                borderRadius: "8px",
                                marginRight: 4
                              }}
                            >
                              <History fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip {...CustomTooltipProps} title="Acessar Ticket">
                            <IconButton
                              onClick={() => { history.push(`/tickets/${ticket.uuid}`) }}
                              size="small"
                              style={{
                                color: green[700],
                                backgroundColor: "#ffffff",
                                border: "1px solid #d1d5db",
                                borderRadius: "8px"
                              }}
                            >
                              <Forward fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                    {loading && (
                      <tr>
                        <td colSpan={12}>
                          <TableRowSkeleton avatar columns={3} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Box>
              {/* Paginação Desktop */}
              <Box className={classes.pagination} component="nav" aria-label="Table navigation">
                <span className={classes.paginationInfo}>
                  Página <strong>{pageNumber}</strong> de <strong>{totalPages}</strong> • 
                  <strong>{totalTickets}</strong> tickets
                </span>
                <Box className={classes.paginationControls}>
                  <span style={{ fontSize: "0.875rem", marginRight: 8 }}>Itens por página:</span>
                  <FormControl size="small" variant="outlined" style={{ minWidth: 80 }}>
                    <Select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(e.target.value);
                        handleFilter(1);
                      }}
                    >
                      <MenuItem value={5}>5</MenuItem>
                      <MenuItem value={10}>10</MenuItem>
                      <MenuItem value={20}>20</MenuItem>
                      <MenuItem value={50}>50</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
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
            </Paper>
          ) : (
            /* Mobile View */
            <>
              <div className="flex flex-col gap-1.5 mt-3 w-full max-w-[375px] mx-auto">
                {!loading && tickets.length === 0 && (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    Nenhum ticket encontrado.
                  </div>
                )}
              {tickets.map((ticket) => (
                  <div key={ticket.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-semibold text-sm">#{ticket.id}</span>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{ticket?.status}</div>
                      </div>
                      <div className="flex gap-1">
                        <Tooltip {...CustomTooltipProps} title="Logs">
                          <IconButton
                          onClick={() => {
                              setOpenTicketMessageDialog(true);
                              setTicketOpen(ticket);
                          }}
                            size="small"
                          style={{
                            color: blue[700],
                              backgroundColor: "#ffffff",
                              border: "1px solid #d1d5db",
                              borderRadius: "8px"
                          }}
                          >
                            <History fontSize="small" />
                          </IconButton>
                      </Tooltip>
                        <Tooltip {...CustomTooltipProps} title="Acessar">
                          <IconButton
                            onClick={() => history.push(`/tickets/${ticket.uuid}`)}
                            size="small"
                          style={{
                            color: green[700],
                              backgroundColor: "#ffffff",
                              border: "1px solid #d1d5db",
                              borderRadius: "8px"
                          }}
                          >
                            <Forward fontSize="small" />
                          </IconButton>
                      </Tooltip>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div>WhatsApp: {ticket?.whatsappName}</div>
                      <div>Contato: {ticket?.contactName}</div>
                      <div>Usuário: {ticket?.userName}</div>
                      <div>Fila: {ticket?.queueName}</div>
                      <div>Última Mensagem: {ticket?.lastMessage}</div>
                      <div>Abertura: {ticket?.createdAt}</div>
                      <div>Fechamento: {ticket?.closedAt || "—"}</div>
                      <div>Tempo: {ticket?.supportTime}</div>
                      <div>NPS: {ticket?.NPS || "—"}</div>
                    </div>
                  </div>
              ))}
              {loading && <TableRowSkeleton avatar columns={3} />}
              </div>
              {/* Paginação Mobile */}
              <nav className="flex items-center justify-between p-3 mt-2 w-full max-w-[375px] mx-auto" aria-label="Mobile navigation">
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                  Página <span className="font-semibold text-gray-900 dark:text-white">{pageNumber}</span>
                  {" "} de {" "}
                  <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
                  {" "} • {" "}
                  <span className="font-semibold text-gray-900 dark:text-white">{totalTickets}</span> tickets
                </span>
                <div className="flex items-center gap-2">
                  <select
                value={pageSize}
                onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      handleFilter(1);
                    }}
                    className="text-xs bg-gray-50 border border-gray-300 rounded-md p-1 dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
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
      </div>
              </nav>
            </>
          )}
        </Box>
      </MainContainer>
    </Box>
  );
};

export default Reports;
