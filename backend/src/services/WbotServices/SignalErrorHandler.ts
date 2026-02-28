/**
 * SIGNAL ERROR HANDLER - Auto-Recovery Robusto v2
 *
 * Detecta erros de decriptação Signal (Bad MAC, SessionError) e
 * faz auto-recovery PRESERVANDO creds + app-state (sem precisar QR Code).
 *
 * Estratégia:
 *   1. O loggerBaileys detecta erros de decriptação e chama `trackDecryptError`
 *   2. Quando o threshold é atingido (N erros em X segundos), aciona recovery
 *   3. Recovery: deleta APENAS session-*, sender-key-*, pre-key-* do FS
 *   4. Desconecta e reconecta — Baileys renegocia chaves automaticamente
 *   5. NÃO deleta creds nem app-state → sem necessidade de escanear QR
 */
import logger from "../../utils/logger";
import { releaseWbotLock } from "../../libs/wbotMutex";
import path from "path";
import fs from "fs";

// Rastreamento de erros por whatsappId
const errorTrackers = new Map<number, {
  count: number;
  firstError: number;
  lastError: number;
  recovering: boolean;
  recoveryCount: number;
  lastRecovery: number;
}>();

// Thresholds configuráveis via env
const DECRYPT_ERROR_THRESHOLD = parseInt(process.env.SIGNAL_ERROR_THRESHOLD || "5", 10);
const DECRYPT_ERROR_WINDOW_MS = parseInt(process.env.SIGNAL_ERROR_WINDOW_MS || "30000", 10);
const MAX_RECOVERIES_PER_HOUR = parseInt(process.env.SIGNAL_MAX_RECOVERIES_HOUR || "2", 10);
const RECOVERY_DELAY_MS = parseInt(process.env.SIGNAL_RECOVERY_DELAY_MS || "5000", 10);

// Padrões de erro Signal conhecidos
const SIGNAL_ERROR_PATTERNS = [
  "bad mac",
  "no matching sessions",
  "no session found",
  "verifymac",
  "decryptwithsessions",
  "failed to decrypt",
  "invalid prekey id",
];

class SignalErrorHandler {
  /**
   * Verifica se uma string contém padrão de erro Signal
   */
  static isSignalError(error: any): boolean {
    if (!error) return false;
    const errorStr = ((error.message || "") + " " + (error.stack || "")).toLowerCase();
    return SIGNAL_ERROR_PATTERNS.some(p => errorStr.includes(p)) ||
           error.type === "SessionError" ||
           error.type === "PreKeyError";
  }

  /**
   * Chamado pelo loggerBaileys quando detecta erro de decriptação.
   * Acumula erros e aciona recovery quando threshold é atingido.
   */
  static trackDecryptError(whatsappId: number, companyId?: number): void {
    if (!whatsappId) return;

    const now = Date.now();
    let tracker = errorTrackers.get(whatsappId);

    if (!tracker) {
      tracker = {
        count: 0,
        firstError: now,
        lastError: now,
        recovering: false,
        recoveryCount: 0,
        lastRecovery: 0,
      };
      errorTrackers.set(whatsappId, tracker);
    }

    // Se a janela expirou, resetar contagem
    if (now - tracker.firstError > DECRYPT_ERROR_WINDOW_MS) {
      tracker.count = 0;
      tracker.firstError = now;
    }

    tracker.count++;
    tracker.lastError = now;

    // Se já está em recovery, ignorar
    if (tracker.recovering) return;

    // Verificar se atingiu threshold
    if (tracker.count >= DECRYPT_ERROR_THRESHOLD) {
      logger.warn(
        `[SignalError] Threshold atingido: ${tracker.count} erros de decriptação em ` +
        `${Math.round((now - tracker.firstError) / 1000)}s para whatsappId=${whatsappId}. ` +
        `Iniciando auto-recovery...`
      );
      this.triggerRecovery(whatsappId, companyId);
    }
  }

  /**
   * Aciona o processo de recovery: limpa sessões Signal e reconecta
   */
  private static async triggerRecovery(whatsappId: number, companyId?: number): Promise<void> {
    const tracker = errorTrackers.get(whatsappId);
    if (!tracker) return;

    // Verificar limite de recoveries por hora
    const now = Date.now();
    if (now - tracker.lastRecovery < 3600000) {
      if (tracker.recoveryCount >= MAX_RECOVERIES_PER_HOUR) {
        logger.error(
          `[SignalError] Limite de ${MAX_RECOVERIES_PER_HOUR} recoveries/hora atingido para ` +
          `whatsappId=${whatsappId}. Intervenção manual necessária.`
        );
        return;
      }
    } else {
      // Resetar contador de recoveries (nova hora)
      tracker.recoveryCount = 0;
    }

    tracker.recovering = true;
    tracker.recoveryCount++;
    tracker.lastRecovery = now;

    try {
      const { default: Whatsapp } = require("../../models/Whatsapp");
      const whatsapp = await Whatsapp.findByPk(whatsappId);
      if (!whatsapp) {
        tracker.recovering = false;
        return;
      }

      const actualCompanyId = companyId || whatsapp.companyId;

      // 1. Construir caminho da sessão
      const sessionDir = path.resolve(
        process.cwd(),
        process.env.SESSIONS_DIR || "private/sessions",
        String(actualCompanyId || "1"),
        String(whatsappId)
      );

      // 2. Limpar APENAS arquivos Signal (preservar creds + app-state)
      const deleted = this.cleanSignalFiles(sessionDir);
      logger.info(
        `[SignalError] Arquivos Signal removidos para whatsappId=${whatsappId}: ${JSON.stringify(deleted)}`
      );

      // 3. Desconectar a sessão atual
      try {
        const { removeWbot } = require("../../libs/wbot");
        await removeWbot(whatsappId, false);
        logger.info(`[SignalError] Sessão removida do pool para whatsappId=${whatsappId}`);
      } catch (e: any) {
        logger.warn(`[SignalError] Erro ao remover sessão: ${e?.message}`);
      }

      // 4. Liberar lock Redis
      try {
        await releaseWbotLock(whatsappId);
      } catch { /* ignorar */ }

      // 5. Marcar como OPENING (mostra no frontend que está reconectando)
      await whatsapp.update({ status: "OPENING" });

      // 6. Agendar reconexão
      logger.info(
        `[SignalError] Reconexão agendada em ${RECOVERY_DELAY_MS / 1000}s para whatsappId=${whatsappId}`
      );

      setTimeout(async () => {
        try {
          const { StartWhatsAppSessionUnified } = require("./StartWhatsAppSessionUnified");
          await StartWhatsAppSessionUnified(whatsapp, actualCompanyId);
          logger.info(`[SignalError] ✅ Reconexão automática iniciada para whatsappId=${whatsappId}`);
        } catch (reconnectErr: any) {
          logger.error(
            `[SignalError] Erro na reconexão automática: ${reconnectErr?.message}`
          );
          // NÃO marca como PENDING — a conta ainda está autenticada
          // O HealthCheck ou o usuário pode tentar novamente
          try {
            const { default: Whatsapp } = require("../../models/Whatsapp");
            await Whatsapp.update(
              { status: "DISCONNECTED" },
              { where: { id: whatsappId } }
            );
          } catch { /* ignorar */ }
        } finally {
          tracker.recovering = false;
          tracker.count = 0;
        }
      }, RECOVERY_DELAY_MS);

    } catch (err: any) {
      logger.error(`[SignalError] Falha no recovery para whatsappId=${whatsappId}: ${err?.message}`);
      tracker.recovering = false;
    }
  }

  /**
   * Remove APENAS arquivos Signal corrompidos, preservando creds e app-state.
   * Retorna contagem de arquivos removidos por tipo.
   */
  static cleanSignalFiles(sessionDir: string): { sessions: number; senderKeys: number; preKeys: number } {
    const result = { sessions: 0, senderKeys: 0, preKeys: 0 };

    if (!fs.existsSync(sessionDir)) return result;

    try {
      const files = fs.readdirSync(sessionDir);

      for (const file of files) {
        let shouldDelete = false;

        if (file.startsWith("session-")) {
          shouldDelete = true;
          result.sessions++;
        } else if (file.startsWith("sender-key-")) {
          shouldDelete = true;
          result.senderKeys++;
        } else if (file.startsWith("pre-key-")) {
          shouldDelete = true;
          result.preKeys++;
        }

        if (shouldDelete) {
          try {
            fs.unlinkSync(path.join(sessionDir, file));
          } catch { /* ignorar arquivo individual */ }
        }
      }
    } catch (err: any) {
      logger.error(`[SignalError] Erro ao limpar arquivos Signal: ${err?.message}`);
    }

    return result;
  }

  /**
   * Resetar contador de erros (chamado quando sessão conecta com sucesso)
   */
  static resetErrorCount(whatsappId: number): void {
    const tracker = errorTrackers.get(whatsappId);
    if (tracker) {
      tracker.count = 0;
      tracker.recovering = false;
      // NÃO reseta recoveryCount/lastRecovery — proteção por hora mantida
    }
    logger.info(`[SignalError] Contador de erros resetado para whatsappId=${whatsappId}`);
  }

  /**
   * Retorna estatísticas para monitoramento
   */
  static getStats(): Record<number, any> {
    const stats: Record<number, any> = {};
    for (const [id, tracker] of errorTrackers) {
      stats[id] = {
        errors: tracker.count,
        recovering: tracker.recovering,
        recoveriesThisHour: tracker.recoveryCount,
        lastError: tracker.lastError ? new Date(tracker.lastError).toISOString() : null,
        lastRecovery: tracker.lastRecovery ? new Date(tracker.lastRecovery).toISOString() : null,
      };
    }
    return stats;
  }
}

export default SignalErrorHandler;
