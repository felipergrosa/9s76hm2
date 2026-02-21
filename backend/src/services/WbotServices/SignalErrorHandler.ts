/**
 * SIGNAL ERROR HANDLER - Auto-Recovery Robusto
 * Detecta erros Signal, limpa sessão corrompida e reconecta automaticamente
 */
import logger from "../../utils/logger";
import { releaseWbotLock } from "../../libs/wbotMutex";
import DeleteBaileysService from "../BaileysServices/DeleteBaileysService";
import cacheLayer from "../../libs/cache";
import path from "path";
import fs from "fs";

// Contador de erros Signal por whatsappId para evitar loop infinito
const signalErrorCount = new Map<number, { count: number; lastError: number }>();
const MAX_SIGNAL_ERRORS = 3; // Máximo de erros antes de parar auto-recovery
const ERROR_WINDOW_MS = 60000; // Janela de 1 minuto para contar erros

class SignalErrorHandler {
  /**
   * Detecta erros Signal críticos (Bad MAC, SessionError)
   */
  static isSignalError(error: any): boolean {
    if (!error) return false;
    
    const errorStr = ((error.message || '') + ' ' + (error.stack || '')).toLowerCase();
    
    return errorStr.includes('bad mac') ||
           errorStr.includes('no matching sessions') ||
           errorStr.includes('no session found') ||
           errorStr.includes('verifymac') ||
           errorStr.includes('decryptwithsessions') ||
           errorStr.includes('failed to decrypt') ||
           error.type === 'SessionError' ||
           error.type === 'PreKeyError';
  }

  /**
   * Verifica se deve tentar auto-recovery (evita loop infinito)
   */
  static shouldAttemptRecovery(whatsappId: number): boolean {
    const now = Date.now();
    const record = signalErrorCount.get(whatsappId);
    
    if (!record) {
      signalErrorCount.set(whatsappId, { count: 1, lastError: now });
      return true;
    }
    
    // Se passou mais de 1 minuto desde o último erro, resetar contador
    if (now - record.lastError > ERROR_WINDOW_MS) {
      signalErrorCount.set(whatsappId, { count: 1, lastError: now });
      return true;
    }
    
    // Incrementar contador
    record.count++;
    record.lastError = now;
    
    // Se excedeu o máximo, não tentar auto-recovery
    if (record.count > MAX_SIGNAL_ERRORS) {
      logger.warn(`[SignalError] Limite de erros Signal excedido para whatsappId=${whatsappId}. Auto-recovery desabilitado temporariamente.`);
      return false;
    }
    
    return true;
  }

  /**
   * Limpeza de sessão completa quando detectado erro Signal crítico
   * COM auto-recovery automático
   */
  static async handleSignalError(whatsappId: number, error: any, companyId?: number): Promise<boolean> {
    if (!this.isSignalError(error)) return false;

    logger.warn(`[SignalError] Detectado erro Signal para whatsappId=${whatsappId}: ${error.message || error}`);

    // Verificar se deve tentar auto-recovery
    if (!this.shouldAttemptRecovery(whatsappId)) {
      logger.warn(`[SignalError] Auto-recovery desabilitado para whatsappId=${whatsappId}. Necessário intervenção manual.`);
      return false;
    }

    try {
      // Importar dinamicamente apenas quando necessário
      const { default: Whatsapp } = require('../../models/Whatsapp');
      const whatsapp = await Whatsapp.findByPk(whatsappId);
      
      if (!whatsapp) return false;

      const actualCompanyId = companyId || whatsapp.companyId;

      // 1. Liberar lock Redis
      try {
        await releaseWbotLock(whatsappId);
        logger.info(`[SignalError] Lock liberado para whatsappId=${whatsappId}`);
      } catch (lockErr) {
        logger.warn(`[SignalError] Erro ao liberar lock: ${lockErr}`);
      }

      // 2. Marcar como desconectado
      await whatsapp.update({ status: 'DISCONNECTED' });
      logger.info(`[SignalError] WhatsApp ${whatsappId} marcado como DISCONNECTED`);

      // 3. Limpar cache de sessão
      try {
        await cacheLayer.delFromPattern(`sessions:${whatsappId}:*`);
        logger.info(`[SignalError] Cache de sessão limpo para whatsappId=${whatsappId}`);
      } catch (cacheErr) {
        logger.warn(`[SignalError] Erro ao limpar cache: ${cacheErr}`);
      }

      // 4. Limpar arquivos de sessão local
      const sessionPath = path.join(
        process.cwd(),
        process.env.SESSIONS_DIR || 'private/sessions',
        String(whatsapp.companyId || '1'),
        String(whatsappId)
      );
      
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        logger.info(`[SignalError] Sessão local removida: ${sessionPath}`);
      }

      // 5. Limpar sessão via DeleteBaileysService (limpa auth e dados)
      try {
        await DeleteBaileysService(whatsappId);
        logger.info(`[SignalError] DeleteBaileysService executado para whatsappId=${whatsappId}`);
      } catch (deleteErr) {
        logger.warn(`[SignalError] Erro no DeleteBaileysService: ${deleteErr}`);
      }

      // 6. Agendar reconexão automática após delay
      const delay = 10000; // 10 segundos
      logger.info(`[SignalError] Agendando reconexão em ${delay/1000}s para whatsappId=${whatsappId}`);
      
      setTimeout(async () => {
        try {
          const { StartWhatsAppSessionUnified } = require('./StartWhatsAppSessionUnified');
          await whatsapp.update({ status: 'OPENING' });
          logger.info(`[SignalError] Iniciando reconexão automática para whatsappId=${whatsappId}`);
          await StartWhatsAppSessionUnified(whatsapp, actualCompanyId);
        } catch (reconnectErr) {
          logger.error(`[SignalError] Erro na reconexão automática: ${reconnectErr}`);
          // Se falhar, marcar como PENDING para usuário escanear QR
          await whatsapp.update({ status: 'PENDING' });
        }
      }, delay);

      return true;

    } catch (err) {
      logger.error(`[SignalError] Falha na recuperação para whatsappId=${whatsappId}: ${err}`);
      return false;
    }
  }

  /**
   * Resetar contador de erros (chamado quando sessão conecta com sucesso)
   */
  static resetErrorCount(whatsappId: number): void {
    signalErrorCount.delete(whatsappId);
    logger.info(`[SignalError] Contador de erros resetado para whatsappId=${whatsappId}`);
  }
}

export default SignalErrorHandler;
