import EmailCampaign from "../../models/EmailCampaign";
import EmailShipping from "../../models/EmailShipping";
import AppError from "../../errors/AppError";

interface Response {
  total: number;
  pending: number;
  processing: number;
  delivered: number;
  failed: number;
}

const GetReportService = async (
  emailCampaignId: string | number,
  companyId: number
): Promise<Response> => {
  // N2 (IDOR): garante que a campanha pertence ao tenant antes de expor o relatório
  const campaign = await EmailCampaign.findOne({
    where: { id: emailCampaignId, companyId }
  });
  if (!campaign) {
    throw new AppError("Campanha de e-mail não encontrada", 404);
  }

  const shippings = await EmailShipping.findAll({
    where: { emailCampaignId },
    attributes: ["status"]
  });

  const report: Response = {
    total: shippings.length,
    pending: 0,
    processing: 0,
    delivered: 0,
    failed: 0
  };

  shippings.forEach(shipping => {
    if (shipping.status in report) {
      (report as any)[shipping.status] += 1;
    }
  });

  return report;
};

export default GetReportService;
