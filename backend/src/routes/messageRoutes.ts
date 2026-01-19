import { NextFunction, Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";

import * as MessageController from "../controllers/MessageController";

const messageRoutes = Router();

const upload = multer(uploadConfig);

// IMPORTANTE: rotas específicas devem vir ANTES das rotas com parâmetros dinâmicos
messageRoutes.get("/messages-allMe", isAuth, MessageController.allMe);
messageRoutes.post("/messages/edit/:messageId", isAuth, MessageController.edit);
messageRoutes.get("/messages/transcribeAudio/:fileName", isAuth, MessageController.transcribeAudioMessage);
messageRoutes.post("/messages/lista/:ticketId", isAuth, MessageController.sendListMessage);
messageRoutes.post("/messages/copy/:ticketId", isAuth, MessageController.sendCopyMessage);
messageRoutes.post("/messages/call/:ticketId", isAuth, MessageController.sendCALLMessage);
messageRoutes.post("/messages/url/:ticketId", isAuth, MessageController.sendURLMessage);
messageRoutes.post("/messages/PIX/:ticketId", isAuth, MessageController.sendPIXMessage);
messageRoutes.post('/messages/:messageId/reactions', isAuth, MessageController.addReaction);
messageRoutes.post('/message/forward', isAuth, MessageController.forwardMessage);
messageRoutes.post('/message/forward-external', isAuth, MessageController.forwardToExternalNumber);

// Rotas genéricas com parâmetros dinâmicos devem vir por último
messageRoutes.get("/messages/:ticketId", isAuth, MessageController.index);
messageRoutes.post("/messages/:ticketId", isAuth, upload.array("medias"), MessageController.store);
messageRoutes.delete("/messages/:messageId", isAuth, MessageController.remove);

export default messageRoutes;
