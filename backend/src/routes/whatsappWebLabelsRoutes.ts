import express from "express";
import isAuth from "../middleware/isAuth";
import { 
  getDeviceLabelsWWeb, 
  getContactsByLabelWWeb, 
  getLabelsStatusWWeb,
  getLabelsProgressWWeb,
  cancelLabelsOperationWWeb,
  initializeWhatsAppWebConnection
} from "../controllers/WhatsAppWebLabelsController";

const whatsappWebLabelsRoutes = express.Router();

// Buscar todas as labels do dispositivo via WhatsApp-Web.js
whatsappWebLabelsRoutes.get("/whatsapp-web/labels", isAuth, getDeviceLabelsWWeb);

// Buscar contatos de uma label específica via WhatsApp-Web.js
whatsappWebLabelsRoutes.get("/whatsapp-web/labels/:labelId/contacts", isAuth, getContactsByLabelWWeb);

// Verificar status da conexão WhatsApp-Web.js
whatsappWebLabelsRoutes.get("/whatsapp-web/status", isAuth, getLabelsStatusWWeb);

// Progresso do carregamento de labels
whatsappWebLabelsRoutes.get("/whatsapp-web/labels/progress", isAuth, getLabelsProgressWWeb);

// Cancelar operação de labels
whatsappWebLabelsRoutes.get("/whatsapp-web/labels/cancel", isAuth, cancelLabelsOperationWWeb);

// Inicializar conexão WhatsApp-Web.js
whatsappWebLabelsRoutes.post("/whatsapp-web/initialize", isAuth, initializeWhatsAppWebConnection);

export default whatsappWebLabelsRoutes;
