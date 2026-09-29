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
import Tooltip from "@material-ui/core/Tooltip";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import {
  Search as SearchIcon,
  Trash2 as DeleteOutlineIcon,
  Edit as EditIcon,
  FileText as DescriptionIcon,
  PlayCircle as PlayCircleOutlineIcon,
  PauseCircle as PauseCircleOutlineIcon,
  Copy as FileCopyOutlinedIcon,
  Plus as AddIcon,
  Megaphone as CampaignsIcon,
} from "lucide-react";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";

import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
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

// ===== Estilos no padrão do gerenciador de Templates Meta =====
const useStyles = makeStyles((theme) => ({
  paper: {
    flex: 1,
    padding: 0,
    overflow: "hidden",
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
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
    minWidth: 260,
    flex: "1 1 320px",
    maxWidth: 420,
  },
  filterSelect: {
    minWidth: 160,
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
    verticalAlign: "top",
  },
  rowHover: {
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    transition: "background-color 120ms ease",
  },
  campaignName: {
    fontWeight: 600,
    fontSize: "0.9rem",
    lineHeight: 1.35,
  },
  mutedText: {
    color: theme.palette.text.secondary,
    fontSize: "0.78rem",
    marginTop: 2,
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
  emptyIcon: {
    fontSize: 44,
    opacity: 0.35,
    marginBottom: theme.spacing(1),
  },
  paginationBar: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(1.5),
    borderTop: `1px solid ${theme.palette.divider}`,
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
    fontSize: "1rem",
    fontWeight: 700,
    lineHeight: 1.25,
    wordBreak: "break-word",
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
  },
  cardActions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    flexWrap: "wrap",
  },
}));

// Chip de status com cores tailwind compatíveis com dark mode
const StatusChip = ({ status }) => {
  const map = {
    INATIVA: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    PROGRAMADA: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    EM_ANDAMENTO:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    CANCELADA:
      "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    FINALIZADA:
      "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  };
  const label = {
    INATIVA: "Inativa",
    PROGRAMADA: "Programada",
    EM_ANDAMENTO: "Em andamento",
    CANCELADA: "Pausada",
    FINALIZADA: "Finalizada",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        map[status] || map.INATIVA
      }`}
    >
      {label[status] || status}
    </span>
  );
};

const Campaigns = () => {
  const classes = useStyles();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const [deletingCampaign, setDeletingCampaign] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [campaigns, dispatch] = useReducer(reducer, []);
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

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditCampaign = (campaign) => {
    // Redirecionar para a nova tela de edição de campanha
    history.push(`/campaignsNew/${campaign.id}`);
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
            className={`flex items-center justify-center px-3 h-8 leading-tight border ${page === pageNumber
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

  const getContactListName = (campaign) => {
    // Verifica se tem múltiplas listas (contactListIds)
    if (campaign.contactListIds) {
      try {
        const listIds = JSON.parse(campaign.contactListIds);
        if (Array.isArray(listIds) && listIds.length > 0) {
          return `${listIds.length} lista(s) selecionada(s)`;
        }
      } catch {
        // Se não conseguiu parsear, ignora
      }
    }

    // Verifica lista única (contactListId)
    if (campaign.contactListId) {
      return campaign.contactList?.name || "Lista #" + campaign.contactListId;
    }

    return "Não definida";
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

  const handleCloneCampaign = async (campaign) => {
    try {
      const { data } = await api.post(`/campaigns/${campaign.id}/clone`);
      toast.success("Campanha clonada com sucesso!");
      handleEditCampaign(data); // Abre edição da campanha clonada
    } catch (err) {
      toastError(err);
    }
  };

  // Ações compartilhadas entre tabela desktop e cards mobile
  const renderActions = (campaign) => (
    <>
      {campaign.status === "EM_ANDAMENTO" && (
        <Tooltip title="Pausar campanha">
          <IconButton
            onClick={() => cancelCampaign(campaign)}
            size="small"
            style={{ color: "#f44336" }}
          >
            <PauseCircleOutlineIcon size={18} />
          </IconButton>
        </Tooltip>
      )}
      {campaign.status === "CANCELADA" && (
        <Tooltip title="Retomar campanha">
          <IconButton
            onClick={() => restartCampaign(campaign)}
            size="small"
            style={{ color: "#4caf50" }}
          >
            <PlayCircleOutlineIcon size={18} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Relatório detalhado">
        <IconButton
          onClick={() =>
            history.push(`/campaign/${campaign.id}/detailed-report`)
          }
          size="small"
        >
          <DescriptionIcon size={18} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Editar">
        <IconButton
          size="small"
          onClick={() => handleEditCampaign(campaign)}
        >
          <EditIcon size={18} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Clonar campanha">
        <IconButton
          size="small"
          onClick={() => handleCloneCampaign(campaign)}
          style={{ color: "#2196f3" }}
        >
          <FileCopyOutlinedIcon size={18} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Excluir">
        <IconButton
          size="small"
          onClick={() => {
            setConfirmModalOpen(true);
            setDeletingCampaign(campaign);
          }}
        >
          <DeleteOutlineIcon size={18} />
        </IconButton>
      </Tooltip>
    </>
  );

  const filteredCampaigns = statusFilter
    ? campaigns.filter((c) => c.status === statusFilter)
    : campaigns;

  return (
    <MainContainer useWindowScroll>
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
      {hasPermission("campaigns.view") ? (
        <Paper className={classes.paper} variant="outlined">
          {/* Header — padrão do gerenciador de Templates Meta */}
          <Box className={classes.header}>
            <div className={classes.headerText}>
              <Title>
                {i18n.t("campaigns.title")} ({totalCampaigns})
              </Title>
              <span className={classes.subtitle}>
                Disparos em massa via WhatsApp — acompanhe status, agendamentos
                e relatórios de entrega.
              </span>
            </div>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon size={18} />}
              onClick={() => history.push("/campaigns/new")}
            >
              Nova campanha
            </Button>
          </Box>

          {/* Toolbar: busca + filtro de status */}
          <Box className={classes.toolbar}>
            <TextField
              className={classes.searchField}
              variant="outlined"
              size="small"
              placeholder={i18n.t("campaigns.searchPlaceholder")}
              type="search"
              value={searchParam}
              onChange={handleSearch}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon size={18} style={{ color: "gray" }} />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl
              variant="outlined"
              size="small"
              className={classes.filterSelect}
            >
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                displayEmpty
              >
                <MenuItem value="">Todos os status</MenuItem>
                <MenuItem value="INATIVA">Inativa</MenuItem>
                <MenuItem value="PROGRAMADA">Programada</MenuItem>
                <MenuItem value="EM_ANDAMENTO">Em andamento</MenuItem>
                <MenuItem value="CANCELADA">Pausada</MenuItem>
                <MenuItem value="FINALIZADA">Finalizada</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Mobile cards */}
          <div className={classes.mobileList}>
            {filteredCampaigns.map((campaign) => (
              <div key={campaign.id} className={classes.card}>
                <div className={classes.cardHeader}>
                  <div className={classes.cardTitle}>{campaign.name}</div>
                  <StatusChip status={campaign.status} />
                </div>
                <div className={classes.cardMeta}>
                  <div>
                    <div className={classes.metaLabel}>{i18n.t("campaigns.table.contactList")}</div>
                    <div className={classes.metaValue}>{getContactListName(campaign)}</div>
                  </div>
                  <div>
                    <div className={classes.metaLabel}>{i18n.t("campaigns.table.whatsapp")}</div>
                    <div className={classes.metaValue}>{campaign.whatsappId ? campaign.whatsapp?.name || "Não definido" : "Não definido"}</div>
                  </div>
                  <div>
                    <div className={classes.metaLabel}>{i18n.t("campaigns.table.scheduledAt")}</div>
                    <div className={classes.metaValue}>{campaign.scheduledAt ? datetimeToClient(campaign.scheduledAt) : "Sem agendamento"}</div>
                  </div>
                  <div>
                    <div className={classes.metaLabel}>{i18n.t("campaigns.table.confirmation")}</div>
                    <div className={classes.metaValue}>{campaign.confirmation ? "Habilitada" : "Desabilitada"}</div>
                  </div>
                </div>
                <div className={classes.cardActions}>
                  {renderActions(campaign)}
                </div>
              </div>
            ))}
            {loading && <TableRowSkeleton columns={1} />}
          </div>

          {/* Desktop table */}
          <div className={classes.desktopTableWrapper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell className={classes.headCell}>
                    {i18n.t("campaigns.table.name")}
                  </TableCell>
                  <TableCell align="center" className={classes.headCell}>
                    {i18n.t("campaigns.table.status")}
                  </TableCell>
                  <TableCell align="center" className={classes.headCell}>
                    {i18n.t("campaigns.table.contactList")}
                  </TableCell>
                  <TableCell align="center" className={classes.headCell}>
                    {i18n.t("campaigns.table.whatsapp")}
                  </TableCell>
                  <TableCell align="center" className={classes.headCell}>
                    {i18n.t("campaigns.table.scheduledAt")}
                  </TableCell>
                  <TableCell align="center" className={classes.headCell}>
                    {i18n.t("campaigns.table.completedAt")}
                  </TableCell>
                  <TableCell align="center" className={classes.headCell}>
                    {i18n.t("campaigns.table.confirmation")}
                  </TableCell>
                  <TableCell align="center" className={classes.headCell}>
                    {i18n.t("campaigns.table.actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCampaigns.map((campaign) => (
                  <TableRow key={campaign.id} className={classes.rowHover} hover={false}>
                    <TableCell className={classes.bodyCell}>
                      <div className={classes.campaignName}>{campaign.name}</div>
                      {campaign.confirmation && (
                        <div className={classes.mutedText}>
                          Confirmação habilitada
                        </div>
                      )}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      <StatusChip status={campaign.status} />
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {getContactListName(campaign)}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {campaign.whatsappId
                        ? campaign.whatsapp?.name || "Não definido"
                        : "Não definido"}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {campaign.scheduledAt
                        ? datetimeToClient(campaign.scheduledAt)
                        : "Sem agendamento"}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {campaign.completedAt
                        ? datetimeToClient(campaign.completedAt)
                        : "Não concluída"}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {campaign.confirmation ? "Habilitada" : "Desabilitada"}
                    </TableCell>
                    <TableCell align="center" className={`${classes.bodyCell} ${classes.actionsCell}`}>
                      {renderActions(campaign)}
                    </TableCell>
                  </TableRow>
                ))}
                {loading && <TableRowSkeleton columns={8} />}
              </TableBody>
            </Table>
          </div>

          {/* Empty state */}
          {!loading && filteredCampaigns.length === 0 && (
            <Box className={classes.emptyState}>
              <CampaignsIcon className={classes.emptyIcon} />
              <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                {searchParam || statusFilter
                  ? "Nenhuma campanha encontrada para os filtros aplicados."
                  : "Nenhuma campanha criada ainda."}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {!searchParam && !statusFilter &&
                  "Crie sua primeira campanha de disparo em massa."}
              </Typography>
            </Box>
          )}

          {/* Paginação numerada */}
          <nav className={`flex justify-center ${classes.paginationBar}`} aria-label="Page navigation">
            <ul className="inline-flex -space-x-px text-sm">
              <li>
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={pageNumber === 1}
                  className={`flex items-center justify-center px-3 h-8 leading-tight border rounded-l-lg ${pageNumber === 1
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
                  className={`flex items-center justify-center px-3 h-8 leading-tight border ${pageNumber === 1
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
                  className={`flex items-center justify-center px-3 h-8 leading-tight border ${pageNumber === totalPages
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
                  className={`flex items-center justify-center px-3 h-8 leading-tight border rounded-r-lg ${pageNumber === totalPages
                    ? "text-gray-300 bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-700"
                    : "text-gray-500 bg-white border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                    }`}
                >
                  »
                </button>
              </li>
            </ul>
          </nav>
        </Paper>
      ) : (
        <ForbiddenPage />
      )}
    </MainContainer>
  );
};

export default Campaigns;
