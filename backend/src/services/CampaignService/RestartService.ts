import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import { campaignQueue } from "../../queues";
import { Op } from "sequelize";
import logger from "../../utils/logger";

export async function RestartService(id: number) {
  const campaign = await Campaign.findByPk(id);
  
  if (!campaign) {
    throw new Error("Campanha não encontrada");
  }

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

  // Atualiza status para EM_ANDAMENTO
  await campaign.update({ status: "EM_ANDAMENTO" });

  // Reprocessa a campanha - o sistema automaticamente pula os já enviados
  await campaignQueue.add("ProcessCampaign", {
    id: campaign.id,
    delay: 3000
  });

  logger.info(`[RESTART CAMPAIGN] Campanha ${id} reiniciada com sucesso`);
}
