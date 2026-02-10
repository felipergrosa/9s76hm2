import logger from "../../utils/logger";
import Contact from "../../models/Contact";
import { getWbot } from "../../libs/wbot";
import { Op } from "sequelize";

/**
 * Serviço para resolver LIDs (Local Identifiers) do WhatsApp para números reais
 * 
 * LIDs são identificadores temporários no formato: 123456789012345@lid
 * Números reais são no formato: 5519999999999@s.whatsapp.net
 * 
 * Este serviço tenta resolver o LID usando o mapping do Baileys
 */

interface ResolveLidResult {
  success: boolean;
  realNumber?: string;
  realJid?: string;
  error?: string;
}

export const isLid = (jid: string): boolean => {
  return jid && jid.includes("@lid");
};

export const extractLidNumber = (jid: string): string => {
  return jid.replace("@lid", "");
};

/**
 * Tenta resolver um LID para o número real usando o Baileys
 */
export const resolveLidToRealNumber = async (
  lidJid: string,
  whatsappId: number
): Promise<ResolveLidResult> => {
  try {
    if (!isLid(lidJid)) {
      return {
        success: false,
        error: "JID fornecido não é um LID"
      };
    }

    logger.info(`[ResolveLID] Tentando resolver LID: ${lidJid} para whatsappId=${whatsappId}`);

    const wbot = getWbot(whatsappId);
    
    if (!wbot) {
      logger.warn(`[ResolveLID] WBOT não encontrado para whatsappId=${whatsappId}`);
      return {
        success: false,
        error: "WBOT não disponível"
      };
    }

    // Tenta buscar o mapping no Baileys
    if (wbot.store && wbot.store.contacts) {
      const lidNumber = extractLidNumber(lidJid);
      logger.info(`[ResolveLID] Procurando mapping para LID ${lidNumber} no store`);
      
      // Procura por número real que corresponda ao LID
      const contacts = wbot.store.contacts;
      
      for (const [jid, contactData] of Object.entries(contacts)) {
        const contact = contactData as any;
        
        // Verifica se este contato tem o LID associado
        if (contact.lid && contact.lid === lidNumber) {
          logger.info(`[ResolveLID] ✓ LID ${lidJid} resolvido para ${jid}`);
          
          // Extrai o número do JID real
          const realNumber = jid.replace("@s.whatsapp.net", "").replace("@c.us", "");
          
          return {
            success: true,
            realNumber,
            realJid: jid
          };
        }
      }
    }

    // NOTA: Fallback via onWhatsApp() removido (risco de banimento se chamado em massa)
    // Resolução deve ser feita apenas via store do Baileys ou LidMapping no banco

    logger.warn(`[ResolveLID] LID ${lidJid} não encontrado no store do Baileys`);
    
    return {
      success: false,
      error: "LID não encontrado no mapping do Baileys"
    };
    
  } catch (error) {
    logger.error(`[ResolveLID] Erro ao resolver LID ${lidJid}:`, error);
    
    return {
      success: false,
      error: error.message || String(error)
    };
  }
};

/**
 * Busca e mescla contatos duplicados (LID + número real do mesmo contato)
 * Delega ao ContactMergeService que usa transação para garantir atomicidade
 */
export const mergeDuplicateLidContacts = async (
  companyId: number,
  lidContactId: number,
  realContactId: number
): Promise<boolean> => {
  try {
    logger.info(`[MergeLID] Mesclando contatos duplicados: LID ${lidContactId} → Real ${realContactId}`);

    const ContactMergeService = require("./ContactMergeService").default;
    const result = await ContactMergeService.mergeContacts(lidContactId, realContactId, companyId);
    
    if (result.success) {
      logger.info(`[MergeLID] ✓ Contatos mesclados com sucesso`, {
        ticketsMoved: result.ticketsMoved,
        messagesMoved: result.messagesMoved,
        tagsCopied: result.tagsCopied
      });
    } else {
      logger.warn(`[MergeLID] Falha na mesclagem: ${result.error}`);
    }

    return result.success;
  } catch (error) {
    logger.error(`[MergeLID] Erro ao mesclar contatos:`, error);
    return false;
  }
};

/**
 * Procura por contatos duplicados (LID + número real) e os mescla automaticamente
 */
export const findAndMergeLidDuplicates = async (
  companyId: number,
  whatsappId: number
): Promise<number> => {
  try {
    logger.info(`[FindMergeLID] Procurando contatos LID duplicados para companyId=${companyId}`);

    // Busca todos os contatos com LID (number @lid OU PENDING_ OU remoteJid @lid)
    const lidContacts = await Contact.findAll({
      where: {
        companyId,
        [Op.or]: [
          { number: { [Op.like]: "%@lid" } },
          { number: { [Op.like]: "PENDING_%" } },
          { remoteJid: { [Op.like]: "%@lid" } }
        ]
      },
      attributes: ["id", "number", "name", "remoteJid"]
    });

    if (lidContacts.length === 0) {
      logger.info(`[FindMergeLID] Nenhum contato LID encontrado`);
      return 0;
    }

    logger.info(`[FindMergeLID] Encontrados ${lidContacts.length} contatos LID`);

    let mergedCount = 0;

    for (const lidContact of lidContacts) {
      try {
        // Tenta resolver o LID
        const resolution = await resolveLidToRealNumber(lidContact.number, whatsappId);

        if (resolution.success && resolution.realNumber) {
          // Busca se existe um contato com o número real
          const realContact = await Contact.findOne({
            where: {
              companyId,
              [Op.or]: [
                { number: resolution.realNumber },
                { number: `${resolution.realNumber}@s.whatsapp.net` },
                { number: `${resolution.realNumber}@c.us` }
              ]
            }
          });

          if (realContact) {
            logger.info(`[FindMergeLID] Encontrado contato real para mesclar: ${realContact.id}`);
            
            const merged = await mergeDuplicateLidContacts(
              companyId,
              lidContact.id,
              realContact.id
            );

            if (merged) {
              mergedCount++;
            }
          } else {
            // Não existe contato real, apenas atualiza o número do LID (com canonicalNumber)
            logger.info(`[FindMergeLID] Atualizando contato LID ${lidContact.id} para número real ${resolution.realNumber}`);
            
            await lidContact.update({
              number: resolution.realNumber,
              canonicalNumber: resolution.realNumber,
              remoteJid: `${resolution.realNumber}@s.whatsapp.net`
            });
            
            mergedCount++;
          }
        }
      } catch (err) {
        logger.warn(`[FindMergeLID] Falha ao processar LID ${lidContact.id}:`, err);
      }
    }

    logger.info(`[FindMergeLID] ✓ ${mergedCount} contatos processados`);
    
    return mergedCount;
    
  } catch (error) {
    logger.error(`[FindMergeLID] Erro ao buscar/mesclar duplicados:`, error);
    return 0;
  }
};

export default {
  isLid,
  extractLidNumber,
  resolveLidToRealNumber,
  mergeDuplicateLidContacts,
  findAndMergeLidDuplicates
};
