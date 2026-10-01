import React, { useState } from "react";
import { Field } from "formik";
import {
  TextField,
  Typography,
  Box,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Button,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Alert } from "@material-ui/lab";
import {
  Info,
  FileCopy,
  Facebook,
  Instagram,
  VpnKey,
  Security,
  ExpandMore,
  CloudDone
} from "@material-ui/icons";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  sectionTitle: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1)
  },
  oauthCard: {
    padding: theme.spacing(3),
    borderRadius: theme.shape.borderRadius * 2,
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(0,0,0,0.02)",
    border: "1px solid",
    borderColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.1)"
        : "rgba(0,0,0,0.08)",
    textAlign: "center",
    marginBottom: theme.spacing(2)
  },
  oauthButton: {
    padding: theme.spacing(1.5, 4),
    fontSize: "1rem",
    fontWeight: 600,
    textTransform: "none",
    borderRadius: theme.shape.borderRadius * 2
  },
  envBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(1),
    color: theme.palette.success.main,
    fontSize: "0.8rem"
  },
  divider: {
    margin: theme.spacing(2, 0)
  },
  chip: {
    marginLeft: theme.spacing(1)
  },
  webhookUrlBox: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    backgroundColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.05)"
        : "rgba(0,0,0,0.03)",
    borderRadius: theme.shape.borderRadius,
    border: "1px solid",
    borderColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.1)"
        : "rgba(0,0,0,0.1)"
  },
  webhookUrl: {
    flex: 1,
    fontFamily: "monospace",
    fontSize: "0.85rem",
    wordBreak: "break-all"
  },
  helpButton: {
    marginLeft: theme.spacing(1)
  },
  envFallback: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    fontStyle: "italic"
  },
  accordion: {
    boxShadow: "none",
    border: "1px solid",
    borderColor:
      theme.palette.type === "dark"
        ? "rgba(255,255,255,0.1)"
        : "rgba(0,0,0,0.08)",
    borderRadius: theme.shape.borderRadius + "px !important",
    "&:before": { display: "none" }
  }
}));

const MetaAPIFields = ({ values, errors, touched, channelType, whatsAppId }) => {
  const classes = useStyles();
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const backendUrl =
    process.env.REACT_APP_BACKEND_URL || window.location.origin;
  // endpoint único: /webhook atende page (facebook) e instagram
  const webhookUrl = `${backendUrl}/webhook`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleCopyToken = () => {
    if (values.metaWebhookVerifyToken) {
      navigator.clipboard.writeText(values.metaWebhookVerifyToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const isInstagram = channelType === "instagram";
  const ChannelIcon = isInstagram ? Instagram : Facebook;
  const channelColor = isInstagram ? "#e1306c" : "#3b5998";
  const channelName = isInstagram ? "Instagram" : "Facebook";
  const hasCustomCreds = Boolean(values.metaAppId && values.metaAppSecret);

  // OAuth Meta: redireciona para autorização e o usuário escolhe quais
  // páginas/contas conectar na tela seguinte (webhook assinado automaticamente).
  // Credenciais: campos do form > credenciais da conexão salva > env do servidor.
  const handleConnectViaMeta = async () => {
    setOauthLoading(true);
    try {
      const { data } = await api.post("/meta-oauth/start", {
        channel: channelType,
        whatsappId: whatsAppId || undefined,
        metaAppId: values.metaAppId || undefined,
        metaAppSecret: values.metaAppSecret || undefined
      });
      window.location.href = data.url;
    } catch (err) {
      setOauthLoading(false);
      toastError(err);
    }
  };

  return (
    <>
      <Typography variant="h6" className={classes.sectionTitle}>
        <ChannelIcon style={{ color: channelColor }} />
        Configuração do {channelName}
        <Chip
          label="Meta API"
          size="small"
          style={{ backgroundColor: channelColor, color: "#fff" }}
          className={classes.chip}
        />
      </Typography>

      {/* Fluxo principal: OAuth automático com credenciais do servidor */}
      <Box className={classes.oauthCard}>
        <Button
          variant="contained"
          className={classes.oauthButton}
          startIcon={
            oauthLoading ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              <ChannelIcon />
            )
          }
          onClick={handleConnectViaMeta}
          disabled={oauthLoading}
          style={{ backgroundColor: channelColor, color: "#fff" }}
        >
          {oauthLoading
            ? "Redirecionando…"
            : `Conectar ${channelName} automaticamente`}
        </Button>

        <Typography
          variant="body2"
          color="textSecondary"
          style={{ marginTop: 12 }}
        >
          Abre o login oficial da Meta. Depois de autorizar, você escolhe quais
          páginas{isInstagram ? " e contas do Instagram" : ""} conectar — o
          webhook é configurado automaticamente.
        </Typography>

        <Box className={classes.envBadge}>
          <CloudDone fontSize="small" />
          {hasCustomCreds
            ? "Usando credenciais do app informadas abaixo"
            : "Usando o app Meta configurado no servidor"}
        </Box>
      </Box>

      {/* Configuração avançada — opcional (app próprio ou cadastro manual) */}
      <Accordion className={classes.accordion}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">
            Configuração avançada (opcional)
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box width="100%">
            <Alert severity="info" style={{ marginBottom: 16 }}>
              Use estes campos apenas se esta conexão tiver um{" "}
              <strong>app Meta próprio</strong> ou se você quiser cadastrar os
              dados manualmente. Em branco, o sistema usa as variáveis de
              ambiente do servidor.
            </Alert>

            {/* App ID + App Secret */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label="Meta App ID"
                  name="metaAppId"
                  error={touched.metaAppId && Boolean(errors.metaAppId)}
                  helperText={
                    touched.metaAppId && errors.metaAppId ? (
                      errors.metaAppId
                    ) : (
                      <span className={classes.envFallback}>
                        Fallback: META_APP_ID
                      </span>
                    )
                  }
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  placeholder="123456789012345"
                  InputProps={{
                    startAdornment: (
                      <VpnKey
                        style={{ marginRight: 8, color: "#999" }}
                        fontSize="small"
                      />
                    )
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label="Meta App Secret"
                  name="metaAppSecret"
                  type="password"
                  error={
                    touched.metaAppSecret && Boolean(errors.metaAppSecret)
                  }
                  helperText={
                    touched.metaAppSecret && errors.metaAppSecret ? (
                      errors.metaAppSecret
                    ) : (
                      <span className={classes.envFallback}>
                        Fallback: META_APP_SECRET
                      </span>
                    )
                  }
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  placeholder="abc123def456..."
                  InputProps={{
                    startAdornment: (
                      <Security
                        style={{ marginRight: 8, color: "#999" }}
                        fontSize="small"
                      />
                    )
                  }}
                />
              </Grid>
            </Grid>

            {/* Page ID + Page Access Token */}
            <Grid container spacing={2} style={{ marginTop: 8 }}>
              <Grid item xs={12} md={4}>
                <Field
                  as={TextField}
                  label={
                    isInstagram ? "Instagram Account ID" : "Facebook Page ID"
                  }
                  name={isInstagram ? "instagramAccountId" : "metaPageId"}
                  error={
                    isInstagram
                      ? touched.instagramAccountId &&
                        Boolean(errors.instagramAccountId)
                      : touched.metaPageId && Boolean(errors.metaPageId)
                  }
                  helperText={
                    isInstagram
                      ? "ID da conta do Instagram Business"
                      : "ID da Página do Facebook"
                  }
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  placeholder="17841400000000000"
                />
              </Grid>

              <Grid item xs={12} md={8}>
                <Field
                  as={TextField}
                  label="Page Access Token"
                  name="metaPageAccessToken"
                  type="password"
                  error={
                    touched.metaPageAccessToken &&
                    Boolean(errors.metaPageAccessToken)
                  }
                  helperText="Token de acesso da página (obtido no Meta Business Suite)"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </Grid>
            </Grid>

            {/* Webhook Verify Token + User Token */}
            <Grid container spacing={2} style={{ marginTop: 8 }}>
              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label="Webhook Verify Token"
                  name="metaWebhookVerifyToken"
                  error={
                    touched.metaWebhookVerifyToken &&
                    Boolean(errors.metaWebhookVerifyToken)
                  }
                  helperText={
                    touched.metaWebhookVerifyToken &&
                    errors.metaWebhookVerifyToken ? (
                      errors.metaWebhookVerifyToken
                    ) : (
                      <span className={classes.envFallback}>
                        Fallback: VERIFY_TOKEN
                      </span>
                    )
                  }
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  placeholder="meu_token_secreto_123"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <Field
                  as={TextField}
                  label="User Access Token (opcional)"
                  name="metaAccessToken"
                  type="password"
                  error={
                    touched.metaAccessToken && Boolean(errors.metaAccessToken)
                  }
                  helperText="Token do usuário para gerenciamento (opcional)"
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </Grid>
            </Grid>

            <Divider className={classes.divider} />

            {/* Referência de webhook para cadastro manual */}
            <Typography variant="subtitle2" gutterBottom>
              Configuração do Webhook (Meta for Developers)
              <Tooltip title="Configure estes valores no Meta for Developers → Seu App → Webhooks">
                <IconButton size="small" className={classes.helpButton}>
                  <Info fontSize="small" color="primary" />
                </IconButton>
              </Tooltip>
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box mb={1}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Callback URL</strong>
                  </Typography>
                  <Box className={classes.webhookUrlBox}>
                    <Typography className={classes.webhookUrl}>
                      {webhookUrl}
                    </Typography>
                    <Tooltip
                      title={copiedWebhook ? "Copiado!" : "Copiar URL"}
                    >
                      <IconButton
                        size="small"
                        onClick={handleCopyWebhook}
                        color={copiedWebhook ? "primary" : "default"}
                      >
                        <FileCopy fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box mb={1}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Verify Token</strong>
                  </Typography>
                  <Box className={classes.webhookUrlBox}>
                    <Typography className={classes.webhookUrl}>
                      {values.metaWebhookVerifyToken ||
                        "(usa VERIFY_TOKEN do servidor)"}
                    </Typography>
                    {values.metaWebhookVerifyToken && (
                      <Tooltip
                        title={copiedToken ? "Copiado!" : "Copiar Token"}
                      >
                        <IconButton
                          size="small"
                          onClick={handleCopyToken}
                          color={copiedToken ? "primary" : "default"}
                        >
                          <FileCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              </Grid>
            </Grid>

            <Alert severity="warning" style={{ marginTop: 8 }}>
              <strong>Campos de assinatura no painel Meta:</strong>
              <br />
              {isInstagram ? (
                <>
                  messages, messaging_postbacks, comments, messaging_seen,
                  mentions
                </>
              ) : (
                <>
                  messages, messaging_postbacks, feed, message_deliveries,
                  message_reads, messaging_referrals, leadgen
                </>
              )}
            </Alert>
          </Box>
        </AccordionDetails>
      </Accordion>
    </>
  );
};

export default MetaAPIFields;
