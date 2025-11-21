/* eslint-disable no-unused-vars */

import React, { useState, useEffect, useReducer, useContext, useRef, useMemo } from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { Paper, Box, useMediaQuery, TextField, InputAdornment, Grid, IconButton, Button, Tooltip } from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import DescriptionIcon from "@material-ui/icons/Description";
import PlayCircleOutlineIcon from "@material-ui/icons/PlayCircleOutline";
import PauseCircleOutlineIcon from "@material-ui/icons/PauseCircleOutline";
import { Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import CampaignModal from "../../components/CampaignModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { isArray } from "lodash";
import { useDate } from "../../hooks/useDate";
import ForbiddenPage from "../../components/ForbiddenPage";
import usePlans from "../../hooks/usePlans";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePermissions from "../../hooks/usePermissions";

const reducer = (state, action) => {
  if (action.type === "SET_CAMPAIGNS") {
    // Substitui completamente a lista (paginação por página)
    return [...action.payload];
  }
  if (action.type === "LOAD_CAMPAIGNS") {
    const campaigns = action.payload;
    const newCampaigns = [];

    if (isArray(campaigns)) {
      campaigns.forEach((campaign) => {
        const campaignIndex = state.findIndex((u) => u.id === campaign.id);
        if (campaignIndex !== -1) {
          state[campaignIndex] = campaign;
        } else {
          newCampaigns.push(campaign);
        }
      });
    }

    return [...state, ...newCampaigns];
  }

  if (action.type === "UPDATE_CAMPAIGNS") {
    const campaign = action.payload;
    const campaignIndex = state.findIndex((u) => u.id === campaign.id);

    if (campaignIndex !== -1) {
      state[campaignIndex] = campaign;
      return [...state];
    } else {
      return [campaign, ...state];
    }
  }

  if (action.type === "DELETE_CAMPAIGN") {
    const campaignId = action.payload;

    const campaignIndex = state.findIndex((u) => u.id === campaignId);
    if (campaignIndex !== -1) {
      state.splice(campaignIndex, 1);
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
  sortButton: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    font: "inherit",
    color: "inherit",
    "&:hover": {
      opacity: 0.8,
    },
  },
  sortIcon: {
    fontSize: "0.75rem",
    opacity: 0.6,
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
}));

const CustomTooltipProps = {
  arrow: true,
  enterTouchDelay: 0,
  leaveTouchDelay: 5000,
  enterDelay: 300,
  leaveDelay: 100,
};

const Campaigns = () => {
  const classes = useStyles();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up(1200));
  const history = useHistory();
  const isMountedRef = useRef(true);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [deletingCampaign, setDeletingCampaign] = useState(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [campaigns, dispatch] = useReducer(reducer, []);
  const { user, socket } = useContext(AuthContext);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);


  const { datetimeToClient } = useDate();
  const { getPlanCompany } = usePlans();
  const { hasPermission } = usePermissions();

  useEffect(() => {
    async function fetchData() {
      const companyId = user.companyId;
      const planConfigs = await getPlanCompany(undefined, companyId);
      if (!planConfigs.plan.useCampaigns) {
        toast.error("Esta empresa não possui permissão para acessar essa página! Estamos lhe redirecionando.");
        setTimeout(() => {
          history.push(`/`)
        }, 1000);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      fetchCampaigns();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParam, pageNumber, itemsPerPage, sortField, sortDirection]);

  useEffect(() => {
    const companyId = user.companyId;
    // const socket = socketManager.GetSocket();

    const onCompanyCampaign = (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CAMPAIGNS", payload: data.record });
      }
      if (data.action === "delete") {
        dispatch({ type: "DELETE_CAMPAIGN", payload: +data.id });
      }
    }

    socket.on(`company-${companyId}-campaign`, onCompanyCampaign);
    return () => {
      socket.off(`company-${companyId}-campaign`, onCompanyCampaign);
    };
  }, [user]);

  const fetchCampaigns = async () => {
    try {
      const { data } = await api.get("/campaigns/", {
        params: { 
          searchParam, 
          pageNumber,
          limit: itemsPerPage,
          orderBy: sortField || 'name',
          order: sortDirection
        },
      });
      // Verificar se o componente ainda está montado antes de atualizar o estado
      if (!isMountedRef.current) return;
      // Substitui a lista ao trocar de página/filtro
      dispatch({ type: "SET_CAMPAIGNS", payload: data.records || [] });
      setTotalCampaigns(typeof data.count === "number" ? data.count : (data.total || data.records?.length || 0));
      setLoading(false);
    } catch (err) {
      if (isMountedRef.current) {
        toastError(err);
        setLoading(false);
      }
    }
  };

  const handleOpenCampaignModal = (campaign) => {
    console.log('[Campaigns] Abrindo modal de campanha', campaign?.id, campaign);
    setSelectedCampaign(campaign);
    setCampaignModalOpen(true);
  };

  const handleCloseCampaignModal = () => {
    console.log('[Campaigns] Fechando modal de campanha');
    setSelectedCampaign(null);
    setCampaignModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditCampaign = (campaign) => {
    setSelectedCampaign(campaign);
    setCampaignModalOpen(true);
  };

  const handleDeleteCampaign = async (campaignId) => {
    try {
      await api.delete(`/campaigns/${campaignId}`);
      toast.success(i18n.t("campaigns.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingCampaign(null);
    setSearchParam("");
    setPageNumber(1);
  };

  // Paginação numerada
  const totalPages = useMemo(() => {
    return totalCampaigns === 0 ? 1 : Math.ceil(totalCampaigns / itemsPerPage);
  }, [totalCampaigns, itemsPerPage]);

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

  const formatStatus = (val) => {
    switch (val) {
      case "INATIVA":
        return "Inativa";
      case "PROGRAMADA":
        return "Programada";
      case "EM_ANDAMENTO":
        return "Em Andamento";
      case "CANCELADA":
        return "Cancelada";
      case "FINALIZADA":
        return "Finalizada";
      default:
        return val;
    }
  };

  const cancelCampaign = async (campaign) => {
    try {
      await api.post(`/campaigns/${campaign.id}/cancel`);
      toast.success(i18n.t("campaigns.toasts.cancel"));
      setPageNumber(1);
      fetchCampaigns();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const restartCampaign = async (campaign) => {
    try {
      await api.post(`/campaigns/${campaign.id}/restart`);
      toast.success(i18n.t("campaigns.toasts.restart"));
      setPageNumber(1);
      fetchCampaigns();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Box className={classes.root}>
      <MainContainer useWindowScroll>
        <Box className={classes.container}>
          <ConfirmationModal
            title={
              deletingCampaign &&
              `${i18n.t("campaigns.confirmationModal.deleteTitle")} ${deletingCampaign.name}?`
            }
            open={confirmModalOpen}
            onClose={setConfirmModalOpen}
            onConfirm={() => handleDeleteCampaign(deletingCampaign.id)}
          >
            {i18n.t("campaigns.confirmationModal.deleteMessage")}
          </ConfirmationModal>
          {campaignModalOpen && (
            <CampaignModal
              resetPagination={() => {
                setPageNumber(1);
                fetchCampaigns();
              }}
              open={campaignModalOpen}
              onClose={handleCloseCampaignModal}
              aria-labelledby="form-dialog-title"
              campaignId={selectedCampaign && selectedCampaign.id}
            />
          )}
          {hasPermission("campaigns.view") ? (
            <>
              <MainHeader>
                <Grid style={{ width: "99.6%" }} container>
                  <Grid xs={12} sm={5} item>
                    <Title>
                      {i18n.t("campaigns.title")} ({totalCampaigns})
                    </Title>
                  </Grid>
                  <Grid xs={12} sm={7} item>
                    <Grid container alignItems="center" spacing={2}>
                      <Grid item xs>
                        <TextField
                          fullWidth
                          placeholder={i18n.t("campaigns.searchPlaceholder")}
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
                        <Tooltip {...CustomTooltipProps} title={i18n.t("campaigns.buttons.add")}>
                          <Button
                            onClick={handleOpenCampaignModal}
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
                            aria-label={i18n.t("campaigns.buttons.add")}
                          >
                            {i18n.t("campaigns.buttons.add")}
                          </Button>
                        </Tooltip>
                      </Grid>
                    </Grid>
                  </Grid>
                </Grid>
              </MainHeader>
              {isDesktop ? (
                <Paper className={classes.mainPaper} variant="outlined">
                  <Box style={{ overflowX: "auto" }}>
                    <table className={classes.table}>
                      <thead className={classes.tableHead}>
                        <tr>
                          <th scope="col" style={{ textAlign: "center" }}>
                            <button 
                              onClick={() => handleSort('name')} 
                              className={classes.sortButton}
                              style={{ width: "100%", justifyContent: "center" }}
                            >
                              {i18n.t("campaigns.table.name").toUpperCase()}
                              <span className={classes.sortIcon}>
                                {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                              </span>
                            </button>
                          </th>
                          <th scope="col" style={{ textAlign: "center" }}>
                            <button 
                              onClick={() => handleSort('status')} 
                              className={classes.sortButton}
                              style={{ width: "100%", justifyContent: "center" }}
                            >
                              {i18n.t("campaigns.table.status").toUpperCase()}
                              <span className={classes.sortIcon}>
                                {sortField === 'status' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                              </span>
                            </button>
                          </th>
                          <th scope="col" style={{ textAlign: "center" }}>
                            {i18n.t("campaigns.table.contactList").toUpperCase()}
                          </th>
                          <th scope="col" style={{ textAlign: "center" }}>
                            {i18n.t("campaigns.table.whatsapp").toUpperCase()}
                          </th>
                          <th scope="col" style={{ textAlign: "center" }}>
                            {i18n.t("campaigns.table.scheduledAt").toUpperCase()}
                          </th>
                          <th scope="col" style={{ textAlign: "center" }}>
                            {i18n.t("campaigns.table.completedAt").toUpperCase()}
                          </th>
                          <th scope="col" style={{ textAlign: "center" }}>
                            {i18n.t("campaigns.table.confirmation").toUpperCase()}
                          </th>
                          <th scope="col" style={{ textAlign: "center" }}>
                            {i18n.t("campaigns.table.actions").toUpperCase()}
                          </th>
                        </tr>
                      </thead>
                      <tbody className={classes.tableBody}>
                        {!loading && campaigns.length === 0 && (
                          <tr>
                            <td colSpan={8} className={classes.emptyState}>
                              Nenhuma campanha encontrada.
                            </td>
                          </tr>
                        )}
                        {campaigns.map((campaign) => (
                          <tr key={campaign.id}>
                            <td style={{ textAlign: "center" }}>{campaign.name}</td>
                            <td style={{ textAlign: "center" }}>
                              {formatStatus(campaign.status)}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {campaign.contactListId
                                ? campaign.contactList.name
                                : "Não definida"}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {campaign.whatsappId
                                ? campaign.whatsapp.name
                                : "Não definido"}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {campaign.scheduledAt
                                ? datetimeToClient(campaign.scheduledAt)
                                : "Sem agendamento"}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {campaign.completedAt
                                ? datetimeToClient(campaign.completedAt)
                                : "Não concluída"}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {campaign.confirmation ? "Habilitada" : "Desabilitada"}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {campaign.status === "EM_ANDAMENTO" && (
                                <Tooltip {...CustomTooltipProps} title="Parar Campanha">
                                  <IconButton
                                    onClick={() => cancelCampaign(campaign)}
                                    size="small"
                                    style={{
                                      color: "#f59e0b",
                                      backgroundColor: "#ffffff",
                                      border: "1px solid #d1d5db",
                                      borderRadius: "8px",
                                      marginRight: 4
                                    }}
                                  >
                                    <PauseCircleOutlineIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {campaign.status === "CANCELADA" && (
                                <Tooltip {...CustomTooltipProps} title="Reiniciar Campanha">
                                  <IconButton
                                    onClick={() => restartCampaign(campaign)}
                                    size="small"
                                    style={{
                                      color: "#10b981",
                                      backgroundColor: "#ffffff",
                                      border: "1px solid #d1d5db",
                                      borderRadius: "8px",
                                      marginRight: 4
                                    }}
                                  >
                                    <PlayCircleOutlineIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip {...CustomTooltipProps} title="Relatório Detalhado">
                                <IconButton
                                  onClick={() =>
                                    history.push(`/campaign/${campaign.id}/detailed-report`)
                                  }
                                  size="small"
                                  style={{
                                    color: "#6366f1",
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px",
                                    marginRight: 4
                                  }}
                                >
                                  <DescriptionIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip {...CustomTooltipProps} title="Editar">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEditCampaign(campaign)}
                                  style={{
                                    color: "#374151",
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px",
                                    marginRight: 4
                                  }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip {...CustomTooltipProps} title="Deletar">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    setConfirmModalOpen(true);
                                    setDeletingCampaign(campaign);
                                  }}
                                  style={{
                                    color: "#dc2626",
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px"
                                  }}
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </td>
                          </tr>
                        ))}
                        {loading && <TableRowSkeleton columns={8} />}
                      </tbody>
                    </table>
                  </Box>
                  {/* Paginação Desktop */}
                  <Box className={classes.pagination} component="nav" aria-label="Table navigation">
                    <span className={classes.paginationInfo}>
                      Página <strong>{pageNumber}</strong> de <strong>{totalPages}</strong> • 
                      <strong>{totalCampaigns}</strong> campanhas
                    </span>
                    <Box className={classes.paginationControls}>
                      <span style={{ fontSize: "0.875rem", marginRight: 8 }}>Itens por página:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setPageNumber(1);
                        }}
                        style={{ fontSize: "0.875rem", padding: "4px 8px", border: "1px solid #E5E7EB", borderRadius: "4px" }}
                      >
                        <option value={5}>5</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
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
                    {!loading && campaigns.length === 0 && (
                      <div className="text-center text-sm text-gray-500 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        Nenhuma campanha encontrada.
                      </div>
                    )}
                    {campaigns.map((campaign) => (
                      <div key={campaign.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-semibold text-sm">{campaign.name}</span>
                            <div className="text-xs text-gray-600 dark:text-gray-400">Status: {formatStatus(campaign.status)}</div>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {campaign.status === "EM_ANDAMENTO" && (
                              <Tooltip {...CustomTooltipProps} title="Parar Campanha">
                                <IconButton
                                  onClick={() => cancelCampaign(campaign)}
                                  size="small"
                                  style={{
                                    color: "#f59e0b",
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px"
                                  }}
                                >
                                  <PauseCircleOutlineIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {campaign.status === "CANCELADA" && (
                              <Tooltip {...CustomTooltipProps} title="Reiniciar Campanha">
                                <IconButton
                                  onClick={() => restartCampaign(campaign)}
                                  size="small"
                                  style={{
                                    color: "#10b981",
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "8px"
                                  }}
                                >
                                  <PlayCircleOutlineIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip {...CustomTooltipProps} title="Relatório">
                              <IconButton
                                onClick={() => history.push(`/campaign/${campaign.id}/detailed-report`)}
                                size="small"
                                style={{
                                  color: "#6366f1",
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #d1d5db",
                                  borderRadius: "8px"
                                }}
                              >
                                <DescriptionIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip {...CustomTooltipProps} title="Editar">
                              <IconButton
                                size="small"
                                onClick={() => handleEditCampaign(campaign)}
                                style={{
                                  color: "#374151",
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #d1d5db",
                                  borderRadius: "8px"
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip {...CustomTooltipProps} title="Deletar">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  setConfirmModalOpen(true);
                                  setDeletingCampaign(campaign);
                                }}
                                style={{
                                  color: "#dc2626",
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #d1d5db",
                                  borderRadius: "8px"
                                }}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                          <div>Lista de Contatos: {campaign.contactListId ? campaign.contactList.name : "Não definida"}</div>
                          <div>WhatsApp: {campaign.whatsappId ? campaign.whatsapp.name : "Não definido"}</div>
                          <div>Agendamento: {campaign.scheduledAt ? datetimeToClient(campaign.scheduledAt) : "Sem agendamento"}</div>
                          <div>Conclusão: {campaign.completedAt ? datetimeToClient(campaign.completedAt) : "Não concluída"}</div>
                          <div>Confirmação: {campaign.confirmation ? "Habilitada" : "Desabilitada"}</div>
                        </div>
                      </div>
                    ))}
                    {loading && <TableRowSkeleton columns={8} />}
                  </div>
                  {/* Paginação Mobile */}
                  <nav className="flex items-center justify-between p-3 mt-2 w-full max-w-[375px] mx-auto" aria-label="Mobile navigation">
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                      Página <span className="font-semibold text-gray-900 dark:text-white">{pageNumber}</span>
                      {" "} de {" "}
                      <span className="font-semibold text-gray-900 dark:text-white">{totalPages}</span>
                      {" "} • {" "}
                      <span className="font-semibold text-gray-900 dark:text-white">{totalCampaigns}</span> campanhas
                    </span>
                    <div className="flex items-center gap-2">
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value));
                          setPageNumber(1);
                        }}
                        className="text-xs bg-gray-50 border border-gray-300 rounded-md p-1 dark:bg-gray-700 dark:border-gray-600"
                      >
                        <option value={5}>5</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
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
            </>
          ) : (
            <ForbiddenPage />
          )}
        </Box>
      </MainContainer>
    </Box>
  );
};

export default Campaigns;
