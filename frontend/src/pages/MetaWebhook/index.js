import React, { useState, useEffect, useMemo } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import { Typography, Tooltip, Chip } from "@material-ui/core";
import { toast } from "react-toastify";
import {
  Webhook as WebhookIcon,
  KeyRound as KeyIcon,
  ShieldCheck as ShieldIcon,
  Copy as CopyIcon,
  Check as CheckIcon,
  ListChecks as FieldsIcon,
  Link2 as LinkIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import Title from "../../components/Title";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import StatCard from "../../components/bento/StatCard";
import {
  bentoContainer,
  bentoItem,
  bentoItemReduced,
} from "../../components/bento/motionPresets";
import "../../components/bento/bento.css";

// ===== Estilos no padrão bento (referência: pages/ClosingReport) =====
const useStyles = makeStyles((theme) => ({
  paper: {
    padding: theme.spacing(2, 2.5),
    borderRadius: 20,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  sectionTitle: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    fontWeight: 700,
  },
  urlRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  urlBox: {
    flex: 1,
    minWidth: 220,
    padding: theme.spacing(1, 1.5),
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.default,
    fontFamily: "monospace",
    fontSize: 13,
    wordBreak: "break-all",
  },
  tokenBox: {
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1.5),
    borderRadius: 12,
    border: `1px dashed ${theme.palette.divider}`,
    fontFamily: "monospace",
    fontSize: 13,
    letterSpacing: 1,
  },
  fieldGroup: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 16,
    padding: theme.spacing(1.5, 2),
  },
  fieldChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  stepList: {
    margin: 0,
    paddingLeft: theme.spacing(2.5),
    "& li": {
      marginBottom: theme.spacing(1),
      lineHeight: 1.5,
    },
  },
}));

const MetaWebhook = () => {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);
  // Chave do último valor copiado — feedback visual temporário no botão
  const [copied, setCopied] = useState("");

  const reducedMotion = useReducedMotion();
  const itemVariant = reducedMotion ? bentoItemReduced : bentoItem;

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/meta-webhook-config");
        setConfig(data);
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleCopy = async (key, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast.success(i18n.t("metaWebhook.toasts.copied"));
      setTimeout(() => setCopied((c) => (c === key ? "" : c)), 2000);
    } catch (e) {
      toast.error(i18n.t("metaWebhook.toasts.copyError"));
    }
  };

  const totalFields = useMemo(
    () =>
      (config?.fields || []).reduce(
        (acc, group) => acc + (group.items?.length || 0),
        0
      ),
    [config]
  );

  const tokenStatus = !config
    ? "-"
    : config.verifyTokenMasked || config.perConnectionVerifyTokens > 0
    ? i18n.t("metaWebhook.status.configured")
    : i18n.t("metaWebhook.status.missing");

  const secretStatus = !config
    ? "-"
    : config.appSecretConfigured || config.perConnectionAppSecrets > 0
    ? i18n.t("metaWebhook.status.configured")
    : i18n.t("metaWebhook.status.missing");

  // Linha reutilizável: label + valor mono + botão copiar
  const renderCopyRow = (label, value, copyKey) => (
    <div>
      <span className="bento-label">{label}</span>
      <div className={classes.urlRow} style={{ marginTop: 6 }}>
        <div className={classes.urlBox}>{value || "-"}</div>
        <Tooltip title={i18n.t("metaWebhook.buttons.copy")}>
          <button
            type="button"
            className="bento-icon-btn"
            onClick={() => handleCopy(copyKey, value)}
            disabled={!value}
            aria-label={i18n.t("metaWebhook.buttons.copy")}
          >
            {copied === copyKey ? (
              <CheckIcon size={16} />
            ) : (
              <CopyIcon size={16} />
            )}
          </button>
        </Tooltip>
      </div>
    </div>
  );

  const renderToken = (masked) => (
    <div className={classes.tokenBox}>
      <KeyIcon size={14} />
      {masked || i18n.t("metaWebhook.token.notSet")}
    </div>
  );

  return (
    <MainContainer useWindowScroll>
      <motion.div
        variants={bentoContainer}
        initial="hidden"
        animate="show"
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          gap: 12,
        }}
      >
        {/* Cabeçalho */}
        <motion.div variants={itemVariant}>
          <Title>{i18n.t("metaWebhook.title")}</Title>
          <Typography variant="body2" color="textSecondary">
            {i18n.t("metaWebhook.subtitle")}
          </Typography>
        </motion.div>

        {/* Strip de KPIs — status da configuração */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard
            label={i18n.t("metaWebhook.cards.verifyToken")}
            value={tokenStatus}
            icon={<KeyIcon size={20} />}
            accent="var(--primary-color)"
            loading={loading}
          />
          <StatCard
            label={i18n.t("metaWebhook.cards.appSecret")}
            value={secretStatus}
            icon={<ShieldIcon size={20} />}
            accent="#26c281"
            loading={loading}
          />
          <StatCard
            label={i18n.t("metaWebhook.cards.perConnection")}
            value={config ? config.perConnectionVerifyTokens : 0}
            icon={<LinkIcon size={20} />}
            accent="#8e44ad"
            loading={loading}
          />
          <StatCard
            label={i18n.t("metaWebhook.cards.fields")}
            value={totalFields}
            icon={<FieldsIcon size={20} />}
            accent="#3598dc"
            loading={loading}
          />
        </div>

        {/* Endpoints + verify tokens */}
        <motion.div variants={itemVariant}>
          <Paper className={`${classes.paper} bento-panel`} variant="outlined">
            <div className={classes.sectionTitle}>
              <WebhookIcon size={18} />
              {i18n.t("metaWebhook.sections.endpoints")}
            </div>

            {renderCopyRow(
              i18n.t("metaWebhook.labels.unifiedUrl"),
              config?.webhookUrl,
              "webhookUrl"
            )}
            <div>
              <span className="bento-label">
                {i18n.t("metaWebhook.labels.verifyToken")}
              </span>
              <div style={{ marginTop: 6 }}>
                {renderToken(config?.verifyTokenMasked)}
              </div>
              <Typography variant="caption" color="textSecondary">
                {i18n.t("metaWebhook.labels.verifyTokenHint")}
              </Typography>
            </div>

            {renderCopyRow(
              i18n.t("metaWebhook.labels.wabaUrl"),
              config?.whatsappBusiness?.webhookUrl,
              "wabaUrl"
            )}
            <div>
              <span className="bento-label">
                {i18n.t("metaWebhook.labels.wabaVerifyToken")}
              </span>
              <div style={{ marginTop: 6 }}>
                {renderToken(config?.whatsappBusiness?.verifyTokenMasked)}
              </div>
            </div>
          </Paper>
        </motion.div>

        {/* Checklist de campos de assinatura por produto Meta */}
        <motion.div variants={itemVariant}>
          <Paper className={`${classes.paper} bento-panel`} variant="outlined">
            <div className={classes.sectionTitle}>
              <FieldsIcon size={18} />
              {i18n.t("metaWebhook.sections.fields")}
            </div>
            <Typography variant="body2" color="textSecondary">
              {i18n.t("metaWebhook.sections.fieldsHint")}
            </Typography>

            {(config?.fields || []).map((group) => (
              <div key={group.object} className={classes.fieldGroup}>
                <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
                  {group.product}
                  <Typography
                    component="span"
                    variant="caption"
                    color="textSecondary"
                    style={{ marginLeft: 8, fontFamily: "monospace" }}
                  >
                    {group.object} → {group.endpoint}
                  </Typography>
                </Typography>
                <div className={classes.fieldChips}>
                  {group.items.map((item) => (
                    <Tooltip
                      key={item.name}
                      title={i18n.t(
                        item.source === "app"
                          ? "metaWebhook.fields.autoHint"
                          : "metaWebhook.fields.dashboardHint"
                      )}
                    >
                      <Chip
                        size="small"
                        variant={
                          item.source === "app" ? "default" : "outlined"
                        }
                        color={item.source === "app" ? "primary" : "default"}
                        label={
                          item.source === "app"
                            ? item.name
                            : `${item.name} *`
                        }
                      />
                    </Tooltip>
                  ))}
                </div>
              </div>
            ))}

            <Typography variant="caption" color="textSecondary">
              {i18n.t("metaWebhook.fields.legend")}
            </Typography>
          </Paper>
        </motion.div>

        {/* Passo a passo de configuração no app Meta */}
        <motion.div variants={itemVariant}>
          <Paper className={`${classes.paper} bento-panel`} variant="outlined">
            <div className={classes.sectionTitle}>
              <LinkIcon size={18} />
              {i18n.t("metaWebhook.sections.steps")}
            </div>
            <ol className={classes.stepList}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <li key={n}>
                  <Typography variant="body2">
                    {i18n.t(`metaWebhook.steps.${n}`)}
                  </Typography>
                </li>
              ))}
            </ol>
          </Paper>
        </motion.div>
      </motion.div>
    </MainContainer>
  );
};

export default MetaWebhook;
