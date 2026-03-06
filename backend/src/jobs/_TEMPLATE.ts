/**
 * ============================================================================
 * TEMPLATE DE JOB BULL QUEUE
 * ============================================================================
 * 
 * Copie este arquivo para criar novos jobs facilmente.
 * 
 * NOME DO ARQUIVO: src/jobs/NomeDoJob.ts
 * 
 * INSTRUÇÕES:
 * 1. Copie este template
 * 2. Renomeie o arquivo (ex: ProcessarPagamentoJob.ts)
 * 3. Substitua TODO pelo nome do seu job
 * 4. Implemente a lógica no método handle
 * 5. Exporte em src/jobs/index.ts
 * 6. Use BullScheduler para agendar
 * 
 * ============================================================================
 */

import logger from "../utils/logger";
// Importe aqui os modelos e serviços necessários
// import Ticket from "../models/Ticket";
// import SomeService from "../services/SomeService";

/**
 * Job: TODO - Descrição breve do que o job faz
 * 
 * Responsabilidades:
 * - TODO: Liste o que este job faz
 * - TODO: Ex: Processar pagamento pendente
 * - TODO: Ex: Enviar email de lembrete
 * 
 * Trigger:
 * - Evento: TODO (ex: Ticket criado, Pagamento recebido)
 * - Timing: TODO (ex: Imediato, 1 hora depois)
 * 
 * Exemplo de uso:
 * ```typescript
 * await BullScheduler.schedule('TODO', {
 *   param1: 'valor',
 *   param2: 123
 * }, {
 *   delay: 3600000, // 1 hora
 *   jobId: `todo-${entityId}`, // único por entidade
 *   attempts: 3
 * });
 * ```
 */
export default {
  /**
   * Nome único da fila Bull
   * Formato: {DB_NAME}-NomeDoJob
   */
  key: `${process.env.DB_NAME}-TODO`,

  /**
   * Handler principal do job
   * 
   * @param data - Dados passados ao agendar o job
   * @returns Promise com resultado opcional
   */
  async handle({ data }: { data: any }) {
    // ========================================================================
    // PASSO 1: Extração e validação de dados
    // ========================================================================
    
    const { 
      // TODO: Liste aqui os parâmetros esperados
      // param1, 
      // param2,
      // entityId,
    } = data || {};

    // Validação obrigatória
    // TODO: Valide todos os campos necessários
    // if (!param1) {
    //   throw new Error("[TODOJob] param1 é obrigatório");
    // }

    logger.info("[TODOJob] Iniciando processamento", {
      // param1,
      // param2,
    });

    try {
      // ========================================================================
      // PASSO 2: Lógica principal do job
      // ========================================================================
      
      // TODO: Implemente aqui a lógica do job
      // Exemplos:
      // - Buscar dados do banco
      // - Processar informações
      // - Chamar serviços externos
      // - Atualizar registros
      
      // const entity = await Model.findByPk(entityId);
      // if (!entity) {
      //   logger.warn(`[TODOJob] Entidade ${entityId} não encontrada`);
      //   return; // Job concluído sem erro
      // }
      
      // await SomeService.process(entity);

      // ========================================================================
      // PASSO 3: Retorno (opcional)
      // ========================================================================
      
      logger.info("[TODOJob] Processamento concluído com sucesso");
      
      // Retorne dados úteis para logs/debug
      return {
        success: true,
        // processedAt: new Date().toISOString(),
        // entityId,
      };

    } catch (error: any) {
      // ========================================================================
      // TRATAMENTO DE ERROS
      // ========================================================================
      
      logger.error("[TODOJob] Erro no processamento", {
        error: error.message,
        stack: error.stack,
        // param1,
        // param2,
      });

      // Relançar o erro faz o Bull tentar novamente (retry)
      // Deixe o erro subir se:
      // - É um erro transitório (ex: timeout de API externa)
      // - Você quer aproveitar o retry automático do Bull
      
      // Capture/Não relance se:
      // - É um erro permanente (ex: dados inválidos)
      // - Você não quer retry
      
      throw error;
    }
  }
};

/**
 * ============================================================================
 * EXEMPLOS DE AGENDAMENTO
 * ============================================================================
 * 
 * // 1. Agendamento imediato
 * await BullScheduler.schedule('TODO', {
 *   param1: 'valor',
 *   param2: 123
 * });
 * 
 * // 2. Agendamento com delay (1 hora)
 * await BullScheduler.schedule('TODO', {
 *   param1: 'valor'
 * }, {
 *   delay: 3600000
 * });
 * 
 * // 3. Agendamento com jobId único (evita duplicatas)
 * await BullScheduler.schedule('TODO', {
 *   entityId: 123
 * }, {
 *   jobId: 'todo-123', // Só existe um job com este ID
 *   delay: 60000
 * });
 * 
 * // 4. Reagendamento (remove anterior, cria novo)
 * await BullScheduler.reschedule('TODO', 'todo-123', {
 *   entityId: 123
 * }, {
 *   delay: 120000 // Novo timing
 * });
 * 
 * // 5. Job recorrente (substitui cron)
 * await BullScheduler.scheduleRecurring('TODO', {}, '0 2 * * *');
 * 
 * ============================================================================
 * 
 * INTEGRAÇÃO COM EVENT TRIGGER:
 * 
 * // Em algum hook de modelo ou serviço:
 * EventTrigger.onTicketCreated(async (ticket) => {
 *   await BullScheduler.schedule('TODO', {
 *     ticketId: ticket.id,
 *     companyId: ticket.companyId
 *   }, {
 *     delay: 5000,
 *     jobId: `todo-ticket-${ticket.id}`
 *   });
 * });
 * 
 * ============================================================================
 */
