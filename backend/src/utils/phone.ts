import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js";
import logger from "./logger";

export interface NormalizedPhoneResult {
  canonical: string | null;
  digits: string;
}

/**
 * Normaliza um número de telefone usando libphonenumber-js.
 * - Prioriza formato E.164 (sem o +)
 * - Fallback para IDs do WhatsApp/Meta (10-20 dígitos) se a lib considerar inválido
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

  // FALLBACK PARA IDs DO WHATSAPP / META / LIDs
  // Se a lib não reconhecer como telefone válido, mas tiver entre 10 e 20 dígitos,
  // mantemos os dígitos originais pois pode ser um ID de API Cloud ou LID.
  const finalDigits = digitsOnly.startsWith("5555") ? digitsOnly.slice(2) : digitsOnly;
  if (finalDigits.length >= 10 && finalDigits.length <= 20) {
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

  // Se estiver na faixa de ID do WhatsApp/Meta (14-20 dígitos), consideramos "válido" para o sistema
  if (digits.length >= 14 && digits.length <= 20) return true;

  try {
    return isValidPhoneNumber(canonical.startsWith("+") ? canonical : `+${canonical}`, "BR");
  } catch {
    return digits.length >= 10 && digits.length <= 13;
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
