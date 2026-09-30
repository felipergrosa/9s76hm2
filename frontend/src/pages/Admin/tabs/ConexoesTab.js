import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { toast } from "react-toastify";
import { format, parseISO } from "date-fns";

import {
  Box,
  Paper,
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
  MenuItem,
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import { Stack } from "@mui/material";
import {
  CropFree,
  Replay,
  Autorenew,
  DeleteSweep,
  PowerSettingsNew,
  PhonelinkSetup,
  Facebook,
  Instagram,
  WhatsApp,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  CheckCircle,
} from "@material-ui/icons";

import api from "../../../services/api";
import { i18n } from "../../../translate/i18n";
import toastError from "../../../errors/toastError";
import TableRowSkeleton from "../../../components/TableRowSkeleton";
import ConfirmationModal from "../../../components/ConfirmationModal";
import QrcodeModal from "../../../components/QrcodeModal";
import WhatsAppModalCompany from "../../../components/CompanyWhatsapps";
import ForbiddenPage from "../../../components/ForbiddenPage";
import { AuthContext } from "../../../context/Auth/AuthContext";
import useCompanies from "../../../hooks/useCompanies";
import usePermissions from "../../../hooks/usePermissions";
import useDebounce from "../../../hooks/useDebounce";

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
  companyFilter: {
    minWidth: 200,
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
  channelCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
}));

// Ícone do canal — mesma regra de AllConnections (facebook/instagram/whatsapp)
const IconChannel = (channel) => {
  switch (channel) {
    case "facebook":
      return <Facebook fontSize="small" />;
    case "instagram":
      return <Instagram fontSize="small" />;
    case "whatsapp":
      return <WhatsApp fontSize="small" />;
    default:
      return null;
  }
};

// Chips de status no padrão novo (tailwind + dark:) — cores por estado da sessão
const chipBaseClass =
  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium";

const STATUS_CHIP_CLASSES = {
  CONNECTED:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  OPENING:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  QRCODE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  PAIRING:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  TIMEOUT:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  DISCONNECTED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const DEFAULT_STATUS_CHIP =
  "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";

const STATUS_LABELS = {
  CONNECTED: "Conectado",
  OPENING: "Conectando",
  QRCODE: "QR Code",
  PAIRING: "Pareando",
  TIMEOUT: "Timeout",
  DISCONNECTED: "Desconectado",
};

// Tooltip do chip reaproveita os mesmos textos de ajuda da página original
const statusTooltip = (whatsApp) => {
  const isBaileys =
    !whatsApp.channelType || whatsApp.channelType === "baileys";

  if (
    whatsApp.status === "DISCONNECTED" ||
    (whatsApp.status === "qrcode" && !isBaileys)
  ) {
    return {
      title: i18n.t("connections.toolTips.disconnected.title"),
      content: i18n.t("connections.toolTips.disconnected.content"),
    };
  }
  if (whatsApp.status === "qrcode" && isBaileys) {
    return {
      title: i18n.t("connections.toolTips.qrcode.title"),
      content: i18n.t("connections.toolTips.qrcode.content"),
    };
  }
  if (whatsApp.status === "CONNECTED") {
    return { title: i18n.t("connections.toolTips.connected.title") };
  }
  if (whatsApp.status === "TIMEOUT" || whatsApp.status === "PAIRING") {
    return {
      title: i18n.t("connections.toolTips.timeout.title"),
      content: i18n.t("connections.toolTips.timeout.content"),
    };
  }
  return null;
};

const StatusChip = ({ whatsApp }) => {
  const normalized = (whatsApp.status || "").toUpperCase();
  const chipClass = STATUS_CHIP_CLASSES[normalized] || DEFAULT_STATUS_CHIP;
  const label = STATUS_LABELS[normalized] || whatsApp.status || "—";
  const tip = statusTooltip(whatsApp);

  const chip = <span className={`${chipBaseClass} ${chipClass}`}>{label}</span>;

  if (!tip) return chip;

  return (
    <Tooltip
      arrow
      title={
        <React.Fragment>
          <Typography gutterBottom color="inherit" variant="subtitle2">
            {tip.title}
          </Typography>
          {tip.content && (
            <Typography variant="caption">{tip.content}</Typography>
          )}
        </React.Fragment>
      }
    >
      {chip}
    </Tooltip>
  );
};

// Aba "Conexões" do console /admin — migração de src/pages/AllConnections.
// Lista TODAS as conexões WhatsApp de TODAS as empresas (GET /whatsapp/all/?session=0)
// com as mesmas ações da página original: QR/restart, disconnect e
// gerenciamento via WhatsAppModalCompany.
const ConexoesTab = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const { hasPermission } = usePermissions();
  const { list } = useCompanies();

  const [loading, setLoading] = useState(true);
  const [whats, setWhats] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const searchParam = useDebounce(searchInput, 500);
  const [companyFilter, setCompanyFilter] = useState("");

  // Toggle "limpar sessão" por conexão — idêntico ao clearAuthById original
  const [clearAuthById, setClearAuthById] = useState({});

  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [filterConnections, setFilterConnections] = useState([]);
  const [companyWhatsApps, setCompanyWhatsApps] = useState(null);

  const confirmationModalInitialState = {
    action: "",
    title: "",
    message: "",
    whatsAppId: "",
    open: false,
  };
  const [confirmModalInfo, setConfirmModalInfo] = useState(
    confirmationModalInitialState
  );

  // Mesma chamada da página original — session=0 exclui o payload da sessão
  const loadConnections = useCallback(async (withSpinner = true) => {
    if (withSpinner) setLoading(true);
    try {
      const { data } = await api.get("/whatsapp/all/?session=0");
      setWhats(Array.isArray(data) ? data : []);
    } catch (err) {
      // 403 = sem permissão connections.view — lista fica vazia
      if (err?.response?.status !== 403) {
        toastError(err);
      }
    }
    if (withSpinner) setLoading(false);
  }, []);

  const loadCompanies = useCallback(async () => {
    try {
      const companyList = await list();
      setCompanies(Array.isArray(companyList) ? companyList : []);
    } catch (e) {
      toast.error("Não foi possível carregar a lista de registros");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadConnections();
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // companyId → empresa, para a coluna "Empresa" e o filtro
  const companyById = useMemo(() => {
    const map = {};
    companies.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [companies]);

  // Filtros client-side: empresa (select) + busca por nome/número/empresa
  const filteredWhats = useMemo(() => {
    const s = (searchParam || "").toLowerCase().trim();
    return (whats || []).filter((w) => {
      if (companyFilter && String(w.companyId) !== String(companyFilter)) {
        return false;
      }
      if (!s) return true;
      const companyName = companyById[w.companyId]?.name || "";
      return `${w.name || ""} ${w.number || ""} ${companyName}`
        .toLowerCase()
        .includes(s);
    });
  }, [whats, companyFilter, searchParam, companyById]);

  // POST /whatsappsession/:id — tentar novamente / recarregar conexão
  const handleStartWhatsAppSession = async (whatsAppId) => {
    try {
      await api.post(`/whatsappsession/${whatsAppId}`);
      // O backend vira OPENING de forma assíncrona — recarrega agora e em 3s
      loadConnections(false);
      setTimeout(() => loadConnections(false), 3000);
    } catch (err) {
      toastError(err);
    }
  };

  // PUT /whatsappsession/:id { clearAuth } — novo QR Code
  const handleRequestNewQrCode = async (whatsAppId) => {
    try {
      const clearAuth = !!clearAuthById?.[whatsAppId];
      await api.put(`/whatsappsession/${whatsAppId}`, { clearAuth });
      setClearAuthById((prev) => ({ ...prev, [whatsAppId]: false }));
      loadConnections(false);
      setTimeout(() => loadConnections(false), 3000);
    } catch (err) {
      toastError(err);
    }
  };

  // Abre o WhatsAppModalCompany com as conexões da empresa da linha —
  // equivalente ao clique no lápis da linha de empresa na página original
  const handleOpenWhatsAppModal = (whatsApp) => {
    const comp = companyById[whatsApp.companyId] || null;
    const whatsappsFilter = (whats || []).filter(
      (w) => w.companyId === whatsApp.companyId
    );
    setSelectedWhatsApp(whatsApp);
    setFilterConnections(whatsappsFilter);
    setCompanyWhatsApps(comp);
    setWhatsAppModalOpen(true);
  };

  const handleCloseWhatsAppModal = useCallback(() => {
    setWhatsAppModalOpen(false);
    setSelectedWhatsApp(null);
    setFilterConnections([]);
    setCompanyWhatsApps(null);
    // Edições/exclusões dentro do modal mudam a lista — recarrega ao fechar
    loadConnections(false);
  }, [loadConnections]);

  const handleOpenQrModal = (whatsApp) => {
    setSelectedWhatsApp(whatsApp);
    setQrModalOpen(true);
  };

  const handleCloseQrModal = useCallback(() => {
    setSelectedWhatsApp(null);
    setQrModalOpen(false);
    loadConnections(false);
  }, [loadConnections]);

  const handleOpenConfirmationModal = (action, whatsAppId) => {
    if (action === "disconnect") {
      setConfirmModalInfo({
        action: action,
        title: i18n.t("connections.confirmationModal.disconnectTitle"),
        message: i18n.t("connections.confirmationModal.disconnectMessage"),
        whatsAppId: whatsAppId,
      });
    }

    if (action === "delete") {
      setConfirmModalInfo({
        action: action,
        title: i18n.t("connections.confirmationModal.deleteTitle"),
        message: i18n.t("connections.confirmationModal.deleteMessage"),
        whatsAppId: whatsAppId,
      });
    }
    setConfirmModalOpen(true);
  };

  // Mesmas chamadas da página original: disconnect → DELETE whatsappsession,
  // delete → DELETE whatsapp
  const handleSubmitConfirmationModal = async () => {
    if (confirmModalInfo.action === "disconnect") {
      try {
        await api.delete(`/whatsappsession/${confirmModalInfo.whatsAppId}`);
        loadConnections(false);
        setTimeout(() => loadConnections(false), 3000);
      } catch (err) {
        toastError(err);
      }
    }

    if (confirmModalInfo.action === "delete") {
      try {
        await api.delete(`/whatsapp/${confirmModalInfo.whatsAppId}`);
        toast.success(i18n.t("connections.toasts.deleted"));
        loadConnections(false);
      } catch (err) {
        toastError(err);
      }
    }

    setConfirmModalInfo(confirmationModalInitialState);
  };

  // Ações por status — mesma matriz de botões da página original
  // (qrcode → QR, DISCONNECTED → replay/novo QR/limpar sessão,
  // CONNECTED|PAIRING|TIMEOUT → disconnect, OPENING → spinner desabilitado)
  const renderActionButtons = (whatsApp) => {
    const isBaileys =
      !whatsApp.channelType || whatsApp.channelType === "baileys";

    return (
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        justifyContent="center"
        style={{ flexWrap: "wrap" }}
      >
        {whatsApp.status === "qrcode" && isBaileys && (
          <Tooltip title={i18n.t("connections.buttons.qrcode")}>
            <span>
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleOpenQrModal(whatsApp)}
              >
                <CropFree />
              </IconButton>
            </span>
          </Tooltip>
        )}
        {whatsApp.status === "DISCONNECTED" && (
          <>
            <Tooltip
              title={
                isBaileys
                  ? i18n.t("connections.buttons.tryAgain")
                  : "Recarregar Conexão"
              }
            >
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => handleStartWhatsAppSession(whatsApp.id)}
                >
                  <Replay />
                </IconButton>
              </span>
            </Tooltip>

            {isBaileys && (
              <>
                <Tooltip title={i18n.t("connections.buttons.newQr")}>
                  <span>
                    <IconButton
                      size="small"
                      color="secondary"
                      onClick={() => handleRequestNewQrCode(whatsApp.id)}
                    >
                      <Autorenew />
                    </IconButton>
                  </span>
                </Tooltip>

                <Tooltip
                  title={
                    clearAuthById?.[whatsApp.id]
                      ? "Limpar sessão: ATIVO"
                      : "Limpar sessão: inativo"
                  }
                >
                  <span>
                    <IconButton
                      size="small"
                      color={
                        clearAuthById?.[whatsApp.id] ? "secondary" : "default"
                      }
                      onClick={() =>
                        setClearAuthById((prev) => ({
                          ...prev,
                          [whatsApp.id]: !prev?.[whatsApp.id],
                        }))
                      }
                    >
                      <DeleteSweep />
                    </IconButton>
                  </span>
                </Tooltip>
              </>
            )}
          </>
        )}
        {(whatsApp.status === "CONNECTED" ||
          whatsApp.status === "PAIRING" ||
          whatsApp.status === "TIMEOUT") && (
          <Tooltip title={i18n.t("connections.buttons.disconnect")}>
            <span>
              <IconButton
                size="small"
                color="secondary"
                onClick={() => {
                  handleOpenConfirmationModal("disconnect", whatsApp.id);
                }}
              >
                <PowerSettingsNew />
              </IconButton>
            </span>
          </Tooltip>
        )}
        {whatsApp.status === "OPENING" && (
          <Tooltip title={i18n.t("connections.buttons.connecting")}>
            <span>
              <IconButton size="small" disabled>
                <Autorenew />
              </IconButton>
            </span>
          </Tooltip>
        )}

        {/* Gerenciar conexões da empresa — abre o WhatsAppModalCompany */}
        <Tooltip title={i18n.t("connections.title")}>
          <span>
            <IconButton
              size="small"
              onClick={() => handleOpenWhatsAppModal(whatsApp)}
            >
              <PhonelinkSetup fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    );
  };

  if (!hasPermission("all-connections.view")) {
    return <ForbiddenPage />;
  }

  const isAdmin = user.profile === "admin";

  return (
    <Box>
      <ConfirmationModal
        title={confirmModalInfo.title}
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={handleSubmitConfirmationModal}
      >
        {confirmModalInfo.message}
      </ConfirmationModal>
      <QrcodeModal
        open={qrModalOpen}
        onClose={handleCloseQrModal}
        whatsAppId={!whatsAppModalOpen && selectedWhatsApp?.id}
      />
      <WhatsAppModalCompany
        open={whatsAppModalOpen}
        onClose={handleCloseWhatsAppModal}
        filteredWhatsapps={filterConnections}
        companyInfos={companyWhatsApps}
        whatsAppId={!qrModalOpen && selectedWhatsApp?.id}
      />

      <Box className={classes.toolbar}>
        <TextField
          placeholder="Buscar por nome, número ou empresa"
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
        <TextField
          select
          label="Empresa"
          variant="outlined"
          size="small"
          className={classes.companyFilter}
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
        >
          <MenuItem value="">Todas as empresas</MenuItem>
          {companies.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
        </TextField>
        <Typography variant="body2" className={classes.countText}>
          {i18n.t("connections.title")} ({filteredWhats.length})
        </Typography>
        <Box flex={1} />
        <Tooltip title="Recarregar">
          <span>
            <IconButton
              size="small"
              onClick={() => loadConnections()}
              disabled={loading}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Paper className={classes.tablePaper} elevation={0} variant="outlined">
        <div className={classes.tableScroll}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell align="center" className={classes.headCell}>
                  Canal
                </TableCell>
                <TableCell className={classes.headCell}>
                  {i18n.t("connections.table.name")}
                </TableCell>
                <TableCell className={classes.headCell}>Empresa</TableCell>
                <TableCell align="center" className={classes.headCell}>
                  {i18n.t("connections.table.status")}
                </TableCell>
                <TableCell align="center" className={classes.headCell}>
                  {i18n.t("connections.table.number")}
                </TableCell>
                <TableCell align="center" className={classes.headCell}>
                  {i18n.t("connections.table.default")}
                </TableCell>
                <TableCell align="center" className={classes.headCell}>
                  {i18n.t("connections.table.lastUpdate")}
                </TableCell>
                {isAdmin && (
                  <TableCell align="center" className={classes.headCell}>
                    {i18n.t("connections.table.actions")}
                  </TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRowSkeleton columns={isAdmin ? 8 : 7} />
              ) : (
                filteredWhats.map((whatsApp) => (
                  <TableRow key={whatsApp.id} className={classes.rowHover}>
                    <TableCell align="center" className={classes.bodyCell}>
                      <div className={classes.channelCell}>
                        {IconChannel(whatsApp.channel) || (
                          <Typography
                            variant="caption"
                            className={classes.cellCaption}
                          >
                            {whatsApp.channel || "—"}
                          </Typography>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={classes.bodyCell}>
                      {whatsApp.name || "—"}
                      {whatsApp.channelType &&
                        whatsApp.channelType !== "baileys" && (
                          <div className={classes.cellCaption}>
                            {whatsApp.channelType}
                          </div>
                        )}
                    </TableCell>
                    <TableCell className={classes.bodyCell}>
                      {companyById[whatsApp.companyId]?.name ||
                        `#${whatsApp.companyId}`}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      <StatusChip whatsApp={whatsApp} />
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {whatsApp.number || "—"}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {whatsApp.isDefault && (
                        <CheckCircle
                          fontSize="small"
                          style={{ color: green[500] }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="center" className={classes.bodyCell}>
                      {whatsApp.updatedAt
                        ? format(parseISO(whatsApp.updatedAt), "dd/MM/yy HH:mm")
                        : "—"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell align="center" className={classes.bodyCell}>
                        {renderActionButtons(whatsApp)}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && filteredWhats.length === 0 && (
          <Box className={classes.emptyState}>
            <PhonelinkSetup className={classes.emptyIcon} />
            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {searchParam || companyFilter
                ? "Nenhuma conexão encontrada para os filtros."
                : "Nenhuma conexão cadastrada."}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {searchParam || companyFilter
                ? "Ajuste a busca ou limpe os filtros aplicados."
                : "As conexões WhatsApp das empresas aparecerão aqui."}
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default ConexoesTab;
