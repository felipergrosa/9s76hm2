/**
 * Serviço de Validação de Números WhatsApp via API Oficial da Meta
 * 
 * Usa o endpoint /contacts da Graph API para verificar se números
 * estão registrados no WhatsApp.
 * 
 * Documentação: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers
 */

import axios from "axios";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import { safeNormalizePhoneNumber } from "../../utils/phone";

interface ContactValidationResult {
  input: string;           // Número original enviado
  wa_id: string | null;    // ID do WhatsApp (número normalizado) se válido
  isValid: boolean;        // Se o número está no WhatsApp
  status: "valid" | "invalid" | "error";
  errorMessage?: string;
}

interface BatchValidationResult {
  results: ContactValidationResult[];
  validCount: number;
  invalidCount: number;
  errorCount: number;
}

/**
 * Busca configuração da conexão oficial da empresa
 */
async function getOfficialWhatsappConfig(companyId: number): Promise<{
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
} | null> {
  try {
    // Buscar conexão oficial ativa da empresa
    const whatsapp = await Whatsapp.findOne({
      where: {
        companyId,
        channelType: "official",
        status: "CONNECTED"
      }
    });

    if (!whatsapp) {
      logger.warn(`[CheckNumberOfficial] Nenhuma conexão oficial encontrada para empresa ${companyId}`);
      return null;
    }

    const phoneNumberId = whatsapp.wabaPhoneNumberId;
    const accessToken = whatsapp.wabaAccessToken;

    if (!phoneNumberId || !accessToken) {
      logger.warn(`[CheckNumberOfficial] Conexão oficial sem credenciais completas: whatsappId=${whatsapp.id}`);
      return null;
    }

    return {
      phoneNumberId,
      accessToken,
      apiVersion: "v18.0"
    };
  } catch (error: any) {
    logger.error(`[CheckNumberOfficial] Erro ao buscar config: ${error.message}`);
    return null;
  }
}

/**
 * Valida um único número usando a API oficial
 * 
 * IMPORTANTE: A API oficial da Meta não tem um endpoint direto para verificar
 * se um número está no WhatsApp como o Baileys tem (onWhatsApp).
 * 
 * A estratégia é:
 * 1. Tentar enviar uma mensagem de template (que falha se número inválido)
 * 2. Ou usar o endpoint de contacts que retorna wa_id se válido
 * 
 * O endpoint /contacts é a melhor opção para validação em massa.
 */
export async function CheckNumberOfficial(
  number: string,
  companyId: number
): Promise<string | null> {
  const config = await getOfficialWhatsappConfig(companyId);

  if (!config) {
    throw new Error("Nenhuma conexão oficial disponível para validação");
  }

  const { canonical: normalizedNumber } = safeNormalizePhoneNumber(number);

  try {
    // Usar endpoint de contacts para verificar
    const response = await axios.post(
      `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/contacts`,
      {
        blocking: "wait",
        contacts: [`+${normalizedNumber}`],
        force_check: true
      },
      {
        headers: {
          "Authorization": `Bearer ${config.accessToken}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    const contacts = response.data?.contacts || [];

    if (contacts.length > 0 && contacts[0].status === "valid") {
      const waId = contacts[0].wa_id;
      logger.info(`[CheckNumberOfficial] Número válido: ${number} -> wa_id: ${waId}`);
      return waId;
    }

    logger.info(`[CheckNumberOfficial] Número inválido: ${number}`);
    return null;

  } catch (error: any) {
    const errorData = error.response?.data?.error;
    const errorCode = errorData?.code;
    const errorMessage = errorData?.message || error.message;

    // Código 100 geralmente indica número inválido
    if (errorCode === 100) {
      logger.info(`[CheckNumberOfficial] Número não encontrado no WhatsApp: ${number}`);
      return null;
    }

    // Código 131030 = número não está no WhatsApp
    if (errorCode === 131030) {
      logger.info(`[CheckNumberOfficial] Número não registrado no WhatsApp: ${number}`);
      return null;
    }

    logger.error(`[CheckNumberOfficial] Erro ao validar ${number}: ${errorMessage}`);
    throw new Error(`Erro na validação: ${errorMessage}`);
  }
}

/**
 * Valida múltiplos números em lote (mais eficiente)
 * A API oficial permite até 1000 números por requisição
 */
export async function CheckNumbersOfficialBatch(
  numbers: string[],
  companyId: number,
  batchSize: number = 100
): Promise<BatchValidationResult> {
  const config = await getOfficialWhatsappConfig(companyId);

  if (!config) {
    throw new Error("Nenhuma conexão oficial disponível para validação");
  }

  const results: ContactValidationResult[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let errorCount = 0;

  // Processar em lotes
  for (let i = 0; i < numbers.length; i += batchSize) {
    const batch = numbers.slice(i, i + batchSize);
    const normalizedBatch = batch.map(n => `+${safeNormalizePhoneNumber(n).canonical || n.replace(/\D/g, "")}`);

    logger.info(`[CheckNumberOfficial] Validando lote ${Math.floor(i / batchSize) + 1}: ${batch.length} números`);

    try {
      const response = await axios.post(
        `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/contacts`,
        {
          blocking: "wait",
          contacts: normalizedBatch,
          force_check: true
        },
        {
          headers: {
            "Authorization": `Bearer ${config.accessToken}`,
            "Content-Type": "application/json"
          },
          timeout: 60000
        }
      );

      const contacts = response.data?.contacts || [];

      // Mapear resultados
      for (let j = 0; j < batch.length; j++) {
        const originalNumber = batch[j];
        const contact = contacts[j];

        if (contact && contact.status === "valid") {
          results.push({
            input: originalNumber,
            wa_id: contact.wa_id,
            isValid: true,
            status: "valid"
          });
          validCount++;
        } else {
          results.push({
            input: originalNumber,
            wa_id: null,
            isValid: false,
            status: "invalid"
          });
          invalidCount++;
        }
      }

    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      logger.error(`[CheckNumberOfficial] Erro no lote: ${errorMessage}`);

      // Marcar todos do lote como erro
      for (const num of batch) {
        results.push({
          input: num,
          wa_id: null,
          isValid: false,
          status: "error",
          errorMessage
        });
        errorCount++;
      }
    }

    // Delay entre lotes para não sobrecarregar a API
    if (i + batchSize < numbers.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  logger.info(`[CheckNumberOfficial] Validação concluída: ${validCount} válidos, ${invalidCount} inválidos, ${errorCount} erros`);

  return {
    results,
    validCount,
    invalidCount,
    errorCount
  };
}

/**
 * Método alternativo: Validação "lazy" no momento do envio
 * 
 * Se a API de contacts não estiver disponível ou der erro,
 * podemos validar tentando enviar uma mensagem e verificando o erro.
 * 
 * Erros que indicam número inválido:
 * - 131030: Recipient phone number not in allowed list
 * - 131047: Re-engagement message
 * - 131026: Message undeliverable
 */
export async function ValidateOnSend(
  number: string,
  companyId: number
): Promise<{ isValid: boolean; wa_id: string | null; error?: string }> {
  const config = await getOfficialWhatsappConfig(companyId);

  if (!config) {
    return { isValid: false, wa_id: null, error: "Sem conexão oficial" };
  }

  const { canonical: normalizedNumber } = safeNormalizePhoneNumber(number);

  try {
    // Tentar enviar uma mensagem de "presença" ou template simples
    // Se falhar com erro específico, o número é inválido

    // Por enquanto, apenas normalizar e assumir válido
    // A validação real acontece no momento do envio da campanha
    return {
      isValid: true,
      wa_id: normalizedNumber
    };

  } catch (error: any) {
    const errorCode = error.response?.data?.error?.code;

    // Códigos que indicam número inválido
    const invalidCodes = [131030, 131047, 131026, 100];

    if (invalidCodes.includes(errorCode)) {
      return {
        isValid: false,
        wa_id: null,
        error: "Número não registrado no WhatsApp"
      };
    }

    return {
      isValid: false,
      wa_id: null,
      error: error.message
    };
  }
}

export default CheckNumberOfficial;
