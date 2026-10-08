import { Op } from "sequelize";
import Campaign from "../models/Campaign";
import ContactTag from "../models/ContactTag";
import { withCache } from "../utils/serviceCache";
import logger from "../utils/logger";

/**
 * Remove as "tags de controle de campanha" (campaignTagId) do contato quando
 * ele responde uma mensagem — cobre tickets que saem do status "campaign"
 * e também campanhas com statusTicket=closed, cujo ticket não passa por lá.
 * Só considera campanhas EM_ANDAMENTO: marcas de campanhas finalizadas são
 * limpas em massa no finalizeCampaignRun.
 */
const removeCampaignMarkerTags = async (
  contactId: number,
  companyId: number
): Promise<void> => {
  if (!contactId) return;

  try {
    // Cache curto (10s) da lista de tags de campanhas ativas — evita uma
    // query extra a cada mensagem recebida quando nenhuma campanha usa o recurso
    const taggedCampaigns = await withCache(
      `taggedActiveCampaigns:${companyId}`,
      async () =>
        Campaign.findAll({
          where: {
            companyId,
            status: "EM_ANDAMENTO",
            campaignTagId: { [Op.ne]: null }
          },
          attributes: ["campaignTagId"],
          raw: true
        }),
      10 * 1000
    );

    const tagIds = (taggedCampaigns || [])
      .map((c: any) => Number(c.campaignTagId))
      .filter((n: number) => Number.isInteger(n) && n > 0);
    if (!tagIds.length) return;

    await ContactTag.destroy({
      where: { contactId, companyId, tagId: { [Op.in]: tagIds } }
    });
  } catch (err) {
    logger.warn(
      `[removeCampaignMarkerTags] Falha ao remover tag de campanha do contato ${contactId}: ${err}`
    );
  }
};

export default removeCampaignMarkerTags;
