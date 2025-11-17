import { Request, Response } from "express";
import * as Sentry from "@sentry/node";
import logger from "../utils/logger";
import ProcessWhatsAppWebhook from "../services/WbotServices/ProcessWhatsAppWebhook";

/**
 * Controller para receber webhooks da WhatsApp Business API Oficial
 * 
 * Endpoints:
 * GET  /webhooks/whatsapp - Verificação do webhook (Meta)
 * POST /webhooks/whatsapp - Receber eventos
 */

/**
 * Verificação do webhook pela Meta
 * A Meta envia um GET request para verificar se o endpoint é válido
 */
export const verifyWebhook = (req: Request, res: Response): Response => {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    logger.info(`[Webhook] Verificação recebida: mode=${mode}, token=${token?.toString().substring(0, 10)}...`);

    // Verificar se é modo subscribe
    if (mode !== "subscribe") {
      logger.warn(`[Webhook] Modo inválido: ${mode}`);
      return res.status(403).send("Forbidden");
    }

    // Verificar token
    const expectedToken = process.env.WABA_WEBHOOK_VERIFY_TOKEN || "meu_token_secreto";
    if (token !== expectedToken) {
      logger.warn(`[Webhook] Token inválido recebido`);
      return res.status(403).send("Forbidden");
    }

    // Retornar challenge
    logger.info(`[Webhook] Verificação bem-sucedida, retornando challenge`);
    return res.status(200).send(challenge);
    
  } catch (error: any) {
    Sentry.captureException(error);
    logger.error(`[Webhook] Erro na verificação: ${error.message}`);
    return res.status(500).send("Internal Server Error");
  }
};

/**
 * Processar eventos do webhook
 * A Meta envia eventos de mensagens, status, etc.
 */
export const processWebhook = async (req: Request, res: Response): Promise<Response> => {
  try {
    const body = req.body;

    logger.debug(`[Webhook] Evento recebido: ${JSON.stringify(body).substring(0, 200)}...`);

    // Validar payload básico
    if (!body.object) {
      logger.warn(`[Webhook] Payload inválido: sem campo 'object'`);
      return res.status(400).send("Bad Request");
    }

    // Verificar se é evento do WhatsApp Business
    if (body.object !== "whatsapp_business_account") {
      logger.debug(`[Webhook] Ignorando evento de tipo: ${body.object}`);
      return res.status(200).send("OK");
    }

    // Responder imediatamente (Meta espera resposta em 20 segundos)
    res.status(200).send("OK");

    // Processar eventos de forma assíncrona
    if (body.entry && Array.isArray(body.entry)) {
      for (const entry of body.entry) {
        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            // Processar cada mudança
            try {
              await ProcessWhatsAppWebhook(change);
            } catch (error: any) {
              // Não lançar erro para não afetar outros eventos
              Sentry.captureException(error);
              logger.error(`[Webhook] Erro ao processar change: ${error.message}`);
            }
          }
        }
      }
    }

    return res;
    
  } catch (error: any) {
    Sentry.captureException(error);
    logger.error(`[Webhook] Erro ao processar webhook: ${error.message}`);
    
    // Mesmo em caso de erro, retornar 200 para Meta não reenviar
    return res.status(200).send("OK");
  }
};
