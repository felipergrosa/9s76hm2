import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { Op, UniqueConstraintError } from "sequelize";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import Whatsapp from "../models/Whatsapp";
import Contact from "../models/Contact";
import CompaniesSettings from "../models/CompaniesSettings";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import CreateMessageService from "../services/MessageServices/CreateMessageService";
import AppError from "../errors/AppError";
import { emitToCompanyNamespace } from "../libs/socketEmit";
import { sanitizeWhatsapp } from "../helpers/sanitizeWhatsapp";
import {
  telegramGetMe,
  telegramSetWebhook,
  safeTelegramError
} from "../services/TelegramServices/telegramApi";
import { telegramNumber } from "../services/TelegramServices/telegramContact";
import logger from "../utils/logger";

const routes = express.Router();

// =============================================================================
// Canal Telegram Bot (referência Fluxoo).
// - POST /whatsapp/:id/telegram-setup: autenticado (connections.edit). Recebe
//   o botToken, valida via getMe, gera o token opaco do webhook e registra o
//   setWebhook apontando para /public/telegram/:token.
// - POST /public/telegram/:token: webhook público chamado pelo Telegram.
//   A autenticação é o token opaco na URL + secret_token no header
//   (X-Telegram-Bot-Api-Secret-Token, registrado no setWebhook).
// companyId/whatsappId NUNCA vêm do body nem são expostos: são derivados do
// token, que só existe em conexões do canal "telegram".
// =============================================================================

// O Telegram faz POST por mensagem e retenta em caso de falha — o limite
// precisa acomodar bursts de conversas ativas + retries sem derrubar o canal.
const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", code: "RATE_LIMIT_EXCEEDED" }
});

const MAX_MESSAGE_LENGTH = 4000;

// Formato do token do BotFather: <id numérico>:<segredo base64url-ish>
const BOT_TOKEN_REGEX = /^\d{5,}:[A-Za-z0-9_-]{20,}$/;

/**
 * Resolve a conexão telegram a partir do token da URL.
 * Retorna null para token inválido — o caller responde 404 genérico (não
 * diferencia "token inexistente" de "canal errado" para não vazar info).
 */
const resolveTelegramConnection = async (
  token: string
): Promise<Whatsapp | null> => {
  // Tokens são hex de 48 chars (24 bytes). Rejeitar formatos estranhos antes
  // de ir ao banco evita scans com payloads gigantes na URL.
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(token)) {
    return null;
  }

  return Whatsapp.findOne({
    where: {
      telegramWebhookToken: token,
      [Op.or]: [{ channel: "telegram" }, { channelType: "telegram" }]
    }
  });
};

/**
 * Cria ou reutiliza o Contact do remetente Telegram.
 * Não usa CreateOrUpdateContactService: ele rejeita "números" que não são
 * telefones reais, e telegram usa identificador sintético tg_<wappId>_<chatId>.
 */
const findOrCreateTelegramContact = async (
  whatsapp: Whatsapp,
  chatId: string | number,
  name: string,
  username?: string
): Promise<Contact> => {
  const number = telegramNumber(whatsapp.id, chatId);

  const existing = await Contact.findOne({
    where: { number, companyId: whatsapp.companyId }
  });

  if (existing) {
    // Nome de fallback ("Telegram <chatId>") cede ao nome real do perfil
    if (name && /^Telegram \S+$/.test(existing.name || "") && existing.name !== name) {
      await existing.update({ name });
    }
    return existing;
  }

  try {
    return await Contact.create({
      name,
      number,
      email: "",
      isGroup: false,
      companyId: whatsapp.companyId,
      whatsappId: whatsapp.id,
      channels: ["telegram"],
      // chat_id puro fica disponível para respostas mesmo se o formato do
      // number mudar no futuro
      remoteJid: String(chatId)
    } as any);
  } catch (err) {
    // Race entre dois updates do mesmo contato: o segundo perde o UNIQUE
    // e apenas lê o contato que o primeiro criou.
    if (err instanceof UniqueConstraintError) {
      const contact = await Contact.findOne({
        where: { number, companyId: whatsapp.companyId }
      });
      if (contact) return contact;
    }
    throw err;
  }
};

// Tipos de anexo Telegram mapeados para placeholder — mídia inbound está
// fora do escopo N1, mas o atendente precisa ver que algo chegou.
const MEDIA_PLACEHOLDERS: Record<string, string> = {
  photo: "[foto]",
  video: "[vídeo]",
  video_note: "[vídeo]",
  document: "[documento]",
  audio: "[áudio]",
  voice: "[áudio]",
  sticker: "[sticker]",
  animation: "[gif]",
  location: "[localização]",
  contact: "[contato]",
  poll: "[enquete]"
};

/**
 * POST /whatsapp/:id/telegram-setup
 * Valida e salva o botToken, gera o token público do webhook e registra o
 * setWebhook na API do Telegram. O botToken NUNCA é devolvido nem logado.
 */
routes.post(
  "/whatsapp/:id/telegram-setup",
  isAuth,
  checkPermission("connections.edit"),
  async (req: Request, res: Response): Promise<Response> => {
    const { id } = req.params;
    const { companyId } = req.user;

    const whatsapp = await Whatsapp.findOne({
      where: { id, companyId }
    });

    if (!whatsapp) {
      throw new AppError("ERR_NO_WAPP_FOUND", 404);
    }

    // Só aceita conexões do canal telegram (checa os dois campos — conexões
    // criadas pelo modal podem nascer só com channelType preenchido).
    if (whatsapp.channel !== "telegram" && whatsapp.channelType !== "telegram") {
      throw new AppError("ERR_WAPP_NOT_TELEGRAM", 400);
    }

    const botToken =
      typeof req.body?.botToken === "string" ? req.body.botToken.trim() : "";

    // Se não veio token novo e já existe um salvo, re-registra o webhook com
    // o token atual (recuperação de webhook perdido/rotacionado).
    const effectiveToken = botToken || whatsapp.telegramBotToken;
    if (!effectiveToken || !BOT_TOKEN_REGEX.test(effectiveToken)) {
      throw new AppError("ERR_TELEGRAM_INVALID_TOKEN", 400);
    }

    // getMe valida o token de verdade antes de persistir/registrar webhook
    let botProfile: any;
    try {
      botProfile = await telegramGetMe(effectiveToken);
    } catch (err: any) {
      logger.warn(
        `[TelegramSetup] getMe falhou para whatsappId=${id}: ${safeTelegramError(err)}`
      );
      throw new AppError("ERR_TELEGRAM_INVALID_TOKEN", 400);
    }

    const backendUrl = (process.env.BACKEND_URL || "")
      .trim()
      .replace(/\/+$/, "");
    if (!backendUrl) {
      // Sem URL pública não há como o Telegram alcançar o webhook.
      throw new AppError("ERR_TELEGRAM_NO_BACKEND_URL", 500);
    }

    if (!whatsapp.telegramWebhookToken) {
      whatsapp.telegramWebhookToken = crypto.randomBytes(24).toString("hex");
    }

    const webhookUrl = `${backendUrl}/public/telegram/${whatsapp.telegramWebhookToken}`;

    try {
      // secret_token = próprio webhookToken: o Telegram o devolve no header
      // X-Telegram-Bot-Api-Secret-Token — checagem extra além da URL.
      await telegramSetWebhook(
        effectiveToken,
        webhookUrl,
        whatsapp.telegramWebhookToken
      );
    } catch (err: any) {
      logger.error(
        `[TelegramSetup] setWebhook falhou whatsappId=${id}: ${safeTelegramError(err)}`
      );
      throw new AppError("ERR_TELEGRAM_SETUP_FAILED", 502);
    }

    await whatsapp.update({
      telegramBotToken: effectiveToken,
      telegramWebhookToken: whatsapp.telegramWebhookToken,
      channel: "telegram",
      channelType: "telegram",
      status: "CONNECTED",
      // @username do bot preenche "number" para exibição na listagem
      number: botProfile?.username
        ? `@${botProfile.username}`
        : whatsapp.number
    });

    logger.info(
      `[TelegramSetup] Webhook registrado: whatsappId=${id} companyId=${companyId} bot=@${botProfile?.username ?? "?"}`
    );

    await emitToCompanyNamespace(companyId, `company-${companyId}-whatsapp`, {
      action: "update",
      whatsapp: sanitizeWhatsapp(whatsapp)
    });

    // Resposta não inclui botToken nem webhookUrl (bearer credentials) —
    // o webhook já está registrado no Telegram, o usuário não precisa vê-lo.
    return res.status(200).json({
      ok: true,
      webhookConfigured: true,
      bot: {
        id: botProfile?.id,
        username: botProfile?.username || null,
        name: botProfile?.first_name || null
      }
    });
  }
);

/**
 * POST /public/telegram/:token
 * Webhook do Telegram: resolve a conexão pelo token → contato → ticket →
 * mensagem (mesmo pipeline do publicWebchatRoutes).
 * Responde 200 para updates ignoráveis (edições, callbacks, grupos) para o
 * Telegram não retentar; 500 só em falha inesperada (retry é deduplicado
 * pelo wid = update_id).
 */
routes.post(
  "/public/telegram/:token",
  webhookRateLimit,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const whatsapp = await resolveTelegramConnection(req.params.token);
      if (!whatsapp) {
        return res.status(404).json({ error: "ERR_TELEGRAM_NOT_FOUND" });
      }

      // Defesa em profundidade: registramos secret_token no setWebhook, então
      // updates legítimos trazem o header. Ausência do header é tolerada
      // (webhooks antigos), mas header presente e divergente é rejeitado.
      const secretHeader = req.headers["x-telegram-bot-api-secret-token"];
      if (
        secretHeader &&
        secretHeader !== whatsapp.telegramWebhookToken
      ) {
        return res.status(403).json({ error: "ERR_TELEGRAM_FORBIDDEN" });
      }

      const update = req.body || {};
      const msg = update.message;

      // Updates sem message (edited_message, callback_query, channel_post):
      // fora do escopo — confirma recebimento para o Telegram não retentar.
      if (!msg || !msg.chat) {
        return res.status(200).json({ ok: true, ignored: "no_message" });
      }

      // Somente DM (chat privado). Grupos/canais fora do escopo N1.
      if (msg.chat.type !== "private") {
        return res.status(200).json({ ok: true, ignored: "non_private_chat" });
      }

      const chatId = msg.chat.id;
      const text = typeof msg.text === "string" ? msg.text.trim() : "";

      // Texto puro ou placeholder de mídia (com caption quando houver)
      let body = text;
      if (!body) {
        const kind = Object.keys(MEDIA_PLACEHOLDERS).find(
          k => msg[k] !== undefined
        );
        if (!kind) {
          return res.status(200).json({ ok: true, ignored: "empty_message" });
        }
        const caption =
          typeof msg.caption === "string" ? ` ${msg.caption.trim()}` : "";
        body = `${MEDIA_PLACEHOLDERS[kind]}${caption}`.slice(0, MAX_MESSAGE_LENGTH);
      }

      const from = msg.from || {};
      const displayName =
        [from.first_name, from.last_name].filter(Boolean).join(" ").trim() ||
        (from.username ? `@${from.username}` : `Telegram ${chatId}`);

      const contact = await findOrCreateTelegramContact(
        whatsapp,
        chatId,
        displayName,
        from.username
      );
      const companyId = whatsapp.companyId;

      const settings = await CompaniesSettings.findOne({
        where: { companyId }
      });

      // Mesmo caminho dos listeners Facebook/Webchat: reabre/reusa o ticket
      // mais recente do contato nesta conexão.
      const ticket = await FindOrCreateTicketService(
        contact,
        whatsapp,
        1, // unreadMessages incrementais
        companyId,
        null,
        null,
        null,
        "telegram",
        false,
        false,
        settings
      );

      // wid derivado do update_id: retries do Telegram são deduplicados
      // pelo CreateMessageService (wid+companyId).
      const wid = `tg_${update.update_id ?? `${chatId}_${msg.message_id}`}`;

      const message = await CreateMessageService({
        messageData: {
          wid,
          ticketId: ticket.id,
          contactId: contact.id,
          body: body.slice(0, MAX_MESSAGE_LENGTH),
          fromMe: false,
          read: false,
          channel: "telegram",
          // Guarda o update bruto: message_id serve para reply_to em
          // respostas citadas no outbound
          dataJson: JSON.stringify(update)
        },
        companyId
      });

      return res.status(201).json({ ok: true, id: message.id });
    } catch (err: any) {
      // Não loga req.body: o update pode conter texto do usuário (LGPD)
      logger.error(`[PublicTelegram] webhook falhou: ${err?.message}`);
      return res.status(500).json({ error: "ERR_TELEGRAM_WEBHOOK" });
    }
  }
);

export default routes;
