import express from "express";
import * as WhatsAppWebhookController from "../controllers/WhatsAppWebhookController";

const whatsappWebhookRoutes = express.Router();

/**
 * Rotas para Webhooks do WhatsApp Business API Oficial
 * 
 * GET  /webhooks/whatsapp - Verificação do webhook (Meta)
 * POST /webhooks/whatsapp - Receber eventos
 */

// Verificação do webhook (Meta envia GET para validar)
whatsappWebhookRoutes.get(
  "/webhooks/whatsapp",
  WhatsAppWebhookController.verifyWebhook
);

// Receber eventos do webhook
whatsappWebhookRoutes.post(
  "/webhooks/whatsapp",
  WhatsAppWebhookController.processWebhook
);

export default whatsappWebhookRoutes;
