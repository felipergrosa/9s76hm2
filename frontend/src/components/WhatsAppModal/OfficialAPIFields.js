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
import { 
  Info, 
  FileCopy
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

      <Typography variant="h6" className={classes.sectionTitle}>
        Credenciais da API Oficial
        <Chip label="Meta" size="small" color="primary" className={classes.chip} />
      </Typography>

      {/* Linha 1: Phone Number ID + Webhook Verify Token + PIN 2FA */}
      <Grid container spacing={2}>
        {/* Phone Number ID */}
        <Grid item xs={12} md={4}>
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

        {/* Webhook Verify Token */}
        <Grid item xs={12} md={4}>
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

        {/* PIN 2FA - Two Factor Authentication */}
        <Grid item xs={12} md={4}>
          <Field
            as={TextField}
            label="PIN 2FA (Verificação de Dois Passos)"
            name="wabaTwoFactorPin"
            type="password"
            error={touched.wabaTwoFactorPin && Boolean(errors.wabaTwoFactorPin)}
            helperText={
              touched.wabaTwoFactorPin && errors.wabaTwoFactorPin
                ? errors.wabaTwoFactorPin
                : "PIN de 6 dígitos configurado no Gestor do WhatsApp (obrigatório para produção)"
            }
            variant="outlined"
            margin="dense"
            fullWidth
            placeholder="130420"
            inputProps={{ maxLength: 6, pattern: "[0-9]*" }}
          />
        </Grid>

        {/* Linha 2: Business Account ID + Access Token */}
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
        <Grid item xs={12} md={6}>
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
      </Grid>

      <Divider className={classes.divider} />

      {/* Informações de Configuração do Webhook */}
      <Typography variant="h6" className={classes.sectionTitle}>
        Configuração do Webhook (Meta Business)
        <Tooltip
          title="Dica: Se você tem dúvidas sobre como obter essas credenciais, consulte a aba '📚 Tutorial API Oficial' acima para um guia completo passo a passo."
        >
          <IconButton size="small" className={classes.helpButton}>
            <Info fontSize="small" color="primary" />
          </IconButton>
        </Tooltip>
      </Typography>

      {/* Callback URL e Verify Token lado a lado */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
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
              Esta URL será usada no Meta Business Manager para receber eventos
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
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
              Use o mesmo token preenchido no campo "Webhook Verify Token" acima
            </Typography>
          </Box>
        </Grid>
      </Grid>

      <Divider className={classes.divider} />

      {/* Renovação Automática de Janela 24h */}
      <Typography variant="h6" className={classes.sectionTitle}>
        Renovação Automática de Janela 24h
        <Tooltip
          title="Quando a janela de 24h está prestes a expirar, o sistema envia automaticamente uma mensagem para o contato. Se ele responder, uma nova janela de 24h é aberta. Isso ajuda a manter conversas ativas sem custos de template."
        >
          <IconButton size="small" className={classes.helpButton}>
            <Info fontSize="small" color="primary" />
          </IconButton>
        </Tooltip>
      </Typography>

      <Grid container spacing={2}>
        {/* Mensagem de Renovação */}
        <Grid item xs={12}>
          <Field
            as={TextField}
            label="Mensagem para Renovar Janela 24h"
            name="sessionWindowRenewalMessage"
            error={touched.sessionWindowRenewalMessage && Boolean(errors.sessionWindowRenewalMessage)}
            helperText={
              touched.sessionWindowRenewalMessage && errors.sessionWindowRenewalMessage
                ? errors.sessionWindowRenewalMessage
                : "Mensagem enviada automaticamente quando a janela está prestes a expirar. Deixe vazio para desativar."
            }
            variant="outlined"
            margin="dense"
            fullWidth
            multiline
            rows={3}
            placeholder="Ex: Olá! Ainda estamos aqui. Posso ajudar com algo mais?"
          />
        </Grid>

        {/* Minutos antes de expirar */}
        <Grid item xs={12} md={6}>
          <Field
            as={TextField}
            label="Minutos antes de expirar"
            name="sessionWindowRenewalMinutes"
            type="number"
            error={touched.sessionWindowRenewalMinutes && Boolean(errors.sessionWindowRenewalMinutes)}
            helperText={
              touched.sessionWindowRenewalMinutes && errors.sessionWindowRenewalMinutes
                ? errors.sessionWindowRenewalMinutes
                : "Quantos minutos antes de expirar a mensagem será enviada (padrão: 60)"
            }
            variant="outlined"
            margin="dense"
            fullWidth
            placeholder="60"
            inputProps={{ min: 1, max: 1440 }}
          />
        </Grid>
      </Grid>

      {/* Dica agora exibida no tooltip do ícone (i) ao lado do título */}
    </>
  );
};

export default OfficialAPIFields;
