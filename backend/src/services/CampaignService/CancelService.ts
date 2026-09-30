import { Op } from "sequelize";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import AppError from "../../errors/AppError";
import { campaignQueue } from "../../queues";

export async function CancelService(id: number, companyId: number) {
  // N2 (IDOR): valida tenant antes de cancelar (e evita 500 em id inexistente)
  const campaign = await Campaign.findOne({ where: { id, companyId } });
  if (!campaign) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }
  await campaign.update({ status: "CANCELADA" });

  const recordsToCancel = await CampaignShipping.findAll({
    where: {
      campaignId: campaign.id,
      jobId: { [Op.not]: null },
      deliveredAt: null
    }
  });

  const promises = [];

  for (let record of recordsToCancel) {
    const job = await campaignQueue.getJob(+record.jobId);
    if (job) {
      promises.push(job.remove());
    }
  }

  await Promise.all(promises);
}
