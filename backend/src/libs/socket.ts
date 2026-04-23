import { Server as SocketIO } from "socket.io";
import { Server } from "http";
import AppError from "../errors/AppError";
import logger from "../utils/logger";
import { instrument } from "@socket.io/admin-ui";
import jwt from "jsonwebtoken";
import Redis from "ioredis";

// Define namespaces permitidos
const ALLOWED_NAMESPACES = /^\/workspace-\d+$/;

// Funções de validação simples
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  // Permite que IDs numéricos também sejam considerados válidos
  return uuidRegex.test(str) || /^\d+$/.test(str);
};

const isValidStatus = (status: string): boolean => {
  return ["open", "closed", "pending", "group", "bot", "campaign"].includes(status);
};

const validateJWTPayload = (payload: any): { userId: string; iat?: number; exp?: number } => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload inválido");
  }
  if (!payload.userId || !isValidUUID(payload.userId)) {
    throw new Error("userId inválido");
  }
  return payload;
};

// Origens CORS permitidas
// IMPORTANTE: Deve incluir a URL do FRONTEND, não do backend
const ALLOWED_ORIGINS = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
  : ["http://localhost:3000", "https://chats.nobreluminarias.com.br"];

// Regex seguros (alinhados com app.ts) para matching de origem.
const LOCALHOST_REGEX = /^https?:\/\/localhost(:\d+)?$/;
const LOCAL_IP_REGEX = /^https?:\/\/(127\.0\.0\.1|\[::1\])(:\d+)?$/;
const TRUSTED_DOMAIN_REGEX = /^https?:\/\/([a-z0-9-]+\.)*nobreluminarias\.com\.br$/i;
const isDevelopment = process.env.NODE_ENV !== "production";

const isOriginAllowed = (origin: string | undefined): boolean => {
  // Sem origin: permitido apenas em dev (bibliotecas internas, healthcheck).
  if (!origin) return isDevelopment;

  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (TRUSTED_DOMAIN_REGEX.test(origin)) return true;
  if (isDevelopment && (LOCALHOST_REGEX.test(origin) || LOCAL_IP_REGEX.test(origin))) return true;

  return false;
};

// Ajuste da classe AppError para compatibilidade com Error
class SocketCompatibleAppError extends Error {
  constructor(public message: string, public statusCode: number) {
    super(message);
    this.name = "AppError";
    // Garante que a stack trace seja capturada
    Error.captureStackTrace?.(this, SocketCompatibleAppError);
  }
}

let io: SocketIO;

export const initIO = (httpServer: Server): SocketIO => {
  io = new SocketIO(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          logger.warn(`[SOCKET CORS] Origem não autorizada: ${origin}`);
          callback(new SocketCompatibleAppError("Violação da política CORS", 403));
        }
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    maxHttpBufferSize: 1e6, // Limita payload a 1MB
    pingTimeout: 60000, // Aumentado de 20s para 60s (match com frontend)
    pingInterval: 25000,
    upgradeTimeout: 5000, // Reduzido de 30s para 5s (evita travamento no F5)
    allowUpgrades: true, // Permite upgrade de transporte

    // Connection State Recovery: recupera eventos perdidos durante desconexões temporárias
    // Funciona para desconexões de até 2 minutos (configurable)
    connectionStateRecovery: {
      // Guardar estado por 2 minutos após desconexão
      maxDisconnectionDuration: 2 * 60 * 1000,
      // Pular middlewares na reconexão bem-sucedida (mais rápido)
      skipMiddlewares: true,
    }
  });

  // Configura o adapter Redis para suportar múltipliplas instâncias (carregamento dinâmico)
  try {
    const redisUrl = process.env.SOCKET_REDIS_URL || process.env.REDIS_URI_ACK || process.env.REDIS_URI;
    if (redisUrl) {
      const pubClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableAutoPipelining: true
      });
      const subClient = pubClient.duplicate({
        enableReadyCheck: false
      });
      try {
        // Requer dinamicamente para evitar erro de tipos quando o pacote ainda não estiver instalado no dev
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { createAdapter } = require("@socket.io/redis-adapter");
        io.adapter(createAdapter(pubClient as any, subClient as any));
        logger.info(`Socket.IO Redis adapter habilitado (${redisUrl})`);
      } catch (innerErr) {
        logger.warn("Pacote '@socket.io/redis-adapter' não encontrado. Prosseguindo sem adapter.");
      }
    } else {
      logger.warn("Socket.IO Redis adapter desabilitado: defina SOCKET_REDIS_URL ou REDIS_URI/REDIS_URI_ACK");
    }
  } catch (err) {
    logger.error("Falha ao configurar Socket.IO Redis adapter", err);
  }

  // Middleware de autenticação JWT obrigatória.
  // Feature flag SOCKET_AUTH_PERMISSIVE permite rollback emergencial (não recomendado em produção).
  const isSocketAuthPermissive = process.env.SOCKET_AUTH_PERMISSIVE === "true";
  io.use((socket, next) => {
    try {
      const token = socket.handshake.query.token as string;
      const origin = socket.handshake.headers.origin;

      if (!token) {
        logger.warn(`[SOCKET AUTH] Conexão sem token - origin=${origin}`);
        if (isSocketAuthPermissive) {
          logger.warn("[SOCKET AUTH] SOCKET_AUTH_PERMISSIVE=true - permitindo conexão sem token");
          return next();
        }
        return next(new SocketCompatibleAppError("Token de autenticação obrigatório", 401));
      }

      try {
        // Usa mesmo secret validado em config/auth.ts (falha em produção se ausente).
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-only-do-not-use-in-production");
        const validatedPayload = validateJWTPayload(decoded);
        socket.data.user = validatedPayload;
        return next();
      } catch (err) {
        logger.warn(`[SOCKET AUTH] Token inválido - origin=${origin} erro=${err.message}`);
        if (isSocketAuthPermissive) {
          logger.warn("[SOCKET AUTH] SOCKET_AUTH_PERMISSIVE=true - permitindo token inválido");
          return next();
        }
        return next(new SocketCompatibleAppError("Token inválido ou expirado", 401));
      }
    } catch (e) {
      logger.error(`[SOCKET AUTH] Erro inesperado no middleware: ${e.message}`);
      if (isSocketAuthPermissive) {
        return next();
      }
      return next(new SocketCompatibleAppError("Falha na autenticação do socket", 401));
    }
  });

  // Admin UI apenas em desenvolvimento
  const isAdminEnabled = process.env.SOCKET_ADMIN === "true" && process.env.NODE_ENV !== "production";
  if (isAdminEnabled && process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
    try {
      instrument(io, {
        auth: {
          type: "basic",
          username: process.env.ADMIN_USERNAME,
          password: process.env.ADMIN_PASSWORD,
        },
        mode: "development",
        readonly: true,
      });
      logger.info("Socket.IO Admin UI inicializado em modo de desenvolvimento");
    } catch (error) {
      logger.error("Falha ao inicializar Socket.IO Admin UI", error);
    }
  } else if (isAdminEnabled) {
    logger.warn("Credenciais de administrador ausentes, Admin UI não inicializado");
  }

  // Namespaces dinâmicos com validação
  const workspaces = io.of((name, auth, next) => {
    if (ALLOWED_NAMESPACES.test(name)) {
      next(null, true);
    } else {
      logger.warn(`Tentativa de conexão a namespace inválido: ${name}`);
      next(new SocketCompatibleAppError("Namespace inválido", 403), false);
    }
  });

  workspaces.on("connection", (socket) => {
    const clientIp = socket.handshake.address;

    // Connection State Recovery: verifica se a conexão foi recuperada
    if ((socket as any).recovered) {
      logger.info(`[SOCKET RECOVERY] ✅ Conexão RECUPERADA - namespace=${socket.nsp.name} socketId=${socket.id} rooms=${Array.from(socket.rooms).join(",")}`);
      // Eventos perdidos durante a desconexão serão reenviados automaticamente
    } else {
      try {
        logger.info(`[SOCKET] Cliente conectado ao namespace ${socket.nsp.name} (IP: ${clientIp}) query=${JSON.stringify(socket.handshake.query)}`);
      } catch { }
    }

    // Valida userId
    const userId = socket.handshake.query.userId as string;
    if (userId && userId !== "undefined" && !isValidUUID(userId)) { // Adicionado verificação para "undefined" string
      socket.disconnect(true);
      logger.warn(`userId inválido de ${clientIp}`);
      return;
    }

    // logger.info(`Cliente conectado ao namespace ${socket.nsp.name} (IP: ${clientIp})`);

    socket.on("joinChatBox", async (ticketId: string, callback?: (error?: string) => void) => {
      const normalizedId = (ticketId ?? "").toString().trim();
      if (!normalizedId || normalizedId === "undefined" || !isValidUUID(normalizedId)) {
        logger.warn(`ticketId inválido: ${normalizedId || "vazio"}`);
        callback?.("ID de ticket inválido");
        return;
      }
      await socket.join(normalizedId);
      // Reduzir logs: só logar em modo debug
      if (process.env.SOCKET_DEBUG === "true") {
        logger.info(`Cliente entrou no canal de ticket ${ticketId} no namespace ${socket.nsp.name}`);
        try {
          const sockets = await socket.nsp.in(normalizedId).fetchSockets();
          logger.info(`[SOCKET JOIN DEBUG] ns=${socket.nsp.name} room=${normalizedId} count=${sockets.length}`);
        } catch (e) {
          logger.warn(`[SOCKET JOIN DEBUG] falha ao consultar sala ${normalizedId} em ${socket.nsp.name}`);
        }
      }
      callback?.();
    });

    // Last Event ID Pattern: recupera mensagens perdidas desde o último ID conhecido
    socket.on("recoverMissedMessages", async (data: { ticketId: string; lastMessageId: number }, callback?: (result: any) => void) => {
      try {
        const { ticketId, lastMessageId } = data;
        if (!ticketId || lastMessageId === undefined || lastMessageId === null || Number.isNaN(lastMessageId)) {
          callback?.({ error: "ticketId e lastMessageId são obrigatórios" });
          return;
        }

        // Importação dinâmica para evitar dependência circular
        const { default: Message } = await import("../models/Message");
        const { default: Ticket } = await import("../models/Ticket");
        const { Op } = await import("sequelize");

        const normalizedTicketId = String(ticketId).trim();
        const numericTicketId = Number(normalizedTicketId);

        const ticket = Number.isInteger(numericTicketId) && numericTicketId > 0
          ? await Ticket.findByPk(numericTicketId, { attributes: ["id", "uuid"] })
          : await Ticket.findOne({ where: { uuid: normalizedTicketId }, attributes: ["id", "uuid"] });

        if (!ticket) {
          callback?.({ error: "Ticket não encontrado" });
          return;
        }

        // Busca mensagens mais recentes que o último ID conhecido
        const missedMessages = await Message.findAll({
          where: {
            ticketId: ticket.id,
            id: { [Op.gt]: lastMessageId }
          },
          order: [["id", "ASC"]],
          limit: 100, // Limita para evitar sobrecarga
          include: ["contact"]
        });

        logger.info(`[SOCKET RECOVERY] Recuperando ${missedMessages.length} mensagens perdidas para ticket ${ticket.uuid} desde ID ${lastMessageId}`);

        callback?.({
          success: true,
          messages: missedMessages,
          count: missedMessages.length
        });
      } catch (e) {
        logger.error("[SOCKET RECOVERY] Erro ao recuperar mensagens:", e);
        callback?.({ error: (e as Error).message });
      }
    });

    socket.on("joinNotification", (callback?: (error?: string) => void) => {
      socket.join("notification");
      logger.info(`Cliente entrou no canal de notificações no namespace ${socket.nsp.name}`);
      callback?.();
    });

    socket.on("joinTickets", (status: string, callback?: (error?: string) => void) => {
      if (!isValidStatus(status)) {
        logger.warn(`Status inválido: ${status}`);
        callback?.("Status inválido");
        return;
      }
      socket.join(status);
      logger.info(`Cliente entrou no canal ${status} no namespace ${socket.nsp.name}`);
      callback?.();
    });

    socket.on("joinTicketsLeave", (status: string, callback?: (error?: string) => void) => {
      if (!isValidStatus(status)) {
        logger.warn(`Status inválido: ${status}`);
        callback?.("Status inválido");
        return;
      }
      socket.leave(status);
      logger.info(`Cliente saiu do canal ${status} no namespace ${socket.nsp.name}`);
      callback?.();
    });

    socket.on("joinChatBoxLeave", (ticketId: string, callback?: (error?: string) => void) => {
      const normalizedId = (ticketId ?? "").toString().trim();
      if (!normalizedId || normalizedId === "undefined" || !isValidUUID(normalizedId)) {
        logger.warn(`ticketId inválido: ${normalizedId || "vazio"}`);
        callback?.("ID de ticket inválido");
        return;
      }
      socket.leave(normalizedId);
      logger.info(`Cliente saiu do canal de ticket ${ticketId} no namespace ${socket.nsp.name}`);
      callback?.();
    });

    // Diagnóstico: verifica se o socket está em uma sala e quantos sockets existem nela
    socket.on("debugCheckRoom", async (roomId: string, callback?: (data: any) => void) => {
      try {
        const room = (roomId ?? "").toString().trim();
        if (!room) {
          callback?.({ error: "invalid room" });
          return;
        }
        const sockets = await socket.nsp.in(room).fetchSockets();
        const present = sockets.some(s => s.id === socket.id);
        const payload = {
          present,
          count: sockets.length,
          room,
          roomsOfSocket: Array.from(socket.rooms || [])
        };
        if (process.env.SOCKET_DEBUG === "true") {
          logger.info(`[SOCKET DEBUG] Room ${room} -> present=${present} count=${sockets.length} socketId=${socket.id}`);
        }
        callback?.(payload);
      } catch (e) {
        if (process.env.SOCKET_DEBUG === "true") {
          logger.error("[SOCKET DEBUG] Falha em debugCheckRoom", e);
        }
        callback?.({ error: (e as Error).message });
      }
    });

    // Heartbeat: atualiza lastActivityAt do usuário em tempo real
    socket.on("userHeartbeat", async (data: { userId: number | string }, callback?: (result: any) => void) => {
      try {
        const { userId } = data;
        if (!userId) {
          callback?.({ error: "userId obrigatório" });
          return;
        }

        // Importação dinâmica para evitar dependência circular
        const { default: User } = await import("../models/User");
        const { default: UpdateUserOnlineStatusService } = await import("../services/UserServices/UpdateUserOnlineStatusService");

        // Extrair companyId do namespace (formato: /workspace-{companyId})
        const namespaceMatch = socket.nsp.name.match(/workspace-(\d+)/);
        const companyId = namespaceMatch ? parseInt(namespaceMatch[1], 10) : null;

        if (!companyId) {
          callback?.({ error: "companyId não encontrado" });
          return;
        }

        const user = await User.findByPk(userId, {
          attributes: ["id", "online", "lastActivityAt", "status", "companyId"]
        });

        if (!user) {
          callback?.({ error: "Usuário não encontrado" });
          return;
        }

        const now = new Date();
        const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

        // Se usuário está offline ou inativo há mais de 3h (ou lastActivityAt é null), colocar online
        if (!user.online || !user.lastActivityAt || user.lastActivityAt < threeHoursAgo) {
          console.log(`[Heartbeat] Usuário ${userId} voltando à atividade - online=${user.online}, lastActivity=${user.lastActivityAt}`);
          
          // Atualizar para online
          await User.update(
            { 
              online: true, 
              lastActivityAt: now,
              status: null // Limpar status "ausente" se existir
            },
            { where: { id: userId }, silent: true }
          );

          // Emitir evento Socket.IO para atualizar frontend
          await UpdateUserOnlineStatusService({
            userId,
            companyId,
            online: true
          });
        } else {
          // Apenas atualizar lastActivityAt
          await User.update(
            { lastActivityAt: now },
            { where: { id: userId }, silent: true }
          );
        }

        callback?.({ success: true, timestamp: now.toISOString() });
      } catch (e) {
        console.error("[Heartbeat] Erro:", e);
        callback?.({ error: (e as Error).message });
      }
    });

    socket.on("disconnect", () => {
      logger.info(`Cliente desconectado do namespace ${socket.nsp.name} (IP: ${clientIp})`);
    });

    socket.on("error", (error) => {
      logger.error(`Erro no socket do namespace ${socket.nsp.name}: ${error.message}`);
    });
  });

  return io;
};

export const getIO = (): SocketIO => {
  if (!io) {
    throw new SocketCompatibleAppError("Socket IO não inicializado", 500);
  }
  return io;
};
