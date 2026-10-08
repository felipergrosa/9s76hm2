import React, {
  useState,
  useEffect,
  useCallback,
} from "react";

import { makeStyles } from "@material-ui/core/styles";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Chip,
  Button,
} from "@material-ui/core";

import {
  Activity as ActivityIcon,
  CheckCircle2 as CheckIcon,
  AlertTriangle as AlertIcon,
  WifiOff as WifiOffIcon,
  RefreshCw as RefreshIcon,
  Phone as PhoneIcon,
} from "lucide-react";

import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import ForbiddenPage from "../../components/ForbiddenPage";
import TableRowSkeleton from "../../components/TableRowSkeleton";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import usePermissions from "../../hooks/usePermissions";

import { motion, useReducedMotion } from "framer-motion";
import StatCard from "../../components/bento/StatCard";
import { bentoContainer, bentoItem, bentoItemReduced } from "../../components/bento/motionPresets";
import "../../components/bento/bento.css";

// ===== Estilos no padrão das páginas novas (Wallets/Connections) =====
const useStyles = makeStyles((theme) => ({
  paper: {
    flex: 1,
    padding: 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
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
    position: "sticky",
    top: 0,
    zIndex: 1,
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
  mutedText: {
    color: theme.palette.text.secondary,
    fontSize: "0.78rem",
  },
  connectionName: {
    fontWeight: 600,
    fontSize: "0.9rem",
    lineHeight: 1.35,
  },
  errorText: {
    color: "#e7505a",
    fontSize: "0.78rem",
    maxWidth: 320,
    display: "inline-block",
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
  // Área rolável — header fica fixo no topo do Paper
  listScroll: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
}));

// Cores do badge por quality rating da Meta (palette bento)
const QUALITY_COLORS = {
  GREEN: "#26c281",
  YELLOW: "#f39c12",
  RED: "#e7505a",
};

// Chip colorido para qualidade / status — mesma linguagem visual do restante
const ColoredChip = ({ label, color }) => (
  <Chip
    size="small"
    label={label}
    style={{
      backgroundColor: color,
      color: "#fff",
      fontWeight: 600,
      fontSize: "0.72rem",
      textShadow: "0px 0.3px #000",
    }}
  />
);

const WhatsappHealth = () => {
  const classes = useStyles();
  const { hasPermission } = usePermissions();

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    connected: 0,
    green: 0,
    attention: 0,
    errors: 0,
  });
  const [syncedAt, setSyncedAt] = useState(null);
  const [loading, setLoading] = useState(false);

  const reducedMotion = useReducedMotion();
  const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

  // Consulta on-demand à Graph API via backend — re-sincroniza tudo
  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/whatsapp-health");
      setItems(Array.isArray(data?.items) ? data.items : []);
      if (data?.stats) setStats(data.stats);
      if (data?.syncedAt) setSyncedAt(data.syncedAt);
    } catch (err) {
      // 403 = sem permissão connections.view — silencia (ForbiddenPage cobre)
      if (err?.response?.status !== 403) {
        toastError(err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // Badge de qualidade: GREEN/YELLOW/RED colorido; demais vira texto discreto
  const renderQuality = (item) => {
    if (item.error) {
      return (
        <Tooltip title={item.error}>
          <span className={classes.errorText}>
            {i18n.t("whatsappHealth.labels.queryError")}
          </span>
        </Tooltip>
      );
    }
    const q = item.qualityRating;
    if (!q || q === "NA") {
      return <span className={classes.mutedText}>—</span>;
    }
    const color = QUALITY_COLORS[q];
    const label = i18n.t(`whatsappHealth.quality.${q}`, { defaultValue: q });
    return color ? <ColoredChip label={label} color={color} /> : (
      <span>{label}</span>
    );
  };

  // Status da conexão: badge verde quando CONNECTED, âmbar para os demais
  const renderStatus = (item) => {
    const connected = item.status === "CONNECTED";
    const label = connected
      ? i18n.t("whatsappHealth.status.connected")
      : item.status || "—";
    return (
      <ColoredChip
        label={label}
        color={connected ? "#26c281" : "#f39c12"}
      />
    );
  };

  // Tier de envio formatado (TIER_1K → 1K, TIER_UNLIMITED → Ilimitado)
  const renderMessagingLimit = (item) => {
    if (!item.messagingLimit) {
      return <span className={classes.mutedText}>—</span>;
    }
    const key = `whatsappHealth.tiers.${item.messagingLimit}`;
    const translated = i18n.t(key);
    return translated === key ? item.messagingLimit : translated;
  };

  // Status do nome de exibição (name_status da Meta)
  const renderNameStatus = (item) => {
    if (!item.nameStatus) {
      return <span className={classes.mutedText}>—</span>;
    }
    const key = `whatsappHealth.nameStatus.${item.nameStatus}`;
    const translated = i18n.t(key);
    return translated === key ? item.nameStatus : translated;
  };

  const formatSync = (iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <MainContainer>
      {!hasPermission("connections.view") ? (
        <ForbiddenPage />
      ) : (
        <motion.div
          variants={bentoContainer}
          initial="hidden"
          animate="show"
          style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: 12 }}
        >
          {/* Strip de KPIs bento — agregados retornados pelo backend */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard
              label={i18n.t("whatsappHealth.stats.total")}
              value={stats.total}
              icon={<PhoneIcon size={20} />}
              accent="var(--primary-color)"
              loading={loading && items.length === 0}
            />
            <StatCard
              label={i18n.t("whatsappHealth.stats.green")}
              value={stats.green}
              icon={<CheckIcon size={20} />}
              accent="#26c281"
              loading={loading && items.length === 0}
            />
            <StatCard
              label={i18n.t("whatsappHealth.stats.attention")}
              value={stats.attention}
              icon={<AlertIcon size={20} />}
              accent="#f39c12"
              loading={loading && items.length === 0}
            />
            <StatCard
              label={i18n.t("whatsappHealth.stats.errors")}
              value={stats.errors}
              icon={<WifiOffIcon size={20} />}
              accent="#e7505a"
              loading={loading && items.length === 0}
            />
          </div>

          <motion.div
            variants={itemVariant}
            style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
          >
            <Paper className={`${classes.paper} bento-panel`} variant="outlined">
              {/* Cabeçalho: título + subtítulo + ação de re-sync */}
              <div className={classes.header}>
                <div className={classes.headerText}>
                  <Title>
                    {i18n.t("whatsappHealth.title")} ({stats.total})
                  </Title>
                  <span className={classes.subtitle}>
                    {i18n.t("whatsappHealth.subtitle")}
                    {syncedAt ? ` — ${i18n.t("whatsappHealth.updatedAt")} ${formatSync(syncedAt)}` : ""}
                  </span>
                </div>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  disabled={loading}
                  onClick={fetchHealth}
                  startIcon={<RefreshIcon size={16} />}
                >
                  {loading
                    ? i18n.t("whatsappHealth.buttons.syncing")
                    : i18n.t("whatsappHealth.buttons.refresh")}
                </Button>
              </div>

              {/* Tabela de números WABA */}
              <div className={classes.listScroll}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell className={classes.headCell}>
                        {i18n.t("whatsappHealth.table.connection")}
                      </TableCell>
                      <TableCell className={classes.headCell}>
                        {i18n.t("whatsappHealth.table.number")}
                      </TableCell>
                      <TableCell className={classes.headCell}>
                        {i18n.t("whatsappHealth.table.status")}
                      </TableCell>
                      <TableCell className={classes.headCell}>
                        {i18n.t("whatsappHealth.table.quality")}
                      </TableCell>
                      <TableCell className={classes.headCell}>
                        {i18n.t("whatsappHealth.table.messagingLimit")}
                      </TableCell>
                      <TableCell className={classes.headCell}>
                        {i18n.t("whatsappHealth.table.nameStatus")}
                      </TableCell>
                      <TableCell className={classes.headCell}>
                        {i18n.t("whatsappHealth.table.lastSync")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading && items.length === 0 ? (
                      <TableRowSkeleton columns={7} />
                    ) : (
                      (items || []).map((item) => (
                        <TableRow key={item.id} className={classes.rowHover}>
                          <TableCell className={classes.bodyCell}>
                            <span className={classes.connectionName}>
                              {item.name}
                            </span>
                            {item.verifiedName && (
                              <div className={classes.mutedText}>
                                {item.verifiedName}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className={classes.bodyCell}>
                            {item.number || <span className={classes.mutedText}>—</span>}
                          </TableCell>
                          <TableCell className={classes.bodyCell}>
                            {renderStatus(item)}
                          </TableCell>
                          <TableCell className={classes.bodyCell}>
                            {renderQuality(item)}
                          </TableCell>
                          <TableCell className={classes.bodyCell}>
                            {renderMessagingLimit(item)}
                          </TableCell>
                          <TableCell className={classes.bodyCell}>
                            {renderNameStatus(item)}
                          </TableCell>
                          <TableCell className={classes.bodyCell}>
                            <span className={classes.mutedText}>
                              {formatSync(item.lastSync)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {!loading && items.length === 0 && (
                  <div className={classes.emptyState}>
                    <ActivityIcon size={36} />
                    <span>{i18n.t("whatsappHealth.empty")}</span>
                  </div>
                )}
              </div>
            </Paper>
          </motion.div>
        </motion.div>
      )}
    </MainContainer>
  );
};

export default WhatsappHealth;
