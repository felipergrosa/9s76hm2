import logger from "../utils/logger";
import ContactListItem from "../models/ContactListItem";
import CheckContactNumber from "../services/WbotServices/CheckNumber";
import { CheckNumberOfficial, CheckNumbersOfficialBatch } from "../services/MetaServices/CheckNumberOfficial";
import Whatsapp from "../models/Whatsapp";
import { Op } from "sequelize";

interface ValidateWhatsappContactsData {
  contactListId: number;
  companyId: number;
  batchSize?: number;
  useOfficialApi?: boolean;  // Forçar uso da API oficial
}

/**
 * Detecta qual método de validação usar baseado nas conexões disponíveis
 * Prioriza API oficial se disponível, senão usa Baileys
 */
async function detectValidationMethod(companyId: number, forceOfficial?: boolean): Promise<boolean> {
  // Se forçado, usa oficial
  if (forceOfficial === true) return true;
  if (forceOfficial === false) return false;

  try {
    // Verificar se existe conexão oficial ativa
    const officialConnection = await Whatsapp.findOne({
      where: {
        companyId,
        channelType: "official",
        status: "CONNECTED"
      }
    });

    if (officialConnection && officialConnection.wabaPhoneNumberId && officialConnection.wabaAccessToken) {
      logger.info(`[ValidateWhatsappContacts] Conexão oficial encontrada: ${officialConnection.name}`);
      return true;
    }

    // Verificar se existe conexão Baileys ativa
    const baileysConnection = await Whatsapp.findOne({
      where: {
        companyId,
        channelType: { [Op.or]: ["baileys", null] },
        status: "CONNECTED"
      }
    });

    if (baileysConnection) {
      logger.info(`[ValidateWhatsappContacts] Conexão Baileys encontrada: ${baileysConnection.name}`);
      return false;
    }

    // Se não encontrou nenhuma, tenta oficial (vai falhar graciosamente)
    logger.warn(`[ValidateWhatsappContacts] Nenhuma conexão ativa encontrada para empresa ${companyId}`);
    return true;

  } catch (error: any) {
    logger.error(`[ValidateWhatsappContacts] Erro ao detectar método: ${error.message}`);
    return false;
  }
}

export default {
  key: `${process.env.DB_NAME}-validateWhatsappContacts`,

  async handle({ data }: { data: ValidateWhatsappContactsData }) {
    try {
      const { contactListId, companyId, batchSize = 50, useOfficialApi } = data;
      
      logger.info(`[ValidateWhatsappContacts] *** JOB INICIADO *** para lista ${contactListId}, empresa ${companyId}, batchSize ${batchSize}`);

      // Detectar se deve usar API oficial
      const shouldUseOfficial = await detectValidationMethod(companyId, useOfficialApi);
      logger.info(`[ValidateWhatsappContacts] Método de validação: ${shouldUseOfficial ? 'API Oficial Meta' : 'Baileys'}`);

      // Buscar contatos não validados em lotes
      const contacts = await ContactListItem.findAll({
        where: {
          contactListId,
          companyId,
          isWhatsappValid: null
        },
        limit: batchSize,
        order: [['id', 'ASC']]
      });

      if (contacts.length === 0) {
        logger.info(`[ValidateWhatsappContacts] Nenhum contato pendente de validação encontrado para lista ${contactListId}`);
        return;
      }

      logger.info(`[ValidateWhatsappContacts] Validando ${contacts.length} contatos da lista ${contactListId}`);

      let validCount = 0;
      let invalidCount = 0;
      let errorCount = 0;

      // Se usar API oficial, processar em lote (mais eficiente)
      if (shouldUseOfficial) {
        const numbers = contacts.map(c => c.number);
        
        try {
          const batchResult = await CheckNumbersOfficialBatch(numbers, companyId, batchSize);
          
          // Atualizar cada contato com o resultado
          for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            const result = batchResult.results[i];
            
            if (result.status === "valid" && result.wa_id) {
              await contact.update({
                number: result.wa_id,
                isWhatsappValid: true,
                validatedAt: new Date()
              });
              validCount++;
            } else if (result.status === "invalid") {
              await contact.update({
                isWhatsappValid: false,
                validatedAt: new Date()
              });
              invalidCount++;
            } else {
              // Erro - não atualiza, será tentado novamente
              errorCount++;
            }
          }
        } catch (error: any) {
          logger.error(`[ValidateWhatsappContacts] Erro na validação em lote: ${error.message}`);
          errorCount = contacts.length;
        }
      } else {
        // Usar Baileys (método antigo)
        for (const contact of contacts) {
          try {
            const validatedNumber = await CheckContactNumber(contact.number, companyId);
            
            if (validatedNumber) {
              await contact.update({
                number: validatedNumber,
                isWhatsappValid: true,
                validatedAt: new Date()
              });
              validCount++;
            } else {
              await contact.update({
                isWhatsappValid: false,
                validatedAt: new Date()
              });
              invalidCount++;
            }
          } catch (error: any) {
            const msg = error?.message || "";
            if (
              msg === "invalidNumber" ||
              msg === "ERR_WAPP_INVALID_CONTACT" ||
              /não está cadastrado/i.test(msg)
            ) {
              await contact.update({
                isWhatsappValid: false,
                validatedAt: new Date()
              });
              invalidCount++;
            } else {
              logger.warn(`[ValidateWhatsappContacts] Erro ao validar contato ${contact.id}:`, {
                number: contact.number,
                error: msg
              });
              errorCount++;
            }
          }

          // Pequeno delay entre validações para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      logger.info(`[ValidateWhatsappContacts] Lote processado - Lista: ${contactListId}, Válidos: ${validCount}, Inválidos: ${invalidCount}, Erros: ${errorCount}`);

      // Se ainda há contatos para validar, reagendar próximo lote
      const remainingCount = await ContactListItem.count({
        where: {
          contactListId,
          companyId,
          isWhatsappValid: null
        }
      });

      if (remainingCount > 0) {
        logger.info(`[ValidateWhatsappContacts] Reagendando próximo lote - ${remainingCount} contatos restantes`);
        
        // Reagendar próximo lote usando import dinâmico para evitar dependência circular
        try {
          const queues = await import("../queues");
          await queues.validateWhatsappContactsQueue.add(
            "validateWhatsappContacts",
            { contactListId, companyId, batchSize, useOfficialApi: shouldUseOfficial },
            { 
              delay: 5000, // 5 segundos entre lotes
              removeOnComplete: 10,
              removeOnFail: 5
            }
          );
        } catch (importError: any) {
          logger.error(`[ValidateWhatsappContacts] Erro ao reagendar:`, { error: importError.message });
        }
      } else {
        logger.info(`[ValidateWhatsappContacts] Validação completa para lista ${contactListId}`);
      }

    } catch (error: any) {
      logger.error(`[ValidateWhatsappContacts] Erro no job:`, {
        message: error.message,
        stack: error.stack,
        data
      });
      throw error;
    }
  }
};
