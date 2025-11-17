import { Op, Sequelize } from "sequelize";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import Whatsapp from "../../models/Whatsapp";
import moment from "moment";

// Tabela de preços Meta (Brasil) - Atualizar conforme necessário
// https://developers.facebook.com/docs/whatsapp/pricing/
const META_PRICING = {
  BR: {
    freeConversations: 1000, // 1000 conversas grátis por mês
    marketingCost: 0.05, // R$ 0,05 por conversa de marketing (estimado)
    utilityCost: 0.03, // R$ 0,03 por conversa de utilidade
    serviceCost: 0.01, // R$ 0,01 por conversa de serviço
    currency: "BRL"
  }
};

interface CostCalculation {
  campaignId: number;
  campaignName: string;
  whatsappId: number;
  whatsappName: string;
  channelType: string;
  
  // Contadores
  totalMessages: number;
  deliveredMessages: number;
  
  // Custo
  freeUsed: number; // Quantos dos 1000 grátis foram usados
  chargeableMessages: number; // Mensagens cobradas
  costPerMessage: number; // Custo unitário
  totalCost: number; // Custo total da campanha
  currency: string;
  
  // Meta
  monthlyFreeLimit: number;
  monthlyUsedSoFar: number; // Total usado no mês (todas as campanhas)
  remainingFree: number; // Quantos ainda tem grátis no mês
}

interface MonthlyReport {
  month: string; // YYYY-MM
  companyId: number;
  
  // Resumo geral
  totalCampaigns: number;
  totalMessages: number;
  totalDelivered: number;
  
  // Custo
  freeLimit: number;
  totalUsed: number;
  chargeableMessages: number;
  totalCost: number;
  currency: string;
  
  // Por WhatsApp
  whatsapps: Array<{
    whatsappId: number;
    whatsappName: string;
    channelType: string;
    totalMessages: number;
    deliveredMessages: number;
    freeUsed: number;
    chargeableMessages: number;
    totalCost: number;
  }>;
  
  // Por Campanha
  campaigns: CostCalculation[];
}

/**
 * Calcula custo de uma campanha específica
 */
export const CalculateCampaignCost = async (
  campaignId: number
): Promise<CostCalculation | null> => {
  const campaign = await Campaign.findByPk(campaignId, {
    include: [
      {
        model: Whatsapp,
        attributes: ["id", "name", "channelType"]
      }
    ]
  });

  if (!campaign) {
    throw new Error("Campanha não encontrada");
  }

  const whatsapp = campaign.whatsapp;
  if (!whatsapp || whatsapp.channelType !== "official") {
    return null; // Não cobra Baileys
  }

  // Buscar envios da campanha
  const shippings: any = await CampaignShipping.findAll({
    where: {
      campaignId,
      whatsappId: whatsapp.id
    },
    attributes: [
      [Sequelize.fn("COUNT", "*"), "total"],
      [
        Sequelize.fn(
          "SUM",
          Sequelize.literal("CASE WHEN status = 'delivered' THEN 1 ELSE 0 END")
        ),
        "delivered"
      ]
    ],
    raw: true
  });

  const totalMessages = parseInt(shippings[0]?.total || "0", 10);
  const deliveredMessages = parseInt(shippings[0]?.delivered || "0", 10);

  // Buscar uso do mês até esta campanha
  const campaignDate = moment(campaign.createdAt);
  const monthStart = campaignDate.clone().startOf("month").toDate();
  const monthEnd = campaignDate.clone().endOf("month").toDate();

  // Campanhas anteriores no mesmo mês
  const previousCampaigns = await Campaign.findAll({
    where: {
      companyId: campaign.companyId,
      whatsappId: whatsapp.id,
      createdAt: {
        [Op.gte]: monthStart,
        [Op.lt]: campaign.createdAt // Antes desta campanha
      },
      status: {
        [Op.in]: ["FINALIZADA", "EM_ANDAMENTO", "PAUSADA"]
      }
    },
    attributes: ["id"]
  });

  const previousCampaignIds = previousCampaigns.map(c => c.id);

  let monthlyUsedBefore = 0;
  if (previousCampaignIds.length > 0) {
    const previousShippings: any = await CampaignShipping.findAll({
      where: {
        campaignId: previousCampaignIds,
        status: "delivered"
      },
      attributes: [
        [Sequelize.fn("COUNT", "*"), "total"]
      ],
      raw: true
    });
    monthlyUsedBefore = parseInt(previousShippings[0]?.total || "0", 10);
  }

  const pricing = META_PRICING.BR;
  const freeLimit = pricing.freeConversations;
  const remainingFreeBefore = Math.max(0, freeLimit - monthlyUsedBefore);

  // Calcular quanto desta campanha usa o grátis
  const freeUsed = Math.min(deliveredMessages, remainingFreeBefore);
  const chargeableMessages = Math.max(0, deliveredMessages - freeUsed);

  // Custo (assumindo marketing)
  const costPerMessage = pricing.marketingCost;
  const totalCost = chargeableMessages * costPerMessage;

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    whatsappId: whatsapp.id,
    whatsappName: whatsapp.name,
    channelType: whatsapp.channelType,
    
    totalMessages,
    deliveredMessages,
    
    freeUsed,
    chargeableMessages,
    costPerMessage,
    totalCost,
    currency: pricing.currency,
    
    monthlyFreeLimit: freeLimit,
    monthlyUsedSoFar: monthlyUsedBefore + deliveredMessages,
    remainingFree: Math.max(0, freeLimit - (monthlyUsedBefore + deliveredMessages))
  };
};

/**
 * Relatório mensal de custos
 */
export const CalculateMonthlyCost = async (
  companyId: number,
  month: string // YYYY-MM
): Promise<MonthlyReport> => {
  const monthStart = moment(month, "YYYY-MM").startOf("month").toDate();
  const monthEnd = moment(month, "YYYY-MM").endOf("month").toDate();

  // Buscar campanhas do mês
  const campaigns = await Campaign.findAll({
    where: {
      companyId,
      createdAt: {
        [Op.gte]: monthStart,
        [Op.lte]: monthEnd
      },
      status: {
        [Op.in]: ["FINALIZADA", "EM_ANDAMENTO", "PAUSADA"]
      }
    },
    include: [
      {
        model: Whatsapp,
        attributes: ["id", "name", "channelType"]
      }
    ],
    order: [["createdAt", "ASC"]]
  });

  const officialCampaigns = campaigns.filter(c => c.whatsapp?.channelType === "official");

  // Calcular custo de cada campanha
  const campaignCosts: CostCalculation[] = [];
  let accumulatedMessages = 0;
  const pricing = META_PRICING.BR;

  for (const campaign of officialCampaigns) {
    const shippings: any = await CampaignShipping.findAll({
      where: {
        campaignId: campaign.id,
        status: "delivered"
      },
      attributes: [
        [Sequelize.fn("COUNT", "*"), "total"]
      ],
      raw: true
    });

    const deliveredMessages = parseInt(shippings[0]?.total || "0", 10);
    const remainingFree = Math.max(0, pricing.freeConversations - accumulatedMessages);
    const freeUsed = Math.min(deliveredMessages, remainingFree);
    const chargeableMessages = Math.max(0, deliveredMessages - freeUsed);
    const totalCost = chargeableMessages * pricing.marketingCost;

    campaignCosts.push({
      campaignId: campaign.id,
      campaignName: campaign.name,
      whatsappId: campaign.whatsapp!.id,
      whatsappName: campaign.whatsapp!.name,
      channelType: campaign.whatsapp!.channelType,
      
      totalMessages: deliveredMessages,
      deliveredMessages,
      
      freeUsed,
      chargeableMessages,
      costPerMessage: pricing.marketingCost,
      totalCost,
      currency: pricing.currency,
      
      monthlyFreeLimit: pricing.freeConversations,
      monthlyUsedSoFar: accumulatedMessages + deliveredMessages,
      remainingFree: Math.max(0, pricing.freeConversations - (accumulatedMessages + deliveredMessages))
    });

    accumulatedMessages += deliveredMessages;
  }

  // Agrupar por WhatsApp
  const whatsappMap = new Map<number, any>();
  campaignCosts.forEach(cost => {
    if (!whatsappMap.has(cost.whatsappId)) {
      whatsappMap.set(cost.whatsappId, {
        whatsappId: cost.whatsappId,
        whatsappName: cost.whatsappName,
        channelType: cost.channelType,
        totalMessages: 0,
        deliveredMessages: 0,
        freeUsed: 0,
        chargeableMessages: 0,
        totalCost: 0
      });
    }
    const wa = whatsappMap.get(cost.whatsappId)!;
    wa.totalMessages += cost.totalMessages;
    wa.deliveredMessages += cost.deliveredMessages;
    wa.freeUsed += cost.freeUsed;
    wa.chargeableMessages += cost.chargeableMessages;
    wa.totalCost += cost.totalCost;
  });

  const totalChargeableMessages = campaignCosts.reduce((sum, c) => sum + c.chargeableMessages, 0);
  const totalCost = campaignCosts.reduce((sum, c) => sum + c.totalCost, 0);

  return {
    month,
    companyId,
    
    totalCampaigns: officialCampaigns.length,
    totalMessages: accumulatedMessages,
    totalDelivered: accumulatedMessages,
    
    freeLimit: pricing.freeConversations,
    totalUsed: accumulatedMessages,
    chargeableMessages: totalChargeableMessages,
    totalCost,
    currency: pricing.currency,
    
    whatsapps: Array.from(whatsappMap.values()),
    campaigns: campaignCosts
  };
};

export default {
  CalculateCampaignCost,
  CalculateMonthlyCost
};
