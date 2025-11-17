import { Request, Response } from "express";
import { getWbot } from "../libs/wbot";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import cacheLayer from "../libs/cache";
import Whatsapp from "../models/Whatsapp";
import logger from "../utils/logger";

// Map para controlar requisições em andamento por whatsappId
const pendingSessions = new Map<number, Promise<void>>();

const store = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsappIdNum = parseInt(whatsappId, 10);

  // Verificar se já há uma sessão sendo iniciada para este WhatsApp
  if (pendingSessions.has(whatsappIdNum)) {
    logger.warn(`[WhatsAppSessionController] Sessão já está sendo iniciada para whatsappId=${whatsappIdNum}. Ignorando requisição duplicada.`);
    return res.status(200).json({ message: "Session is already starting." });
  }

  // Verificar se já existe uma sessão ativa
  try {
    const wbot = getWbot(whatsappIdNum);
    if (wbot && wbot.user?.id) {
      logger.info(`[WhatsAppSessionController] Sessão já está ativa para whatsappId=${whatsappIdNum}. Ignorando requisição.`);
      return res.status(200).json({ message: "Session is already active." });
    }
  } catch (err) {
    // Não há sessão ativa, pode prosseguir
  }

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

  // Criar promise para a sessão e adicionar ao map
  const sessionPromise = StartWhatsAppSession(whatsapp, companyId)
    .finally(() => {
      // Remover do map após completar (sucesso ou erro)
      pendingSessions.delete(whatsappIdNum);
    });

  pendingSessions.set(whatsappIdNum, sessionPromise);

  // Não esperar pela conclusão para responder ao cliente
  sessionPromise.catch(err => {
    logger.error(`[WhatsAppSessionController] Erro ao iniciar sessão para whatsappId=${whatsappIdNum}: ${err?.message}`);
  });

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

export default { store, remove, update };
