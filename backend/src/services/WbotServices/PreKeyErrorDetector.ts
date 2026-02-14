// 🛠️ MELHORIA: DETECTOR INTELIGENTE DE PREKEY ERRORS
// Previne loops infinitos e acelera recuperação de sessões corrompidas

const logger = require('../utils/logger');

interface PreKeyErrorTracker {
  whatsappId: number;
  lastErrorTime: number;
  errorCount: number;
  isRecovering: boolean;
  recoveryAttempts: number;
}

class PreKeyErrorDetector {
  private static trackers = new Map<number, PreKeyErrorTracker>();
  private static readonly ERROR_THRESHOLD = 3; // 3 erros em 5 minutos
  private static readonly TIME_WINDOW = 5 * 60 * 1000; // 5 minutos
  private static readonly MAX_RECOVERY_ATTEMPTS = 2;
  private static readonly RECOVERY_COOLDOWN = 30000; // 30 segundos

  static detectPreKeyError(whatsappId: number, error: any): boolean {
    const now = Date.now();
    const tracker = this.trackers.get(whatsappId) || {
      whatsappId,
      lastErrorTime: 0,
      errorCount: 0,
      isRecovering: false,
      recoveryAttempts: 0
    };

    // Verificar se é PreKeyError
    const isPreKeyError = error?.message?.includes('Invalid PreKey ID') || 
                          error?.type === 'PreKeyError' ||
                          error?.stack?.includes('SessionBuilder.initIncoming');

    if (!isPreKeyError) return false;

    // Atualizar tracker
    tracker.lastErrorTime = now;
    tracker.errorCount++;

    // Verificar se está em janela de tempo
    const timeSinceLastError = now - tracker.lastErrorTime;
    if (timeSinceLastError > this.TIME_WINDOW) {
      tracker.errorCount = 1; // Reset contador
    }

    this.trackers.set(whatsappId, tracker);

    // Verificar se atingiu threshold
    if (tracker.errorCount >= this.ERROR_THRESHOLD && !tracker.isRecovering) {
      logger.warn(`[PREKEY-DETECTOR] Threshold atingido para whatsappId=${whatsappId}: ${tracker.errorCount} erros`);
      this.triggerRecovery(whatsappId);
      return true;
    }

    return false;
  }

  static async triggerRecovery(whatsappId: number): Promise<void> {
    const tracker = this.trackers.get(whatsappId);
    if (!tracker || tracker.isRecovering) return;

    tracker.isRecovering = true;
    tracker.recoveryAttempts++;

    logger.info(`[PREKEY-DETECTOR] Iniciando recuperação para whatsappId=${whatsappId} (tentativa ${tracker.recoveryAttempts})`);

    try {
      // Importar dinamicamente para evitar dependência circular
      const { default: Whatsapp } = require('../../models/Whatsapp');
      const whatsapp = await Whatsapp.findByPk(whatsappId);
      
      if (!whatsapp) {
        logger.error(`[PREKEY-DETECTOR] WhatsApp não encontrado: ${whatsappId}`);
        return;
      }

      // 1. Desconectar
      logger.info(`[PREKEY-DETECTOR] Desconectando whatsappId=${whatsappId}`);
      await whatsapp.update({ status: 'DISCONNECTED' });

      // 2. Limpar sessão
      const sessionPath = require('path').join(__dirname, `../../private/sessions/1/${whatsappId}`);
      const fs = require('fs');
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        logger.info(`[PREKEY-DETECTOR] Sessão removida: ${sessionPath}`);
      }

      // 3. Limpar cache Redis se disponível
      try {
        const redis = require('redis');
        const client = redis.createClient({ url: process.env.REDIS_URL || 'redis://127.0.0.1:6379/0' });
        await client.connect();
        await client.flushAll();
        await client.disconnect();
        logger.info(`[PREKEY-DETECTOR] Cache Redis limpo`);
      } catch (error) {
        logger.warn(`[PREKEY-DETECTOR] Redis não disponível: ${error.message}`);
      }

      // 4. Esperar um momento
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 5. Reconectar
      logger.info(`[PREKEY-DETECTOR] Reconectando whatsappId=${whatsappId}`);
      await whatsapp.update({ status: 'OPENING' });

      // Limpar tracker após recuperação bem-sucedida
      setTimeout(() => {
        this.trackers.delete(whatsappId);
        logger.info(`[PREKEY-DETECTOR] Recuperação concluída para whatsappId=${whatsappId}`);
      }, 10000);

    } catch (error) {
      logger.error(`[PREKEY-DETECTOR] Erro na recuperação do whatsappId=${whatsappId}: ${error.message}`);
      
      // Tentar novamente se não excedeu limite
      if (tracker.recoveryAttempts < this.MAX_RECOVERY_ATTEMPTS) {
        setTimeout(() => {
          tracker.isRecovering = false;
          this.triggerRecovery(whatsappId);
        }, this.RECOVERY_COOLDOWN);
      } else {
        logger.error(`[PREKEY-DETECTOR] Limite de tentativas atingido para whatsappId=${whatsappId}`);
        tracker.isRecovering = false;
      }
    }
  }

  static getTrackerStatus(whatsappId: number): PreKeyErrorTracker | null {
    return this.trackers.get(whatsappId) || null;
  }

  static cleanup(): void {
    const now = Date.now();
    for (const [id, tracker] of this.trackers.entries()) {
      if (now - tracker.lastErrorTime > this.TIME_WINDOW * 2) {
        this.trackers.delete(id);
      }
    }
  }
}

// Limpeza automática a cada hora
setInterval(() => {
  PreKeyErrorDetector.cleanup();
}, 3600000);

module.exports = PreKeyErrorDetector;
