import { Request, Response } from "express";
import * as Sentry from "@sentry/node";
import logger from "../utils/logger";
import Whatsapp from "../models/Whatsapp";
import {
  checkOfficialWebhookSignature
} from "../services/WebhookService/CheckMetaWebhookSignature";
import { enqueueOfficialWebhookChange } from "../queues/OfficialWebhookQueue";

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
export const verifyWebhook = async (req: Request, res: Response): Promise<Response> => {
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

    // Verificar token: aceita o token global (comportamento atual, preservado)
    // ou o token configurado por conexão WABA (campo já existia, sem uso até aqui).
    const globalToken = process.env.WABA_WEBHOOK_VERIFY_TOKEN;
    const isGlobalTokenValid = !!globalToken && token === globalToken;

    const isPerConnectionTokenValid =
      typeof token === "string" && token.length > 0 &&
      !!(await Whatsapp.findOne({
        where: { wabaWebhookVerifyToken: token }
      }));

    if (!isGlobalTokenValid && !isPerConnectionTokenValid) {
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
    if (!body || body.object !== "whatsapp_business_account" || !Array.isArray(body.entry)) {
      return res.status(400).send("Bad Request");
    }

    const changes = body.entry.flatMap((entry: any) =>
      Array.isArray(entry.changes) ? entry.changes : []
    );
    if (changes.length > 100) {
      return res.status(400).send("Bad Request");
    }

    // Meta entrega outros fields no mesmo webhook (account_update,
    // message_template_status_update...) — eles não têm metadata.phone_number_id.
    // Rejeitar com 400 faria a Meta retentar para sempre: ack e ignora.
    const messageChanges = changes.filter((c: any) => c?.field === "messages");
    const ignored = changes.length - messageChanges.length;
    if (ignored > 0) {
      logger.info(`[Webhook] ${ignored} change(s) de outros fields ignorados`);
    }
    if (!messageChanges.length) {
      return res.status(200).send("OK");
    }

    const phoneNumberIds = messageChanges.map((change: any) => change?.value?.metadata?.phone_number_id);
    if (phoneNumberIds.some((id: any) => typeof id !== "string" || !id)) {
      return res.status(400).send("Bad Request");
    }

    const signatureHeader = req.headers["x-hub-signature-256"] as string | undefined;
    const valid = await checkOfficialWebhookSignature(req.rawBody, signatureHeader, phoneNumberIds);
    if (!valid) {
      logger.warn("[Webhook] Assinatura oficial inválida para o número indicado");
      return res.status(403).send("Forbidden");
    }

    // Acknowledgement only after Redis has accepted every event. Bull retries
    // worker failures; Meta retries this request when Redis is unavailable.
    for (const change of messageChanges) {
      await enqueueOfficialWebhookChange(change, change.value.metadata.phone_number_id);
    }
    return res.status(200).send("OK");
    
  } catch (error: any) {
    Sentry.captureException(error);
    logger.error(`[Webhook] Erro ao processar webhook: ${error.message}`);
    
    return res.status(503).send("Service Unavailable");
  }
};
