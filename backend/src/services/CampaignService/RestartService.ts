import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import AppError from "../../errors/AppError";
import { campaignQueue } from "../../queues";
import { Op } from "sequelize";
import logger from "../../utils/logger";

export async function RestartService(id: number, companyId: number) {
  // N2 (IDOR): só reinicia campanha do próprio tenant
  const campaign = await Campaign.findOne({ where: { id, companyId } });

  if (!campaign) {
    throw new AppError("Campanha não encontrada", 404);
  }

  // Log detalhado da campanha
  logger.info(`[RESTART CAMPAIGN] ID=${id} | contactListId: ${campaign.contactListId} | whatsappId: ${campaign.whatsappId} | status: ${campaign.status}`);

  // Verifica quantos contatos já foram processados
  const totalShipped = await CampaignShipping.count({
    where: {
      campaignId: campaign.id,
      deliveredAt: { [Op.ne]: null }
    }
  });

  const totalContacts = await CampaignShipping.count({
    where: { campaignId: campaign.id }
  });

  logger.info(`[RESTART CAMPAIGN] ID=${id} | Enviados: ${totalShipped}/${totalContacts}`);

  // Atualiza status para EM_ANDAMENTO e normaliza scheduledAt:
  // o pacing dos envios usa scheduledAt como base; mantê-lo no futuro
  // atrasaria o retomar/iniciar-para-agora até a data antiga.
  await campaign.update({ status: "EM_ANDAMENTO", scheduledAt: new Date() });

  // Reprocessa a campanha - o sistema automaticamente pula os já enviados
  await campaignQueue.add("ProcessCampaign", {
    id: campaign.id,
    delay: 3000
  });

  logger.info(`[RESTART CAMPAIGN] Campanha ${id} reiniciada com sucesso`);
}
