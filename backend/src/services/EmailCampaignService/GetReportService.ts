import EmailShipping from "../../models/EmailShipping";

interface Response {
  total: number;
  pending: number;
  processing: number;
  delivered: number;
  failed: number;
}

const GetReportService = async (emailCampaignId: string | number): Promise<Response> => {
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
