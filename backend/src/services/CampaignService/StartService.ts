import Campaign from "../../models/Campaign";
import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import { campaignQueue } from "../../queues";
import logger from "../../utils/logger";

// Extrai IDs numéricos de campo que pode vir como array ou JSON string
const toIdList = (value: any): number[] => {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) {
    return value.map(Number).filter((n: number) => Number.isInteger(n));
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(Number).filter((n: number) => Number.isInteger(n));
      }
    } catch { /* valor escalar */ }
  }
  const n = Number(value);
  return Number.isInteger(n) ? [n] : [];
};

/**
 * Inicia uma campanha parada (INATIVA), antecipa uma PROGRAMADA ou
 * retoma uma CANCELADA, validando os pré-requisitos de envio antes
 * de enfileirar o processamento.
 */
export async function StartService(id: number, companyId: number) {
  // N2 (IDOR): só inicia campanha do próprio tenant
  const campaign = await Campaign.findOne({ where: { id, companyId } });

  if (!campaign) {
    throw new AppError("Campanha não encontrada", 404);
  }

  if (!["INATIVA", "PROGRAMADA", "CANCELADA"].includes(campaign.status)) {
    throw new AppError(
      "A campanha só pode ser iniciada quando Inativa, Programada ou Pausada",
      400
    );
  }

  // Pré-requisito: lista de contatos
  const contactListIds = toIdList((campaign as any).contactListIds);
  if (!campaign.contactListId && contactListIds.length === 0) {
    throw new AppError("Selecione uma lista de contatos antes de iniciar a campanha", 400);
  }

  // Pré-requisito: conexão de envio
  const allowedWhatsappIds = toIdList((campaign as any).allowedWhatsappIds);
  if (!campaign.whatsappId && allowedWhatsappIds.length === 0) {
    throw new AppError("Selecione uma conexão WhatsApp antes de iniciar a campanha", 400);
  }

  const candidateWhatsappIds = campaign.whatsappId
    ? [campaign.whatsappId]
    : allowedWhatsappIds;

  const whatsapps = await Whatsapp.findAll({
    where: { id: candidateWhatsappIds, companyId },
    attributes: ["id", "channelType", "status"]
  });

  if (whatsapps.length === 0) {
    throw new AppError("Nenhuma conexão WhatsApp válida para esta campanha", 400);
  }

  const hasOfficial = whatsapps.some(w => w.channelType === "official");

  // API Oficial exige template aprovado da Meta
  if (hasOfficial && !campaign.metaTemplateName) {
    throw new AppError(
      "Campanhas na API Oficial exigem a seleção de um template aprovado da Meta",
      400
    );
  }

  // Canais não-oficiais exigem mensagem ou mídia
  const hasMessage = [1, 2, 3, 4, 5].some(i => {
    const msg = (campaign as any)[`message${i}`];
    return typeof msg === "string" && msg.trim().length > 0;
  });
  const hasMedia =
    Boolean(campaign.mediaPath || campaign.mediaName) ||
    [1, 2, 3, 4, 5].some(i => Boolean((campaign as any)[`mediaUrl${i}`]));

  if (!hasOfficial && !hasMessage && !hasMedia) {
    throw new AppError(
      "Defina ao menos uma mensagem ou anexo antes de iniciar a campanha",
      400
    );
  }

  // scheduledAt é a base do pacing dos envios; "iniciar agora" = agora.
  await campaign.update({
    status: "EM_ANDAMENTO",
    scheduledAt: new Date(),
    completedAt: null
  });

  await campaignQueue.add(
    "ProcessCampaign",
    { id: campaign.id, delay: 3000 },
    { delay: 3000, removeOnComplete: true }
  );

  logger.info(`[START CAMPAIGN] Campanha ${id} iniciada (status anterior validado, empresa ${companyId})`);

  return campaign;
}

export default StartService;
