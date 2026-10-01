/**
 * Builder compartilhado de condições SQL para filtros de contatos.
 * Usado por:
 *  - AddFilteredContactsToListService (INSERT SELECT direto)
 *  - SyncContactListBySavedFilterService (conjunto válido p/ remoção)
 * Manter um único builder evita drift entre o filtro que adiciona
 * e o filtro que remove itens da lista na sincronização diária.
 */

export interface ContactFilterSqlParams {
  channel?: string[] | string;
  representativeCode?: string[] | string;
  city?: string[] | string;
  region?: string[] | string;
  segment?: string[] | string;
  situation?: string[] | string;
  foundationMonths?: number[] | string[];
  minCreditLimit?: string;
  maxCreditLimit?: string;
  tags?: number[];
  excludeTags?: number[];
  florder?: boolean | string;
  dtUltCompraStart?: string;
  dtUltCompraEnd?: string;
  minVlUltCompra?: number | string;
  maxVlUltCompra?: number | string;
  bzEmpresa?: string | string[];
  // Filtros de vínculo operacional
  whatsappIds?: number[] | string[];
  walletIds?: number[] | string[];
  whatsappInvalid?: boolean | string;
  isWhatsappValid?: boolean | string;
}

export interface ContactFilterSqlResult {
  conds: string[];
  repl: Record<string, any>;
  hasEffectiveFilters: boolean;
}

// Normaliza valor para array de strings (aceita array, CSV ou JSON string)
export const normalizeStringArray = (val: any): string[] => {
  if (val == null) return [];
  if (Array.isArray(val)) {
    return val.map(v => (v == null ? "" : String(v).trim())).filter(Boolean);
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(v => (v == null ? "" : String(v).trim())).filter(Boolean);
      }
    } catch { /* ignore */ }
    if (trimmed.includes(",")) {
      return trimmed.split(",").map(s => s.trim()).filter(Boolean);
    }
    return [trimmed];
  }
  return [];
};

const normalizeIdArray = (val: any): number[] => {
  const arr = Array.isArray(val) ? val : normalizeStringArray(val);
  return arr
    .map((t: any) => (typeof t === "string" ? parseInt(t, 10) : Number(t)))
    .filter((t: number) => Number.isInteger(t) && t > 0);
};

const normalizeBool = (v: any): boolean | null => {
  if (typeof v === "boolean") return v;
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (["true", "1", "sim", "yes"].includes(s)) return true;
  if (["false", "0", "nao", "não", "no"].includes(s)) return false;
  return null;
};

const parseMoney = (val: string): number => {
  const raw = String(val).trim().replace(/\s+/g, "").replace(/R\$?/gi, "");
  if (raw.includes(",")) return parseFloat(raw.replace(/\./g, "").replace(/,/g, "."));
  return parseFloat(raw);
};

/**
 * Monta as condições WHERE sobre o alias `c` (Contacts) para os filtros.
 * Inclui sempre as condições base: companyId, isGroup=false e
 * canonicalNumber válido (mesma regra dos dois consumidores).
 */
export const buildContactFilterSql = (
  companyId: number | string,
  filters: ContactFilterSqlParams
): ContactFilterSqlResult => {
  const conds: string[] = ['c."companyId" = :companyId'];
  const repl: Record<string, any> = { companyId };

  // Regra: apenas contatos com número canônico válido, excluindo grupos
  conds.push('c."isGroup" = false');
  conds.push('c."canonicalNumber" IS NOT NULL');
  conds.push('LENGTH(c."canonicalNumber") BETWEEN 10 AND 16');

  const channel = normalizeStringArray(filters.channel);
  const representativeCode = normalizeStringArray(filters.representativeCode);
  const city = normalizeStringArray(filters.city);
  const region = normalizeStringArray(filters.region);
  const segment = normalizeStringArray(filters.segment);
  const situation = normalizeStringArray(filters.situation);
  const bzEmpresaArr = normalizeStringArray(filters.bzEmpresa);
  const tags = normalizeIdArray(filters.tags);
  const excludeTagIds = normalizeIdArray(filters.excludeTags);
  const whatsappIds = normalizeIdArray(filters.whatsappIds);
  const walletIds = normalizeIdArray(filters.walletIds);
  const florderBool = normalizeBool(filters.florder);
  const whatsappInvalid = normalizeBool(filters.whatsappInvalid);

  const hasEffectiveFilters = Boolean(
    channel.length || representativeCode.length || city.length || region.length ||
    segment.length || situation.length || bzEmpresaArr.length || tags.length ||
    excludeTagIds.length || whatsappIds.length || walletIds.length ||
    (filters.foundationMonths && (filters.foundationMonths as any[]).length > 0) ||
    filters.minCreditLimit || filters.maxCreditLimit ||
    filters.dtUltCompraStart || filters.dtUltCompraEnd ||
    filters.minVlUltCompra != null || filters.maxVlUltCompra != null ||
    florderBool !== null || whatsappInvalid === true ||
    // aceita também isWhatsappValid=false direto (mesmo efeito do whatsappInvalid)
    normalizeBool(filters.isWhatsappValid) === false
  );

  const addIn = (col: string, arr: string[]) => {
    if (arr.length > 0) {
      const key = col.replace(/\W/g, "_");
      // IS NOT NULL evita que NULL passe pelo IN (NULL IN (...) retorna NULL)
      conds.push(`c.${col} IS NOT NULL`);
      conds.push(`c.${col} IN (:${key})`);
      repl[key] = arr;
    }
  };

  // Campos "código nome": casa pelo PREFIXO numérico do valor selecionado,
  // assim variantes antigas do mesmo código (pré-propagação) também casam.
  // Valores sem prefixo numérico caem no IN literal.
  const addCodeNameIn = (col: string, arr: string[], keyBase: string) => {
    if (!arr.length) return;
    const codes: string[] = [];
    const literals: string[] = [];
    for (const v of arr) {
      const m = String(v).trim().match(/^(\d+)/);
      if (m) codes.push(m[1]);
      else literals.push(v);
    }
    const parts: string[] = [];
    if (codes.length) {
      const key = `${keyBase}Codes`;
      repl[key] = Array.from(new Set(codes));
      parts.push(`substring(c.${col} from '^\\s*(\\d+)') IN (:${key})`);
    }
    if (literals.length) {
      const key = `${keyBase}Lit`;
      repl[key] = literals;
      parts.push(`c.${col} IN (:${key})`);
    }
    conds.push(`c.${col} IS NOT NULL`);
    conds.push(`(${parts.join(" OR ")})`);
  };

  addIn('"channel"', channel);
  addCodeNameIn('"representativeCode"', representativeCode, "rep");
  addIn('"city"', city);
  addIn('"region"', region);
  addCodeNameIn('"segment"', segment, "segment");
  addIn('"situation"', situation);

  // Empresa (ERP): casa pelo código quando o valor tem prefixo numérico;
  // valores sem código usam ILIKE (formato livre)
  if (bzEmpresaArr.length > 0) {
    const codes = bzEmpresaArr.map(v => String(v).trim().match(/^(\d+)/)?.[1]).filter(Boolean) as string[];
    const noCode = bzEmpresaArr.filter(v => !/^\s*\d+/.test(String(v).trim()));
    const parts: string[] = [];
    if (codes.length > 0) {
      repl.bzEmpresaCodes = Array.from(new Set(codes));
      parts.push(`substring(c."bzEmpresa" from '^\\s*(\\d+)') IN (:bzEmpresaCodes)`);
    }
    if (noCode.length > 0) {
      const orConds = noCode.map((e, i) => {
        const key = `bzEmpresa${i}`;
        repl[key] = `%${e.trim()}%`;
        return `c."bzEmpresa" ILIKE :${key}`;
      });
      parts.push(`(${orConds.join(" OR ")})`);
    }
    conds.push(`(${parts.join(" OR ")})`);
  }

  if (florderBool !== null) {
    repl.florder = florderBool;
    conds.push('c."florder" = :florder');
  }

  if (filters.dtUltCompraStart) {
    repl.dtStart = filters.dtUltCompraStart;
    conds.push('c."dtUltCompra" >= :dtStart');
  }
  if (filters.dtUltCompraEnd) {
    repl.dtEnd = filters.dtUltCompraEnd;
    conds.push('c."dtUltCompra" <= :dtEnd');
  }

  const minV = filters.minVlUltCompra != null && filters.minVlUltCompra !== ""
    ? Number(filters.minVlUltCompra) : null;
  const maxV = filters.maxVlUltCompra != null && filters.maxVlUltCompra !== ""
    ? Number(filters.maxVlUltCompra) : null;
  if (minV != null && !Number.isNaN(minV)) {
    repl.minV = minV;
    conds.push('c."vlUltCompra" >= :minV');
  }
  if (maxV != null && !Number.isNaN(maxV)) {
    repl.maxV = maxV;
    conds.push('c."vlUltCompra" <= :maxV');
  }

  if (Array.isArray(filters.foundationMonths) && filters.foundationMonths.length > 0) {
    const months = (filters.foundationMonths as any[])
      .map(n => Number(n))
      .filter(n => Number.isInteger(n) && n >= 1 && n <= 12);
    if (months.length > 0) {
      conds.push('c."foundationDate" IS NOT NULL');
      conds.push(`EXTRACT(MONTH FROM c."foundationDate") IN (${months.join(",")})`);
    }
  }

  // Limite de crédito é VARCHAR no formato BRL/EN-US — CAST defensivo
  if (filters.minCreditLimit || filters.maxCreditLimit) {
    const creditSql = `CAST(CASE WHEN TRIM(c."creditLimit") = '' THEN NULL WHEN POSITION(',' IN TRIM(c."creditLimit")) > 0 THEN REPLACE(REPLACE(REPLACE(TRIM(REPLACE(c."creditLimit", 'R$', '')), '.', ''), ',', '.'), ' ', '') ELSE REPLACE(TRIM(REPLACE(c."creditLimit", 'R$', '')), ' ', '') END AS NUMERIC)`;
    const hasMin = typeof filters.minCreditLimit !== "undefined" && filters.minCreditLimit !== "";
    const hasMax = typeof filters.maxCreditLimit !== "undefined" && filters.maxCreditLimit !== "";
    if (hasMin && hasMax) {
      repl.minCredit = parseMoney(filters.minCreditLimit as string);
      repl.maxCredit = parseMoney(filters.maxCreditLimit as string);
      conds.push(`${creditSql} BETWEEN :minCredit AND :maxCredit`);
    } else if (hasMin) {
      repl.minCredit = parseMoney(filters.minCreditLimit as string);
      conds.push(`${creditSql} >= :minCredit`);
    } else if (hasMax) {
      repl.maxCredit = parseMoney(filters.maxCreditLimit as string);
      conds.push(`${creditSql} <= :maxCredit`);
    }
  }

  // Tags inclusivas: contato DEVE ter TODAS
  if (tags.length > 0) {
    repl.tagIds = tags;
    repl.tagsLen = tags.length;
    conds.push(`c."id" IN (SELECT "contactId" FROM (SELECT "contactId", COUNT(DISTINCT "tagId") AS tag_count FROM "ContactTags" WHERE "tagId" IN (:tagIds) GROUP BY "contactId") t WHERE t.tag_count = :tagsLen)`);
  }

  // Tags exclusivas: contato NÃO pode ter NENHUMA
  if (excludeTagIds.length > 0) {
    repl.excludeTagIds = excludeTagIds;
    conds.push(`c."id" NOT IN (SELECT DISTINCT "contactId" FROM "ContactTags" WHERE "tagId" IN (:excludeTagIds))`);
  }

  // Conexão WhatsApp de origem do contato
  if (whatsappIds.length > 0) {
    repl.whatsappIds = whatsappIds;
    conds.push('c."whatsappId" IN (:whatsappIds)');
  }

  // WhatsApp inválido: aceita whatsappInvalid=true ou isWhatsappValid=false
  const isInvalidFilter = whatsappInvalid === true || normalizeBool(filters.isWhatsappValid) === false;
  if (isInvalidFilter) {
    conds.push('c."isWhatsappValid" = false');
  }

  // Carteira (responsável): contato precisa ter tag pessoal (#) de algum
  // dos usuários selecionados — tags pessoais ficam em allowedContactTags
  if (walletIds.length > 0) {
    repl.walletIds = walletIds;
    conds.push(`EXISTS (
      SELECT 1 FROM "ContactTags" ct
      JOIN "Users" u ON ct."tagId" = ANY(u."allowedContactTags")
      JOIN "Tags" t ON t.id = ct."tagId"
      WHERE ct."contactId" = c."id"
        AND u."id" IN (:walletIds)
        AND u."companyId" = :companyId
        AND t."name" LIKE '#%' AND t."name" NOT LIKE '##%'
    )`);
  }

  return { conds, repl, hasEffectiveFilters };
};
