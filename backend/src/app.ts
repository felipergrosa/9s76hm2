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
import debugRequest from "../debug-middleware"; // ✅ Debug temporário

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

// Função para verificar se origem é permitida (mais flexível)
const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true; // Permitir requisições sem origin (ex: Postman, mobile apps)
  
  // Verificar se a origem está na lista explícita
  if (allowedOrigins.includes(origin)) return true;
  
  // Verificar se é subdomínio de nobreluminarias.com.br
  if (origin.endsWith('nobreluminarias.com.br')) return true;
  
  // Verificar localhost para desenvolvimento
  if (origin.includes('localhost')) return true;
  
  return false;
};

// Configuração do BullBoard
if (String(process.env.BULL_BOARD).toLocaleLowerCase() === 'true' && process.env.REDIS_URI_ACK !== '') {
  BullBoard.setQueues(BullQueue.queues.map(queue => queue && queue.bull));
  app.use('/admin/queues', isBullAuth, BullBoard.UI);
}

// Middlewares
// app.use(helmet({
//   contentSecurityPolicy: {
//     directives: {
//       defaultSrc: ["'self'", "http://localhost:8080"],
//       imgSrc: ["'self'", "data:", "http://localhost:8080"],
//       scriptSrc: ["'self'", "http://localhost:8080"],
//       styleSrc: ["'self'", "'unsafe-inline'", "http://localhost:8080"],
//       connectSrc: ["'self'", "http://localhost:8080"]
//     }
//   },
//   crossOriginResourcePolicy: false, // Permite recursos de diferentes origens
//   crossOriginEmbedderPolicy: false, // Permite incorporação de diferentes origens
//   crossOriginOpenerPolicy: false, // Permite abertura de diferentes origens
//   // crossOriginResourcePolicy: {
//   //   policy: "cross-origin" // Permite carregamento de recursos de diferentes origens
//   // }
// }));

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

// ✅ Debug temporário - REMOVER APÓS IDENTIFICAR PROBLEMA
app.use(debugRequest);

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
