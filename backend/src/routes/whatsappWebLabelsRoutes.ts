import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import { 
  getDeviceLabelsWWeb, 
  getContactsByLabelWWeb, 
  getLabelsStatusWWeb, 
  getLabelsProgressWWeb, 
  cancelLabelsOperationWWeb, 
  initializeWhatsAppWebConnection, 
  getLabelsQrImageWWeb, 
  fullLabelSync 
} from "../controllers/WhatsAppWebLabelsController";

const whatsappWebLabelsRoutes = express.Router();

// Buscar todas as labels do dispositivo via WhatsApp-Web.js
whatsappWebLabelsRoutes.get("/whatsapp-web/labels", isAuth, checkPermission("tags.view"), getDeviceLabelsWWeb);

// Buscar contatos de uma label específica via WhatsApp-Web.js
whatsappWebLabelsRoutes.get("/whatsapp-web/labels/:labelId/contacts", isAuth, checkPermission("tags.view"), getContactsByLabelWWeb);

// Verificar status da conexão WhatsApp-Web.js
whatsappWebLabelsRoutes.get("/whatsapp-web/status", isAuth, checkPermission("connections.edit"), getLabelsStatusWWeb);

// Obter QR Code como imagem (DataURL PNG)
whatsappWebLabelsRoutes.get("/whatsapp-web/qr-image", isAuth, checkPermission("connections.edit"), getLabelsQrImageWWeb);

// Progresso do carregamento de labels
whatsappWebLabelsRoutes.get("/whatsapp-web/labels/progress", isAuth, checkPermission("tags.view"), getLabelsProgressWWeb);

// Cancelar operação de labels
whatsappWebLabelsRoutes.get("/whatsapp-web/labels/cancel", isAuth, checkPermission("tags.edit"), cancelLabelsOperationWWeb);

// Inicializar conexão WhatsApp-Web.js
whatsappWebLabelsRoutes.post("/whatsapp-web/initialize", isAuth, checkPermission("connections.edit"), initializeWhatsAppWebConnection);

// Full sync de labels (Baileys + WhatsApp Web)
whatsappWebLabelsRoutes.post("/whatsapp-web/labels/full-sync", isAuth, checkPermission("tags.edit"), fullLabelSync);

export default whatsappWebLabelsRoutes;
