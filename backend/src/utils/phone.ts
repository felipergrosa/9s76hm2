import logger from "./logger";

export interface NormalizedPhoneResult {
  canonical: string | null;
  digits: string;
}

/**
 * Normaliza um número de telefone para formato canônico:
 * - Remove caracteres não numéricos
 * - Remove zeros à esquerda
 * - Garante DDI brasileiro (55) para números com 10 ou 11 dígitos
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

  // Remove zeros à esquerda
  let canonical = digitsOnly.replace(/^0+/, "");
  if (!canonical) {
    return { canonical: null, digits: "" };
  }

  // Se tem 10 ou 11 dígitos e não começa com 55, adiciona DDI brasileiro
  if (!canonical.startsWith("55") && canonical.length >= 10 && canonical.length <= 11) {
    canonical = `55${canonical}`;
  }

  return { canonical, digits: canonical };
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
