/**
 * SIGNAL ERROR HANDLER - Versão Otimizada
 * Abordagem mínima sem overhead de Maps/timers persistentes
 * Foca na causa raiz: detecção e limpeza de sessão corrompida
 */
import logger from "../../utils/logger";

class SignalErrorHandler {
  /**
   * Detecta erros Signal críticos (Bad MAC, SessionError)
   * SEM overhead de tracking persistente
   */
  static isSignalError(error: any): boolean {
    if (!error) return false;
    
    const errorStr = (error.message || error.stack || '').toLowerCase();
    
    return errorStr.includes('bad mac') ||
           errorStr.includes('no matching sessions') ||
           errorStr.includes('verifymac') ||
           errorStr.includes('decryptwithsessions') ||
           error.type === 'SessionError' ||
           error.type === 'PreKeyError';
  }

  /**
   * Limpeza de sessão completa quando detectado erro Signal crítico
   * SEM retry automático - deixa para próxima tentativa natural do usuário
   */
  static async handleSignalError(whatsappId: number, error: any): Promise<boolean> {
    if (!this.isSignalError(error)) return false;

    logger.warn(`[SignalError] Detectado erro Signal para whatsappId=${whatsappId}: ${error.message || error}`);

    try {
      // Importar dinamicamente apenas quando necessário
      const { default: Whatsapp } = require('../../models/Whatsapp');
      const whatsapp = await Whatsapp.findByPk(whatsappId);
      
      if (!whatsapp) return false;

      // 1. Marcar como desconectado
      await whatsapp.update({ status: 'DISCONNECTED' });
      logger.info(`[SignalError] WhatsApp ${whatsappId} desconectado para limpeza`);

      // 2. Limpar sessão local
      const fs = require('fs');
      const path = require('path');
      const sessionPath = path.join(__dirname, `../../private/sessions/1/${whatsappId}`);
      
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        logger.info(`[SignalError] Sessão local removida: ${sessionPath}`);
      }

      // 3. Tentar reconectar após delay mínimo
      setTimeout(async () => {
        try {
          await whatsapp.update({ status: 'OPENING' });
          logger.info(`[SignalError] Reconexão iniciada para whatsappId=${whatsappId}`);
        } catch (err) {
          logger.error(`[SignalError] Erro na reconexão: ${err.message}`);
        }
      }, 5000);

      return true;

    } catch (err) {
      logger.error(`[SignalError] Falha na recuperação para whatsappId=${whatsappId}: ${err.message}`);
      return false;
    }
  }
}

export default SignalErrorHandler;
