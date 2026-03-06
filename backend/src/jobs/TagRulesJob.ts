import Company from "../models/Company";
import ApplyTagRulesService from "../services/TagServices/ApplyTagRulesService";
import logger from "../utils/logger";

/**
 * Job: TagRules - Aplica regras automáticas de tags a contatos
 * 
 * Responsabilidades:
 * - Aplicar regras de tags configuradas aos contatos
 * - Processar contatos novos ou atualizados
 * - Atualizar carteiras e segmentações
 * 
 * Trigger:
 * - Evento: Contact created ou Contact updated
 * - Timing: Imediato (sem delay) ou batch de 5s
 * 
 * NOTA: Este job substitui o tagRulesRecentContactsCron (5min polling)
 * Versão event-driven: só executa quando há contato novo/atualizado
 */
export default {
  key: `${process.env.DB_NAME}-TagRules`,

  async handle({ data }: { data: any }) {
    const { 
      companyId, 
      contactId,
      forceFull = false // Se true, processa todas as regras da company
    } = data || {};

    if (!companyId) {
      throw new Error("[TagRulesJob] companyId é obrigatório");
    }

    logger.info(`[TagRulesJob] Iniciando aplicação de regras`, {
      companyId,
      contactId: contactId || "todos",
      forceFull,
    });

    try {
      let results: any[];

      if (forceFull || !contactId) {
        // Processamento completo da company (substitui o cron diário)
        results = await ApplyTagRulesService({ companyId });
        
        const totalAffected = results.reduce((sum, r) => sum + r.contactsAffected, 0);
        
        logger.info(`[TagRulesJob] Processamento completo finalizado`, {
          companyId,
          totalAffected,
          rulesProcessed: results.length,
        });

        // Log detalhado se houver afetados
        results.forEach((r: any) => {
          if (r.contactsAffected > 0) {
            logger.info(`[TagRulesJob] Regra aplicada: ${r.tagName}`, {
              companyId,
              tagName: r.tagName,
              contactsAffected: r.contactsAffected,
            });
          }
        });

      } else {
        // Processamento de contato específico (event-driven)
        results = await ApplyTagRulesService({ 
          companyId, 
          contactId 
        });

        const totalAffected = results.reduce((sum, r) => sum + r.contactsAffected, 0);
        
        logger.info(`[TagRulesJob] Contato específico processado`, {
          companyId,
          contactId,
          totalAffected,
          rulesMatched: results.filter((r: any) => r.contactsAffected > 0).length,
        });
      }

      return {
        success: true,
        companyId,
        contactId,
        totalAffected: results.reduce((sum, r) => sum + r.contactsAffected, 0),
        rulesProcessed: results.length,
      };

    } catch (error: any) {
      logger.error(`[TagRulesJob] Erro ao aplicar regras`, {
        companyId,
        contactId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
};
