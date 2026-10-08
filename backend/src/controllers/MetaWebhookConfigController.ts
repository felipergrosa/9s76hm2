import { Request, Response } from "express";
import { Op } from "sequelize";
import Whatsapp from "../models/Whatsapp";
import logger from "../utils/logger";

/**
 * Config pública do(s) webhook(s) Meta para a tela "Webhook Unificado Meta".
 *
 * Segurança: NUNCA retornar tokens completos — verify tokens e app secrets
 * saem sempre mascarados ou apenas como contagem de conexões configuradas.
 */

// Mascara segredo exibindo só as bordas ("ab•••yz").
// Tokens curtos saem quase totalmente mascarados para não vazar entropia.
const maskToken = (token?: string | null): string | null => {
  const value = (token || "").trim();
  if (!value) return null;
  if (value.length <= 4) return "••••";
  if (value.length <= 8) return `${value.slice(0, 1)}•••${value.slice(-1)}`;
  return `${value.slice(0, 2)}•••${value.slice(-2)}`;
};

// Onde o campo é habilitado:
// - "app": o backend assina automaticamente via subscribed_apps na conexão
//   (graphAPI.subscribeApp / MetaOAuthService.subscribeInstagramObject);
// - "dashboard": precisa ser marcado na assinatura de webhook do app no
//   painel de desenvolvedores da Meta.
//
// Campos realmente consumidos — manter sincronizado com:
// - controllers/WebHookController.ts (objects "page" e "instagram")
// - controllers/WhatsAppWebhookController.ts (object "whatsapp_business_account")
const WEBHOOK_FIELDS = [
  {
    object: "page",
    product: "Facebook / Messenger",
    endpoint: "/webhook",
    items: [
      // DM via Messenger: entry.messaging → handleMessage
      { name: "messages", source: "app" },
      // Postbacks de botões/menus → handleMessage
      { name: "messaging_postbacks", source: "app" },
      // Confirmações de entrega/leitura e echos do próprio envio
      { name: "message_deliveries", source: "app" },
      { name: "message_reads", source: "app" },
      { name: "message_echoes", source: "app" },
      // Handover protocol: eventos quando outro app é o receptor primário
      { name: "standby", source: "app" },
      { name: "messaging_handovers", source: "app" },
      // Comentários no feed da página (automação comment_keyword)
      { name: "feed", source: "dashboard" }
    ]
  },
  {
    object: "instagram",
    product: "Instagram",
    endpoint: "/webhook",
    items: [
      // DM do Instagram chega em entry.messaging do objeto "instagram" —
      // habilitar "messages" na assinatura do produto Instagram no app.
      { name: "messages", source: "dashboard" },
      // Comentários em mídia (automação comment_keyword + Comment-to-DM)
      { name: "comments", source: "app" },
      // Menções em stories/mídia (automação story_mention)
      { name: "mentions", source: "app" }
    ]
  },
  {
    object: "whatsapp_business_account",
    product: "WhatsApp Business API",
    endpoint: "/webhooks/whatsapp",
    items: [
      // Mensagens recebidas e atualizações de status (sent/delivered/read)
      { name: "messages", source: "dashboard" },
      // Mudança de status de templates (approved/rejected/paused)
      { name: "message_template_status_update", source: "dashboard" }
    ]
  }
];

const countConfigured = async (column: string): Promise<number> =>
  Whatsapp.count({
    where: {
      [column]: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
    }
  });

export const index = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Base pública: BACKEND_URL tem prioridade; fallback para o host da
    // requisição (útil em dev quando o env não está configurado).
    const envBase = (process.env.BACKEND_URL || "").trim().replace(/\/+$/, "");
    const baseUrl = envBase || `${req.protocol}://${req.get("host")}`;

    // Somente contagens — nunca expor os valores de tokens/secrets por conexão.
    const [metaTokens, wabaTokens, appSecrets] = await Promise.all([
      countConfigured("metaWebhookVerifyToken"),
      countConfigured("wabaWebhookVerifyToken"),
      countConfigured("metaAppSecret")
    ]);

    return res.json({
      baseUrl,
      // Webhook unificado Facebook + Instagram (WebHookController)
      webhookUrl: `${baseUrl}/webhook`,
      verifyTokenMasked: maskToken(process.env.VERIFY_TOKEN),
      perConnectionVerifyTokens: metaTokens,
      // Assinatura HMAC X-Hub-Signature-256 (fail-closed em produção)
      appSecretConfigured: !!process.env.META_APP_SECRET,
      perConnectionAppSecrets: appSecrets,
      // Webhook separado da API Oficial do WhatsApp (WhatsAppWebhookController)
      whatsappBusiness: {
        webhookUrl: `${baseUrl}/webhooks/whatsapp`,
        verifyTokenMasked: maskToken(process.env.WABA_WEBHOOK_VERIFY_TOKEN),
        perConnectionVerifyTokens: wabaTokens
      },
      fields: WEBHOOK_FIELDS
    });
  } catch (error) {
    logger.error(
      `[MetaWebhookConfig] Falha ao montar config: ${
        (error as Error)?.message || error
      }`
    );
    return res.status(500).json({ error: "ERR_META_WEBHOOK_CONFIG" });
  }
};
