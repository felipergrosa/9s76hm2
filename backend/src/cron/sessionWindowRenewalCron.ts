import cron from 'node-cron';
import SessionWindowRenewalService from '../services/TicketServices/SessionWindowRenewalService';
import logger from '../utils/logger';

/**
 * Cron job para verificar janelas de sessão 24h prestes a expirar
 * e enviar mensagens automáticas de renovação
 * 
 * Executa a cada 1 minuto
 */
export const sessionWindowRenewalCron = () => {
  // Executa a cada minuto: "* * * * *"
  cron.schedule('* * * * *', async () => {
    logger.debug('[SessionWindowRenewalCron] Verificando janelas prestes a expirar...');
    
    try {
      await SessionWindowRenewalService();
    } catch (err: any) {
      logger.error(`[SessionWindowRenewalCron] Erro: ${err.message}`);
    }
  });
};
