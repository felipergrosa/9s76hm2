import cron from 'node-cron';
import SessionWindowRenewalService from '../services/TicketServices/SessionWindowRenewalService';
import logger from '../utils/logger';

/**
 * Cron job para verificar janelas de sessão 24h prestes a expirar
 * e enviar mensagens automáticas de renovação
 * 
 * ⚠️ DESATIVADO - Substituído por Bull Queue (SessionWindowRenewalJob)
 * O Bull Queue é mais eficiente porque:
 * - Agenda um job por ticket (sem polling no banco)
 * - Zero overhead quando não há tickets
 * - Escalável para milhares de tickets
 * 
 * Este cron foi mantido comentado como backup opcional.
 * Se precisar reativar, use intervalo maior (ex: a cada 1 hora)
 */
export const sessionWindowRenewalCron = () => {
  // SUBSTITUÍDO POR BULL QUEUE - Ver ProcessWhatsAppWebhook.ts
  logger.info('[SessionWindowRenewalCron] Desativado - usando Bull Queue (SessionWindowRenewalJob)');
  
  /*
  // Executa a cada hora: "0 * * * *" (backup opcional)
  cron.schedule('0 * * * *', async () => {
    logger.debug('[SessionWindowRenewalCron] Verificando janelas prestes a expirar...');
    
    try {
      await SessionWindowRenewalService();
    } catch (err: any) {
      logger.error(`[SessionWindowRenewalCron] Erro: ${err.message}`);
    }
  });
  */
};
