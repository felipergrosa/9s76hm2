import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import LidMapping from "../../models/LidMapping";
import sequelize from "../../database";
import logger from "../../utils/logger";
import { safeNormalizePhoneNumber } from "../../utils/phone";
import { getIO } from "../../libs/socket";

/**
 * FASE 4: Job assíncrono de reconciliação de contatos PENDING_
 *
 * Responsabilidades:
 *   1. Buscar contatos com number LIKE 'PENDING_%'
 *   2. Consultar LidMapping para cada um
 *   3. Se encontrar PN:
 *      a. Se já existe contato real → MERGE (transferir tickets/mensagens)
 *      b. Se não existe → PROMOVER (atualizar number/canonical)
 *   4. Reportar métricas
 */

export interface ReconciliationResult {
  totalPending: number;
  reconciled: number;
  merged: number;
  promoted: number;
  failed: number;
  remaining: number;
}

/**
 * Reconcilia contatos pendentes para uma empresa específica.
 */
export async function reconcilePendingContacts(
  companyId: number
): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    totalPending: 0,
    reconciled: 0,
    merged: 0,
    promoted: 0,
    failed: 0,
    remaining: 0
  };

  try {
    // 1. Buscar contatos PENDING_
    const pendingContacts = await Contact.findAll({
      where: {
        companyId,
        number: { [Op.like]: "PENDING_%" },
        isGroup: false
      }
    });

    result.totalPending = pendingContacts.length;

    if (pendingContacts.length === 0) return result;

    logger.info("[ReconcileJob] Iniciando reconciliação", {
      companyId,
      totalPending: pendingContacts.length
    });

    for (const pendingContact of pendingContacts) {
      try {
        const lidJid = pendingContact.lidJid || pendingContact.remoteJid;

        if (!lidJid) {
          logger.warn("[ReconcileJob] Contato PENDING_ sem lidJid/remoteJid", {
            contactId: pendingContact.id
          });
          result.failed++;
          continue;
        }

        // 2. Consultar LidMapping
        const mapping = await LidMapping.findOne({
          where: { lid: lidJid, companyId }
        });

        if (!mapping?.phoneNumber) {
          // Sem mapeamento ainda — permanece pendente
          result.remaining++;
          continue;
        }

        const phoneNumber = mapping.phoneNumber;
        const { canonical } = safeNormalizePhoneNumber(phoneNumber);
        const normalizedNumber = canonical || phoneNumber;

        // 3. Verificar se já existe contato real
        const realContact = await Contact.findOne({
          where: {
            companyId,
            isGroup: false,
            [Op.or]: [
              { canonicalNumber: normalizedNumber },
              { number: normalizedNumber }
            ],
            id: { [Op.ne]: pendingContact.id }
          }
        });

        if (realContact) {
          // 3a. MERGE: transferir tickets e mensagens (com transação atômica)
          const transaction = await sequelize.transaction();
          try {
            const ticketsUpdated = await Ticket.update(
              { contactId: realContact.id },
              { where: { contactId: pendingContact.id }, transaction }
            );

            const messagesUpdated = await Message.update(
              { contactId: realContact.id },
              { where: { contactId: pendingContact.id }, transaction }
            );

            // Atualizar lidJid do contato real
            if (!realContact.lidJid && lidJid) {
              await realContact.update({ lidJid }, { transaction });
            }

            // Remover contato fantasma
            await pendingContact.destroy({ transaction });

            await transaction.commit();

            result.merged++;
            result.reconciled++;
            logger.info("[ReconcileJob] MERGE: contato pendente mesclado", {
              pendingId: pendingContact.id,
              realId: realContact.id,
              ticketsMoved: ticketsUpdated[0],
              messagesMoved: messagesUpdated[0],
              phoneNumber: normalizedNumber
            });

            // Emitir eventos Socket.IO para atualizar frontend
            try {
              const io = getIO();
              io.of(`/workspace-${companyId}`)
                .emit(`company-${companyId}-contact`, { action: "delete", contactId: pendingContact.id });
              io.of(`/workspace-${companyId}`)
                .emit(`company-${companyId}-contact`, { action: "update", contact: realContact });
            } catch { /* socket não crítico */ }
          } catch (txErr: any) {
            await transaction.rollback();
            throw txErr;
          }
        } else {
          // 3b. PROMOVER: atualizar contato pendente com número real
          await pendingContact.update({
            number: normalizedNumber,
            canonicalNumber: normalizedNumber,
            remoteJid: `${normalizedNumber}@s.whatsapp.net`,
            lidJid
          });

          result.promoted++;
          result.reconciled++;
          logger.info("[ReconcileJob] PROMOVER: contato pendente virou real", {
            contactId: pendingContact.id,
            phoneNumber: normalizedNumber,
            lidJid
          });

          // Emitir evento Socket.IO para atualizar frontend
          try {
            const io = getIO();
            io.of(`/workspace-${companyId}`)
              .emit(`company-${companyId}-contact`, { action: "update", contact: pendingContact });
          } catch { /* socket não crítico */ }
        }
      } catch (err: any) {
        result.failed++;
        logger.error("[ReconcileJob] Erro ao reconciliar contato", {
          contactId: pendingContact.id,
          err: err?.message
        });
      }
    }

    result.remaining = result.totalPending - result.reconciled - result.failed;

    logger.info("[ReconcileJob] Reconciliação concluída", {
      companyId,
      ...result
    });
  } catch (err: any) {
    logger.error("[ReconcileJob] Erro fatal na reconciliação", {
      companyId,
      err: err?.message
    });
  }

  return result;
}

/**
 * Reconcilia contatos pendentes para TODAS as empresas.
 * Usar como cron job (ex: a cada 60 segundos).
 */
export async function reconcileAllCompanies(): Promise<void> {
  try {
    // Buscar empresas que têm contatos pendentes
    const companies = await Contact.findAll({
      attributes: ["companyId"],
      where: {
        number: { [Op.like]: "PENDING_%" },
        isGroup: false
      },
      group: ["companyId"],
      raw: true
    });

    if (companies.length === 0) return;

    for (const row of companies) {
      await reconcilePendingContacts((row as any).companyId);
    }
  } catch (err: any) {
    logger.error("[ReconcileJob] Erro ao buscar empresas", { err: err?.message });
  }
}

export default { reconcilePendingContacts, reconcileAllCompanies };
