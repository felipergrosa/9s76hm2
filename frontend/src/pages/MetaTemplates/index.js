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
import Checkbox from "@material-ui/core/Checkbox";
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

import AddIcon from "@material-ui/icons/Add";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import SyncIcon from "@material-ui/icons/Sync";
import { Info } from "@material-ui/icons";
import { WhatsApp as WhatsAppIcon } from "@material-ui/icons";

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
import usePermissions from "../../hooks/usePermissions";

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
    padding: 0,
    overflow: "hidden",
  },
  subtitle: {
    color: theme.palette.text.secondary,
    marginTop: theme.spacing(0.5),
  },
  connectionSelector: {
    minWidth: 200,
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    flexWrap: "wrap",
  },
  searchField: {
    minWidth: 220,
    flex: "1 1 220px",
    maxWidth: 320,
  },
  filterSelect: {
    minWidth: 140,
  },
  bulkBar: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(0.5, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.type === "dark"
        ? theme.palette.action.selected
        : theme.palette.primary[50],
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
  },
  bodyCell: {
    paddingTop: theme.spacing(1.25),
    paddingBottom: theme.spacing(1.25),
  },
  templateName: {
    fontWeight: 500,
    fontSize: 14,
    lineHeight: 1.35,
  },
  templateSnippet: {
    color: theme.palette.text.secondary,
    fontSize: 12.5,
    lineHeight: 1.45,
    maxWidth: 480,
    whiteSpace: "pre-line",
    marginTop: 2,
  },
  templateFooter: {
    color: theme.palette.text.disabled,
    fontSize: 11.5,
    lineHeight: 1.4,
    maxWidth: 480,
    marginTop: 4,
    fontStyle: "italic",
  },
  infoBox: {
    backgroundColor:
      theme.palette.type === "dark"
        ? theme.palette.grey[800]
        : "#eaf1c6af",
    padding: theme.spacing(2),
    margin: theme.spacing(2),
    borderRadius: 8,
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1),
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
  rowHover: {
    transition: "background-color 120ms ease",
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
  },
  spinning: {
    animation: "$spin 900ms linear infinite",
  },
  "@keyframes spin": {
    from: { transform: "rotate(0deg)" },
    to: { transform: "rotate(360deg)" },
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
  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium";

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
  if (!normalized || normalized === "UNKNOWN") return <>—</>;
  const chipClass = QUALITY_CHIP_CLASSES[normalized] || DEFAULT_STATUS_CHIP;
  return <span className={`${chipBaseClass} ${chipClass}`}>{normalized}</span>;
};

// Corpo completo do template — exibido integralmente na listagem
const bodyText = (template) => {
  const comps = Array.isArray(template?.components) ? template.components : [];
  return (comps.find((c) => c.type === "BODY")?.text || "").trim();
};

// Rodapé do template (exibido abaixo do corpo quando presente)
const footerText = (template) => {
  const comps = Array.isArray(template?.components) ? template.components : [];
  return (comps.find((c) => c.type === "FOOTER")?.text || "").trim();
};

// Formata valor monetário em Real brasileiro (ex.: 0,0625 → "R$ 0,0625")
const formatBrl = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  }).format(Number(value));

const MetaTemplates = () => {
  const classes = useStyles();
  const { user, socket } = useContext(AuthContext);
  const { whatsApps, loading: loadingWhatsApps } = useContext(WhatsAppsContext);

  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [templates, dispatch] = useReducer(reducer, []);
  const [selectedWhatsAppId, setSelectedWhatsAppId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [deletingTemplate, setDeletingTemplate] = useState(null);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [checkedIds, setCheckedIds] = useState([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("meta-templates.create");
  const canEdit = hasPermission("meta-templates.edit");
  const canDelete = hasPermission("meta-templates.delete");

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
    setCheckedIds([]);
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
    setCategoryFilter("");
    setStatusFilter("");
    setLanguageFilter("");
    setCheckedIds([]);
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

  const handleDeleteBulk = async () => {
    try {
      // DELETE com body precisa ir em `data` no axios
      await api.delete(`/meta-templates/${selectedWhatsAppId}/bulk`, {
        data: { templateIds: checkedIds },
      });
      checkedIds.forEach((id) =>
        dispatch({ type: "DELETE_TEMPLATE", payload: id })
      );
      toast.success(i18n.t("metaTemplates.toasts.deleted"));
      setCheckedIds([]);
    } catch (err) {
      toastError(err);
    }
    setDeletingBulk(false);
  };

  const toggleChecked = (id) =>
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  // Filtros client-side: busca por nome/snippet + selects de categoria/status/idioma
  const filteredTemplates = templates.filter((t) => {
    if (searchParam) {
      const hay = `${t.name || ""} ${bodySnippet(t)}`.toLowerCase();
      if (!hay.includes(searchParam)) return false;
    }
    if (categoryFilter && (t.category || "").toUpperCase() !== categoryFilter)
      return false;
    if (statusFilter && (t.status || "").toUpperCase() !== statusFilter)
      return false;
    if (languageFilter && (t.language || "") !== languageFilter) return false;
    return true;
  });

  const languagesInUse = useMemo(
    () => [...new Set(templates.map((t) => t.language).filter(Boolean))],
    [templates]
  );
  const statusesInUse = useMemo(
    () =>
      [...new Set(templates.map((t) => (t.status || "").toUpperCase()))]
        .filter(Boolean)
        .sort(),
    [templates]
  );

  const filteredIds = filteredTemplates.map((t) => t.id);
  const allFilteredChecked =
    filteredIds.length > 0 &&
    filteredIds.every((id) => checkedIds.includes(id));
  const someChecked = checkedIds.length > 0;

  const toggleAllFiltered = () => {
    if (allFilteredChecked) {
      setCheckedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setCheckedIds((prev) => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const hasOfficialConnection = officialWhatsApps.length > 0;

  return (
    <MainContainer useWindowScroll>
      <ConfirmationModal
        title={
          deletingBulk
            ? i18n.t("metaTemplates.confirm.bulkDeleteTitle", {
                defaultValue: `Excluir ${checkedIds.length} templates?`,
                count: checkedIds.length,
              })
            : deletingTemplate &&
              `${i18n.t("metaTemplates.confirm.deleteTitle")} ${
                deletingTemplate.name
              }?`
        }
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={() =>
          deletingBulk ? handleDeleteBulk() : handleDeleteTemplate(deletingTemplate)
        }
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
        <Box>
          <Title>
            {i18n.t("metaTemplates.title")} ({filteredTemplates.length})
          </Title>
          <Typography variant="body2" className={classes.subtitle}>
            {i18n.t("metaTemplates.subtitle")}
          </Typography>
        </Box>
        <MainHeaderButtonsWrapper>
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
              <IconButton
                onClick={handleSync}
                disabled={!selectedWhatsAppId || loading}
                size="small"
              >
                <SyncIcon className={loading ? classes.spinning : undefined} />
              </IconButton>
            </span>
          </Tooltip>
          {canCreate && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenTemplateModal}
              disabled={!selectedWhatsAppId}
              startIcon={<AddIcon />}
            >
              {i18n.t("metaTemplates.buttons.add")}
            </Button>
          )}
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

        {/* Barra de busca e filtros (padrão gerenciador da Meta) */}
        {hasOfficialConnection && (
          <Box className={classes.toolbar}>
            <TextField
              placeholder={i18n.t("metaTemplates.searchPlaceholder")}
              type="search"
              variant="outlined"
              size="small"
              className={classes.searchField}
              value={searchParam}
              onChange={handleSearch}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon style={{ color: "gray" }} fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl
              variant="outlined"
              size="small"
              className={classes.filterSelect}
            >
              <InputLabel>
                {i18n.t("metaTemplates.table.category")}
              </InputLabel>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                label={i18n.t("metaTemplates.table.category")}
              >
                <MenuItem value="">
                  {i18n.t("metaTemplates.filters.all", { defaultValue: "Todas" })}
                </MenuItem>
                <MenuItem value="MARKETING">
                  {i18n.t("metaTemplates.category.MARKETING")}
                </MenuItem>
                <MenuItem value="UTILITY">
                  {i18n.t("metaTemplates.category.UTILITY")}
                </MenuItem>
                <MenuItem value="AUTHENTICATION">
                  {i18n.t("metaTemplates.category.AUTHENTICATION")}
                </MenuItem>
              </Select>
            </FormControl>
            <FormControl
              variant="outlined"
              size="small"
              className={classes.filterSelect}
            >
              <InputLabel>{i18n.t("metaTemplates.table.status")}</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label={i18n.t("metaTemplates.table.status")}
              >
                <MenuItem value="">
                  {i18n.t("metaTemplates.filters.all", { defaultValue: "Todas" })}
                </MenuItem>
                {statusesInUse.map((s) => (
                  <MenuItem key={s} value={s}>
                    {i18n.t(`metaTemplates.status.${s}`, { defaultValue: s })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl
              variant="outlined"
              size="small"
              className={classes.filterSelect}
            >
              <InputLabel>{i18n.t("metaTemplates.table.language")}</InputLabel>
              <Select
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
                label={i18n.t("metaTemplates.table.language")}
              >
                <MenuItem value="">
                  {i18n.t("metaTemplates.filters.all", { defaultValue: "Todos" })}
                </MenuItem>
                {languagesInUse.map((l) => (
                  <MenuItem key={l} value={l}>
                    {l}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        {/* Barra de ações em massa — aparece só com seleção */}
        {someChecked && (
          <Box className={classes.bulkBar}>
            <Typography variant="body2" style={{ fontWeight: 600 }}>
              {i18n.t("metaTemplates.bulk.selected", {
                defaultValue: "{{count}} selecionado(s)",
                count: checkedIds.length,
              })}
            </Typography>
            {canDelete && (
              <Button
                size="small"
                color="secondary"
                startIcon={<DeleteOutlineIcon />}
                onClick={() => {
                  setDeletingBulk(true);
                  setConfirmModalOpen(true);
                }}
              >
                {i18n.t("metaTemplates.buttons.delete")}
              </Button>
            )}
            <Box flex={1} />
            <Button size="small" onClick={() => setCheckedIds([])}>
              {i18n.t("metaTemplates.bulk.clear", { defaultValue: "Limpar seleção" })}
            </Button>
          </Box>
        )}

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                {canDelete && (
                  <Checkbox
                    size="small"
                    indeterminate={someChecked && !allFilteredChecked}
                    checked={allFilteredChecked}
                    onChange={toggleAllFiltered}
                    disabled={filteredTemplates.length === 0}
                  />
                )}
              </TableCell>
              <TableCell className={classes.headCell}>
                {i18n.t("metaTemplates.table.name")}
              </TableCell>
              <TableCell align="center" className={classes.headCell}>
                {i18n.t("metaTemplates.table.category")}
              </TableCell>
              <TableCell align="center" className={classes.headCell}>
                {i18n.t("metaTemplates.table.cost", { defaultValue: "Custo/envio" })}
              </TableCell>
              <TableCell align="center" className={classes.headCell}>
                {i18n.t("metaTemplates.table.language")}
              </TableCell>
              <TableCell align="center" className={classes.headCell}>
                {i18n.t("metaTemplates.table.status")}
              </TableCell>
              <TableCell align="center" className={classes.headCell}>
                {i18n.t("metaTemplates.table.quality")}
              </TableCell>
              <TableCell align="center" className={classes.headCell}>
                {i18n.t("metaTemplates.table.reason")}
              </TableCell>
              <TableCell align="center" className={classes.headCell}>
                {i18n.t("metaTemplates.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRowSkeleton key="skeleton" columns={9} />
            ) : (
              <>
                {filteredTemplates.map((template) => (
                  <TableRow key={template.id} className={classes.rowHover} hover={false}>
                    <TableCell padding="checkbox" className={classes.bodyCell}>
                      {canDelete && (
                        <Checkbox
                          size="small"
                          checked={checkedIds.includes(template.id)}
                          onChange={() => toggleChecked(template.id)}
                        />
                      )}
                    </TableCell>
                    <TableCell className={classes.bodyCell}>
                      <div className={classes.templateName}>{template.name}</div>
                      {bodyText(template) && (
                        <div className={classes.templateSnippet}>
                          {bodyText(template)}
                        </div>
                      )}
                      {footerText(template) && (
                        <div className={classes.templateFooter}>
                          {footerText(template)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      <CategoryChip category={template.category} />
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {template.estimatedCost !== null &&
                      template.estimatedCost !== undefined ? (
                        <Tooltip title="Custo estimado por envio (tarifa efetiva Meta — pode variar por tier)">
                          <span className="bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full text-xs">
                            {formatBrl(template.estimatedCost)}
                          </span>
                        </Tooltip>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {template.language || "—"}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      <StatusChip status={template.status} />
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      <QualityChip score={template.quality_score?.score} />
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {template.rejected_reason || "—"}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {canEdit && (
                        <Tooltip title={i18n.t("metaTemplates.buttons.edit")}>
                          <IconButton
                            size="small"
                            onClick={() => handleEditTemplate(template)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Tooltip title={i18n.t("metaTemplates.buttons.delete")}>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setDeletingBulk(false);
                              setDeletingTemplate(template);
                              setConfirmModalOpen(true);
                            }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
        {!loading && hasOfficialConnection && filteredTemplates.length === 0 && (
          <Box className={classes.emptyState}>
            <WhatsAppIcon className={classes.emptyIcon} />
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {i18n.t("metaTemplates.empty")}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {i18n.t("metaTemplates.emptyHint", {
                defaultValue:
                  "Crie um novo template ou clique em Sincronizar para buscar os existentes na Meta.",
              })}
            </Typography>
          </Box>
        )}
      </Paper>
    </MainContainer>
  );
};

export default MetaTemplates;
