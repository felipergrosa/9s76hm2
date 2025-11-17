import { Op, Sequelize } from "sequelize";
import sequelize from "../../database";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import ContactListItem from "../../models/ContactListItem";
import Whatsapp from "../../models/Whatsapp";
import ContactList from "../../models/ContactList";
import logger from "../../utils/logger";
import { CalculateCampaignCost } from "./CalculateCostService";

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
  whatsappUsage: Array<{
    whatsappId: number | null;
    name: string | null;
    total: number;
    delivered: number;
    failed: number;
  }>;
  cost?: {
    totalMessages: number;
    deliveredMessages: number;
    freeUsed: number;
    chargeableMessages: number;
    costPerMessage: number;
    totalCost: number;
    currency: string;
    monthlyFreeLimit: number;
    remainingFree: number;
  } | null;
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

  let whatsappUsage = [] as Array<{
    whatsappId: number | null;
    name: string | null;
    total: number;
    delivered: number;
    failed: number;
  }>;

  try {
    const whatsappUsageRaw = await CampaignShipping.findAll({
      where: { campaignId },
      attributes: [
        "whatsappId",
        [Sequelize.fn("COUNT", Sequelize.col("CampaignShipping.id")), "total"],
        [
          Sequelize.fn(
            "SUM",
            Sequelize.literal("CASE WHEN status = 'delivered' THEN 1 ELSE 0 END")
          ),
          "delivered"
        ],
        [
          Sequelize.fn(
            "SUM",
            Sequelize.literal("CASE WHEN status = 'failed' THEN 1 ELSE 0 END")
          ),
          "failed"
        ]
      ],
      group: [Sequelize.col("CampaignShipping.whatsappId")],
      raw: true
    });

    const whatsappIds = whatsappUsageRaw
      .map((item: any) => item.whatsappId)
      .filter((id: number | null | undefined) => id !== null && id !== undefined);

    let whatsappNameMap = new Map<number, string>();
    if (whatsappIds.length > 0) {
      const whatsapps = await Whatsapp.findAll({
        where: { id: whatsappIds },
        attributes: ["id", "name"],
        raw: true
      });
      whatsappNameMap = new Map<number, string>(
        whatsapps.map((item: any) => [Number(item.id), item.name])
      );
    }

    whatsappUsage = whatsappUsageRaw.map((item: any) => {
      const whatsappId = item.whatsappId !== null ? Number(item.whatsappId) : null;
      return {
        whatsappId,
        name: whatsappId !== null ? whatsappNameMap.get(whatsappId) || null : null,
        total: Number(item.total) || 0,
        delivered: Number(item.delivered) || 0,
        failed: Number(item.failed) || 0,
      };
    });
  } catch (error) {
    logger.warn("[GetDetailedReportService] whatsappId column not available, skipping usage aggregation", {
      campaignId,
      error: error.message
    });
    // Se a coluna não existir (versão antiga do banco), retornamos lista vazia
    whatsappUsage = [];
  }

  // Calcular custo se for API Oficial
  let cost = null;
  try {
    cost = await CalculateCampaignCost(campaignId);
  } catch (error) {
    logger.warn("[GetDetailedReportService] Erro ao calcular custo", { error });
  }

  return {
    campaign,
    summary,
    whatsappUsage,
    cost,
    records,
    count,
    hasMore: count > offset + limit
  };
};

export default GetDetailedReportService;
