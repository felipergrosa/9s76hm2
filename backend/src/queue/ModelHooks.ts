/**
 * ============================================================================
 * SEQUELIZE HOOKS - Integração EventTrigger com Modelos
 * ============================================================================
 * 
 * Este arquivo centraliza todos os hooks Sequelize que disparam eventos
 * para o sistema EventTrigger / Bull Queue.
 * 
 * USO:
 * Importe e chame initModelHooks() no startup do servidor, após
 * todos os modelos serem carregados.
 * 
 * ============================================================================
 */

import { Sequelize } from "sequelize-typescript";
import { EventTrigger } from "./EventTrigger";
import { BullScheduler } from "./BullScheduler";
import logger from "../utils/logger";

/**
 * Inicializa hooks em todos os modelos relevantes
 * @param sequelize Instância do Sequelize
 */
export function initModelHooks(sequelize: Sequelize): void {
  logger.info("[ModelHooks] Inicializando hooks Sequelize...");

  // ==========================================================================
  // CONTACT HOOKS
  // ==========================================================================
  
  const Contact = sequelize.models.Contact;
  if (Contact) {
    // Hook: After Create
    Contact.afterCreate(async (instance: any) => {
      try {
        // Disparar evento
        await EventTrigger.emitContactCreated(instance);
        
        // Agendar job de TagRules (com pequeno delay para batch)
        await BullScheduler.schedule(
          `${process.env.DB_NAME}-TagRules`,
          {
            companyId: instance.companyId,
            contactId: instance.id,
          },
          {
            delay: 3000, // 3 segundos de batch
            jobId: `tag-rules-${instance.id}`,
          }
        );
        
        logger.debug(`[ModelHooks] Contact ${instance.id} criado - TagRules agendado`);
      } catch (err: any) {
        logger.error(`[ModelHooks] Erro no afterCreate Contact: ${err.message}`);
      }
    });

    // Hook: After Update
    Contact.afterUpdate(async (instance: any) => {
      try {
        // Só dispara se campos relevantes mudaram
        const changed = instance.changed();
        const relevantFields = ['name', 'number', 'email', 'tags', 'walletId'];
        
        if (changed && relevantFields.some((f: string) => changed.includes(f))) {
          await EventTrigger.emitContactUpdated(instance);
          
          // Cancelar job anterior se existir
          await BullScheduler.cancel(
            `${process.env.DB_NAME}-TagRules`,
            `tag-rules-${instance.id}`
          );
          
          // Reagendar TagRules
          await BullScheduler.schedule(
            `${process.env.DB_NAME}-TagRules`,
            {
              companyId: instance.companyId,
              contactId: instance.id,
            },
            {
              delay: 3000,
              jobId: `tag-rules-${instance.id}`,
            }
          );
          
          logger.debug(`[ModelHooks] Contact ${instance.id} atualizado - TagRules reagendado`);
        }
      } catch (err: any) {
        logger.error(`[ModelHooks] Erro no afterUpdate Contact: ${err.message}`);
      }
    });

    logger.info("[ModelHooks] Hooks Contact registrados");
  }

  // ==========================================================================
  // TICKET HOOKS
  // ==========================================================================
  
  const Ticket = sequelize.models.Ticket;
  if (Ticket) {
    // Hook: After Create
    Ticket.afterCreate(async (instance: any) => {
      try {
        await EventTrigger.emitTicketCreated(instance);
      } catch (err: any) {
        logger.error(`[ModelHooks] Erro no afterCreate Ticket: ${err.message}`);
      }
    });

    // Hook: After Update (para mensagens e inatividade)
    Ticket.afterUpdate(async (instance: any) => {
      try {
        const changed = instance.changed();
        
        if (changed) {
          // Mensagem nova
          if (changed.includes('lastMessage') || changed.includes('updatedAt')) {
            await EventTrigger.emitTicketMessaged(instance);
          }
          
          // Status mudou
          if (changed.includes('status')) {
            await EventTrigger.emitTicketUpdated(instance);
            
            // Se mudou para status "bot", agendar InactivityTimeout
            if (instance.status === "bot" && instance.queueId) {
              const queue = await sequelize.models.Queue.findByPk(instance.queueId, {
                include: [{ model: sequelize.models.AIAgent, as: "aiAgent" }]
              });
              
              if (queue?.aiAgent?.status === "active" && queue.aiAgent.inactivityTimeoutMinutes > 0) {
                const delay = queue.aiAgent.inactivityTimeoutMinutes * 60 * 1000;
                
                await BullScheduler.schedule(
                  `${process.env.DB_NAME}-InactivityTimeout`,
                  { ticketId: instance.id, agentId: queue.aiAgent.id, companyId: instance.companyId },
                  { delay, jobId: `inactivity-${instance.id}` }
                );
                
                logger.debug(`[ModelHooks] InactivityTimeout agendado para ticket ${instance.id} (status mudou para bot)`);
              }
            }
            
            // Se mudou de "bot" para outro status, cancelar InactivityTimeout
            if (instance.status !== "bot" && changed.includes('status')) {
              await BullScheduler.cancel(
                `${process.env.DB_NAME}-InactivityTimeout`,
                `inactivity-${instance.id}`
              );
              logger.debug(`[ModelHooks] InactivityTimeout cancelado para ticket ${instance.id} (status mudou de bot)`);
            }
          }
        }
      } catch (err: any) {
        logger.error(`[ModelHooks] Erro no afterUpdate Ticket: ${err.message}`);
      }
    });

    logger.info("[ModelHooks] Hooks Ticket registrados");
  }

  // ==========================================================================
  // LID MAPPING HOOKS
  // ==========================================================================
  
  const LidMapping = sequelize.models.LidMapping;
  if (LidMapping) {
    LidMapping.afterCreate(async (instance: any) => {
      try {
        await EventTrigger.emitLidMappingSaved(instance);
        
        // Agendar reconciliação imediata
        await BullScheduler.schedule(
          `${process.env.DB_NAME}-ReconcileLid`,
          {
            lid: instance.lid,
            phoneNumber: instance.phoneNumber,
            companyId: instance.companyId,
            contactId: instance.contactId,
          },
          {
            jobId: `reconcile-${instance.lid}-${instance.companyId}`,
          }
        );
        
        logger.debug(`[ModelHooks] LidMapping criado - ReconcileLid agendado`);
      } catch (err: any) {
        logger.error(`[ModelHooks] Erro no afterCreate LidMapping: ${err.message}`);
      }
    });

    logger.info("[ModelHooks] Hooks LidMapping registrados");
  }

  // ==========================================================================
  // MESSAGE HOOKS
  // ==========================================================================
  
  const Message = sequelize.models.Message;
  if (Message) {
    Message.afterCreate(async (instance: any) => {
      try {
        await EventTrigger.emitMessageCreated(instance);
        
        // Se mensagem é do cliente (fromMe=false), agendar jobs relacionados
        if (!instance.fromMe && instance.ticketId) {
          const ticket = await sequelize.models.Ticket.findByPk(instance.ticketId, {
            include: [
              { model: sequelize.models.Whatsapp, as: "whatsapp" },
              { model: sequelize.models.Queue, as: "queue", include: [{ model: sequelize.models.AIAgent, as: "aiAgent" }] }
            ]
          });
          
          if (ticket) {
            // 1. SessionWindowRenewal (API Oficial)
            if (ticket.whatsapp?.channelType === "official" && ticket.whatsapp?.sessionWindowRenewalMessage) {
              const renewalMinutes = ticket.whatsapp.sessionWindowRenewalMinutes || 60;
              const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
              const renewalTime = new Date(expiresAt.getTime() - renewalMinutes * 60 * 1000);
              const delay = Math.max(0, renewalTime.getTime() - Date.now());
              
              await BullScheduler.reschedule(
                `${process.env.DB_NAME}-SessionWindowRenewal`,
                `window-renewal-${ticket.id}`,
                { ticketId: ticket.id, companyId: ticket.companyId },
                { delay }
              );
              
              logger.debug(`[ModelHooks] SessionWindowRenewal reagendado para ticket ${ticket.id} (delay: ${Math.floor(delay/60000)}min)`);
            }
            
            // 2. InactivityTimeout (se ticket em status bot)
            if (ticket.status === "bot" && ticket.queue?.aiAgent) {
              const agent = ticket.queue.aiAgent;
              if (agent.status === "active" && agent.inactivityTimeoutMinutes > 0) {
                const delay = agent.inactivityTimeoutMinutes * 60 * 1000;
                
                await BullScheduler.reschedule(
                  `${process.env.DB_NAME}-InactivityTimeout`,
                  `inactivity-${ticket.id}`,
                  { ticketId: ticket.id, agentId: agent.id, companyId: ticket.companyId },
                  { delay }
                );
                
                logger.debug(`[ModelHooks] InactivityTimeout reagendado para ticket ${ticket.id} (delay: ${agent.inactivityTimeoutMinutes}min)`);
              }
            }
          }
        }
      } catch (err: any) {
        logger.error(`[ModelHooks] Erro no afterCreate Message: ${err.message}`);
      }
    });

    logger.info("[ModelHooks] Hooks Message registrados");
  }

  logger.info("[ModelHooks] Todos os hooks inicializados com sucesso");
}

/**
 * Registra callbacks do EventTrigger
 * Esta função deve ser chamada após todos os jobs estarem prontos
 */
export function initEventTriggerCallbacks(): void {
  logger.info("[ModelHooks] Registrando callbacks EventTrigger...");

  // Callback: Quando sessão desconecta
  EventTrigger.onSessionDisconnected(async (whatsappId: number, status: string) => {
    try {
      // Agendar verificação de sessão órfã
      await BullScheduler.schedule(
        `${process.env.DB_NAME}-OrphanedSessionCheck`,
        {
          whatsappId,
          reason: `Session disconnected: ${status}`,
        },
        {
          delay: 5000, // 5 segundos após desconexão
          jobId: `orphaned-check-${whatsappId}`,
        }
      );
      
      logger.debug(`[ModelHooks] OrphanedSessionCheck agendado para ${whatsappId}`);
    } catch (err: any) {
      logger.error(`[ModelHooks] Erro ao agendar OrphanedSessionCheck: ${err.message}`);
    }
  });

  logger.info("[ModelHooks] Callbacks EventTrigger registrados");
}

/**
 * Inicializa jobs recorrentes (substitui cronjobs de baixa frequência)
 */
export async function initRecurringJobs(): Promise<void> {
  logger.info("[ModelHooks] Inicializando jobs recorrentes...");

  try {
    // WhatsAppHealthCheck recorrente (a cada 5 minutos)
    await BullScheduler.scheduleRecurring(
      `${process.env.DB_NAME}-WhatsAppHealthCheck`,
      { type: "recurring" },
      "*/5 * * * *", // A cada 5 minutos
      { jobId: "whatsapp-health-check-recurring" }
    );
    
    logger.info("[ModelHooks] WhatsAppHealthCheck recorrente agendado (5 min)");
  } catch (err: any) {
    logger.error(`[ModelHooks] Erro ao inicializar jobs recorrentes: ${err.message}`);
  }
}
