import { Sequelize, Model } from "sequelize";
import BullScheduler from "./BullScheduler";
import logger from "../utils/logger";

/**
 * ============================================================================
 * EVENT TRIGGER SYSTEM - Disparadores Event-Driven para Bull Queue
 * ============================================================================
 * 
 * Este módulo centraliza todos os gatilhos (triggers) que disparam jobs
 * Bull Queue em resposta a eventos do banco de dados ou do sistema.
 * 
 * FILOSOFIA:
 * - "Não polle, reaja" - Em vez de verificar constantemente, reagimos a eventos
 * - Lazy scheduling - Só agenda job quando há necessidade real
 * - Idempotência - Jobs podem ser reagendados sem side effects
 * 
 * EXEMPLO DE USO:
 * ```typescript
 * // Quando contato é criado → aplica regras de tags
 * EventTrigger.onContactCreated(async (contact) => {
 *   await BullScheduler.schedule('TagRules', {
 *     contactId: contact.id,
 *     companyId: contact.companyId
 *   }, {
 *     delay: 5000, // batch de 5s
 *     jobId: `tag-rules-${contact.id}`
 *   });
 * });
 * 
 * // Quando mapeamento LID é salvo → reconcilia contatos
 * EventTrigger.onLidMappingSaved(async (mapping) => {
 *   await BullScheduler.schedule('ReconcileLid', {
 *     lid: mapping.lid,
 *     phoneNumber: mapping.phoneNumber,
 *     companyId: mapping.companyId
 *   });
 * });
 * ```
 * 
 * ============================================================================
 */

// Tipos de callbacks
export type ContactCallback = (contact: any) => Promise<void> | void;
export type TicketCallback = (ticket: any) => Promise<void> | void;
export type MessageCallback = (message: any) => Promise<void> | void;
export type LidMappingCallback = (mapping: any) => Promise<void> | void;
export type SessionCallback = (whatsappId: number, status: string) => Promise<void> | void;

// Registros de callbacks
const contactCreatedCallbacks: ContactCallback[] = [];
const contactUpdatedCallbacks: ContactCallback[] = [];
const ticketCreatedCallbacks: TicketCallback[] = [];
const ticketUpdatedCallbacks: TicketCallback[] = [];
const ticketMessagedCallbacks: TicketCallback[] = [];
const messageCreatedCallbacks: MessageCallback[] = [];
const lidMappingSavedCallbacks: LidMappingCallback[] = [];
const sessionDisconnectedCallbacks: SessionCallback[] = [];
const sessionReconnectedCallbacks: SessionCallback[] = [];

/**
 * Sistema de Event Triggers centralizado
 */
export class EventTrigger {
  
  // ========================================================================
  // REGISTRO DE CALLBACKS
  // ========================================================================
  
  /**
   * Registra callback para quando contato é criado
   * @param callback Função a executar
   */
  static onContactCreated(callback: ContactCallback): void {
    contactCreatedCallbacks.push(callback);
    logger.debug(`[EventTrigger] Registrado callback onContactCreated (total: ${contactCreatedCallbacks.length})`);
  }
  
  /**
   * Registra callback para quando contato é atualizado
   * @param callback Função a executar
   */
  static onContactUpdated(callback: ContactCallback): void {
    contactUpdatedCallbacks.push(callback);
    logger.debug(`[EventTrigger] Registrado callback onContactUpdated (total: ${contactUpdatedCallbacks.length})`);
  }
  
  /**
   * Registra callback para quando ticket é criado
   * @param callback Função a executar
   */
  static onTicketCreated(callback: TicketCallback): void {
    ticketCreatedCallbacks.push(callback);
    logger.debug(`[EventTrigger] Registrado callback onTicketCreated (total: ${ticketCreatedCallbacks.length})`);
  }
  
  /**
   * Registra callback para quando ticket é atualizado
   * @param callback Função a executar
   */
  static onTicketUpdated(callback: TicketCallback): void {
    ticketUpdatedCallbacks.push(callback);
    logger.debug(`[EventTrigger] Registrado callback onTicketUpdated (total: ${ticketUpdatedCallbacks.length})`);
  }
  
  /**
   * Registra callback para quando ticket recebe mensagem
   * @param callback Função a executar
   */
  static onTicketMessaged(callback: TicketCallback): void {
    ticketMessagedCallbacks.push(callback);
    logger.debug(`[EventTrigger] Registrado callback onTicketMessaged (total: ${ticketMessagedCallbacks.length})`);
  }
  
  /**
   * Registra callback para quando mensagem é criada
   * @param callback Função a executar
   */
  static onMessageCreated(callback: MessageCallback): void {
    messageCreatedCallbacks.push(callback);
    logger.debug(`[EventTrigger] Registrado callback onMessageCreated (total: ${messageCreatedCallbacks.length})`);
  }
  
  /**
   * Registra callback para quando mapeamento LID é salvo
   * @param callback Função a executar
   */
  static onLidMappingSaved(callback: LidMappingCallback): void {
    lidMappingSavedCallbacks.push(callback);
    logger.debug(`[EventTrigger] Registrado callback onLidMappingSaved (total: ${lidMappingSavedCallbacks.length})`);
  }
  
  /**
   * Registra callback para quando sessão WhatsApp desconecta
   * @param callback Função a executar
   */
  static onSessionDisconnected(callback: SessionCallback): void {
    sessionDisconnectedCallbacks.push(callback);
    logger.debug(`[EventTrigger] Registrado callback onSessionDisconnected (total: ${sessionDisconnectedCallbacks.length})`);
  }
  
  /**
   * Registra callback para quando sessão WhatsApp reconecta
   * @param callback Função a executar
   */
  static onSessionReconnected(callback: SessionCallback): void {
    sessionReconnectedCallbacks.push(callback);
    logger.debug(`[EventTrigger] Registrado callback onSessionReconnected (total: ${sessionReconnectedCallbacks.length})`);
  }
  
  // ========================================================================
  // DISPARADORES (TRIGGERS)
  // ========================================================================
  
  /**
   * Dispara evento: Contato criado
   * @param contact Instância do contato
   */
  static async emitContactCreated(contact: any): Promise<void> {
    if (contactCreatedCallbacks.length === 0) return;
    
    logger.debug(`[EventTrigger] Emitindo contactCreated para ${contactCreatedCallbacks.length} listeners`);
    
    await Promise.allSettled(
      contactCreatedCallbacks.map(async (cb) => {
        try {
          await cb(contact);
        } catch (err: any) {
          logger.error(`[EventTrigger] Erro em onContactCreated callback: ${err.message}`);
        }
      })
    );
  }
  
  /**
   * Dispara evento: Contato atualizado
   * @param contact Instância do contato
   */
  static async emitContactUpdated(contact: any): Promise<void> {
    if (contactUpdatedCallbacks.length === 0) return;
    
    logger.debug(`[EventTrigger] Emitindo contactUpdated para ${contactUpdatedCallbacks.length} listeners`);
    
    await Promise.allSettled(
      contactUpdatedCallbacks.map(async (cb) => {
        try {
          await cb(contact);
        } catch (err: any) {
          logger.error(`[EventTrigger] Erro em onContactUpdated callback: ${err.message}`);
        }
      })
    );
  }
  
  /**
   * Dispara evento: Ticket criado
   * @param ticket Instância do ticket
   */
  static async emitTicketCreated(ticket: any): Promise<void> {
    if (ticketCreatedCallbacks.length === 0) return;
    
    logger.debug(`[EventTrigger] Emitindo ticketCreated para ${ticketCreatedCallbacks.length} listeners`);
    
    await Promise.allSettled(
      ticketCreatedCallbacks.map(async (cb) => {
        try {
          await cb(ticket);
        } catch (err: any) {
          logger.error(`[EventTrigger] Erro em onTicketCreated callback: ${err.message}`);
        }
      })
    );
  }
  
  /**
   * Dispara evento: Ticket atualizado
   * @param ticket Instância do ticket
   */
  static async emitTicketUpdated(ticket: any): Promise<void> {
    if (ticketUpdatedCallbacks.length === 0) return;
    
    logger.debug(`[EventTrigger] Emitindo ticketUpdated para ${ticketUpdatedCallbacks.length} listeners`);
    
    await Promise.allSettled(
      ticketUpdatedCallbacks.map(async (cb) => {
        try {
          await cb(ticket);
        } catch (err: any) {
          logger.error(`[EventTrigger] Erro em onTicketUpdated callback: ${err.message}`);
        }
      })
    );
  }
  
  /**
   * Dispara evento: Ticket recebeu mensagem
   * @param ticket Instância do ticket
   */
  static async emitTicketMessaged(ticket: any): Promise<void> {
    if (ticketMessagedCallbacks.length === 0) return;
    
    logger.debug(`[EventTrigger] Emitindo ticketMessaged para ${ticketMessagedCallbacks.length} listeners`);
    
    await Promise.allSettled(
      ticketMessagedCallbacks.map(async (cb) => {
        try {
          await cb(ticket);
        } catch (err: any) {
          logger.error(`[EventTrigger] Erro em onTicketMessaged callback: ${err.message}`);
        }
      })
    );
  }
  
  /**
   * Dispara evento: Mensagem criada
   * @param message Instância da mensagem
   */
  static async emitMessageCreated(message: any): Promise<void> {
    if (messageCreatedCallbacks.length === 0) return;
    
    logger.debug(`[EventTrigger] Emitindo messageCreated para ${messageCreatedCallbacks.length} listeners`);
    
    await Promise.allSettled(
      messageCreatedCallbacks.map(async (cb) => {
        try {
          await cb(message);
        } catch (err: any) {
          logger.error(`[EventTrigger] Erro em onMessageCreated callback: ${err.message}`);
        }
      })
    );
  }
  
  /**
   * Dispara evento: Mapeamento LID salvo
   * @param mapping Instância do mapeamento
   */
  static async emitLidMappingSaved(mapping: any): Promise<void> {
    if (lidMappingSavedCallbacks.length === 0) return;
    
    logger.debug(`[EventTrigger] Emitindo lidMappingSaved para ${lidMappingSavedCallbacks.length} listeners`);
    
    await Promise.allSettled(
      lidMappingSavedCallbacks.map(async (cb) => {
        try {
          await cb(mapping);
        } catch (err: any) {
          logger.error(`[EventTrigger] Erro em onLidMappingSaved callback: ${err.message}`);
        }
      })
    );
  }
  
  /**
   * Dispara evento: Sessão desconectada
   * @param whatsappId ID da conexão
   * @param status Status da desconexão
   */
  static async emitSessionDisconnected(whatsappId: number, status: string): Promise<void> {
    if (sessionDisconnectedCallbacks.length === 0) return;
    
    logger.debug(`[EventTrigger] Emitindo sessionDisconnected para ${sessionDisconnectedCallbacks.length} listeners`);
    
    await Promise.allSettled(
      sessionDisconnectedCallbacks.map(async (cb) => {
        try {
          await cb(whatsappId, status);
        } catch (err: any) {
          logger.error(`[EventTrigger] Erro em onSessionDisconnected callback: ${err.message}`);
        }
      })
    );
  }
  
  /**
   * Dispara evento: Sessão reconectada
   * @param whatsappId ID da conexão
   * @param status Status da reconexão
   */
  static async emitSessionReconnected(whatsappId: number, status: string): Promise<void> {
    if (sessionReconnectedCallbacks.length === 0) return;
    
    logger.debug(`[EventTrigger] Emitindo sessionReconnected para ${sessionReconnectedCallbacks.length} listeners`);
    
    await Promise.allSettled(
      sessionReconnectedCallbacks.map(async (cb) => {
        try {
          await cb(whatsappId, status);
        } catch (err: any) {
          logger.error(`[EventTrigger] Erro em onSessionReconnected callback: ${err.message}`);
        }
      })
    );
  }
  
  // ========================================================================
  // INICIALIZAÇÃO DE HOOKS SEQUELIZE
  // ========================================================================
  
  /**
   * Inicializa hooks nos modelos Sequelize
   * Deve ser chamado após todos os modelos serem carregados
   * 
   * @param sequelize Instância do Sequelize
   */
  static initSequelizeHooks(sequelize: Sequelize): void {
    logger.info("[EventTrigger] Inicializando hooks Sequelize...");
    
    // Hook genérico para capturar eventos de todos os modelos
    // Os modelos específicos devem chamar os emitters manualmente
    // para ter controle sobre os dados enviados
    
    logger.info(`[EventTrigger] Hooks inicializados:`, {
      contactCreated: contactCreatedCallbacks.length,
      contactUpdated: contactUpdatedCallbacks.length,
      ticketCreated: ticketCreatedCallbacks.length,
      ticketUpdated: ticketUpdatedCallbacks.length,
      ticketMessaged: ticketMessagedCallbacks.length,
      messageCreated: messageCreatedCallbacks.length,
      lidMappingSaved: lidMappingSavedCallbacks.length,
      sessionDisconnected: sessionDisconnectedCallbacks.length,
      sessionReconnected: sessionReconnectedCallbacks.length,
    });
  }
  
  /**
   * Obtém estatísticas de callbacks registrados
   */
  static getStats(): Record<string, number> {
    return {
      contactCreated: contactCreatedCallbacks.length,
      contactUpdated: contactUpdatedCallbacks.length,
      ticketCreated: ticketCreatedCallbacks.length,
      ticketUpdated: ticketUpdatedCallbacks.length,
      ticketMessaged: ticketMessagedCallbacks.length,
      messageCreated: messageCreatedCallbacks.length,
      lidMappingSaved: lidMappingSavedCallbacks.length,
      sessionDisconnected: sessionDisconnectedCallbacks.length,
      sessionReconnected: sessionReconnectedCallbacks.length,
    };
  }
}

export default EventTrigger;
