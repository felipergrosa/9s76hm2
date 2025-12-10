/* eslint-disable no-unused-vars */

import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";

import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import DescriptionIcon from "@material-ui/icons/Description";
import PlayCircleOutlineIcon from "@material-ui/icons/PlayCircleOutline";
import PauseCircleOutlineIcon from "@material-ui/icons/PauseCircleOutline";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import CampaignModal from "../../components/CampaignModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { Grid } from "@material-ui/core";
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
  mainPaper: {
    flex: 1,
    padding: theme.spacing(2),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  tableContainer: {
    width: '100%',
    overflowX: 'auto',
  },
  table: {
    width: "100%",
    tableLayout: "fixed",
  },
}));

const Campaigns = () => {
  const classes = useStyles();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [deletingCampaign, setDeletingCampaign] = useState(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [campaigns, dispatch] = useReducer(reducer, []);
  //   const socketManager = useContext(SocketContext);
  const { user, socket } = useContext(AuthContext);


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
  }, [searchParam, pageNumber]);

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
        params: { searchParam, pageNumber },
      });
      // Substitui a lista ao trocar de página/filtro
      dispatch({ type: "SET_CAMPAIGNS", payload: data.records });
      setTotalCampaigns(typeof data.count === "number" ? data.count : 0);
      setLoading(false);
    } catch (err) {
      toastError(err);
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
  const CAMPAIGNS_PER_PAGE = 20; // manter alinhado ao backend
  const totalPages = totalCampaigns === 0 ? 1 : Math.ceil(totalCampaigns / CAMPAIGNS_PER_PAGE);
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setPageNumber(page);
    }
  };
  const renderPageNumbers = () => {
    const pages = [];
    if (totalPages <= 3) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1, 2, 3, "...");
    }
    return pages.map((page, index) => (
      <li key={index}>
        {page === "..." ? (
          <span className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 dark:bg-gray-800 dark:border-gray-700">...</span>
        ) : (
          <button
            onClick={() => handlePageChange(page)}
            className={`flex items-center justify-center px-3 h-8 leading-tight border ${
              page === pageNumber
                ? "text-blue-600 border-blue-300 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-700 dark:text-white"
                : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            }`}
          >
            {page}
          </button>
        )}
      </li>
    ));
  };

  const formatStatus = (val) => {
    switch (val) {
      case "INATIVA":
        return <span style={{ color: '#9e9e9e' }}>⚪ Inativa</span>;
      case "PROGRAMADA":
        return <span style={{ color: '#2196f3' }}>🕐 Programada</span>;
      case "EM_ANDAMENTO":
        return <span style={{ color: '#4caf50', fontWeight: 'bold' }}>▶️ Em Andamento</span>;
      case "CANCELADA":
        return <span style={{ color: '#ff9800', fontWeight: 'bold' }}>⏸️ Pausada</span>;
      case "FINALIZADA":
        return <span style={{ color: '#673ab7' }}>✅ Finalizada</span>;
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
    <MainContainer>
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
              <Grid xs={12} sm={8} item>
                <Title>{i18n.t("campaigns.title")}</Title>
                  <Grid spacing={2} container>
                    <Grid xs={6} sm={6} item>
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
                    <Grid xs={6} sm={6} item>
                      <Button
                        fullWidth
                        variant="contained"
                        onClick={handleOpenCampaignModal}
                        color="primary"
                      >
                        {i18n.t("campaigns.buttons.add")}
                      </Button>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </MainHeader>
            <Paper
              className={classes.mainPaper}
              variant="outlined"
            >
              <div className={classes.tableContainer}>
                <Table size="small" className={classes.table}>
                <TableHead>
                  <TableRow>
                    <TableCell align="center">
                      {i18n.t("campaigns.table.name")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("campaigns.table.status")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("campaigns.table.contactList")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("campaigns.table.whatsapp")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("campaigns.table.scheduledAt")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("campaigns.table.completedAt")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("campaigns.table.confirmation")}
                    </TableCell>
                    <TableCell align="center">
                      {i18n.t("campaigns.table.actions")}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell align="center">{campaign.name}</TableCell>
                        <TableCell align="center">
                          {formatStatus(campaign.status)}
                        </TableCell>
                        <TableCell align="center">
                          {campaign.contactListId
                            ? campaign.contactList.name
                            : "Não definida"}
                        </TableCell>
                        <TableCell align="center">
                          {campaign.whatsappId
                            ? campaign.whatsapp.name
                            : "Não definido"}
                        </TableCell>
                        <TableCell align="center">
                          {campaign.scheduledAt
                            ? datetimeToClient(campaign.scheduledAt)
                            : "Sem agendamento"}
                        </TableCell>
                        <TableCell align="center">
                          {campaign.completedAt
                            ? datetimeToClient(campaign.completedAt)
                            : "Não concluída"}
                        </TableCell>
                        <TableCell align="center">
                          {campaign.confirmation ? "Habilitada" : "Desabilitada"}
                        </TableCell>
                        <TableCell align="center">
                          {campaign.status === "EM_ANDAMENTO" && (
                            <IconButton
                              onClick={() => cancelCampaign(campaign)}
                              title="Pausar Campanha (Em Andamento)"
                              size="small"
                              style={{ color: '#f44336' }}
                            >
                              <PauseCircleOutlineIcon />
                            </IconButton>
                          )}
                          {campaign.status === "CANCELADA" && (
                            <IconButton
                              onClick={() => restartCampaign(campaign)}
                              title="Retomar Campanha (Pausada)"
                              size="small"
                              style={{ color: '#4caf50' }}
                            >
                              <PlayCircleOutlineIcon />
                            </IconButton>
                          )}
                          <IconButton
                            onClick={() =>
                              history.push(`/campaign/${campaign.id}/detailed-report`)
                            }
                            size="small"
                            title="Relatório Detalhado"
                          >
                            <DescriptionIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleEditCampaign(campaign)}
                          >
                            <EditIcon />
                          </IconButton>

                          <IconButton
                            size="small"
                            onClick={(e) => {
                              setConfirmModalOpen(true);
                              setDeletingCampaign(campaign);
                            }}
                          >
                            <DeleteOutlineIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    {loading && <TableRowSkeleton columns={8} />}
                  </>
                </TableBody>
              </Table>
              </div>
            </Paper>
            {/* Paginação numerada */}
            <nav className="flex justify-center mt-4" aria-label="Page navigation">
              <ul className="inline-flex -space-x-px text-sm">
                <li>
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={pageNumber === 1}
                    className={`flex items-center justify-center px-3 h-8 leading-tight border rounded-l-lg ${
                      pageNumber === 1
                        ? "text-gray-300 bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-700"
                        : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                    }`}
                  >
                    «
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handlePageChange(pageNumber - 1)}
                    disabled={pageNumber === 1}
                    className={`flex items-center justify-center px-3 h-8 leading-tight border ${
                      pageNumber === 1
                        ? "text-gray-300 bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-700"
                        : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                    }`}
                  >
                    ‹
                  </button>
                </li>
                {renderPageNumbers()}
                <li>
                  <button
                    onClick={() => handlePageChange(pageNumber + 1)}
                    disabled={pageNumber === totalPages}
                    className={`flex items-center justify-center px-3 h-8 leading-tight border ${
                      pageNumber === totalPages
                        ? "text-gray-300 bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-700"
                        : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                    }`}
                  >
                    ›
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={pageNumber === totalPages}
                    className={`flex items-center justify-center px-3 h-8 leading-tight border rounded-r-lg ${
                      pageNumber === totalPages
                        ? "text-gray-300 bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-700"
                        : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                    }`}
                  >
                    »
                  </button>
                </li>
              </ul>
            </nav>
          </>
        ) : (
          <ForbiddenPage />
        )}
    </MainContainer>
  );
};

export default Campaigns;
