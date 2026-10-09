import { Op } from "sequelize";
import Campaign from "../models/Campaign";
import CampaignShipping from "../models/CampaignShipping";
import ContactTag from "../models/ContactTag";
import { withCache } from "../utils/serviceCache";
import logger from "../utils/logger";

/**
 * Remove as "tags de controle de campanha" (campaignTagId) do contato quando
 * ele responde uma mensagem — cobre tickets que saem do status "campaign"
 * e também campanhas com statusTicket=closed, cujo ticket não passa por lá.
 * Não filtra por status da campanha: a resposta significa "saiu da campanha"
 * mesmo se ela já foi cancelada/finalizada entre o disparo e a resposta.
 */
const removeCampaignMarkerTags = async (
  contactId: number,
  companyId: number
): Promise<void> => {
  if (!contactId) return;

  try {
    // Cache curto (10s) da lista de tags marcadoras configuradas — evita uma
    // query extra a cada mensagem recebida quando nenhuma campanha usa o recurso
    const taggedCampaigns = await withCache(
      `taggedMarkerCampaigns:${companyId}`,
      async () =>
        Campaign.findAll({
          where: {
            companyId,
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

/**
 * Limpa em massa a tag de controle de todos os contatos que receberam disparo
 * da campanha — usada no encerramento definitivo (finalização ou cancelamento).
 */
export const clearCampaignMarkerTags = async (
  campaignId: number,
  companyId: number,
  campaignTagId: number | null | undefined
): Promise<void> => {
  if (!campaignTagId) return;

  try {
    const shippings = await CampaignShipping.findAll({
      where: { campaignId, contactId: { [Op.ne]: null } },
      attributes: ["contactId"],
      raw: true
    });
    const contactIds = Array.from(
      new Set(
        shippings
          .map((s: any) => Number(s.contactId))
          .filter((n: number) => Number.isInteger(n))
      )
    );
    if (contactIds.length) {
      await ContactTag.destroy({
        where: {
          companyId,
          tagId: campaignTagId,
          contactId: { [Op.in]: contactIds }
        }
      });
    }
  } catch (e) {
    logger.warn(
      `[clearCampaignMarkerTags] Falha ao limpar tag ${campaignTagId} da campanha ${campaignId}: ${e}`
    );
  }
};

export default removeCampaignMarkerTags;
