import React, { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";

import { makeStyles, useTheme } from "@material-ui/core/styles";
import {
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  InputAdornment,
  FormControl,
  Select,
} from "@material-ui/core";

import {
  Search as SearchIcon,
  Pencil as EditIcon,
  Trash2 as DeleteIcon,
  Plus as AddIcon,
  MessageSquare as PhraseIcon,
} from "lucide-react";

import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ForbiddenPage from "../../components/ForbiddenPage";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import ConfirmationModal from "../../components/ConfirmationModal";
import CampaignModalPhrase from "../../components/CampaignModalPhrase";
import usePermissions from "../../hooks/usePermissions";

// Status → chip tailwind (padrão das telas de Conexões/Campanhas)
const statusInfo = (flow) =>
  flow.status
    ? {
        label: "Ativo",
        cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
      }
    : {
        label: "Desativado",
        cls: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
      };

// ===== Estilos no padrão do gerenciador (referência: Connections/index.js) =====
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
  nameText: {
    fontWeight: 600,
    fontSize: "0.9rem",
    lineHeight: 1.35,
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
    gap: theme.spacing(0.5),
    flexWrap: "wrap",
  },
  actionButton: {
    minWidth: 44,
    minHeight: 44,
  },
}));

const CampaignsPhrase = () => {
  const classes = useStyles();
  const theme = useTheme();

  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("phrase-campaigns.create");
  const canEdit = hasPermission("phrase-campaigns.edit");
  const canDelete = hasPermission("phrase-campaigns.delete");

  const [loading, setLoading] = useState(true);
  const [campaignflows, setCampaignFlows] = useState([]);
  const [campaignflowSelected, setCampaignFlowSelected] = useState();
  const [modalOpenPhrase, setModalOpenPhrase] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deletingCampaign, setDeletingCampaign] = useState(null);

  // Busca + filtro de status da toolbar (filtro client-side)
  const [searchParam, setSearchParam] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const getCampaigns = async () => {
    setLoading(true);
    try {
      const res = await api.get("/flowcampaign");
      setCampaignFlows(res.data.flow || []); // Garante que seja sempre um array
    } catch (err) {
      toastError(err);
      setCampaignFlows([]); // Define como array vazio em caso de erro
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtro client-side por nome + status (padrão /connections)
  const filteredFlows = useMemo(() => {
    const search = searchParam.trim().toLowerCase();
    return (campaignflows || []).filter((flow) => {
      if (search && !(flow.name || "").toLowerCase().includes(search)) {
        return false;
      }
      if (statusFilter !== "" && String(!!flow.status) !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [campaignflows, searchParam, statusFilter]);

  const handleDeleteCampaign = async (campaignId) => {
    try {
      await api.delete(`/flowcampaign/${campaignId}`);
      toast.success("Frase deletada");
      getCampaigns();
    } catch (err) {
      toastError(err);
    }
  };

  const onSaveModal = () => {
    getCampaigns();
  };

  // Nova campanha de frases: limpa o id selecionado antes de abrir o modal
  const handleOpenNewCampaign = () => {
    setCampaignFlowSelected(undefined);
    setModalOpenPhrase(true);
  };

  const handleEditCampaign = (flow) => {
    setCampaignFlowSelected(flow.id);
    setModalOpenPhrase(true);
  };

  const handleAskDelete = (flow) => {
    setDeletingCampaign(flow);
    setConfirmModalOpen(true);
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
      <CampaignModalPhrase
        open={modalOpenPhrase}
        onClose={() => setModalOpenPhrase(false)}
        FlowCampaignId={campaignflowSelected}
        onSave={onSaveModal}
      />
      {!hasPermission("phrase-campaigns.view") ? (
        <ForbiddenPage />
      ) : (
        <Paper className={classes.paper} variant="outlined">
          {/* Cabeçalho no padrão: título + subtítulo + ações */}
          <div className={classes.header}>
            <div className={classes.headerText}>
              <Title>
                {i18n.t("campaigns.title")} ({filteredFlows.length})
              </Title>
              <span className={classes.subtitle}>
                Gerencie as campanhas de frases (sequências de mensagens) da empresa.
              </span>
            </div>
            <div className={classes.headerActions}>
              {canCreate && (
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<AddIcon size={16} />}
                  style={{ minHeight: 36 }}
                  onClick={handleOpenNewCampaign}
                >
                  {i18n.t("campaigns.buttons.add")}
                </Button>
              )}
            </div>
          </div>

          {/* Toolbar: busca + filtro de status */}
          <div className={classes.toolbar}>
            <TextField
              className={classes.searchField}
              size="small"
              variant="outlined"
              placeholder={i18n.t("campaigns.searchPlaceholder")}
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
            <FormControl
              size="small"
              variant="outlined"
              className={classes.filterSelect}
            >
              <Select
                native
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                displayEmpty
              >
                <option value="">Todos os status</option>
                <option value="true">Ativos</option>
                <option value="false">Desativados</option>
              </Select>
            </FormControl>
          </div>

          {loading ? (
            <Table>
              <TableBody>
                <TableRowSkeleton columns={3} />
              </TableBody>
            </Table>
          ) : filteredFlows.length === 0 ? (
            <div className={classes.emptyState}>
              <PhraseIcon
                size={44}
                style={{ color: theme.palette.text.disabled }}
              />
              <div>Nenhuma campanha de frases encontrada.</div>
            </div>
          ) : (
            <>
              {/* Cards — mobile */}
              <div className={classes.mobileList}>
                {filteredFlows.map((flow) => {
                  const st = statusInfo(flow);
                  return (
                    <div key={flow.id} className={classes.card}>
                      <div className={classes.cardHeader}>
                        <div className={classes.cardTitle}>
                          <span className={classes.cardName} title={flow.name}>
                            {flow.name}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}
                        >
                          {st.label}
                        </span>
                      </div>
                      <div className={classes.cardActions}>
                        {canEdit && (
                          <IconButton
                            size="small"
                            className={classes.actionButton}
                            onClick={() => handleEditCampaign(flow)}
                          >
                            <EditIcon size={18} />
                          </IconButton>
                        )}
                        {canDelete && (
                          <IconButton
                            size="small"
                            className={classes.actionButton}
                            onClick={() => handleAskDelete(flow)}
                          >
                            <DeleteIcon size={18} />
                          </IconButton>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tabela — desktop */}
              <div className={classes.desktopTableWrapper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell className={classes.headCell}>Nome</TableCell>
                      <TableCell align="center" className={classes.headCell}>
                        Status
                      </TableCell>
                      <TableCell align="center" className={classes.headCell}>
                        {i18n.t("contacts.table.actions")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredFlows.map((flow) => {
                      const st = statusInfo(flow);
                      return (
                        <TableRow key={flow.id} className={classes.rowHover}>
                          <TableCell className={classes.bodyCell}>
                            <span className={classes.nameText}>{flow.name}</span>
                          </TableCell>
                          <TableCell align="center" className={classes.bodyCell}>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}
                            >
                              {st.label}
                            </span>
                          </TableCell>
                          <TableCell
                            align="center"
                            className={`${classes.bodyCell} ${classes.actionsCell}`}
                          >
                            {canEdit && (
                              <IconButton
                                size="small"
                                onClick={() => handleEditCampaign(flow)}
                              >
                                <EditIcon size={18} />
                              </IconButton>
                            )}
                            {canDelete && (
                              <IconButton
                                size="small"
                                onClick={() => handleAskDelete(flow)}
                              >
                                <DeleteIcon size={18} />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Paper>
      )}
    </MainContainer>
  );
};

export default CampaignsPhrase;
