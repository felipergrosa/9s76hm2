import logger from "../../utils/logger";
import path from "path";
import fs from "fs";

/**
 * SignalCleanupService - Limpeza de sessões Signal
 * 
 * Responsável por limpar arquivos de chaves Signal (session-*, sender-key-*, pre-key-*)
 * preservando credenciais (creds-*.json) e app-state.
 * 
 * Uso principal: renovação completa da sessão quando QR Code é escaneado,
 * garantindo que não haja chaves antigas/corrompidas causando "Bad MAC".
 */
class SignalCleanupService {
  private sessionsDir: string;

  constructor() {
    this.sessionsDir = process.env.SESSIONS_DIR || "private/sessions";
  }

  /**
   * Limpa arquivos Signal de uma sessão específica
   * Preserva: creds-*.json, app-state-*
   * Deleta: session-*, sender-key-*, pre-key-*
   */
  async cleanupSession(whatsappId: number, companyId?: number): Promise<{
    success: boolean;
    deleted: number;
    preserved: number;
    backupPath?: string;
    error?: string;
  }> {
    const actualCompanyId = companyId || 1;
    const sessionPath = path.join(
      process.cwd(),
      this.sessionsDir,
      String(actualCompanyId),
      String(whatsappId)
    );

    logger.info(`[SignalCleanup] Iniciando limpeza para whatsappId=${whatsappId}, companyId=${actualCompanyId}`);
    logger.info(`[SignalCleanup] Diretório: ${sessionPath}`);

    // Verificar se diretório existe
    if (!fs.existsSync(sessionPath)) {
      logger.info(`[SignalCleanup] Diretório não existe, nada a limpar`);
      return { success: true, deleted: 0, preserved: 0 };
    }

    try {
      // Listar arquivos
      const files = fs.readdirSync(sessionPath);
      
      const signalFiles = files.filter(f => 
        f.startsWith('session-') || 
        f.startsWith('sender-key-') || 
        f.startsWith('pre-key-')
      );
      
      const credsFiles = files.filter(f => 
        f.startsWith('creds-') || 
        f.startsWith('app-state-')
      );

      logger.info(`[SignalCleanup] Arquivos Signal encontrados: ${signalFiles.length}`);
      logger.info(`[SignalCleanup] Arquivos preservados (creds/app-state): ${credsFiles.length}`);

      if (signalFiles.length === 0) {
        logger.info(`[SignalCleanup] Nenhum arquivo Signal para limpar`);
        return { success: true, deleted: 0, preserved: credsFiles.length };
      }

      // Criar backup opcional (zip rápido dos arquivos Signal)
      let backupPath: string | undefined;
      if (process.env.SIGNAL_CLEANUP_BACKUP === "true") {
        const backupDir = path.join(process.cwd(), 'tmp', 'signal-backups');
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }
        backupPath = path.join(backupDir, `backup-${actualCompanyId}-${whatsappId}-${Date.now()}.json`);
        
        const backupData = {
          timestamp: new Date().toISOString(),
          whatsappId,
          companyId: actualCompanyId,
          files: signalFiles,
          // Não incluir conteúdo dos arquivos para não expor chaves
        };
        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
        logger.info(`[SignalCleanup] Backup de metadados criado: ${backupPath}`);
      }

      // Deletar arquivos Signal
      let deleted = 0;
      for (const file of signalFiles) {
        try {
          fs.unlinkSync(path.join(sessionPath, file));
          deleted++;
        } catch (err) {
          logger.warn(`[SignalCleanup] Erro ao deletar ${file}: ${err}`);
        }
      }

      logger.info(`[SignalCleanup] ✅ Limpeza concluída: ${deleted} arquivos deletados, ${credsFiles.length} preservados`);

      return {
        success: true,
        deleted,
        preserved: credsFiles.length,
        backupPath
      };

    } catch (error: any) {
      logger.error(`[SignalCleanup] ❌ Erro na limpeza: ${error?.message}`);
      return {
        success: false,
        deleted: 0,
        preserved: 0,
        error: error?.message
      };
    }
  }

  /**
   * Verifica se uma sessão precisa de limpeza (tem arquivos Signal antigos)
   */
  async needsCleanup(whatsappId: number, companyId?: number): Promise<{
    needsCleanup: boolean;
    signalFilesCount: number;
    oldestFileAge?: number; // em horas
  }> {
    const actualCompanyId = companyId || 1;
    const sessionPath = path.join(
      process.cwd(),
      this.sessionsDir,
      String(actualCompanyId),
      String(whatsappId)
    );

    if (!fs.existsSync(sessionPath)) {
      return { needsCleanup: false, signalFilesCount: 0 };
    }

    try {
      const files = fs.readdirSync(sessionPath);
      const signalFiles = files.filter(f => 
        f.startsWith('session-') || 
        f.startsWith('sender-key-') || 
        f.startsWith('pre-key-')
      );

      // Verificar idade do arquivo mais antigo
      let oldestAge: number | undefined;
      for (const file of signalFiles) {
        try {
          const stats = fs.statSync(path.join(sessionPath, file));
          const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
          if (!oldestAge || ageHours > oldestAge) {
            oldestAge = ageHours;
          }
        } catch { /* ignore */ }
      }

      // Precisa de limpeza se tiver mais de 100 arquivos ou arquivos com mais de 7 dias
      const needsCleanup = signalFiles.length > 100 || (oldestAge !== undefined && oldestAge > 168);

      return {
        needsCleanup,
        signalFilesCount: signalFiles.length,
        oldestFileAge: oldestAge
      };

    } catch {
      return { needsCleanup: false, signalFilesCount: 0 };
    }
  }

  /**
   * Limpa todas as sessões de uma company (útil para manutenção)
   */
  async cleanupAllSessions(companyId?: number): Promise<{
    totalCleaned: number;
    sessionsProcessed: number;
    errors: string[];
  }> {
    const actualCompanyId = companyId || 1;
    const companyPath = path.join(process.cwd(), this.sessionsDir, String(actualCompanyId));

    const result = {
      totalCleaned: 0,
      sessionsProcessed: 0,
      errors: [] as string[]
    };

    if (!fs.existsSync(companyPath)) {
      return result;
    }

    try {
      const sessionDirs = fs.readdirSync(companyPath, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      for (const sessionDir of sessionDirs) {
        const whatsappId = parseInt(sessionDir, 10);
        if (isNaN(whatsappId)) continue;

        try {
          const cleanup = await this.cleanupSession(whatsappId, actualCompanyId);
          if (cleanup.success) {
            result.totalCleaned += cleanup.deleted;
            result.sessionsProcessed++;
          } else if (cleanup.error) {
            result.errors.push(`Session ${whatsappId}: ${cleanup.error}`);
          }
        } catch (err: any) {
          result.errors.push(`Session ${whatsappId}: ${err?.message}`);
        }
      }

    } catch (error: any) {
      result.errors.push(`General: ${error?.message}`);
    }

    return result;
  }
}

export default new SignalCleanupService();
