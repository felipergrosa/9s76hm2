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
  Divider
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Alert } from "@material-ui/lab";
import { 
  Info, 
  FileCopy,
  Facebook,
  Instagram,
  VpnKey,
  Security
} from "@material-ui/icons";

const useStyles = makeStyles((theme) => ({
  sectionTitle: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1)
  },
  infoBox: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.type === "dark" ? "#1e3a5f" : "#e3f2fd",
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1)
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
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
    backgroundColor: theme.palette.type === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
    borderRadius: theme.shape.borderRadius,
    border: "1px solid",
    borderColor: theme.palette.type === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
  },
  webhookUrl: {
    flex: 1,
    fontFamily: "monospace",
    fontSize: "0.9rem",
    wordBreak: "break-all"
  },
  helpButton: {
    marginLeft: theme.spacing(1)
  },
  envFallback: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    fontStyle: "italic"
  }
}));

const MetaAPIFields = ({ values, errors, touched, channelType }) => {
  const classes = useStyles();
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
  const webhookUrl = channelType === "instagram" 
    ? `${backendUrl}/webhook/instagram`
    : `${backendUrl}/webhook/facebook`;

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

  return (
    <>
      <Typography variant="h6" className={classes.sectionTitle}>
        <ChannelIcon style={{ color: channelColor }} />
        Configuração do {channelName}
        <Chip label="Meta API" size="small" style={{ backgroundColor: channelColor, color: "#fff" }} className={classes.chip} />
      </Typography>

      <Alert severity="info" style={{ marginBottom: 16 }}>
        <strong>Múltiplas Contas:</strong> Cada conexão pode ter suas próprias credenciais. 
        Se deixar em branco, o sistema usará as variáveis de ambiente (.env) como fallback.
      </Alert>

      {/* Linha 1: App ID + App Secret */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Field
            as={TextField}
            label="Meta App ID"
            name="metaAppId"
            error={touched.metaAppId && Boolean(errors.metaAppId)}
            helperText={
              touched.metaAppId && errors.metaAppId
                ? errors.metaAppId
                : <span className={classes.envFallback}>Fallback: REACT_APP_FACEBOOK_APP_ID</span>
            }
            variant="outlined"
            margin="dense"
            fullWidth
            placeholder="123456789012345"
            InputProps={{
              startAdornment: <VpnKey style={{ marginRight: 8, color: "#999" }} fontSize="small" />
            }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <Field
            as={TextField}
            label="Meta App Secret"
            name="metaAppSecret"
            type="password"
            error={touched.metaAppSecret && Boolean(errors.metaAppSecret)}
            helperText={
              touched.metaAppSecret && errors.metaAppSecret
                ? errors.metaAppSecret
                : <span className={classes.envFallback}>Fallback: FACEBOOK_APP_SECRET</span>
            }
            variant="outlined"
            margin="dense"
            fullWidth
            placeholder="abc123def456..."
            InputProps={{
              startAdornment: <Security style={{ marginRight: 8, color: "#999" }} fontSize="small" />
            }}
          />
        </Grid>
      </Grid>

      {/* Linha 2: Page ID + Page Access Token */}
      <Grid container spacing={2} style={{ marginTop: 8 }}>
        <Grid item xs={12} md={4}>
          <Field
            as={TextField}
            label={isInstagram ? "Instagram Account ID" : "Facebook Page ID"}
            name={isInstagram ? "instagramAccountId" : "metaPageId"}
            error={
              isInstagram 
                ? touched.instagramAccountId && Boolean(errors.instagramAccountId)
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
            error={touched.metaPageAccessToken && Boolean(errors.metaPageAccessToken)}
            helperText="Token de acesso da página (obtido no Meta Business Suite)"
            variant="outlined"
            margin="dense"
            fullWidth
            placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxx"
          />
        </Grid>
      </Grid>

      {/* Linha 3: Webhook Verify Token */}
      <Grid container spacing={2} style={{ marginTop: 8 }}>
        <Grid item xs={12} md={6}>
          <Field
            as={TextField}
            label="Webhook Verify Token"
            name="metaWebhookVerifyToken"
            error={touched.metaWebhookVerifyToken && Boolean(errors.metaWebhookVerifyToken)}
            helperText={
              touched.metaWebhookVerifyToken && errors.metaWebhookVerifyToken
                ? errors.metaWebhookVerifyToken
                : <span className={classes.envFallback}>Fallback: VERIFY_TOKEN</span>
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
            error={touched.metaAccessToken && Boolean(errors.metaAccessToken)}
            helperText="Token do usuário para gerenciamento (opcional)"
            variant="outlined"
            margin="dense"
            fullWidth
            placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxx"
          />
        </Grid>
      </Grid>

      <Divider className={classes.divider} />

      {/* Informações de Configuração do Webhook */}
      <Typography variant="h6" className={classes.sectionTitle}>
        Configuração do Webhook (Meta Business)
        <Tooltip
          title="Configure estes valores no Meta for Developers → Seu App → Webhooks"
        >
          <IconButton size="small" className={classes.helpButton}>
            <Info fontSize="small" color="primary" />
          </IconButton>
        </Tooltip>
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Box mb={2}>
            <Typography variant="body2" gutterBottom>
              <strong>1. Callback URL</strong>
            </Typography>
            <Box className={classes.webhookUrlBox}>
              <Typography className={classes.webhookUrl}>
                {webhookUrl}
              </Typography>
              <Tooltip title={copiedWebhook ? "Copiado!" : "Copiar URL"}>
                <IconButton
                  size="small"
                  onClick={handleCopyWebhook}
                  color={copiedWebhook ? "primary" : "default"}
                >
                  <FileCopy fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography variant="caption" color="textSecondary">
              Use esta URL no Meta for Developers → Webhooks
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box mb={2}>
            <Typography variant="body2" gutterBottom>
              <strong>2. Verify Token</strong>
            </Typography>
            <Box className={classes.webhookUrlBox}>
              <Typography className={classes.webhookUrl}>
                {values.metaWebhookVerifyToken || "(preencha o campo acima)"}
              </Typography>
              {values.metaWebhookVerifyToken && (
                <Tooltip title={copiedToken ? "Copiado!" : "Copiar Token"}>
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
            <Typography variant="caption" color="textSecondary">
              Use o mesmo token no Meta for Developers
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Campos de assinatura necessários */}
      <Alert severity="warning" style={{ marginTop: 8 }}>
        <strong>Campos de Assinatura (Webhooks):</strong>
        <br />
        {isInstagram ? (
          <>• messages, messaging_postbacks, messaging_optins</>
        ) : (
          <>• messages, messaging_postbacks, message_deliveries, messaging_optins</>
        )}
      </Alert>
    </>
  );
};

export default MetaAPIFields;
