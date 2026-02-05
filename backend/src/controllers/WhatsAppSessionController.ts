import { Request, Response } from "express";
import { getWbot } from "../libs/wbot";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { StartWhatsAppSessionUnified as StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSessionUnified";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import cacheLayer from "../libs/cache";
import Whatsapp from "../models/Whatsapp";
import ClearContactSessionService from "../services/WbotServices/ClearContactSessionService";

const store = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  // console.log("STARTING SESSION", whatsappId)
  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);
  await StartWhatsAppSession(whatsapp, companyId);


  return res.status(200).json({ message: "Starting session." });
};

const update = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  // const { whatsapp } = await UpdateWhatsAppService({
  //   whatsappId,
  //   companyId,
  //   whatsappData: { session: "", requestQR: true }
  // });
  const whatsapp = await Whatsapp.findOne({ where: { id: whatsappId, companyId } });

  await whatsapp.update({ session: "" });

  if (whatsapp.channel === "whatsapp") {
    await StartWhatsAppSession(whatsapp, companyId);
  }

  return res.status(200).json({ message: "Starting session." });
};

const remove = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  console.log("DISCONNECTING SESSION", whatsappId)
  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);


  if (whatsapp.channel === "whatsapp") {
    await DeleteBaileysService(whatsappId);

    const wbot = getWbot(whatsapp.id);

    wbot.logout();
    wbot.ws.close();
  }

  return res.status(200).json({ message: "Session disconnected." });
};

// Limpa sessão criptográfica de um contato específico (resolve Bad MAC errors)
const clearContactSession = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { contactJid } = req.body;
  const { companyId } = req.user;

  if (!contactJid) {
    return res.status(400).json({ error: "contactJid é obrigatório" });
  }

  // Verificar se o WhatsApp pertence à empresa
  const whatsapp = await Whatsapp.findOne({ where: { id: whatsappId, companyId } });
  if (!whatsapp) {
    return res.status(404).json({ error: "WhatsApp não encontrado" });
  }

  const result = await ClearContactSessionService({
    whatsappId: Number(whatsappId),
    contactJid
  });

  if (result.success) {
    return res.status(200).json(result);
  } else {
    return res.status(400).json(result);
  }
};

export default { store, remove, update, clearContactSession };
