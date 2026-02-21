import { Request, Response } from "express";
import { removeWbot } from "../libs/wbot";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { StartWhatsAppSessionUnified as StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSessionUnified";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import cacheLayer from "../libs/cache";
import Whatsapp from "../models/Whatsapp";
import ClearContactSessionService from "../services/WbotServices/ClearContactSessionService";
import { acquireWbotLock } from "../libs/wbotMutex";
import logger from "../utils/logger";

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

  const clearAuth =
    (req.body as any)?.clearAuth === true ||
    String((req.query as any)?.clearAuth || "").toLowerCase() === "true" ||
    String((req.query as any)?.clearAuth || "") === "1";

  // const { whatsapp } = await UpdateWhatsAppService({
  //   whatsappId,
  //   companyId,
  //   whatsappData: { session: "", requestQR: true }
  // });
  const whatsapp = await Whatsapp.findOne({ where: { id: whatsappId, companyId } });

  if (!whatsapp) {
    return res.status(404).json({ error: "WhatsApp não encontrado" });
  }

  const channelType = (whatsapp as any)?.channelType || "baileys";
  if (clearAuth && (whatsapp as any)?.channel === "whatsapp" && channelType === "baileys") {
    const hasLock = await acquireWbotLock(whatsapp.id);
    if (!hasLock) {
      return res.status(409).json({
        error: "Sessão já está sendo gerenciada por outra instância. Tente novamente em alguns segundos."
      });
    }

    logger.warn({ whatsappId: whatsapp.id, companyId }, "[whatsappsession.update] Limpando auth state (clearAuth=true) antes de gerar novo QR");

    try {
      await removeWbot(Number(whatsappId), true);
    } catch { }

    await DeleteBaileysService(whatsappId);
    await cacheLayer.delFromPattern(`sessions:${whatsappId}:*`);
  }

  await whatsapp.update({ session: "" });

  if (whatsapp.channel === "whatsapp") {
    await StartWhatsAppSession(whatsapp, companyId);
  }

  return res.status(200).json({ message: "Starting session." });
};

import { getIO } from "../libs/socket";

const remove = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  console.log("DISCONNECTING SESSION", whatsappId)
  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);


  if (whatsapp.channel === "whatsapp") {
    await DeleteBaileysService(whatsappId);

    try {
      await removeWbot(Number(whatsappId), true);
    } catch { }

    // Garantir limpeza total do Redis
    await cacheLayer.delFromPattern(`sessions:${whatsappId}:*`);

    await whatsapp.update({ status: "DISCONNECTED", session: "" });

    const io = getIO();
    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-whatsappSession`, {
        action: "update",
        session: whatsapp
      });
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
