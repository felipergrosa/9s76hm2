import "./bootstrap";
import "reflect-metadata";
import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import * as Sentry from "@sentry/node";
import { config as dotenvConfig } from "dotenv";
import bodyParser from 'body-parser';

import "./database";
import uploadConfig from "./config/upload";
import AppError from "./errors/AppError";
import routes from "./routes";
import logger from "./utils/logger";
import { baileysMessageQueue, officialMessageQueue, sendScheduledMessages } from "./queues";
import { importContactsQueue } from "./queues/ImportContactsQueue";
import BullQueue from "./libs/queue"
import BullBoard from 'bull-board';
import basicAuth from 'basic-auth';
import trackUserActivity from "./middleware/trackUserActivity";

// Função de middleware para autenticação básica
export const isBullAuth = (req, res, next) => {
  const user = basicAuth(req);

  if (!user || user.name !== process.env.BULL_USER || user.pass !== process.env.BULL_PASS) {
    res.set('WWW-Authenticate', 'Basic realm="example"');
    return res.status(401).send('Authentication required.');
  }
  next();
};

// Carregar variáveis de ambiente
dotenvConfig();

// Inicializar Sentry
Sentry.init({ dsn: process.env.SENTRY_DSN });

const app = express();

// Configurar trust proxy para rate limiting funcionar atrás de reverse proxy
app.set('trust proxy', 1);

// Configuração de filas
app.set("queues", {
  baileysMessageQueue,
  officialMessageQueue,
  messageQueue: baileysMessageQueue, // Compatibilidade com código legado
  sendScheduledMessages,
  importContactsQueue
});

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000,https://chats.nobreluminarias.com.br")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// Regex seguros para matching de origem.
// IMPORTANTE: não usar `includes('localhost')` (aceita https://evil.com/localhost)
// nem `endsWith('nobreluminarias.com.br')` (aceita fakenobreluminarias.com.br).
const LOCALHOST_REGEX = /^https?:\/\/localhost(:\d+)?$/;
const LOCAL_IP_REGEX = /^https?:\/\/(127\.0\.0\.1|\[::1\])(:\d+)?$/;
const TRUSTED_DOMAIN_REGEX = /^https?:\/\/([a-z0-9-]+\.)*nobreluminarias\.com\.br$/i;
const isDevelopment = process.env.NODE_ENV !== "production";

const isOriginAllowed = (origin: string | undefined): boolean => {
  // Requisições sem origin (mobile apps, curl) só permitidas em dev.
  if (!origin) return isDevelopment;

  // Lista explícita via FRONTEND_URL.
  if (allowedOrigins.includes(origin)) return true;

  // Subdomínio de nobreluminarias.com.br (match estrito).
  if (TRUSTED_DOMAIN_REGEX.test(origin)) return true;

  // Localhost/127.0.0.1 apenas em desenvolvimento.
  if (isDevelopment && (LOCALHOST_REGEX.test(origin) || LOCAL_IP_REGEX.test(origin))) return true;

  return false;
};

// Configuração do BullBoard
if (String(process.env.BULL_BOARD).toLocaleLowerCase() === 'true' && process.env.REDIS_URI_ACK !== '') {
  BullBoard.setQueues(BullQueue.queues.map(queue => queue && queue.bull));
  app.use('/admin/queues', isBullAuth, BullBoard.UI);
}

// Middlewares de segurança com Helmet.
// CSP desabilitado por enquanto para não quebrar UI existente.
// Habilita: X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy, etc.
app.use(helmet({
  contentSecurityPolicy: false, // TODO: habilitar CSP gradualmente em deploy futuro
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Permite carregar mídias de outros domínios
  crossOriginEmbedderPolicy: false, // Permite embeds (ex: iframes de flow builder)
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

app.use(compression()); // Compressão HTTP
app.use(bodyParser.json({ limit: '5mb' })); // Aumentar o limite de carga para 5 MB
app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }));
app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS bloqueado para origem: ${origin}`);
        callback(new Error('Origem não autorizada pelo CORS'));
      }
    }
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(Sentry.Handlers.requestHandler());
app.use("/public", express.static(uploadConfig.directory));

// Desabilitar HTTP/2 para evitar erros de protocolo
app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  next();
});

// Middleware de tracking de atividade do usuário
app.use(trackUserActivity);

// Rotas
app.use(routes);

// Manipulador de erros do Sentry
app.use(Sentry.Handlers.errorHandler());

// Middleware de tratamento de erros
app.use(async (err: Error, req: Request, res: Response, _: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn(err);
    return res.status(err.statusCode).json({ error: err.message });
  }

  logger.error(err);
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
