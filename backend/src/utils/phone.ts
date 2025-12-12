import logger from "./logger";

export interface NormalizedPhoneResult {
  canonical: string | null;
  digits: string;
}

export interface CountryMetadata {
  iso: string;
  ddi: string;
  areaCodeLength?: number;
  mobileIndicatorPrefix?: string;
  mobileNationalLengths?: number[];
  landlineNationalLengths?: number[];
}

export const COUNTRY_METADATA: Record<string, CountryMetadata> = {
  "55": {
    iso: "BR",
    ddi: "55",
    areaCodeLength: 2,
    mobileNationalLengths: [11],
    landlineNationalLengths: [10]
  },
  "54": {
    iso: "AR",
    ddi: "54",
    areaCodeLength: 2,
    mobileIndicatorPrefix: "9",
    mobileNationalLengths: [11],
    landlineNationalLengths: [10]
  },
  "1": {
    iso: "US",
    ddi: "1",
    areaCodeLength: 3,
    mobileNationalLengths: [10],
    landlineNationalLengths: [10]
  }
};

export interface ResolvedCountry {
  metadata?: CountryMetadata;
  national: string;
  ddi: string | null;
}

const sortedCountryKeys = Object.keys(COUNTRY_METADATA).sort((a, b) => b.length - a.length);

export const resolveCountryMetadata = (digits: string): ResolvedCountry => {
  for (const key of sortedCountryKeys) {
    if (digits.startsWith(key)) {
      return {
        metadata: COUNTRY_METADATA[key],
        national: digits.slice(key.length),
        ddi: key
      };
    }
  }

  return {
    metadata: undefined,
    national: digits,
    ddi: null
  };
};

const hasKnownDdi = (digits: string): boolean => {
  return sortedCountryKeys.some(key => digits.startsWith(key));
};

/**
 * Normaliza um número de telefone para formato canônico:
 * - Remove caracteres não numéricos
 * - Remove zeros à esquerda
 * - Mantém DDI conhecido; assume Brasil (55) quando não houver DDI e o tamanho indicar número nacional
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

  // Detecta e normaliza números brasileiros
  if (!hasKnownDdi(canonical)) {
    // Se não reconhecemos DDI mas o número parece nacional (10/11 dígitos), assumir Brasil
    if (canonical.length >= 10 && canonical.length <= 11) {
      canonical = `55${canonical}`;
    }
  } else {
    // Se já tem DDI, valida se é BR e se precisa do 9
    const resolved = resolveCountryMetadata(canonical);
    if (resolved.ddi === "55" && resolved.metadata) {
      const national = resolved.national;
      // Número BR deve ter 10 (fixo) ou 11 (celular com 9) dígitos nacionais
      if (national.length === 10) {
        // Verifica se é celular sem o 9: DDD (2 dígitos) + 8 dígitos
        const ddd = national.substring(0, 2);
        const resto = national.substring(2);
        // Se o resto tem 8 dígitos e começa com 6-9, é celular sem o 9
        if (resto.length === 8 && /^[6-9]/.test(resto)) {
          canonical = `55${ddd}9${resto}`;
        }
      } else if (national.length === 13) {
        // Caso especial: 55 + 15 (DDD) + 51786-8419 (11 dígitos) = número duplicado com DDI errado
        // Exemplo: 15517868419 -> deveria ser 5515917868419
        // Detecta padrão: primeiros 2-3 dígitos repetem o DDD
        const possibleDDD = national.substring(0, 2);
        const restAfterDDD = national.substring(2);
        if (restAfterDDD.length === 11 && /^[6-9]/.test(restAfterDDD.substring(1, 2))) {
          // Já tem o 9, apenas reorganiza
          canonical = `55${possibleDDD}${restAfterDDD}`;
        } else if (restAfterDDD.length === 10 && /^[6-9]/.test(restAfterDDD.substring(0, 1))) {
          // Falta o 9
          canonical = `55${possibleDDD}9${restAfterDDD}`;
        }
      }
    }
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

export const isValidCanonicalPhoneNumber = (
  canonical: string | null | undefined
): boolean => {
  const digits = String(canonical ?? "").replace(/\D/g, "");
  if (!digits) return false;

  const { metadata, national, ddi } = resolveCountryMetadata(digits);

  // Fallback genérico quando não reconhece DDI: apenas checa intervalo razoável
  if (!metadata || !ddi) {
    return digits.length >= 10 && digits.length <= 16;
  }

  const allowed = new Set<number>([
    ...(metadata.mobileNationalLengths || []),
    ...(metadata.landlineNationalLengths || [])
  ]);

  if (allowed.size === 0) {
    return national.length >= 6 && national.length <= 16;
  }

  return allowed.has(national.length);
};

export const isValidPhoneNumberByFormat = (
  value: string | null | undefined
): boolean => {
  const { canonical } = safeNormalizePhoneNumber(value);
  return isValidCanonicalPhoneNumber(canonical);
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
