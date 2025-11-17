import React, { useState } from "react";
import { Field } from "formik";
import {
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Divider,
  Grid,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Link
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { Info, CheckCircle, FileCopy, Launch, Help } from "@material-ui/icons";

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
    backgroundColor: theme.palette.mode === "dark" ? "#1e3a5f" : "#e3f2fd",
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1)
  },
  successBox: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.mode === "dark" ? "#1b5e20" : "#e8f5e9",
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
    display: "flex",
    alignItems: "center",
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
    backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
    borderRadius: theme.shape.borderRadius,
    border: "1px solid",
    borderColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
  },
  webhookUrl: {
    flex: 1,
    fontFamily: "monospace",
    fontSize: "0.9rem",
    wordBreak: "break-all"
  },
  stepBox: {
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
    borderLeft: "4px solid",
    borderLeftColor: theme.palette.primary.main,
    borderRadius: theme.shape.borderRadius
  },
  helpButton: {
    marginLeft: theme.spacing(1)
  }
}));

const OfficialAPIFields = ({ values, errors, touched }) => {
  const classes = useStyles();
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Usar URL do backend (API) em vez do frontend
  const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin;
  const webhookUrl = `${backendUrl}/webhooks/whatsapp`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleCopyToken = () => {
    if (values.wabaWebhookVerifyToken) {
      navigator.clipboard.writeText(values.wabaWebhookVerifyToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <>
      <Box className={classes.infoBox}>
        <Info color="primary" />
        <Box flex={1}>
          <Typography variant="body2">
            <strong>WhatsApp Business API Oficial (Meta):</strong> Configure as credenciais obtidas no Meta Business Manager. 
            As primeiras 1.000 conversas/mês são gratuitas.
          </Typography>
          <Box mt={1} display="flex" gap={1} flexWrap="wrap">
            <Button
              size="small"
              variant="outlined"
              color="primary"
              startIcon={<Launch />}
              href="https://business.facebook.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Criar Conta Meta
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Help />}
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
              target="_blank"
              rel="noopener noreferrer"
            >
              Tutorial Oficial
            </Button>
          </Box>
        </Box>
      </Box>

      <Divider className={classes.divider} />

      <Typography variant="h6" className={classes.sectionTitle}>
        Credenciais da API Oficial
        <Chip label="Meta" size="small" color="primary" className={classes.chip} />
      </Typography>

      {/* Phone Number ID */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Field
            as={TextField}
            label="Phone Number ID"
            name="wabaPhoneNumberId"
            error={touched.wabaPhoneNumberId && Boolean(errors.wabaPhoneNumberId)}
            helperText={
              touched.wabaPhoneNumberId && errors.wabaPhoneNumberId
                ? errors.wabaPhoneNumberId
                : "ID do número obtido no WhatsApp Business Manager"
            }
            variant="outlined"
            margin="dense"
            fullWidth
            placeholder="1234567890"
          />
        </Grid>

        {/* Business Account ID */}
        <Grid item xs={12} md={6}>
          <Field
            as={TextField}
            label="Business Account ID"
            name="wabaBusinessAccountId"
            error={touched.wabaBusinessAccountId && Boolean(errors.wabaBusinessAccountId)}
            helperText={
              touched.wabaBusinessAccountId && errors.wabaBusinessAccountId
                ? errors.wabaBusinessAccountId
                : "ID da conta Business no Meta"
            }
            variant="outlined"
            margin="dense"
            fullWidth
            placeholder="9876543210"
          />
        </Grid>

        {/* Access Token */}
        <Grid item xs={12}>
          <Field
            as={TextField}
            label="Access Token"
            name="wabaAccessToken"
            type="password"
            error={touched.wabaAccessToken && Boolean(errors.wabaAccessToken)}
            helperText={
              touched.wabaAccessToken && errors.wabaAccessToken
                ? errors.wabaAccessToken
                : "Token de acesso à Graph API (válido por 60 dias)"
            }
            variant="outlined"
            margin="dense"
            fullWidth
            placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxx"
          />
        </Grid>

        {/* Webhook Verify Token */}
        <Grid item xs={12}>
          <Field
            as={TextField}
            label="Webhook Verify Token"
            name="wabaWebhookVerifyToken"
            error={touched.wabaWebhookVerifyToken && Boolean(errors.wabaWebhookVerifyToken)}
            helperText={
              touched.wabaWebhookVerifyToken && errors.wabaWebhookVerifyToken
                ? errors.wabaWebhookVerifyToken
                : "Token personalizado para validação do webhook (criar valor único)"
            }
            variant="outlined"
            margin="dense"
            fullWidth
            placeholder="meu_token_secreto_123"
          />
        </Grid>
      </Grid>

      <Divider className={classes.divider} />

      {/* Informações de Configuração do Webhook */}
      <Typography variant="h6" className={classes.sectionTitle}>
        Configuração do Webhook (Meta Business)
      </Typography>

      {/* Callback URL com botão de copiar */}
      <Box mb={2}>
        <Typography variant="body2" gutterBottom>
          <strong>1. Callback URL</strong>
        </Typography>
        <Box className={classes.webhookUrlBox}>
          <Typography className={classes.webhookUrl}>
            {webhookUrl}
          </Typography>
          <Tooltip title={copiedWebhook ? "Copiado!" : "Copiar URL"}>
            <IconButton size="small" onClick={handleCopyWebhook} color={copiedWebhook ? "primary" : "default"}>
              <FileCopy fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="caption" color="textSecondary">
          Esta URL será usada no Meta Business Manager para receber eventos
        </Typography>
      </Box>

      {/* Verify Token */}
      <Box mb={2}>
        <Typography variant="body2" gutterBottom>
          <strong>2. Verify Token</strong>
        </Typography>
        <Box className={classes.webhookUrlBox}>
          <Typography className={classes.webhookUrl}>
            {values.wabaWebhookVerifyToken || "(preencha o campo acima)"}
          </Typography>
          {values.wabaWebhookVerifyToken && (
            <Tooltip title={copiedToken ? "Copiado!" : "Copiar Token"}>
              <IconButton size="small" onClick={handleCopyToken} color={copiedToken ? "primary" : "default"}>
                <FileCopy fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        <Typography variant="caption" color="textSecondary">
          Use o mesmo token preenchido no campo "Webhook Verify Token" acima
        </Typography>
      </Box>

      {/* Passo a passo */}
      <Box className={classes.successBox}>
        <CheckCircle style={{ color: "#4caf50" }} />
        <Box flex={1}>
          <Typography variant="body2" gutterBottom>
            <strong>Passos para configurar no Meta Business:</strong>
          </Typography>
          <Box className={classes.stepBox}>
            <Typography variant="caption">
              <strong>1.</strong> Acesse <Link href="https://business.facebook.com/" target="_blank">Meta Business Manager</Link>
            </Typography>
          </Box>
          <Box className={classes.stepBox}>
            <Typography variant="caption">
              <strong>2.</strong> WhatsApp → Configuration → Webhooks
            </Typography>
          </Box>
          <Box className={classes.stepBox}>
            <Typography variant="caption">
              <strong>3.</strong> Cole a <strong>Callback URL</strong> e o <strong>Verify Token</strong>
            </Typography>
          </Box>
          <Box className={classes.stepBox}>
            <Typography variant="caption">
              <strong>4.</strong> Subscribe aos eventos: <strong>messages</strong> e <strong>message_status</strong>
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider className={classes.divider} />

      {/* Informações Adicionais */}
      <Typography variant="caption" color="textSecondary" style={{ display: "block", marginTop: 16 }}>
        <strong>Nota:</strong> Após salvar, a conexão será testada automaticamente. 
        Certifique-se de que as credenciais estão corretas e que o webhook está configurado no Meta Business Manager.
      </Typography>

      <Typography variant="caption" color="textSecondary" style={{ display: "block", marginTop: 8 }}>
        <strong>Custos:</strong> Primeiras 1.000 conversas/mês grátis. 
        Depois: R$ 0,17 (serviço) ou R$ 0,34 (marketing) por conversa.
      </Typography>
    </>
  );
};

export default OfficialAPIFields;
