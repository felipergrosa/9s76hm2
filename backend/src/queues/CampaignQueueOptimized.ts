import BullQueue from "bull";
import { Op } from "sequelize";
import Campaign from "../models/Campaign";
import Contact from "../models/Contact";
import ContactListItem from "../models/ContactListItem";
import Whatsapp from "../models/Whatsapp";
import CacheManager from "../helpers/CacheManager";
import logger from "../utils/logger";

const connection = process.env.REDIS_URI || "";

/**
 * FILA OTIMIZADA PARA CAMPANHAS
 * 
 * Melhorias:
 * 1. Concorrência configurável (processa múltiplos jobs simultaneamente)
 * 2. Priorização (campanhas urgentes primeiro)
 * 3. Rate limiting por conexão WhatsApp
 * 4. Cache de dados da campanha (evita queries repetidas)
 * 5. Limpeza automática de jobs completados
 */

// Fila separada para campanhas (não interfere com mensagens normais)
export const campaignQueueOptimized = new BullQueue("CampaignOptimized", connection, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000
    },
    removeOnComplete: {
      age: 3600, // Remove após 1 hora
      count: 100 // Mantém apenas últimos 100
    },
    removeOnFail: {
      age: 86400, // Remove após 24 horas
      count: 50 // Mantém apenas últimos 50
    }
  },
  limiter: {
    max: 50, // Máximo 50 jobs processados por segundo
    duration: 1000
  }
});

interface ProcessCampaignJob {
  campaignId: number;
  companyId: number;
}

interface DispatchMessageJob {
  campaignId: number;
  contactId: number;
  whatsappId: number;
  messageIndex: number;
  companyId: number;
}

/**
 * Processa campanha: carrega contatos e cria jobs de envio
 * OTIMIZAÇÃO: Carrega tudo de uma vez, não faz queries N+1
 */
async function processCampaign(job: any): Promise<void> {
  const { campaignId, companyId }: ProcessCampaignJob = job.data;

  try {
    logger.info(`[CampaignOptimized] Processando campanha ${campaignId}`);

    // Busca campanha com cache (evita query repetida)
    const cacheKey = `campaign:${campaignId}`;
    const campaign = await CacheManager.getOrSet(
      cacheKey,
      async () => {
        return await Campaign.findOne({
          where: { id: campaignId, companyId },
          attributes: [
            "id", "name", "status", "message1", "message2", "message3",
            "whatsappId", "contactListId", "companyId"
          ]
        });
      },
      300 // Cache 5 minutos
    );

    if (!campaign || campaign.status !== "EM_ANDAMENTO") {
      logger.warn(`[CampaignOptimized] Campanha ${campaignId} não encontrada ou não está ativa`);
      return;
    }

    // Busca TODOS os contatos de uma vez (evita N+1)
    const contacts = await ContactListItem.findAll({
      where: { contactListId: campaign.contactListId },
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: ["id", "name", "number", "isWhatsappValid"],
          where: { isWhatsappValid: true } // Apenas contatos válidos
        }
      ],
      attributes: ["id", "contactId"]
    });

    logger.info(`[CampaignOptimized] Campanha ${campaignId}: ${contacts.length} contatos válidos`);

    if (contacts.length === 0) {
      logger.warn(`[CampaignOptimized] Campanha ${campaignId} não tem contatos válidos`);
      return;
    }

    // Calcula delay entre mensagens (evita spam)
    const baseDelay = 20000; // 20 segundos entre mensagens
    const delayIncrement = 5000; // +5s a cada 10 mensagens

    // Cria jobs de envio em lote (mais eficiente)
    const jobs = contacts.map((item, index) => {
      const delay = baseDelay + Math.floor(index / 10) * delayIncrement;
      
      return {
        name: "DispatchMessage",
        data: {
          campaignId: campaign.id,
          contactId: (item as any).contactId,
          whatsappId: campaign.whatsappId,
          messageIndex: 1,
          companyId: campaign.companyId
        } as DispatchMessageJob,
        opts: {
          delay,
          priority: 2 // Prioridade média (mensagens normais são 1)
        }
      };
    });

    // Adiciona todos os jobs de uma vez (bulk operation)
    await campaignQueueOptimized.addBulk(jobs);

    logger.info(`[CampaignOptimized] Campanha ${campaignId}: ${jobs.length} jobs criados`);
  } catch (error) {
    logger.error(`[CampaignOptimized] Erro ao processar campanha ${campaignId}:`, error);
    throw error;
  }
}

/**
 * Envia mensagem individual
 * OTIMIZAÇÃO: Usa cache para dados da campanha e whatsapp
 */
async function dispatchMessage(job: any): Promise<void> {
  const { campaignId, contactId, whatsappId, messageIndex, companyId }: DispatchMessageJob = job.data;

  try {
    // Busca dados com cache (evita queries repetidas)
    const [campaign, contact, whatsapp] = await Promise.all([
      CacheManager.getOrSet(
        `campaign:${campaignId}`,
        () => Campaign.findByPk(campaignId) as any,
        300
      ),
      CacheManager.getOrSet(
        `contact:${contactId}`,
        () => Contact.findByPk(contactId) as any,
        300
      ),
      CacheManager.getOrSet(
        `whatsapp:${whatsappId}`,
        () => Whatsapp.findByPk(whatsappId) as any,
        300
      )
    ]);

    if (!campaign || !contact || !whatsapp) {
      logger.error(`[CampaignOptimized] Dados não encontrados: campaign=${!!campaign} contact=${!!contact} whatsapp=${!!whatsapp}`);
      return;
    }

    // Verifica rate limit por WhatsApp (máximo 60 msg/min)
    const rateLimitKey = `campaign:ratelimit:${whatsappId}`;
    const count = await CacheManager.incr(rateLimitKey, 60);

    if (count > 60) {
      logger.warn(`[CampaignOptimized] Rate limit atingido para WhatsApp ${whatsappId}: ${count}/60`);
      // Reagenda para 1 minuto depois
      await campaignQueueOptimized.add("DispatchMessage", job.data, { delay: 60000 });
      return;
    }

    // Aqui vai a lógica de envio real (importar do código original)
    logger.info(`[CampaignOptimized] Enviando mensagem: campanha=${campaignId} contato=${contactId} whatsapp=${whatsappId}`);

    // TODO: Integrar com SendWhatsAppMessage ou código de envio existente

  } catch (error) {
    logger.error(`[CampaignOptimized] Erro ao enviar mensagem:`, error);
    throw error;
  }
}

/**
 * Configura processadores com concorrência
 */
export function setupCampaignProcessors(): void {
  // Processa campanhas (1 por vez, pois carrega muitos contatos)
  campaignQueueOptimized.process("ProcessCampaign", 1, processCampaign);

  // Envia mensagens (10 simultâneas para melhor throughput)
  campaignQueueOptimized.process("DispatchMessage", 10, dispatchMessage);

  // Limpa jobs antigos a cada 5 minutos
  setInterval(async () => {
    await campaignQueueOptimized.clean(3600000, "completed"); // 1 hora
    await campaignQueueOptimized.clean(86400000, "failed"); // 24 horas
    logger.info("[CampaignOptimized] Jobs antigos limpos");
  }, 300000);

  logger.info("[CampaignOptimized] Processadores configurados com concorrência");
}

/**
 * Inicia campanha otimizada
 */
export async function startOptimizedCampaign(campaignId: number, companyId: number): Promise<void> {
  await campaignQueueOptimized.add(
    "ProcessCampaign",
    { campaignId, companyId } as ProcessCampaignJob,
    { priority: 1 } // Alta prioridade
  );
  
  logger.info(`[CampaignOptimized] Campanha ${campaignId} adicionada à fila otimizada`);
}

/**
 * Estatísticas da fila
 */
export async function getCampaignStats(): Promise<any> {
  const [waiting, active, completed, failed] = await Promise.all([
    campaignQueueOptimized.getWaitingCount(),
    campaignQueueOptimized.getActiveCount(),
    campaignQueueOptimized.getCompletedCount(),
    campaignQueueOptimized.getFailedCount()
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    total: waiting + active
  };
}

export default campaignQueueOptimized;
