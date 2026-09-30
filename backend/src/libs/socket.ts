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

const validateJWTPayload = (payload: any): { userId: string | number; companyId?: number; iat?: number; exp?: number } => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload inválido");
  }
  // Aceita userId (token de socket do SerializeUser) ou id (access token do CreateTokens).
  const userId = payload.userId ?? payload.id;
  if (!userId || !isValidUUID(userId)) {
    throw new Error("userId inválido");
  }
  payload.userId = userId;
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
  // Conexões sem Origin não são CORS e devem continuar funcionando.
  if (!origin) return true;

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

// Throttle em memória do heartbeat: último write no DB por usuário.
// Evita UPDATE a cada batimento (frontend envia a cada poucos segundos)
const heartbeatLastWrite = new Map<string, number>();
const HEARTBEAT_WRITE_INTERVAL_MS = 60 * 1000; // 1 write por minuto por usuário
const HEARTBEAT_MAP_MAX_SIZE = 1000;

// Cache curto (60s) de userId -> companyId para tokens antigos de socket
// emitidos antes do deploy (payload sem companyId).
const userCompanyCache = new Map<string, { companyId: number; expires: number }>();
const USER_COMPANY_CACHE_TTL_MS = 60 * 1000;

const resolveUserCompanyId = async (userId: string | number): Promise<number | null> => {
  const key = String(userId);
  const cached = userCompanyCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.companyId;

  // Importação dinâmica para evitar dependência circular
  const { default: User } = await import("../models/User");
  const user = await User.findByPk(userId, { attributes: ["companyId"] });
  const companyId = user?.companyId ?? null;
  if (companyId) {
    if (userCompanyCache.size > 1000) userCompanyCache.clear();
    userCompanyCache.set(key, { companyId, expires: Date.now() + USER_COMPANY_CACHE_TTL_MS });
  }
  return companyId;
};

// companyId efetivo da conexão: setado no middleware de auth ou derivado do namespace.
const getSocketCompanyId = (socket: any): number | null => {
  if (socket.data?.companyId) return Number(socket.data.companyId);
  const match = socket.nsp?.name?.match(/workspace-(\d+)/);
  return match ? Number(match[1]) : null;
};

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
  // Feature flag SOCKET_AUTH_PERMISSIVE permite rollback emergencial,
  // mas é ignorada em produção (auth sempre obrigatória em prod).
  const isSocketAuthPermissive = isDevelopment && process.env.SOCKET_AUTH_PERMISSIVE === "true";
  io.use((socket, next) => {
    try {
      // Aceita token via auth (recomendado) ou query (legado, mantido p/ compatibilidade).
      const token = (socket.handshake.auth?.token || socket.handshake.query.token) as string;
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

  // Middleware de autenticação JWT também para namespaces dinâmicos (Socket.io v3+).
  // Cobre todas as conexões em /workspace-N (e, portanto, todos os eventos/joins).
  workspaces.use((socket, next) => {
    (async () => {
      try {
        // Aceita token via auth (recomendado) ou query (legado, mantido p/ compatibilidade).
        const token = (socket.handshake.auth?.token || socket.handshake.query.token) as string;
        const origin = socket.handshake.headers.origin;

        if (!token) {
          logger.warn(`[SOCKET AUTH WORKSPACE] Conexão sem token - origin=${origin}`);
          if (isSocketAuthPermissive) {
            logger.warn("[SOCKET AUTH WORKSPACE] SOCKET_AUTH_PERMISSIVE=true - permitindo conexão sem token");
            return next();
          }
          return next(new SocketCompatibleAppError("Token de autenticação obrigatório", 401));
        }

        // Binding de tenant: o token precisa pertencer à company do namespace /workspace-N.
        const nsMatch = socket.nsp.name.match(/workspace-(\d+)/);
        const nsCompanyId = nsMatch ? Number(nsMatch[1]) : null;

        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-only-do-not-use-in-production");
          const validatedPayload = validateJWTPayload(decoded);

          let tokenCompanyId = Number(validatedPayload.companyId);
          if (!Number.isSafeInteger(tokenCompanyId) || tokenCompanyId <= 0) {
            // Tokens antigos sem companyId: resolve via banco (com cache curto).
            tokenCompanyId = await resolveUserCompanyId(validatedPayload.userId);
          }

          if (!nsCompanyId || !tokenCompanyId || tokenCompanyId !== nsCompanyId) {
            logger.warn(`[SOCKET AUTH WORKSPACE] Tenant mismatch - namespace=${socket.nsp.name} userId=${validatedPayload.userId}`);
            return next(new SocketCompatibleAppError("Namespace não autorizado para este usuário", 403));
          }

          socket.data.user = { ...validatedPayload, companyId: tokenCompanyId };
          socket.data.companyId = tokenCompanyId;
          return next();
        } catch (err) {
          logger.warn(`[SOCKET AUTH WORKSPACE] Token inválido - origin=${origin} erro=${err.message}`);
          if (isSocketAuthPermissive) {
            logger.warn("[SOCKET AUTH WORKSPACE] SOCKET_AUTH_PERMISSIVE=true - permitindo token inválido");
            return next();
          }
          return next(new SocketCompatibleAppError("Token inválido ou expirado", 401));
        }
      } catch (e) {
        logger.error(`[SOCKET AUTH WORKSPACE] Erro inesperado no middleware: ${e.message}`);
        if (isSocketAuthPermissive) {
          return next();
        }
        return next(new SocketCompatibleAppError("Falha na autenticação do socket", 401));
      }
    })();
  });

  workspaces.on("connection", (socket) => {
    const clientIp = socket.handshake.address;

    // Connection State Recovery: verifica se a conexão foi recuperada
    if ((socket as any).recovered) {
      logger.info(`[SOCKET RECOVERY] ✅ Conexão RECUPERADA - namespace=${socket.nsp.name} socketId=${socket.id} rooms=${Array.from(socket.rooms).join(",")}`);
      // Eventos perdidos durante a desconexão serão reenviados automaticamente
    } else {
      try {
        // Nunca logar handshake.query completo: contém o token JWT.
        logger.info(`[SOCKET] Cliente conectado ao namespace ${socket.nsp.name} (IP: ${clientIp}) userId=${socket.data.user?.userId ?? "n/a"}`);
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

      // Valida que o ticket pertence à company do namespace antes do join.
      const companyId = getSocketCompanyId(socket);
      if (!companyId) {
        callback?.("companyId não encontrado");
        return;
      }
      try {
        // Importação dinâmica para evitar dependência circular
        const { default: Ticket } = await import("../models/Ticket");
        const numericId = Number(normalizedId);
        const where = Number.isInteger(numericId) && numericId > 0
          ? { id: numericId, companyId }
          : { uuid: normalizedId, companyId };
        const ticket = await Ticket.findOne({ where, attributes: ["id"] });
        if (!ticket) {
          callback?.("Ticket não encontrado");
          return;
        }
      } catch (e) {
        logger.warn(`[SOCKET JOIN] Falha ao validar ticket ${normalizedId} em ${socket.nsp.name}: ${(e as Error).message}`);
        callback?.("Erro ao validar ticket");
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
        const companyId = getSocketCompanyId(socket);

        if (!companyId) {
          callback?.({ error: "Ticket não encontrado" });
          return;
        }

        // Filtro por companyId: ticket de outro tenant retorna 404 silencioso.
        const ticket = Number.isInteger(numericTicketId) && numericTicketId > 0
          ? await Ticket.findOne({ where: { id: numericTicketId, companyId }, attributes: ["id", "uuid"] })
          : await Ticket.findOne({ where: { uuid: normalizedTicketId, companyId }, attributes: ["id", "uuid"] });

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
      // Endpoint de diagnóstico: só responde com SOCKET_DEBUG=true (evita enumeração de salas).
      if (process.env.SOCKET_DEBUG !== "true") {
        callback?.({ error: "debug disabled" });
        return;
      }
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
        // SEGURANÇA: usa o userId autenticado do token; o userId do payload do
        // cliente só serve de fallback no modo permissivo (dev), quando não há auth.
        const userId = socket.data.user?.userId ?? data?.userId;
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

        // Throttle: se o último write foi há menos de 60s, responde sem ir ao DB.
        // O lastActivityAt pode ficar até ~1min defasado, o que é aceitável
        // para o propósito (detecção de presença/inatividade)
        const heartbeatKey = `${companyId}:${userId}`;
        const nowMs = Date.now();
        const lastWrite = heartbeatLastWrite.get(heartbeatKey) || 0;
        if (nowMs - lastWrite < HEARTBEAT_WRITE_INTERVAL_MS) {
          callback?.({ success: true, timestamp: new Date(nowMs).toISOString(), throttled: true });
          return;
        }
        heartbeatLastWrite.set(heartbeatKey, nowMs);

        // Limpeza oportunista para não crescer indefinidamente
        if (heartbeatLastWrite.size > HEARTBEAT_MAP_MAX_SIZE) {
          for (const [key, ts] of heartbeatLastWrite) {
            if (nowMs - ts > HEARTBEAT_WRITE_INTERVAL_MS) {
              heartbeatLastWrite.delete(key);
            }
          }
        }

        const user = await User.findByPk(userId, {
          attributes: ["id", "online", "lastActivityAt", "status", "companyId"]
        });

        // Confere tenant: heartbeat só altera usuário da mesma company do namespace.
        if (!user || user.companyId !== companyId) {
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
            { where: { id: userId, companyId }, silent: true }
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
            { where: { id: userId, companyId }, silent: true }
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
