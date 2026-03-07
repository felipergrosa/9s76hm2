import Queue from "bull";
import * as Sentry from "@sentry/node";
import logger from "../utils/logger";
import { ImportContactsService } from "../services/ContactServices/ImportContactsService";
import ContactImportLog from "../models/ContactImportLog";
import { getIO } from "../libs/socket";
import { createAuditLog, AuditActions, AuditEntities } from "../helpers/AuditLogger";

const connection = process.env.REDIS_URI || "";

export const importContactsQueue = new Queue("ImportContacts", connection, {
  limiter: {
    max: 2, // máx 2 importações simultâneas
    duration: 5000
  }
});

interface ImportContactsJobData {
  jobId: string;
  companyId: number;
  userId: number;
  userName: string;
  source: string;
  fileName?: string;
  fileBuffer?: Buffer;
  tagMapping?: any;
  whatsappId?: number;
  silentMode?: boolean;
  dryRun?: boolean;
}

let cancelledJobs: Set<string> = new Set();

export function cancelImportJob(jobId: string) {
  cancelledJobs.add(jobId);
  logger.info(`[ImportContactsQueue] Job ${jobId} marcado para cancelamento`);
}

export function isJobCancelled(jobId: string): boolean {
  return cancelledJobs.has(jobId);
}

async function handleImportContacts(job) {
  const data: ImportContactsJobData = job.data;
  const { jobId, companyId, userId, userName, source, fileName, fileBuffer, tagMapping, whatsappId, silentMode, dryRun } = data;

  const startTime = Date.now();
  let importLog: ContactImportLog | null = null;

  try {
    // Criar log de importação
    importLog = await ContactImportLog.create({
      companyId,
      userId,
      jobId,
      source,
      fileName: fileName || null,
      status: "processing",
      options: JSON.stringify({ tagMapping, whatsappId, silentMode, dryRun }),
      startedAt: new Date()
    });

    logger.info(`[ImportContactsQueue] Iniciando job ${jobId} - Company: ${companyId}, User: ${userId}`);

    // Emitir evento de início via socket
    const io = getIO();
    io.of(`/workspace-${companyId}`).emit(`company-${companyId}-import-status`, {
      jobId,
      status: "processing",
      progress: 0
    });

    // Preparar file para o serviço
    let file: Express.Multer.File | undefined = undefined;
    if (fileBuffer && fileName) {
      file = {
        buffer: fileBuffer,
        originalname: fileName,
        mimetype: fileName.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 
                  fileName.endsWith('.xls') ? 'application/vnd.ms-excel' : 
                  'text/csv',
        fieldname: 'file',
        encoding: '7bit',
        size: fileBuffer.length
      } as any;
    }

    // Executar importação com verificação de cancelamento
    const checkCancelled = () => {
      if (isJobCancelled(jobId)) {
        throw new Error("Import cancelled by user");
      }
    };

    // Verificar cancelamento a cada 1 segundo durante o processamento
    const cancelCheckInterval = setInterval(checkCancelled, 1000);

    try {
      const result = await ImportContactsService(
        companyId,
        file,
        tagMapping,
        whatsappId,
        silentMode,
        dryRun
      );

      clearInterval(cancelCheckInterval);

      // Verificar se foi cancelado após conclusão
      if (isJobCancelled(jobId)) {
        throw new Error("Import cancelled by user");
      }

      const executionTime = Math.floor((Date.now() - startTime) / 1000);

      // Atualizar log com sucesso
      await importLog.update({
        status: "completed",
        totalRecords: result.total || 0,
        processedRecords: result.total || 0,
        createdRecords: result.created || 0,
        updatedRecords: result.updated || 0,
        failedRecords: result.failed?.length || 0,
        errors: result.failed ? JSON.stringify(result.failed) : null,
        completedAt: new Date(),
        executionTime
      });

      // Emitir evento de conclusão via socket
      io.of(`/workspace-${companyId}`).emit(`company-${companyId}-import-status`, {
        jobId,
        status: "completed",
        progress: 100,
        result: {
          total: result.total,
          created: result.created,
          updated: result.updated,
          tagged: result.tagged,
          failed: result.failed?.length || 0
        }
      });

      // Criar log de auditoria
      await createAuditLog({
        userId,
        userName,
        companyId,
        action: AuditActions.IMPORT_COMPLETE,
        entity: AuditEntities.CONTACT,
        details: {
          source,
          fileName,
          total: result.total,
          created: result.created,
          updated: result.updated,
          failed: result.failed?.length || 0,
          executionTime
        }
      });

      logger.info(`[ImportContactsQueue] Job ${jobId} concluído com sucesso`);

      // Remover da lista de cancelados
      cancelledJobs.delete(jobId);

      return result;

    } catch (error) {
      clearInterval(cancelCheckInterval);
      throw error;
    }

  } catch (error: any) {
    Sentry.captureException(error);
    const executionTime = Math.floor((Date.now() - startTime) / 1000);
    const isCancelled = error?.message?.includes("cancelled");

    logger.error(`[ImportContactsQueue] Job ${jobId} falhou: ${error?.message}`);

    if (importLog) {
      await importLog.update({
        status: isCancelled ? "cancelled" : "failed",
        errors: JSON.stringify([{ error: error?.message || "Unknown error" }]),
        completedAt: new Date(),
        executionTime
      });
    }

    // Emitir evento de erro via socket
    const io = getIO();
    io.of(`/workspace-${companyId}`).emit(`company-${companyId}-import-status`, {
      jobId,
      status: isCancelled ? "cancelled" : "failed",
      error: error?.message
    });

    // Remover da lista de cancelados
    cancelledJobs.delete(jobId);

    throw error;
  }
}

// ImportContacts pode validar números via WhatsApp - concurrency=1 por segurança
importContactsQueue.process("ImportContacts", 1, handleImportContacts);

// Limpar jobs antigos periodicamente
importContactsQueue.on("completed", (job) => {
  logger.info(`[ImportContactsQueue] Job ${job.id} completed`);
  job.remove();
});

importContactsQueue.on("failed", (job, err) => {
  logger.error(`[ImportContactsQueue] Job ${job.id} failed: ${err.message}`);
});

export async function addImportContactsJob(data: ImportContactsJobData) {
  return await importContactsQueue.add("ImportContacts", data, {
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: false
  });
}
