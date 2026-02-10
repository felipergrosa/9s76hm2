import { Op, QueryTypes } from "sequelize";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import sequelize from "../../database";

/**
 * Normaliza número de telefone para comparação.
 * Remove tudo que não é dígito e garante formato consistente.
 */
const normalizePhone = (number: string): string => {
  if (!number) return "";
  return number.replace(/\D/g, "");
};

/**
 * Registra evento no log de conexões.
 */
const logConnectionEvent = async (
  whatsappId: number,
  companyId: number,
  phoneNumber: string,
  event: string,
  metadata?: Record<string, any>
): Promise<void> => {
  try {
    await sequelize.query(
      `INSERT INTO "WhatsappConnectionLogs" ("whatsappId", "companyId", "phoneNumber", "event", "metadata", "createdAt")
       VALUES (:whatsappId, :companyId, :phoneNumber, :event, :metadata, NOW())`,
      {
        replacements: {
          whatsappId,
          companyId,
          phoneNumber: normalizePhone(phoneNumber),
          event,
          metadata: metadata ? JSON.stringify(metadata) : null
        },
        type: QueryTypes.INSERT
      }
    );
  } catch (err: any) {
    // Se a tabela ainda não existe (migration não rodou), apenas loga
    if (err?.message?.includes("does not exist") || err?.message?.includes("não existe")) {
      logger.debug(`[ConnectionGuard] Tabela WhatsappConnectionLogs ainda não existe. Ignorando log.`);
      return;
    }
    logger.error(`[ConnectionGuard] Erro ao registrar evento: ${err?.message}`);
  }
};

/**
 * Busca IDs de conexões antigas que usaram o mesmo número de telefone.
 * Retorna IDs que NÃO são a conexão atual.
 */
const findOldConnectionIds = async (
  phoneNumber: string,
  currentWhatsappId: number,
  companyId: number
): Promise<number[]> => {
  const normalized = normalizePhone(phoneNumber);
  if (!normalized) return [];

  try {
    // 1. Buscar no log de conexões (fonte principal)
    const logResults = await sequelize.query(
      `SELECT DISTINCT "whatsappId" FROM "WhatsappConnectionLogs"
       WHERE "phoneNumber" = :phone AND "companyId" = :companyId AND "whatsappId" != :currentId`,
      {
        replacements: { phone: normalized, companyId, currentId: currentWhatsappId },
        type: QueryTypes.SELECT
      }
    ) as any[];

    const idsFromLog = logResults.map((r: any) => r.whatsappId);

    // 2. Buscar conexões existentes com o mesmo número (caso raro de duplicata)
    const existingConns = await Whatsapp.findAll({
      attributes: ["id"],
      where: {
        id: { [Op.ne]: currentWhatsappId },
        companyId,
        number: normalized
      }
    });

    const idsFromDb = existingConns.map(c => c.id);

    // Unir e deduplicar
    const allIds = [...new Set([...idsFromLog, ...idsFromDb])];
    return allIds;
  } catch (err: any) {
    // Se a tabela não existe, buscar apenas por conexões existentes
    if (err?.message?.includes("does not exist") || err?.message?.includes("não existe")) {
      logger.debug(`[ConnectionGuard] Tabela de log não existe, buscando apenas conexões ativas.`);
      return [];
    }
    logger.error(`[ConnectionGuard] Erro ao buscar conexões antigas: ${err?.message}`);
    return [];
  }
};

/**
 * Busca tickets órfãos: tickets cujo whatsappId aponta para conexão inexistente.
 * Filtra por companyId para segurança multi-tenant.
 */
const findOrphanTicketWhatsappIds = async (companyId: number): Promise<number[]> => {
  try {
    const results = await sequelize.query(
      `SELECT DISTINCT t."whatsappId"
       FROM "Tickets" t
       LEFT JOIN "Whatsapps" w ON t."whatsappId" = w.id
       WHERE w.id IS NULL
         AND t."whatsappId" IS NOT NULL
         AND t."companyId" = :companyId`,
      {
        replacements: { companyId },
        type: QueryTypes.SELECT
      }
    ) as any[];

    return results.map((r: any) => r.whatsappId);
  } catch (err: any) {
    logger.error(`[ConnectionGuard] Erro ao buscar tickets órfãos: ${err?.message}`);
    return [];
  }
};

export interface MigrationResult {
  ticketsMigrated: number;
  messagesMigrated: number;
  oldWhatsappIds: number[];
}

/**
 * BLINDAGEM PRINCIPAL: Executada quando uma conexão Baileys abre com sucesso.
 * 
 * 1. Registra o evento de conexão no log
 * 2. Busca conexões antigas com o mesmo número
 * 3. Migra tickets e mensagens órfãos para a conexão atual
 * 
 * Garante que ao recriar uma conexão com o mesmo número,
 * todo o histórico é preservado automaticamente.
 */
export const onConnectionOpen = async (
  whatsappId: number,
  companyId: number,
  phoneNumber: string
): Promise<MigrationResult> => {
  const result: MigrationResult = {
    ticketsMigrated: 0,
    messagesMigrated: 0,
    oldWhatsappIds: []
  };

  const normalized = normalizePhone(phoneNumber);
  if (!normalized) {
    logger.debug(`[ConnectionGuard] Número vazio para whatsappId=${whatsappId}, ignorando.`);
    return result;
  }

  // 1. Registrar conexão no log
  await logConnectionEvent(whatsappId, companyId, normalized, "connected");

  // 2. Buscar IDs de conexões antigas com o mesmo número
  const oldIds = await findOldConnectionIds(normalized, whatsappId, companyId);

  // 3. Buscar IDs de tickets órfãos (conexão inexistente)
  const orphanIds = await findOrphanTicketWhatsappIds(companyId);

  // Unir: conexões antigas conhecidas + tickets órfãos
  const allOldIds = [...new Set([...oldIds, ...orphanIds])].filter(id => id !== whatsappId);

  if (allOldIds.length === 0) {
    logger.debug(`[ConnectionGuard] Nenhuma conexão antiga ou ticket órfão para migrar (whatsappId=${whatsappId}, número=${normalized}).`);
    return result;
  }

  result.oldWhatsappIds = allOldIds;

  logger.warn(`[ConnectionGuard] Detectadas conexões antigas/órfãs para número ${normalized}: [${allOldIds.join(",")}]. Migrando para #${whatsappId}...`);

  // 4. Migrar tickets
  try {
    const [, ticketMeta] = await sequelize.query(
      `UPDATE "Tickets"
       SET "whatsappId" = :newId
       WHERE "whatsappId" IN (:oldIds)
         AND "companyId" = :companyId`,
      {
        replacements: { newId: whatsappId, oldIds: allOldIds, companyId }
      }
    );
    result.ticketsMigrated = (ticketMeta as any)?.rowCount || 0;
  } catch (err: any) {
    logger.error(`[ConnectionGuard] Erro ao migrar tickets: ${err?.message}`);
  }

  // 5. Migrar mensagens (Messages também tem whatsappId em alguns schemas)
  try {
    // Verificar se Messages tem coluna whatsappId
    const [cols] = await sequelize.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'Messages' AND column_name = 'whatsappId'`,
      { type: QueryTypes.SELECT }
    ) as any;

    if (cols?.column_name) {
      const [, msgMeta] = await sequelize.query(
        `UPDATE "Messages"
         SET "whatsappId" = :newId
         WHERE "whatsappId" IN (:oldIds)
           AND "companyId" = :companyId`,
        {
          replacements: { newId: whatsappId, oldIds: allOldIds, companyId }
        }
      );
      result.messagesMigrated = (msgMeta as any)?.rowCount || 0;
    }
  } catch (err: any) {
    // Não é crítico — mensagens são vinculadas via ticketId
    logger.debug(`[ConnectionGuard] Migração de mensagens ignorada: ${err?.message}`);
  }

  // 6. Registrar evento de migração no log
  await logConnectionEvent(whatsappId, companyId, normalized, "migrated", {
    ticketsMigrated: result.ticketsMigrated,
    messagesMigrated: result.messagesMigrated,
    oldWhatsappIds: allOldIds
  });

  logger.warn(
    `[ConnectionGuard] Migração concluída para #${whatsappId} (${normalized}): ` +
    `${result.ticketsMigrated} tickets, ${result.messagesMigrated} mensagens ` +
    `(de conexões [${allOldIds.join(",")}])`
  );

  return result;
};

/**
 * Executada ANTES de apagar uma conexão WhatsApp.
 * Registra o número no log para referência futura.
 */
export const onConnectionDelete = async (
  whatsappId: number,
  companyId: number,
  phoneNumber: string
): Promise<void> => {
  const normalized = normalizePhone(phoneNumber);
  if (!normalized) {
    logger.debug(`[ConnectionGuard] Número vazio ao deletar whatsappId=${whatsappId}, ignorando log.`);
    return;
  }

  await logConnectionEvent(whatsappId, companyId, normalized, "deleted", {
    deletedAt: new Date().toISOString()
  });

  logger.info(`[ConnectionGuard] Conexão #${whatsappId} (${normalized}) registrada como deletada no log.`);
};

export default {
  onConnectionOpen,
  onConnectionDelete,
  normalizePhone
};
