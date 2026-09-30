import { Request, Response } from "express";
import * as Sentry from "@sentry/node";
import logger from "../utils/logger";
import Whatsapp from "../models/Whatsapp";
import WhatsappTemplate from "../models/WhatsappTemplate";
import { getIO } from "../libs/socket";
import {
  checkMetaWebhookSignature,
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

    // Preserva a associação entry -> change: eventos de
    // message_template_status_update não trazem metadata.phone_number_id
    // e a conexão se resolve via entry.id (WABA ID).
    const entries = Array.isArray(body.entry) ? body.entry : [];
    const changes = entries.flatMap((entry: any) =>
      (Array.isArray(entry.changes) ? entry.changes : []).map((change: any) => ({
        entryId: entry.id,
        change
      }))
    );
    if (changes.length > 100) {
      return res.status(400).send("Bad Request");
    }

    // Meta entrega outros fields no mesmo webhook (account_update...) —
    // eles não têm tratamento aqui. Rejeitar com 400 faria a Meta
    // retentar para sempre: ack e ignora.
    const messageChanges = changes
      .filter((c: any) => c?.change?.field === "messages")
      .map((c: any) => c.change);
    const templateStatusChanges = changes.filter(
      (c: any) => c?.change?.field === "message_template_status_update"
    );
    const ignored = changes.length - messageChanges.length - templateStatusChanges.length;
    if (ignored > 0) {
      logger.info(`[Webhook] ${ignored} change(s) de outros fields ignorados`);
    }
    if (!messageChanges.length && !templateStatusChanges.length) {
      return res.status(200).send("OK");
    }

    const signatureHeader = req.headers["x-hub-signature-256"] as string | undefined;

    if (messageChanges.length) {
      const phoneNumberIds = messageChanges.map((change: any) => change?.value?.metadata?.phone_number_id);
      if (phoneNumberIds.some((id: any) => typeof id !== "string" || !id)) {
        return res.status(400).send("Bad Request");
      }

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
    } else {
      // Evento de template não tem phone_number_id: valida o HMAC contra
      // o META_APP_SECRET global ou metaAppSecret de qualquer conexão.
      // Mesma verificação dos eventos "messages" — fail-closed (sem bypass).
      const valid = await checkMetaWebhookSignature(req.rawBody, signatureHeader, "whatsapp-templates");
      if (!valid) {
        logger.warn("[Webhook] Assinatura inválida em evento de status de template");
        return res.status(403).send("Forbidden");
      }
    }

    // message_template_status_update: sincroniza status local do template
    // e notifica o frontend via socket. Erros por evento são capturados
    // individualmente — um evento ruim não derruba o webhook (a Meta
    // retenta em 5xx).
    for (const item of templateStatusChanges) {
      try {
        const value = item?.change?.value || {};
        const metaTemplateId = String(value.message_template_id || "");
        if (!metaTemplateId) {
          logger.warn("[Webhook] message_template_status_update sem message_template_id — ignorado");
          continue;
        }

        const whatsapp = await Whatsapp.findOne({
          where: { wabaBusinessAccountId: String(item.entryId), channelType: "official" }
        });
        if (!whatsapp) {
          logger.warn(`[Webhook] Status de template recebido para WABA desconhecida: ${item.entryId}`);
          continue;
        }

        const event = String(value.event || "").toUpperCase();
        const rejectedReason = value.reason || value.rejection_info?.reason || null;
        const now = new Date();

        const existing = await WhatsappTemplate.findOne({
          where: { whatsappId: whatsapp.id, metaTemplateId }
        });

        if (existing) {
          if (event === "DELETED") {
            await existing.destroy();
          } else {
            await existing.update({
              status: event || existing.status,
              rejectedReason,
              lastSyncedAt: now
            });
          }
        } else if (event !== "DELETED") {
          // DELETED de template nunca sincronizado não precisa criar registro.
          await WhatsappTemplate.create({
            companyId: whatsapp.companyId,
            whatsappId: whatsapp.id,
            metaTemplateId,
            name: value.message_template_name || "",
            language: value.message_template_language || "",
            category: value.message_template_category || "",
            status: event || "PENDING",
            parameterFormat: null,
            components: [],
            rejectedReason,
            lastSyncedAt: now
          });
        }

        getIO()
          .of(`/workspace-${whatsapp.companyId}`)
          .emit(`company-${whatsapp.companyId}-meta-template`, {
            action: "status",
            template: {
              id: metaTemplateId,
              name: value.message_template_name || null,
              status: value.event || null,
              reason: rejectedReason
            }
          });
      } catch (err: any) {
        Sentry.captureException(err);
        logger.error(
          `[Webhook] Erro ao processar status de template (WABA ${item?.entryId}): ${err.message}`
        );
      }
    }

    return res.status(200).send("OK");
    
  } catch (error: any) {
    Sentry.captureException(error);
    logger.error(`[Webhook] Erro ao processar webhook: ${error.message}`);
    
    return res.status(503).send("Service Unavailable");
  }
};
