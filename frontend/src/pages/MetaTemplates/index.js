import React, {
  useState,
  useEffect,
  useReducer,
  useContext,
  useCallback,
  useMemo,
} from "react";
import { toast } from "react-toastify";

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
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import SyncIcon from "@material-ui/icons/Sync";
import { Info } from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ConfirmationModal from "../../components/ConfirmationModal";
import MetaTemplateModal from "../../components/MetaTemplateModal";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";

const reducer = (state, action) => {
  switch (action.type) {
    case "LOAD_TEMPLATES":
      return action.payload;
    case "UPDATE_TEMPLATE": {
      const template = action.payload;
      // Eventos com status DELETED removem a linha (webhook + delete single)
      if (template.status === "DELETED") {
        return state.filter((t) => String(t.id) !== String(template.id));
      }
      const templateIndex = state.findIndex(
        (t) => String(t.id) === String(template.id)
      );

      if (templateIndex !== -1) {
        // Merge para preservar campos que o evento de status não traz.
        // Ignora chaves com valor undefined (ex.: update sem name) para
        // não apagar dados existentes no merge.
        const clean = Object.fromEntries(
          Object.entries(template).filter(([, v]) => v !== undefined)
        );
        const merged = { ...state[templateIndex], ...clean };
        // O evento de status usa "reason"; a listagem usa "rejected_reason"
        if (template.reason !== undefined) {
          merged.rejected_reason = template.reason;
        }
        state[templateIndex] = merged;
        return [...state];
      }
      return [template, ...state];
    }
    case "DELETE_TEMPLATE": {
      const templateId = action.payload;
      return state.filter((t) => String(t.id) !== String(templateId));
    }
    case "RESET":
      return [];
    default:
      return state;
  }
};

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
  },
  connectionSelector: {
    minWidth: 220,
  },
  infoBox: {
    backgroundColor:
      theme.palette.type === "dark"
        ? theme.palette.grey[800]
        : "#eaf1c6af",
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    borderRadius: 4,
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1),
  },
  emptyState: {
    padding: theme.spacing(4),
    textAlign: "center",
    color: theme.palette.text.secondary,
  },
}));

// Chips customizados via tailwind (suporte a dark:)
const STATUS_CHIP_CLASSES = {
  APPROVED:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  PENDING:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  IN_REVIEW:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  DISABLED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  PAUSED:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  FLAGGED:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const DEFAULT_STATUS_CHIP =
  "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";



const CATEGORY_CHIP_CLASSES = {
  MARKETING: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  UTILITY: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  AUTHENTICATION:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

const QUALITY_CHIP_CLASSES = {
  GREEN:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  YELLOW:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  RED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const chipBaseClass =
  "inline-block px-2 py-0.5 rounded-full text-xs font-semibold";

const StatusChip = ({ status }) => {
  const normalized = (status || "").toUpperCase();
  const chipClass = STATUS_CHIP_CLASSES[normalized] || DEFAULT_STATUS_CHIP;
  return (
    <span className={`${chipBaseClass} ${chipClass}`}>
      {i18n.t(`metaTemplates.status.${normalized}`, { defaultValue: normalized || "—" })}
    </span>
  );
};

const CategoryChip = ({ category }) => {
  const normalized = (category || "").toUpperCase();
  const chipClass = CATEGORY_CHIP_CLASSES[normalized] || DEFAULT_STATUS_CHIP;
  return (
    <span className={`${chipBaseClass} ${chipClass}`}>
      {i18n.t(`metaTemplates.category.${normalized}`, { defaultValue: normalized || "—" })}
    </span>
  );
};

const QualityChip = ({ score }) => {
  const normalized = (score || "").toUpperCase();
  if (!normalized) return <>—</>;
  const chipClass = QUALITY_CHIP_CLASSES[normalized] || DEFAULT_STATUS_CHIP;
  return <span className={`${chipBaseClass} ${chipClass}`}>{normalized}</span>;
};

const MetaTemplates = () => {
  const classes = useStyles();
  const { user, socket } = useContext(AuthContext);
  const { whatsApps, loading: loadingWhatsApps } = useContext(WhatsAppsContext);

  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [templates, dispatch] = useReducer(reducer, []);
  const [selectedWhatsAppId, setSelectedWhatsAppId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [deletingTemplate, setDeletingTemplate] = useState(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Apenas conexões oficiais (Meta WhatsApp Business API)
  const officialWhatsApps = useMemo(
    () =>
      (whatsApps || []).filter(
        (w) => w.channelType === "official" && w.channel === "whatsapp"
      ),
    [whatsApps]
  );

  // Seleciona automaticamente a primeira conexão oficial disponível
  useEffect(() => {
    if (!selectedWhatsAppId && officialWhatsApps.length > 0) {
      setSelectedWhatsAppId(officialWhatsApps[0].id);
    }
  }, [officialWhatsApps, selectedWhatsAppId]);

  const fetchTemplates = useCallback(async () => {
    if (!selectedWhatsAppId) return;
    dispatch({ type: "RESET" });
    setLoading(true);
    try {
      // O GET já dispara a sincronização com a Meta no backend
      const { data } = await api.get(`/meta-templates/${selectedWhatsAppId}`);
      dispatch({ type: "LOAD_TEMPLATES", payload: data.templates || [] });
      if (data.stale) {
        toast.warn(i18n.t("metaTemplates.errors.staleCache"));
      }
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [selectedWhatsAppId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Atualização em tempo real do status do template via socket
  useEffect(() => {
    if (!user?.companyId || typeof socket?.on !== "function") return;

    const eventName = `company-${user.companyId}-meta-template`;
    const onMetaTemplate = (data) => {
      if (data.action === "status" && data.template) {
        dispatch({ type: "UPDATE_TEMPLATE", payload: data.template });
      }
      if (data.action === "delete" && Array.isArray(data.templateIds)) {
        data.templateIds.forEach((id) =>
          dispatch({ type: "DELETE_TEMPLATE", payload: id })
        );
      }
    };

    socket.on(eventName, onMetaTemplate);

    return () => {
      socket.off(eventName, onMetaTemplate);
    };
  }, [socket, user?.companyId]);

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleChangeConnection = (event) => {
    setSelectedWhatsAppId(event.target.value);
  };

  const handleOpenTemplateModal = () => {
    setSelectedTemplate(null);
    setTemplateModalOpen(true);
  };

  const handleEditTemplate = (template) => {
    setSelectedTemplate(template);
    setTemplateModalOpen(true);
  };

  const handleCloseTemplateModal = () => {
    setSelectedTemplate(null);
    setTemplateModalOpen(false);
  };

  const handleSync = async () => {
    await fetchTemplates();
    toast.success(i18n.t("metaTemplates.toasts.synced"));
  };

  const handleDeleteTemplate = async (template) => {
    try {
      // A Meta exige name + hsm_id (templateId) para deletar o template
      await api.delete(`/meta-templates/${selectedWhatsAppId}/${template.id}`, {
        params: { name: template.name },
      });
      dispatch({ type: "DELETE_TEMPLATE", payload: template.id });
      toast.success(i18n.t("metaTemplates.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingTemplate(null);
  };

  // Busca client-side por nome
  const filteredTemplates = templates.filter((t) =>
    (t.name || "").toLowerCase().includes(searchParam)
  );

  const hasOfficialConnection = officialWhatsApps.length > 0;

  return (
    <MainContainer useWindowScroll>
      <ConfirmationModal
        title={
          deletingTemplate &&
          `${i18n.t("metaTemplates.confirm.deleteTitle")} ${
            deletingTemplate.name
          }?`
        }
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={() => handleDeleteTemplate(deletingTemplate)}
      >
        {i18n.t("metaTemplates.confirm.deleteMessage")}{" "}
        {i18n.t("metaTemplates.confirm.deleteWarning30d")}
      </ConfirmationModal>
      <MetaTemplateModal
        open={templateModalOpen}
        onClose={handleCloseTemplateModal}
        whatsappId={selectedWhatsAppId}
        template={selectedTemplate}
        onSaved={fetchTemplates}
      />
      <MainHeader>
        <Title>
          {i18n.t("metaTemplates.title")} ({filteredTemplates.length})
        </Title>
        <MainHeaderButtonsWrapper>
          <TextField
            placeholder={i18n.t("metaTemplates.searchPlaceholder")}
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
          <FormControl
            variant="outlined"
            size="small"
            className={classes.connectionSelector}
          >
            <InputLabel>{i18n.t("metaTemplates.selectConnection")}</InputLabel>
            <Select
              value={selectedWhatsAppId}
              onChange={handleChangeConnection}
              label={i18n.t("metaTemplates.selectConnection")}
              disabled={loadingWhatsApps || !hasOfficialConnection}
            >
              {officialWhatsApps.map((w) => (
                <MenuItem key={w.id} value={w.id}>
                  {w.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title={i18n.t("metaTemplates.buttons.sync")}>
            <span>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleSync}
                disabled={!selectedWhatsAppId || loading}
                startIcon={<SyncIcon />}
              >
                {i18n.t("metaTemplates.buttons.sync")}
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenTemplateModal}
            disabled={!selectedWhatsAppId}
          >
            {i18n.t("metaTemplates.buttons.add")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Paper className={classes.mainPaper} variant="outlined">
        {!loadingWhatsApps && !hasOfficialConnection && (
          <Box className={classes.infoBox}>
            <Info color="primary" />
            <Typography variant="body2">
              {i18n.t("metaTemplates.errors.noOfficialConnection")}
            </Typography>
          </Box>
        )}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center">
                {i18n.t("metaTemplates.table.name")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("metaTemplates.table.language")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("metaTemplates.table.category")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("metaTemplates.table.status")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("metaTemplates.table.quality")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("metaTemplates.table.reason")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("metaTemplates.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRowSkeleton key="skeleton" columns={7} />
            ) : (
              <>
                {filteredTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell align="center">{template.name}</TableCell>
                    <TableCell align="center">
                      {template.language || "—"}
                    </TableCell>
                    <TableCell align="center">
                      <CategoryChip category={template.category} />
                    </TableCell>
                    <TableCell align="center">
                      <StatusChip status={template.status} />
                    </TableCell>
                    <TableCell align="center">
                      <QualityChip score={template.quality_score?.score} />
                    </TableCell>
                    <TableCell align="center">
                      {template.rejected_reason || "—"}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleEditTemplate(template)}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setDeletingTemplate(template);
                          setConfirmModalOpen(true);
                        }}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
        {!loading && hasOfficialConnection && filteredTemplates.length === 0 && (
          <Box className={classes.emptyState}>
            <Typography variant="body2">
              {i18n.t("metaTemplates.empty")}
            </Typography>
          </Box>
        )}
      </Paper>
    </MainContainer>
  );
};

export default MetaTemplates;
