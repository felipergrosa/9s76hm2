import { Op, Sequelize } from "sequelize";
import sequelize from "../../database";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import ContactListItem from "../../models/ContactListItem";
import Whatsapp from "../../models/Whatsapp";
import ContactList from "../../models/ContactList";

interface ReportFilters {
  status?: string; // pending, processing, delivered, failed, suppressed
  search?: string;
  pageNumber?: string;
}

interface DetailedReportResponse {
  campaign: Campaign;
  summary: {
    total: number;
    pending: number;
    processing: number;
    delivered: number;
    failed: number;
    suppressed: number;
    confirmationRequested: number;
    confirmed: number;
  };
  records: any[];
  count: number;
  hasMore: boolean;
}

const GetDetailedReportService = async (
  campaignId: number,
  filters: ReportFilters = {}
): Promise<DetailedReportResponse> => {
  const { status, search, pageNumber = "1" } = filters;
  
  const limit = 50;
  const offset = limit * (+pageNumber - 1);

  // Busca a campanha com suas relações
  const campaign = await Campaign.findByPk(campaignId, {
    include: [
      { model: ContactList },
      { model: Whatsapp, attributes: ["id", "name"] }
    ]
  });

  if (!campaign) {
    throw new Error("Campanha não encontrada");
  }

  // Monta filtros dinâmicos
  const whereClause: any = { campaignId };

  if (status) {
    whereClause.status = status;
  }

  if (search) {
    whereClause[Op.or] = [
      { number: { [Op.like]: `%${search}%` } },
      { message: { [Op.like]: `%${search}%` } }
    ];
  }

  // Busca registros com paginação
  const { count, rows: records } = await CampaignShipping.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: ContactListItem,
        as: "contact",
        attributes: ["id", "name", "number", "email"]
      }
    ],
    limit,
    offset,
    order: [["createdAt", "DESC"]]
  });

  // Calcula sumário completo (sem filtros de status)
  const summaryData = await CampaignShipping.findAll({
    where: { campaignId },
    attributes: [
      "status",
      [Sequelize.fn("COUNT", "*"), "count"]
    ],
    group: ["status"],
    raw: true
  });

  // Contadores específicos
  const confirmationRequestedCount = await CampaignShipping.count({
    where: {
      campaignId,
      confirmationRequestedAt: { [Op.ne]: null }
    }
  });

  const confirmedCount = await CampaignShipping.count({
    where: {
      campaignId,
      confirmedAt: { [Op.ne]: null }
    }
  });

  const totalCount = await CampaignShipping.count({
    where: { campaignId }
  });

  // Monta sumário
  const summary: any = {
    total: totalCount,
    pending: 0,
    processing: 0,
    delivered: 0,
    failed: 0,
    suppressed: 0,
    confirmationRequested: confirmationRequestedCount,
    confirmed: confirmedCount
  };

  summaryData.forEach((item: any) => {
    const statusKey = item.status || "pending";
    summary[statusKey] = parseInt(item.count, 10);
  });

  return {
    campaign,
    summary,
    records,
    count,
    hasMore: count > offset + limit
  };
};

export default GetDetailedReportService;
