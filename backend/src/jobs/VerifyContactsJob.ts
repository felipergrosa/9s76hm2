import { CronJob } from "cron";
import { Op, fn, col, where as seqWhere } from "sequelize";
import Contact from "../models/Contact";
import LidMapping from "../models/LidMapping";
import ContactMergeService from "../services/ContactServices/ContactMergeService";
import logger from "../utils/logger";

/**
 * Job de verificação periódica de contatos e grupos
 * 
 * Executa diariamente às 03:00 para:
 * 1. Corrigir grupos sem @g.us
 * 2. Tentar resolver LIDs não resolvidos
 * 3. Mesclar contatos duplicados
 * 4. Limpar LIDs órfãos
 */

let jobInstance: CronJob | null = null;

/**
 * Corrige grupos que não têm @g.us no número
 */
const fixGroupsWithoutGus = async (): Promise<number> => {
  try {
    const [affectedRows] = await Contact.update(
      {
        number: fn("CONCAT", col("number"), "@g.us")
      },
      {
        where: {
          isGroup: true,
          number: {
            [Op.notLike]: "%@g.us"
          }
        }
      }
    );

    if (affectedRows > 0) {
      logger.info(`[VerifyContactsJob] ${affectedRows} grupos corrigidos (adicionado @g.us)`);
    }

    return affectedRows;
  } catch (error: any) {
    logger.error("[VerifyContactsJob] Erro ao corrigir grupos", { error: error?.message });
    return 0;
  }
};

/**
 * Tenta resolver LIDs usando mapeamentos salvos
 */
const resolveLidsFromMappings = async (): Promise<number> => {
  try {
    const mappings = await LidMapping.findAll();
    let resolved = 0;

    for (const mapping of mappings) {
      try {
        const lidContact = await Contact.findOne({
          where: {
            remoteJid: mapping.lid,
            companyId: mapping.companyId,
            isGroup: false
          }
        });

        if (lidContact) {
          const realContact = await Contact.findOne({
            where: {
              [Op.or]: [
                { canonicalNumber: mapping.phoneNumber },
                { number: mapping.phoneNumber }
              ],
              companyId: mapping.companyId,
              isGroup: false,
              id: { [Op.ne]: lidContact.id }
            }
          });

          if (realContact) {
            const result = await ContactMergeService.mergeContacts(
              lidContact.id,
              realContact.id,
              mapping.companyId
            );
            if (result.success) {
              resolved++;
            }
          } else {
            // Atualizar contato LID com número real
            await lidContact.update({
              number: mapping.phoneNumber,
              canonicalNumber: mapping.phoneNumber
            });
            resolved++;
          }
        }
      } catch (e: any) {
        logger.warn("[VerifyContactsJob] Erro ao processar mapping", { 
          lid: mapping.lid, 
          error: e?.message 
        });
      }
    }

    if (resolved > 0) {
      logger.info(`[VerifyContactsJob] ${resolved} LIDs resolvidos via mappings`);
    }

    return resolved;
  } catch (error: any) {
    logger.error("[VerifyContactsJob] Erro ao resolver LIDs", { error: error?.message });
    return 0;
  }
};

/**
 * Resolve LIDs usando o campo remoteJid de contatos com mesmo nome
 * Se existe um contato com LID e outro com o mesmo nome que tem remoteJid real,
 * atualiza o contato LID com o número extraído do remoteJid real
 */
const resolveLidsViaRemoteJid = async (): Promise<number> => {
  try {
    const Ticket = require("../models/Ticket").default;
    const Message = require("../models/Message").default;
    const ContactTag = require("../models/ContactTag").default;
    const sequelize = require("../database").default;

    // Buscar contatos com LID (remoteJid @lid ou número com 14+ dígitos)
    const lidContacts = await Contact.findAll({
      where: {
        isGroup: false,
        [Op.or]: [
          { remoteJid: { [Op.like]: "%@lid" } },
          seqWhere(fn("LENGTH", fn("REGEXP_REPLACE", col("number"), "[^0-9]", "", "g")), {
            [Op.gte]: 14
          })
        ]
      }
    });

    let resolved = 0;

    for (const lidContact of lidContacts) {
      try {
        // Buscar contato real com mesmo nome que tem remoteJid @s.whatsapp.net
        const realContact = await Contact.findOne({
          where: {
            companyId: lidContact.companyId,
            name: lidContact.name,
            id: { [Op.ne]: lidContact.id },
            isGroup: false,
            remoteJid: { [Op.like]: "%@s.whatsapp.net" }
          }
        });

        if (realContact && realContact.remoteJid) {
          // Extrair número do remoteJid real (ex: 5511999999999@s.whatsapp.net -> 5511999999999)
          const realNumber = realContact.remoteJid.replace("@s.whatsapp.net", "");

          if (realNumber && realNumber.length >= 10 && realNumber.length <= 15) {
            // Verificar se há tickets/mensagens no LID
            const lidTickets = await Ticket.count({ where: { contactId: lidContact.id } });
            const realTickets = await Ticket.count({ where: { contactId: realContact.id } });

            if (lidTickets > 0 && realTickets > 0) {
              // Ambos têm tickets - mesclar via ContactMergeService
              const mergeResult = await ContactMergeService.mergeContacts(
                lidContact.id,
                realContact.id,
                lidContact.companyId
              );
              if (mergeResult.success) {
                resolved++;
                logger.info("[VerifyContactsJob] LID mesclado via remoteJid", {
                  lidContactId: lidContact.id,
                  realContactId: realContact.id,
                  name: lidContact.name,
                  realNumber
                });
              }
            } else if (lidTickets > 0) {
              // Só LID tem tickets - transferir para real e deletar LID
              await Ticket.update(
                { contactId: realContact.id },
                { where: { contactId: lidContact.id } }
              );
              await Message.update(
                { contactId: realContact.id },
                { where: { contactId: lidContact.id } }
              );
              await ContactTag.destroy({ where: { contactId: lidContact.id } });
              await lidContact.destroy();
              resolved++;
              logger.info("[VerifyContactsJob] LID transferido e deletado via remoteJid", {
                lidContactId: lidContact.id,
                realContactId: realContact.id,
                name: lidContact.name
              });
            } else {
              // LID não tem tickets - apenas deletar
              await ContactTag.destroy({ where: { contactId: lidContact.id } });
              await lidContact.destroy();
              resolved++;
              logger.info("[VerifyContactsJob] LID órfão deletado (duplicado via remoteJid)", {
                lidContactId: lidContact.id,
                name: lidContact.name
              });
            }
          }
        }
      } catch (e: any) {
        logger.warn("[VerifyContactsJob] Erro ao resolver LID via remoteJid", {
          lidContactId: lidContact.id,
          error: e?.message
        });
      }
    }

    if (resolved > 0) {
      logger.info(`[VerifyContactsJob] ${resolved} LIDs resolvidos via remoteJid`);
    }

    return resolved;
  } catch (error: any) {
    logger.error("[VerifyContactsJob] Erro ao resolver LIDs via remoteJid", { error: error?.message });
    return 0;
  }
};

/**
 * Mescla contatos duplicados (LID + contato real com mesmo nome)
 */
const mergeDuplicateContacts = async (): Promise<number> => {
  try {
    // Buscar todas as empresas
    const companies = await Contact.findAll({
      attributes: [[fn("DISTINCT", col("companyId")), "companyId"]],
      raw: true
    });

    let totalMerged = 0;

    for (const company of companies) {
      const companyId = (company as any).companyId;
      const result = await ContactMergeService.mergeAllDuplicateLids(companyId);
      totalMerged += result.merged;
    }

    if (totalMerged > 0) {
      logger.info(`[VerifyContactsJob] ${totalMerged} contatos duplicados mesclados`);
    }

    return totalMerged;
  } catch (error: any) {
    logger.error("[VerifyContactsJob] Erro ao mesclar duplicados", { error: error?.message });
    return 0;
  }
};

/**
 * Limpa LIDs órfãos (sem tickets ou mensagens)
 */
const cleanOrphanLids = async (): Promise<number> => {
  try {
    const Ticket = require("../models/Ticket").default;
    const Message = require("../models/Message").default;
    const ContactTag = require("../models/ContactTag").default;

    // Buscar LIDs órfãos
    const orphanLids = await Contact.findAll({
      where: {
        isGroup: false,
        [Op.and]: [
          seqWhere(fn("LENGTH", fn("REGEXP_REPLACE", col("number"), "[^0-9]", "", "g")), {
            [Op.gte]: 14
          })
        ]
      }
    });

    let deleted = 0;

    for (const lid of orphanLids) {
      try {
        const ticketCount = await Ticket.count({ where: { contactId: lid.id } });
        const messageCount = await Message.count({ where: { contactId: lid.id } });

        if (ticketCount === 0 && messageCount === 0) {
          await ContactTag.destroy({ where: { contactId: lid.id } });
          await lid.destroy();
          deleted++;
        }
      } catch (e) {
        // Ignorar erros individuais
      }
    }

    if (deleted > 0) {
      logger.info(`[VerifyContactsJob] ${deleted} LIDs órfãos removidos`);
    }

    return deleted;
  } catch (error: any) {
    logger.error("[VerifyContactsJob] Erro ao limpar LIDs órfãos", { error: error?.message });
    return 0;
  }
};

/**
 * Executa todas as verificações
 */
const runVerification = async (): Promise<void> => {
  logger.info("[VerifyContactsJob] Iniciando verificação de contatos e grupos...");
  const startTime = Date.now();

  const groupsFixed = await fixGroupsWithoutGus();
  const lidsResolved = await resolveLidsFromMappings();
  const lidsViaRemoteJid = await resolveLidsViaRemoteJid();
  const duplicatesMerged = await mergeDuplicateContacts();
  const orphansDeleted = await cleanOrphanLids();

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  logger.info("[VerifyContactsJob] Verificação concluída", {
    duration: `${duration}s`,
    groupsFixed,
    lidsResolved,
    lidsViaRemoteJid,
    duplicatesMerged,
    orphansDeleted
  });
};

/**
 * Inicia o job de verificação
 * Executa diariamente às 03:00
 */
const startVerifyContactsJob = (): void => {
  if (jobInstance) {
    logger.warn("[VerifyContactsJob] Job já está em execução");
    return;
  }

  jobInstance = new CronJob(
    "0 3 * * *", // Todos os dias às 03:00
    async () => {
      try {
        await runVerification();
      } catch (error: any) {
        logger.error("[VerifyContactsJob] Erro na execução do job", { error: error?.message });
      }
    },
    null,
    true, // Start immediately
    "America/Sao_Paulo"
  );

  logger.info("[VerifyContactsJob] Job de verificação iniciado (executa às 03:00 diariamente)");
};

/**
 * Para o job de verificação
 */
const stopVerifyContactsJob = (): void => {
  if (jobInstance) {
    jobInstance.stop();
    jobInstance = null;
    logger.info("[VerifyContactsJob] Job de verificação parado");
  }
};

/**
 * Executa verificação manualmente (para testes ou execução imediata)
 */
const runVerificationNow = async (): Promise<void> => {
  await runVerification();
};

export {
  startVerifyContactsJob,
  stopVerifyContactsJob,
  runVerificationNow,
  fixGroupsWithoutGus,
  resolveLidsFromMappings,
  resolveLidsViaRemoteJid,
  mergeDuplicateContacts,
  cleanOrphanLids
};

export default {
  startVerifyContactsJob,
  stopVerifyContactsJob,
  runVerificationNow
};
