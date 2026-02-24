import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js";
import logger from "./logger";

export interface NormalizedPhoneResult {
  canonical: string | null;
  digits: string;
}

/**
 * Máximo de dígitos para um número de telefone real.
 * Brasil: 55 (DDI) + 2 (DDD) + 9 (número) = 13 dígitos.
 * Números com 14+ dígitos são LIDs ou IDs internos da Meta — NUNCA devem virar contato.
 */
export const MAX_PHONE_DIGITS = 13;

/**
 * Retorna true se o número de dígitos é compatível com um telefone real.
 * Rejeita LIDs (15 dígitos), IDs de grupo (@g.us) e IDs internos da Meta (>13 dígitos).
 */
export const isRealPhoneNumber = (value: string | null | undefined): boolean => {
  if (!value) return false;
  const digits = String(value).replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= MAX_PHONE_DIGITS;
};

/**
 * Detecta se um número "resolvido" é apenas o eco dos dígitos do LID original.
 * Ex: LID "2809646841981@lid" → onWhatsApp retorna "2809646841981@s.whatsapp.net"
 * Isso NÃO é resolução real — é o Baileys ecoando o LID de volta.
 *
 * @param resolvedDigits - Dígitos do número supostamente resolvido
 * @param lidJid - JID @lid original (ex: "2809646841981@lid")
 * @returns true se o número resolvido é apenas eco do LID
 */
export const isLidEcho = (resolvedDigits: string, lidJid: string | null | undefined): boolean => {
  if (!lidJid || !resolvedDigits) return false;
  const lidDigits = lidJid.replace(/\D/g, "");
  // Eco direto: dígitos idênticos
  if (resolvedDigits === lidDigits) return true;
  // Eco parcial: dígitos resolvidos são prefixo ou sufixo do LID (>= 10 chars overlap)
  if (lidDigits.length > 13 && resolvedDigits.length >= 10) {
    if (lidDigits.startsWith(resolvedDigits) || lidDigits.endsWith(resolvedDigits)) return true;
  }
  return false;
};

/**
 * Normaliza um número de telefone usando libphonenumber-js.
 * - Prioriza formato E.164 (sem o +)
 * - NÃO aceita LIDs ou IDs internos da Meta como canonical válido
 */
export const normalizePhoneNumber = (
  value: string | null | undefined
): NormalizedPhoneResult => {
  if (value === null || value === undefined) {
    return { canonical: null, digits: "" };
  }

  const raw = String(value).trim();
  if (!raw) {
    return { canonical: null, digits: "" };
  }

  const digitsOnly = raw.replace(/\D/g, "");
  if (!digitsOnly) {
    return { canonical: null, digits: "" };
  }

  try {
    // Tratamento para DDIs duplicados (ex: 555511999...)
    let cleanedDigits = digitsOnly;
    if (cleanedDigits.startsWith("5555")) {
      cleanedDigits = cleanedDigits.slice(2);
    }

    // Tentar parsear com libphonenumber-js
    // Assume Brasil (BR) como default se não houver DDI claro
    // Adicionamos + se não tiver, para forçar o parse como internacional se possível
    let phoneNumberToParse = cleanedDigits;
    if (!cleanedDigits.startsWith("+")) {
      // Se tiver 12-13 dígitos e começar com 55, assume que já tem DDI
      if (cleanedDigits.length >= 12 && cleanedDigits.startsWith("55")) {
        phoneNumberToParse = `+${cleanedDigits}`;
      } else {
        // Senão, o parse com "BR" resolverá
        phoneNumberToParse = cleanedDigits;
      }
    }

    const parsed = parsePhoneNumber(phoneNumberToParse, "BR");

    if (parsed && parsed.isValid()) {
      const canonical = parsed.format("E.164").replace("+", "");
      return { canonical, digits: canonical };
    }
  } catch (err) {
    // Silencioso: fallback para lógica de dígitos abaixo
  }

  // Fallback conservador: aceitar apenas números com comprimento de telefone real (10-13 dígitos).
  // LIDs (15 dígitos) e IDs internos da Meta (>13 dígitos) são REJEITADOS aqui.
  const finalDigits = digitsOnly.startsWith("5555") ? digitsOnly.slice(2) : digitsOnly;
  if (finalDigits.length >= 10 && finalDigits.length <= MAX_PHONE_DIGITS) {
    return { canonical: finalDigits, digits: finalDigits };
  }

  return { canonical: null, digits: digitsOnly };
};

/**
 * Retorna true se os dois números representarem o mesmo contato após normalização.
 */
export const arePhoneNumbersEquivalent = (
  a: string | null | undefined,
  b: string | null | undefined
): boolean => {
  const first = normalizePhoneNumber(a).canonical;
  const second = normalizePhoneNumber(b).canonical;
  return !!first && !!second && first === second;
};

export const isValidCanonicalPhoneNumber = (
  canonical: string | null | undefined
): boolean => {
  if (!canonical) return false;
  const digits = String(canonical).replace(/\D/g, "");

  // LIDs e IDs internos da Meta (>13 dígitos) NÃO são números de telefone válidos
  if (digits.length > MAX_PHONE_DIGITS) return false;

  try {
    return isValidPhoneNumber(canonical.startsWith("+") ? canonical : `+${canonical}`, "BR");
  } catch {
    return digits.length >= 10 && digits.length <= MAX_PHONE_DIGITS;
  }
};

export const isValidPhoneNumberByFormat = (
  value: string | null | undefined
): boolean => {
  const { canonical } = safeNormalizePhoneNumber(value);
  return isValidCanonicalPhoneNumber(canonical);
};

/**
 * Formata um número para exibição internacional.
 */
export const formatPhoneNumber = (
  value: string | null | undefined
): string => {
  if (!value) return "";
  try {
    const raw = String(value);
    const parsed = parsePhoneNumber(raw.startsWith("+") ? raw : `+${raw}`, "BR");
    if (parsed && parsed.isValid()) {
      return parsed.formatInternational();
    }
  } catch (err) {
    // Fallback
  }
  return String(value);
};

/**
 * Helper seguro para aplicar normalização centralizada com log em caso de erro.
 */
export const safeNormalizePhoneNumber = (
  value: string | null | undefined
): NormalizedPhoneResult => {
  try {
    return normalizePhoneNumber(value);
  } catch (err) {
    logger.warn({ value, err }, "[phone.safeNormalize] Erro ao normalizar número");
    return { canonical: null, digits: "" };
  }
};
