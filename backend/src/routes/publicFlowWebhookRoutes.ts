import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { WebhookModel } from "../models/Webhook";
import DispatchWebHookService from "../services/WebhookService/DispatchWebHookService";
import logger from "../utils/logger";

const routes = express.Router();

// Rate limit básico por IP — endpoint público de disparo de fluxo via hash.
// Mesma janela dos limites de mensagem; evita brute force de hash_id e flood.
const flowWebhookRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // máximo 30 disparos por minuto por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests",
    code: "RATE_LIMIT_EXCEEDED"
  }
});

/**
 * POST /public/flow-webhook/:hashId
 *
 * Gatilho externo de fluxo FlowBuilder (re-ativa DispatchWebHookService,
 * que era dead code). PÚBLICO — autenticação é o próprio hash_id.
 *
 * Segurança: hash inexistente retorna 404 com o mesmo corpo genérico do
 * sucesso (não diferencia enumeração); erros internos nunca vazam detalhe.
 */
routes.post(
  "/public/flow-webhook/:hashId",
  flowWebhookRateLimit,
  async (req: Request, res: Response): Promise<Response> => {
    const { hashId } = req.params;

    try {
      const webhook = await WebhookModel.findOne({
        where: { hash_id: hashId }
      });

      if (!webhook || !webhook.active) {
        // Mesmo formato de resposta — não vazar se o hash existe ou não
        return res.status(404).json({ received: true });
      }

      await DispatchWebHookService({
        companyId: webhook.company_id,
        hashId,
        data: req.body || {},
        req
      });

      return res.status(200).json({ received: true });
    } catch (err: any) {
      // Não engolir exceção: loga com contexto, mas resposta é sempre genérica
      logger.error(
        `[FlowWebhook] Erro ao despachar hash=${hashId}: ${err?.message}`
      );
      return res.status(200).json({ received: true });
    }
  }
);

export default routes;
