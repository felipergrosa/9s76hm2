import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as WhatsAppController from "../controllers/WhatsAppController";
import * as MetaController from "../controllers/MetaController";

import multer from "multer";
import uploadConfig from "../config/upload";
import { mediaUpload } from "../services/WhatsappService/uploadMediaAttachment";
import { deleteMedia } from "../services/WhatsappService/uploadMediaAttachment";

const upload = multer(uploadConfig);


const whatsappRoutes = express.Router();

whatsappRoutes.get("/whatsapp/", isAuth, checkPermission("connections.view"), WhatsAppController.index);
whatsappRoutes.get("/whatsapp/filter", isAuth, checkPermission("connections.view"), WhatsAppController.indexFilter);
whatsappRoutes.get("/whatsapp/all", isAuth, checkPermission("connections.view"), WhatsAppController.listAll);

whatsappRoutes.post("/whatsapp/", isAuth, checkPermission("connections.create"), WhatsAppController.store);
whatsappRoutes.post("/facebook/", isAuth, checkPermission("connections.create"), WhatsAppController.storeFacebook);
whatsappRoutes.get("/whatsapp/:whatsappId", isAuth, checkPermission("connections.view"), WhatsAppController.show);
whatsappRoutes.put("/whatsapp/:whatsappId", isAuth, checkPermission("connections.edit"), WhatsAppController.update);
whatsappRoutes.delete("/whatsapp/:whatsappId", isAuth, checkPermission("connections.delete"), WhatsAppController.remove);
whatsappRoutes.post("/closedimported/:whatsappId", isAuth, checkPermission("connections.edit"), WhatsAppController.closedTickets);

//restart
whatsappRoutes.post("/whatsapp-restart/", isAuth, checkPermission("connections.edit"), WhatsAppController.restart);
whatsappRoutes.post("/whatsapp/:whatsappId/media-upload", isAuth, checkPermission("connections.edit"), upload.array("file"), mediaUpload);

whatsappRoutes.delete("/whatsapp/:whatsappId/media-upload", isAuth, checkPermission("connections.edit"), deleteMedia);


whatsappRoutes.delete("/whatsapp-admin/:whatsappId", isAuth, checkPermission("connections.delete"), WhatsAppController.remove);

whatsappRoutes.put("/whatsapp-admin/:whatsappId", isAuth, checkPermission("connections.edit"), WhatsAppController.updateAdmin);

whatsappRoutes.get("/whatsapp-admin/:whatsappId", isAuth, checkPermission("connections.view"), WhatsAppController.showAdmin);

// Meta API Official - Templates
whatsappRoutes.get("/whatsapp/:whatsappId/templates", isAuth, checkPermission("connections.view"), MetaController.getTemplates);
whatsappRoutes.get("/whatsapp/:whatsappId/session-window", isAuth, checkPermission("connections.view"), MetaController.getSessionWindow);
whatsappRoutes.post("/whatsapp/:whatsappId/send-template-to-contact", isAuth, checkPermission("tickets.create"), MetaController.sendTemplateToContact);

export default whatsappRoutes;
