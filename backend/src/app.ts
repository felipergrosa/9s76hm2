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
import type { BaseError as SequelizeBaseError } from "sequelize";

import "./database";
import uploadConfig from "./config/upload";
import AppError from "./errors/AppError";
import routes from "./routes";
import logger from "./utils/logger";
import { messageQueue, sendScheduledMessages } from "./queues";
import { importContactsQueue } from "./queues/ImportContactsQueue";
import BullQueue from "./libs/queue"
import BullBoard from 'bull-board';
import basicAuth from 'basic-auth';

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

// Configuração de filas
app.set("queues", {
  messageQueue,
  sendScheduledMessages,
  importContactsQueue
});

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

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
    origin: allowedOrigins
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(Sentry.Handlers.requestHandler());
app.use("/public", express.static(uploadConfig.directory));

// Rotas
app.use(routes);

// Manipulador de erros do Sentry
app.use(Sentry.Handlers.errorHandler());

const mapDatabaseConnectionError = (
  error: any
): { status: number; code: string; message: string } | null => {
  if (!error) {
    return null;
  }

  const parent = error.parent || error.original || {};
  const pgCode = parent.code;
  const normalizedMessage = String(parent.message || error.message || "").toLowerCase();
  const isSequelizeConnectionError =
    /SequelizeConnection/i.test(error.name || "") ||
    /database/i.test(error.name || "") ||
    Boolean(pgCode);

  if (!isSequelizeConnectionError) {
    return null;
  }

  if (pgCode === "28P01") {
    return {
      status: 503,
      code: "DB_INVALID_CREDENTIALS",
      message: "Credenciais inválidas para o banco de dados. Verifique usuário e senha configurados."
    };
  }

  if (pgCode === "3D000" || (normalizedMessage.includes("database") && normalizedMessage.includes("does not exist"))) {
    return {
      status: 503,
      code: "DB_NOT_FOUND",
      message: "Banco de dados não encontrado. Crie o banco configurado em DB_NAME antes de continuar."
    };
  }

  if (
    pgCode === "28000" ||
    (normalizedMessage.includes("role") && normalizedMessage.includes("does not exist"))
  ) {
    return {
      status: 503,
      code: "DB_ROLE_NOT_FOUND",
      message: "Usuário do banco de dados não existe. Crie o usuário definido em DB_USER."
    };
  }

  return {
    status: 503,
    code: "DB_CONNECTION_ERROR",
    message: "Não foi possível conectar ao banco de dados. Aguarde alguns instantes ou contate o suporte."
  };
};

// Middleware de tratamento de erros
app.use(async (err: Error, req: Request, res: Response, _: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn(err);
    return res.status(err.statusCode).json({ error: err.message });
  }

  const dbError = mapDatabaseConnectionError(err);
  if (dbError) {
    logger.error(`Erro de conexão com o banco (${dbError.code}): ${err.message}`);
    return res.status(dbError.status).json({ error: dbError.message, code: dbError.code });
  }

  logger.error(err);
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
