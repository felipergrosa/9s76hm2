import { NextFunction, Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import uploadConfig from "../config/upload";
import { messageRateLimit, listMessagesRateLimit } from "../middleware/rateLimit";

import * as MessageController from "../controllers/MessageController";

const messageRoutes = Router();

const upload = multer(uploadConfig);

// IMPORTANTE: rotas específicas devem vir ANTES das rotas com parâmetros dinâmicos
messageRoutes.get("/messages-allMe", isAuth, checkPermission("tickets.view"), MessageController.allMe);
messageRoutes.post("/messages/edit/:messageId", isAuth, checkPermission("tickets.update"), MessageController.edit);
messageRoutes.get("/messages/transcribeAudio/:fileName", isAuth, checkPermission("tickets.view"), MessageController.transcribeAudioMessage);
messageRoutes.post("/messages/lista/:ticketId", isAuth, checkPermission("tickets.update"), MessageController.sendListMessage);
messageRoutes.post("/messages/copy/:ticketId", isAuth, checkPermission("tickets.update"), MessageController.sendCopyMessage);
messageRoutes.post("/messages/call/:ticketId", isAuth, checkPermission("tickets.update"), MessageController.sendCALLMessage);
messageRoutes.post("/messages/url/:ticketId", isAuth, checkPermission("tickets.update"), MessageController.sendURLMessage);
messageRoutes.post("/messages/PIX/:ticketId", isAuth, checkPermission("tickets.update"), MessageController.sendPIXMessage);
messageRoutes.post('/messages/:messageId/reactions', isAuth, checkPermission("tickets.update"), MessageController.addReaction);
messageRoutes.post('/message/forward', isAuth, checkPermission("tickets.update"), MessageController.forwardMessage);
messageRoutes.post('/message/forward-external', isAuth, checkPermission("tickets.update"), MessageController.forwardToExternalNumber);
messageRoutes.post('/messages/:ticketId/sync', isAuth, checkPermission("tickets.update"), MessageController.syncMessages);
messageRoutes.post('/messages/:ticketId/import-history', isAuth, checkPermission("tickets.update"), MessageController.importHistory);
messageRoutes.post('/messages/:ticketId/resync', isAuth, checkPermission("tickets.update"), MessageController.resyncTicketHistory);
messageRoutes.get('/messages/:ticketId/search', isAuth, checkPermission("tickets.view"), MessageController.searchMessages);
messageRoutes.get('/messages/:ticketId/pinned', isAuth, checkPermission("tickets.view"), MessageController.listPinnedMessages);
messageRoutes.get('/messages/:ticketId/media', isAuth, checkPermission("tickets.view"), MessageController.listSharedMedia);
messageRoutes.post('/messages/:messageId/pin', isAuth, checkPermission("tickets.update"), MessageController.pinMessage);
messageRoutes.post('/messages/:ticketId/clear', isAuth, checkPermission("tickets.delete"), MessageController.clearTicketMessages);

// Rotas genéricas com parâmetros dinâmicos devem vir por último
messageRoutes.get("/messages/:ticketId", listMessagesRateLimit, isAuth, checkPermission("tickets.view"), MessageController.index);
messageRoutes.post("/messages/:ticketId", messageRateLimit, isAuth, checkPermission("tickets.update"), upload.array("medias"), MessageController.store);
messageRoutes.delete("/messages/:messageId", isAuth, checkPermission("tickets.delete"), MessageController.remove);

export default messageRoutes;
