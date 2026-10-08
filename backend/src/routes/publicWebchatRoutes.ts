import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { Op, UniqueConstraintError } from "sequelize";
import Whatsapp from "../models/Whatsapp";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Message from "../models/Message";
import CompaniesSettings from "../models/CompaniesSettings";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import CreateMessageService from "../services/MessageServices/CreateMessageService";
import logger from "../utils/logger";

const routes = express.Router();

// =============================================================================
// Webchat público por token (referência Fluxoo: /webchat/:token).
// Autenticação do visitante = visitorId opaco gerado pelo backend e guardado no
// navegador (localStorage). Quem tem o visitorId "é" o visitante — por isso ele
// precisa ser longo/aleatório e o formato é validado em todo endpoint.
// companyId/whatsappId NUNCA vêm do body nem são expostos na resposta: são
// derivados do token na URL, que só existe em conexões do canal "webchat".
// =============================================================================

// Limites de segurança
const MAX_MESSAGE_LENGTH = 2000;
const MAX_NAME_LENGTH = 100;
const VISITOR_ID_REGEX = /^[A-Za-z0-9_-]{8,64}$/;

// Rate limits por IP (janelas alinhadas aos demais endpoints públicos).
const sessionRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", code: "RATE_LIMIT_EXCEEDED" }
});

const sendMessageRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // um visitante digitando não passa disso; flood de POST é o alvo
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", code: "RATE_LIMIT_EXCEEDED" }
});

const pollRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // poll a cada ~4s = 15/min; folga para múltiplas abas/visitantes no mesmo IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", code: "RATE_LIMIT_EXCEEDED" }
});

/**
 * Resolve a conexão webchat a partir do token da URL.
 * Retorna null para token inválido — o caller responde 404 genérico
 * (não diferencia "token inexistente" de "canal errado" para não vazar info).
 */
const resolveWebchatConnection = async (token: string): Promise<Whatsapp | null> => {
  // Tokens são hex de 48 chars (24 bytes). Rejeitar formatos estranhos antes
  // de ir ao banco evita scans com payloads gigantes na URL.
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(token)) {
    return null;
  }

  return Whatsapp.findOne({
    where: {
      webchatToken: token,
      [Op.or]: [{ channel: "webchat" }, { channelType: "webchat" }]
    }
  });
};

/** Sanitiza nome do visitante: remove controles/HTML-ish e limita tamanho. */
const sanitizeVisitorName = (name: unknown): string | null => {
  if (typeof name !== "string") return null;
  // Remove caracteres de controle e <> para não virar vetor de HTML no painel.
  const cleaned = name.replace(/[<>\u0000-\u001F\u007F]/g, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_NAME_LENGTH);
};

/** Número sintético do contato webchat — único por conexão+visitante. */
const webchatNumber = (whatsappId: number, visitorId: string): string =>
  `webchat_${whatsappId}_${visitorId}`;

/**
 * Cria ou reutiliza o Contact do visitante.
 * Não usa CreateOrUpdateContactService: ele rejeita "números" que não são
 * telefones reais, e webchat usa identificador opaco.
 */
const findOrCreateVisitorContact = async (
  whatsapp: Whatsapp,
  visitorId: string,
  name: string | null
): Promise<Contact> => {
  const number = webchatNumber(whatsapp.id, visitorId);
  const displayName = name || `Visitante ${visitorId.slice(0, 8)}`;

  const existing = await Contact.findOne({
    where: { number, companyId: whatsapp.companyId }
  });

  if (existing) {
    // Atualiza nome apenas se o atual for o fallback genérico
    if (name && /^Visitante /.test(existing.name || "")) {
      await existing.update({ name });
    }
    return existing;
  }

  try {
    return await Contact.create({
      name: displayName,
      number,
      email: "",
      isGroup: false,
      companyId: whatsapp.companyId,
      whatsappId: whatsapp.id,
      channels: ["webchat"]
    } as any);
  } catch (err) {
    // Race entre dois requests do mesmo visitante: o segundo perde o UNIQUE
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

const notFound = (res: Response): Response =>
  res.status(404).json({ error: "ERR_WEBCHAT_NOT_FOUND" });

/**
 * POST /public/webchat/:token/session
 * Cria/recupera a sessão do visitante. Body: { visitorId?, name? }.
 * Resposta mínima: não expõe companyId/whatsappId nem dados internos.
 */
routes.post(
  "/public/webchat/:token/session",
  sessionRateLimit,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const whatsapp = await resolveWebchatConnection(req.params.token);
      if (!whatsapp) return notFound(res);

      const bodyVisitorId =
        typeof req.body?.visitorId === "string" &&
        VISITOR_ID_REGEX.test(req.body.visitorId)
          ? req.body.visitorId
          : null;

      // visitorId ausente/inválido → gera um novo (não reutiliza formato inválido)
      const visitorId = bodyVisitorId || crypto.randomUUID();
      const name = sanitizeVisitorName(req.body?.name);

      // Se o visitante informou nome, já materializa o contato para o atendente
      // ver um nome amigável antes da primeira mensagem.
      if (bodyVisitorId || name) {
        await findOrCreateVisitorContact(whatsapp, visitorId, name);
      }

      return res.status(200).json({
        visitorId,
        connectionName: whatsapp.name,
        greeting: whatsapp.greetingMessage || null
      });
    } catch (err: any) {
      logger.error(`[PublicWebchat] session falhou: ${err?.message}`);
      return res.status(500).json({ error: "ERR_WEBCHAT_SESSION" });
    }
  }
);

/**
 * POST /public/webchat/:token/messages
 * Envia mensagem do visitante → cria/reutiliza ticket e grava a mensagem.
 * Body: { visitorId, body, name? }.
 */
routes.post(
  "/public/webchat/:token/messages",
  sendMessageRateLimit,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const whatsapp = await resolveWebchatConnection(req.params.token);
      if (!whatsapp) return notFound(res);

      const { visitorId } = req.body || {};
      if (typeof visitorId !== "string" || !VISITOR_ID_REGEX.test(visitorId)) {
        return res.status(400).json({ error: "ERR_WEBCHAT_INVALID_SESSION" });
      }

      const rawBody = req.body?.body;
      const text = typeof rawBody === "string" ? rawBody.trim() : "";
      if (!text || text.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ error: "ERR_WEBCHAT_INVALID_MESSAGE" });
      }

      const name = sanitizeVisitorName(req.body?.name);
      const contact = await findOrCreateVisitorContact(whatsapp, visitorId, name);
      const companyId = whatsapp.companyId;

      const settings = await CompaniesSettings.findOne({ where: { companyId } });

      // Mesmo caminho dos listeners Facebook/Instagram: FindOrCreateTicketService
      // reabre/reusa o ticket mais recente do contato nesta conexão.
      const ticket = await FindOrCreateTicketService(
        contact,
        whatsapp,
        1, // unreadMessages incrementais
        companyId,
        null,
        null,
        null,
        "webchat",
        false,
        false,
        settings
      );

      const wid = `wc_${whatsapp.id}_${Date.now()}_${crypto
        .randomBytes(4)
        .toString("hex")}`;

      const message = await CreateMessageService({
        messageData: {
          wid,
          ticketId: ticket.id,
          contactId: contact.id,
          body: text,
          fromMe: false,
          read: false,
          channel: "webchat"
        },
        companyId
      });

      return res.status(201).json({
        id: message.id,
        createdAt: message.createdAt
      });
    } catch (err: any) {
      logger.error(`[PublicWebchat] send message falhou: ${err?.message}`);
      return res.status(500).json({ error: "ERR_WEBCHAT_SEND" });
    }
  }
);

/**
 * GET /public/webchat/:token/messages?session=<visitorId>
 * Poll das mensagens do ticket do visitante (próprias + do atendente).
 * Escopo: contato derivado de whatsapp.id + visitorId — impossível ler o
 * ticket de outro visitante sem conhecer o visitorId dele.
 */
routes.get(
  "/public/webchat/:token/messages",
  pollRateLimit,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const whatsapp = await resolveWebchatConnection(req.params.token);
      if (!whatsapp) return notFound(res);

      const visitorId = req.query.session;
      if (typeof visitorId !== "string" || !VISITOR_ID_REGEX.test(visitorId)) {
        return res.status(400).json({ error: "ERR_WEBCHAT_INVALID_SESSION" });
      }

      const contact = await Contact.findOne({
        where: {
          number: webchatNumber(whatsapp.id, visitorId),
          companyId: whatsapp.companyId
        },
        attributes: ["id", "name"]
      });

      if (!contact) {
        return res.status(200).json({ messages: [], ticketStatus: null });
      }

      const ticket = await Ticket.findOne({
        where: {
          contactId: contact.id,
          companyId: whatsapp.companyId,
          whatsappId: whatsapp.id,
          isGroup: false
        },
        order: [["id", "DESC"]],
        attributes: ["id", "status"]
      });

      if (!ticket) {
        return res.status(200).json({ messages: [], ticketStatus: null });
      }

      const messages = await Message.findAll({
        where: {
          ticketId: ticket.id,
          companyId: whatsapp.companyId,
          [Op.or]: [{ isPrivate: false }, { isPrivate: null }]
        },
        order: [["createdAt", "ASC"]],
        limit: 200,
        attributes: ["id", "body", "fromMe", "createdAt", "mediaType", "ack"]
      });

      return res.status(200).json({
        ticketStatus: ticket.status,
        messages: messages.map(m => ({
          id: m.id,
          body: m.body,
          fromMe: m.fromMe,
          createdAt: m.createdAt,
          mediaType: m.mediaType
        }))
      });
    } catch (err: any) {
      logger.error(`[PublicWebchat] poll falhou: ${err?.message}`);
      return res.status(500).json({ error: "ERR_WEBCHAT_POLL" });
    }
  }
);

export default routes;
