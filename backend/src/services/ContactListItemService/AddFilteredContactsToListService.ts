import { Sequelize, Op, literal, QueryTypes } from "sequelize";
import Contact from "../../models/Contact";
import ContactListItem from "../../models/ContactListItem";
import logger from "../../utils/logger";
import CheckContactNumber from "../WbotServices/CheckNumber";
import sequelize from "../../database";
import { isValidCanonicalPhoneNumber, safeNormalizePhoneNumber } from "../../utils/phone";

interface FilterParams {
  channel?: string[];
  representativeCode?: string[];
  city?: string[];
  segment?: string[];
  situation?: string[];
  foundationMonths?: number[]; // 1-12
  minCreditLimit?: string;
  maxCreditLimit?: string;
  tags?: number[];
  florder?: boolean | string; // encomenda Sim/Não
  dtUltCompraStart?: string; // yyyy-mm-dd
  dtUltCompraEnd?: string;   // yyyy-mm-dd
  minVlUltCompra?: number | string; // valor mínimo da última compra
  maxVlUltCompra?: number | string; // valor máximo da última compra
  bzEmpresa?: string; // filtro por empresa
}

interface Request {
  contactListId: number;
  companyId: number;
  filters: FilterParams;
}

interface Response {
  added: number;
  duplicated: number;
  errors: number;
}

const normalizePhoneNumber = (value: string | null | undefined): { normalized: string | null; digits: string } => {
  const digitsOnly = String(value ?? "").replace(/\D/g, "");
  if (!digitsOnly) {
    return { normalized: null, digits: "" };
  }
  let normalized = digitsOnly.replace(/^0+/, "");
  if (!normalized) {
    return { normalized: null, digits: "" };
  }
  if (!normalized.startsWith("55") && normalized.length >= 10 && normalized.length <= 11) {
    normalized = `55${normalized}`;
  }
  return { normalized, digits: normalized };
};

const digitsOnly = (value: string | null | undefined): string => String(value ?? "").replace(/\D/g, "");

const processWithConcurrency = async <T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> => {
  if (items.length === 0) return;
  const limit = Math.max(1, concurrency);
  let index = 0;

  const run = async (): Promise<void> => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      await worker(items[currentIndex]);
    }
  };

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => run());
  await Promise.all(runners);
};

const AddFilteredContactsToListService = async ({
  contactListId,
  companyId,
  filters
}: Request): Promise<Response> => {
  try {
    // Validar parâmetros de entrada
    if (!contactListId) {
      throw new Error('ID da lista de contatos não informado');
    }

    if (!companyId) {
      throw new Error('ID da empresa não informado');
    }

    if (!filters || Object.keys(filters).length === 0) {
      throw new Error('Nenhum filtro informado');
    }

    logger.info(`Iniciando adição de contatos filtrados à lista ${contactListId}`);
    logger.info(`Filtros recebidos: ${JSON.stringify(filters)}`);

    // Normalização defensiva dos filtros para aceitar string, array e JSON string
    const normalizeStringArray = (val: any): string[] => {
      if (val == null) return [];
      if (Array.isArray(val)) {
        return val
          .map(v => (v == null ? "" : String(v).trim()))
          .filter(Boolean);
      }
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (!trimmed) return [];
        // Tenta JSON.parse se vier como '["A","B"]'
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed
              .map(v => (v == null ? "" : String(v).trim()))
              .filter(Boolean);
          }
        } catch { /* ignore */ }
        // CSV simples "A,B"
        if (trimmed.includes(",")) {
          return trimmed.split(",").map(s => s.trim()).filter(Boolean);
        }
        return [trimmed];
      }
      return [];
    };

    // Aplica normalização nos principais filtros multi-valor
    filters.channel = normalizeStringArray((filters as any).channel);
    filters.representativeCode = normalizeStringArray((filters as any).representativeCode);
    filters.city = normalizeStringArray((filters as any).city);
    filters.segment = normalizeStringArray((filters as any).segment);
    filters.situation = normalizeStringArray((filters as any).situation);

    // tags: garantir array numérico
    if ((filters as any).tags) {
      try {
        (filters as any).tags = (Array.isArray((filters as any).tags) ? (filters as any).tags : [(filters as any).tags])
          .map((t: any) => typeof t === "string" ? parseInt(t, 10) : t)
          .filter((t: any) => Number.isInteger(t));
      } catch (e) {
        logger.warn(`Falha ao normalizar tags`, { tags: (filters as any).tags, error: (e as any)?.message });
      }
    }

    logger.info(`Filtros após normalização: ${JSON.stringify(filters)}`);

    // Verificar se há filtros efetivos (além de flags booleanas)
    const hasEffectiveFilters = Boolean(
      (filters.channel && filters.channel.length > 0) ||
      (filters.representativeCode && filters.representativeCode.length > 0) ||
      (filters.city && filters.city.length > 0) ||
      (filters.segment && filters.segment.length > 0) ||
      (filters.situation && filters.situation.length > 0) ||
      (filters.bzEmpresa && String(filters.bzEmpresa).trim()) ||
      (filters.tags && filters.tags.length > 0) ||
      (filters.foundationMonths && filters.foundationMonths.length > 0) ||
      filters.minCreditLimit || filters.maxCreditLimit ||
      (filters as any).dtUltCompraStart || (filters as any).dtUltCompraEnd ||
      (filters as any).minVlUltCompra != null || (filters as any).maxVlUltCompra != null ||
      ((filters as any).florder !== undefined && (filters as any).florder !== null)
    );

    if (!hasEffectiveFilters) {
      logger.info('Nenhum filtro específico informado - adicionando todos os contatos da empresa');
    }

    // Caminho direto SQL: quando não validamos WhatsApp no ato
    const directSQL = String(process.env.CONTACT_FILTER_DIRECT_SQL || 'true').toLowerCase() === 'true';
    const shouldValidateWhatsappEarly = String(process.env.CONTACT_FILTER_VALIDATE_WHATSAPP || 'false').toLowerCase() === 'true';

    if (directSQL && !shouldValidateWhatsappEarly) {
      const conds: string[] = ['c."companyId" = :companyId'];
      const repl: any = { companyId, contactListId };

      // Regra: só inserir contatos com número canônico válido, EXCLUINDO GRUPOS
      // Grupos não devem aparecer em listas de contatos
      conds.push('c."isGroup" = false');
      conds.push('c."canonicalNumber" IS NOT NULL');
      conds.push('LENGTH(c."canonicalNumber") BETWEEN 10 AND 16');

      const addIn = (col: string, arr?: string[]) => {
        if (arr && arr.length > 0) {
          conds.push(`c.${col} IN (:${col.replace(/\W/g, '_')})`);
          repl[col.replace(/\W/g, '_')] = arr;
        }
      };

      // Só adiciona filtros se há filtros efetivos
      if (hasEffectiveFilters) {
        addIn('"channel"', filters.channel);
        addIn('"representativeCode"', filters.representativeCode);
        addIn('"city"', filters.city);
        addIn('"segment"', filters.segment);
        addIn('"situation"', filters.situation);

        if (filters.bzEmpresa && String(filters.bzEmpresa).trim()) {
          repl.bzEmpresa = `%${String(filters.bzEmpresa).trim()}%`;
          conds.push('c."bzEmpresa" ILIKE :bzEmpresa');
        }

        if ((filters as any).florder !== undefined && (filters as any).florder !== null) {
          const raw = (filters as any).florder;
          const s = String(raw).trim().toLowerCase();
          const b = (typeof raw === 'boolean') ? raw : ["true", "1", "sim", "yes"].includes(s) ? true : ["false", "0", "nao", "não", "no"].includes(s) ? false : null;
          if (b !== null) {
            repl.florder = b;
            conds.push('c."florder" = :florder');
          }
        }

        if ((filters as any).dtUltCompraStart) {
          repl.dtStart = (filters as any).dtUltCompraStart;
          conds.push('c."dtUltCompra" >= :dtStart');
        }
        if ((filters as any).dtUltCompraEnd) {
          repl.dtEnd = (filters as any).dtUltCompraEnd;
          conds.push('c."dtUltCompra" <= :dtEnd');
        }

        if ((filters as any).minVlUltCompra != null) {
          const v = Number((filters as any).minVlUltCompra);
          if (!Number.isNaN(v)) {
            repl.minV = v;
            conds.push('c."vlUltCompra" >= :minV');
          }
        }
        if ((filters as any).maxVlUltCompra != null) {
          const v = Number((filters as any).maxVlUltCompra);
          if (!Number.isNaN(v)) {
            repl.maxV = v;
            conds.push('c."vlUltCompra" <= :maxV');
          }
        }

        if (filters.foundationMonths && filters.foundationMonths.length > 0) {
          const months = filters.foundationMonths.map(n => Number(n)).filter(n => Number.isInteger(n) && n >= 1 && n <= 12);
          if (months.length > 0) {
            conds.push('c."foundationDate" IS NOT NULL');
            conds.push(`EXTRACT(MONTH FROM c."foundationDate") IN (${months.join(',')})`);
          }
        }

        if (filters.minCreditLimit || filters.maxCreditLimit) {
          const parseMoney = (val: string): number => {
            const raw = String(val).trim().replace(/\s+/g, '').replace(/R\$?/gi, '');
            let num: number;
            if (raw.includes(',')) num = parseFloat(raw.replace(/\./g, '').replace(/,/g, '.')); else num = parseFloat(raw);
            return isNaN(num) ? 0 : num;
          };
          const hasMin = typeof filters.minCreditLimit !== 'undefined' && filters.minCreditLimit !== '';
          const hasMax = typeof filters.maxCreditLimit !== 'undefined' && filters.maxCreditLimit !== '';
          const minValue = hasMin ? parseMoney(filters.minCreditLimit as string) : undefined;
          const maxValue = hasMax ? parseMoney(filters.maxCreditLimit as string) : undefined;
          const creditLimitSql = `CAST(CASE WHEN TRIM(c."creditLimit") = '' THEN NULL WHEN POSITION(',' IN TRIM(c."creditLimit")) > 0 THEN REPLACE(REPLACE(REPLACE(TRIM(REPLACE(c."creditLimit", 'R$', '')), '.', ''), ',', '.'), ' ', '') ELSE REPLACE(TRIM(REPLACE(c."creditLimit", 'R$', '')), ' ', '') END AS NUMERIC)`;
          if (hasMin && hasMax) {
            repl.minCredit = minValue;
            repl.maxCredit = maxValue;
            conds.push(`${creditLimitSql} BETWEEN :minCredit AND :maxCredit`);
          } else if (hasMin) {
            repl.minCredit = minValue;
            conds.push(`${creditLimitSql} >= :minCredit`);
          } else if (hasMax) {
            repl.maxCredit = maxValue;
            conds.push(`${creditLimitSql} <= :maxCredit`);
          }
        }

        if (filters.tags && filters.tags.length > 0) {
          repl.tagIds = filters.tags;
          repl.tagsLen = filters.tags.length;
          conds.push(`c."id" IN (SELECT "contactId" FROM (SELECT "contactId", COUNT(DISTINCT "tagId") AS tag_count FROM "ContactTags" WHERE "tagId" IN (:tagIds) GROUP BY "contactId") t WHERE t.tag_count = :tagsLen)`);
        }
      }

      const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const insertSql = `
        INSERT INTO "ContactListItems"
          ("name","number","canonicalNumber","email","contactListId","companyId","isGroup","createdAt","updatedAt")
        SELECT 
          c."name", 
          c."canonicalNumber" AS "number",
          c."canonicalNumber",
          COALESCE(c."email", ''), 
          :contactListId, 
          :companyId, 
          false, 
          NOW(), 
          NOW()
        FROM "Contacts" c
        ${whereSql}
        ON CONFLICT ("contactListId","number") DO NOTHING;
      `;

      const before = await ContactListItem.count({ where: { contactListId } });
      await sequelize.query(insertSql, { replacements: repl, type: QueryTypes.INSERT });
      const after = await ContactListItem.count({ where: { contactListId } });
      const added = Math.max(0, after - before);
      logger.info(`Resultado da adição (INSERT SELECT): ${added} adicionados`);

      // Job assíncrono removido - validação volta a ser síncrona como era antes

      return { added, duplicated: 0, errors: 0 };
    }

    // Construir condições de filtro para a consulta principal
    const whereConditions: any[] = [{ companyId }];

    // Filtro de canal
    if (filters.channel && filters.channel.length > 0) {
      whereConditions.push({ channel: { [Op.in]: filters.channel } });
    }

    // Filtro de código de representante
    if (filters.representativeCode && filters.representativeCode.length > 0) {
      whereConditions.push({ representativeCode: { [Op.in]: filters.representativeCode } });
    }

    // Filtro de cidade
    if (filters.city && filters.city.length > 0) {
      whereConditions.push({ city: { [Op.in]: filters.city } });
    }

    // Filtro de segmento
    if (filters.segment && filters.segment.length > 0) {
      whereConditions.push({ segment: { [Op.in]: filters.segment } });
    }

    // Filtro de situação
    if (filters.situation && filters.situation.length > 0) {
      whereConditions.push({ situation: { [Op.in]: filters.situation } });
    }

    // Filtro de empresa
    if (filters.bzEmpresa && filters.bzEmpresa.trim()) {
      whereConditions.push({
        bzEmpresa: {
          [Op.iLike]: `%${filters.bzEmpresa.trim()}%`
        }
      });
    }

    // Filtro por mês (independente do ano) da data de fundação
    if (filters.foundationMonths && filters.foundationMonths.length > 0) {
      try {
        const months = filters.foundationMonths
          .map(m => Number(m))
          .filter(m => Number.isInteger(m) && m >= 1 && m <= 12);
        if (months.length > 0) {
          // Garante que foundationDate não seja nulo e filtra por mês via EXTRACT
          whereConditions.push(literal(`"foundationDate" IS NOT NULL`));
          whereConditions.push(literal(`EXTRACT(MONTH FROM "foundationDate") IN (${months.join(',')})`));
          logger.info(`Filtro de meses da fundação (1-12): ${months.join(',')}`);
        }
      } catch (error: any) {
        logger.error(`Erro ao processar filtro de meses da fundação:`, {
          message: error.message,
          foundationMonths: filters.foundationMonths
        });
      }
    }

    // Filtro de limite de crédito (mínimo e máximo inclusivo)
    if (filters.minCreditLimit || filters.maxCreditLimit) {
      try {
        // Converte entrada para número SEM dividir por 100. Aceita "1.234,56" e "1234.56".
        const parseMoney = (val: string): number => {
          const raw = String(val).trim().replace(/\s+/g, '').replace(/R\$?/gi, '');
          let num: number;
          if (raw.includes(',')) {
            // PT-BR: remove pontos (milhar) e troca vírgula por ponto
            const normalized = raw.replace(/\./g, '').replace(/,/g, '.');
            num = parseFloat(normalized);
          } else {
            // EN-US: mantém ponto como separador decimal
            num = parseFloat(raw);
          }
          return isNaN(num) ? 0 : num;
        };

        const hasMin = typeof filters.minCreditLimit !== 'undefined' && filters.minCreditLimit !== '';
        const hasMax = typeof filters.maxCreditLimit !== 'undefined' && filters.maxCreditLimit !== '';
        const minValue = hasMin ? parseMoney(filters.minCreditLimit as string) : undefined;
        const maxValue = hasMax ? parseMoney(filters.maxCreditLimit as string) : undefined;

        // Expressão para converter creditLimit (VARCHAR BRL/EN-US) em número
        // Regra: se contiver vírgula, é PT-BR (remove pontos e troca vírgula por ponto); senão, mantém ponto decimal.
        const creditLimitNumeric = literal(
          `CAST(
            CASE
              WHEN TRIM("creditLimit") = '' THEN NULL
              WHEN POSITION(',' IN TRIM("creditLimit")) > 0 THEN
                REPLACE(REPLACE(REPLACE(TRIM(REPLACE("creditLimit", 'R$', '')), '.', ''), ',', '.'), ' ', '')
              ELSE
                REPLACE(TRIM(REPLACE("creditLimit", 'R$', '')), ' ', '')
            END AS NUMERIC
          )`
        );

        // Ignorar registros com creditLimit NULL ou vazio (evita falha no CAST e resultados incorretos)
        whereConditions.push(literal(`"creditLimit" IS NOT NULL`));
        whereConditions.push(literal(`TRIM("creditLimit") <> ''`));

        if (hasMin && hasMax) {
          whereConditions.push(
            Sequelize.where(creditLimitNumeric, { [Op.between]: [minValue!, maxValue!] })
          );
          logger.info(`Filtro de crédito entre: ${minValue} e ${maxValue}`);
        } else if (hasMin) {
          whereConditions.push(
            Sequelize.where(creditLimitNumeric, { [Op.gte]: minValue! })
          );
          logger.info(`Filtro de crédito mínimo: ${minValue}`);
        } else if (hasMax) {
          whereConditions.push(
            Sequelize.where(creditLimitNumeric, { [Op.lte]: maxValue! })
          );
          logger.info(`Filtro de crédito máximo: ${maxValue}`);
        }
      } catch (error: any) {
        logger.error(`Erro ao processar filtro de limite de crédito:`, {
          message: error.message,
          minCreditLimit: filters.minCreditLimit,
          maxCreditLimit: filters.maxCreditLimit
        });
      }
    }

    // Filtro de tags
    if (filters.tags && filters.tags.length > 0) {
      const tagIds = filters.tags.join(",");
      if (!tagIds) {
        return { added: 0, duplicated: 0, errors: 0 };
      }
      // Evita alias inexistente; usa coluna "id" diretamente
      whereConditions.push(literal(`"id" IN (
        SELECT "contactId" FROM (
          SELECT "contactId", COUNT(DISTINCT "tagId") AS tag_count
          FROM "ContactTags"
          WHERE "tagId" IN (${tagIds})
          GROUP BY "contactId"
        ) AS tag_filter
        WHERE tag_filter.tag_count = ${filters.tags.length}
      )`));
    }

    // Filtro de "Encomenda" (florder)
    if (typeof (filters as any).florder !== 'undefined') {
      try {
        const raw = (filters as any).florder;
        const normalizeBool = (v: any): boolean | null => {
          if (typeof v === 'boolean') return v;
          if (v == null) return null;
          const s = String(v).trim().toLowerCase();
          if (["true", "1", "sim", "yes"].includes(s)) return true;
          if (["false", "0", "nao", "não", "no"].includes(s)) return false;
          return null;
        };
        const b = normalizeBool(raw);
        if (b !== null) {
          whereConditions.push({ florder: b });
        }
      } catch (e) {
        logger.warn('Falha ao interpretar filtro florder', { value: (filters as any).florder, error: (e as any)?.message });
      }
    }

    // Filtro por intervalo de Última Compra (dtUltCompra)
    if ((filters as any).dtUltCompraStart || (filters as any).dtUltCompraEnd) {
      const range: any = {};
      if ((filters as any).dtUltCompraStart) {
        range[Op.gte] = (filters as any).dtUltCompraStart;
      }
      if ((filters as any).dtUltCompraEnd) {
        range[Op.lte] = (filters as any).dtUltCompraEnd;
      }
      whereConditions.push({ dtUltCompra: range });
    }

    // Filtro por faixa de valor da última compra (vlUltCompra NUMERIC) — mesma lógica do crédito
    if ((filters as any).minVlUltCompra != null || (filters as any).maxVlUltCompra != null) {
      const parseNum = (v: any): number | null => {
        if (v === undefined || v === null || v === '') return null;
        if (typeof v === 'number') return v;
        const raw = String(v).trim().replace(/\s+/g, '').replace(/R\$?/gi, '');
        let num: number;
        if (raw.includes(',')) {
          // PT-BR
          const normalized = raw.replace(/\./g, '').replace(/,/g, '.');
          num = parseFloat(normalized);
        } else {
          // EN-US
          num = parseFloat(raw);
        }
        return isNaN(num) ? null : num;
      };
      const hasMin = typeof (filters as any).minVlUltCompra !== 'undefined' && (filters as any).minVlUltCompra !== '';
      const hasMax = typeof (filters as any).maxVlUltCompra !== 'undefined' && (filters as any).maxVlUltCompra !== '';
      const minV = hasMin ? parseNum((filters as any).minVlUltCompra) : undefined;
      const maxV = hasMax ? parseNum((filters as any).maxVlUltCompra) : undefined;

      // Garante que não pegue NULL
      whereConditions.push(literal('"vlUltCompra" IS NOT NULL'));

      if (hasMin && hasMax && minV != null && maxV != null) {
        whereConditions.push(Sequelize.where(literal('"vlUltCompra"'), { [Op.between]: [minV, maxV] }));
        logger.info(`Filtro vlUltCompra entre: ${minV} e ${maxV}`);
      } else if (hasMin && minV != null) {
        whereConditions.push(Sequelize.where(literal('"vlUltCompra"'), { [Op.gte]: minV }));
        logger.info(`Filtro vlUltCompra mínimo: ${minV}`);
      } else if (hasMax && maxV != null) {
        whereConditions.push(Sequelize.where(literal('"vlUltCompra"'), { [Op.lte]: maxV }));
        logger.info(`Filtro vlUltCompra máximo: ${maxV}`);
      }
    }

    // Buscar contatos que correspondem aos filtros
    let contacts = [] as any[];
    const creditFilterActive = Boolean(filters.minCreditLimit || filters.maxCreditLimit);
    const creditLimitNumericAttr = creditFilterActive
      ? literal(`CAST(CASE WHEN TRIM("creditLimit") = '' THEN NULL WHEN POSITION(',' IN TRIM("creditLimit")) > 0 THEN REPLACE(REPLACE(REPLACE(TRIM(REPLACE("creditLimit", 'R$', '')), '.', ''), ',', '.'), ' ', '') ELSE REPLACE(TRIM(REPLACE("creditLimit", 'R$', '')), ' ', '') END AS NUMERIC)`)
      : null;

    try {
      logger.info(`WhereConditions finais: ${JSON.stringify(whereConditions)}`);
      if (creditFilterActive) {
        logger.info(`Faixa numérica aplicada (min/max): ${filters.minCreditLimit} / ${filters.maxCreditLimit}`);
      }
      contacts = await Contact.findAll({
        where: { [Op.and]: whereConditions },
        attributes: creditFilterActive
          ? ['id', 'name', 'number', 'email', 'creditLimit', [creditLimitNumericAttr!, 'creditLimitNum']]
          : ['id', 'name', 'number', 'email'],
        order: [['id', 'ASC']]
      }) as any[];

      logger.info(`Encontrados ${contacts.length} contatos correspondentes aos filtros`);
      if (creditFilterActive) {
        const sample = contacts.slice(0, 10).map(c => ({ id: c.id, creditLimit: c.get ? c.get('creditLimit') : c.creditLimit, creditLimitNum: c.get ? c.get('creditLimitNum') : (c as any).creditLimitNum }));
        logger.info(`Amostra de creditLimit após conversão: ${JSON.stringify(sample)}`);
        try {
          const details = contacts.map(c => ({ id: c.id, creditLimit: c.get ? c.get('creditLimit') : c.creditLimit, creditLimitNum: c.get ? c.get('creditLimitNum') : (c as any).creditLimitNum }));
          logger.info(`Detalhe de creditLimit convertidos (${details.length}): ${JSON.stringify(details)}`);
        } catch (e) {
          logger.warn('Falha ao montar detalhes de creditLimit para log:', { message: (e as any).message });
        }
      }
    } catch (error: any) {
      logger.error('Erro ao buscar contatos com os filtros especificados:', {
        message: error.message,
        stack: error.stack,
        whereConditions: JSON.stringify(whereConditions, null, 2)
      });
      throw new Error(`Erro ao buscar contatos: ${error.message}`);
    }

    // Caminho rápido: excluir grupos, apenas contatos válidos
    type Candidate = { name: string; number: string; email: string };
    const candidates: Candidate[] = contacts.map(c => {
      const name = c?.get ? c.get("name") : (c as any).name;
      const numberRaw = c?.get ? c.get("number") : (c as any).number;
      const emailRaw = c?.get ? c.get("email") : (c as any).email;
      const isGroup = (c as any).isGroup || false;

      // EXCLUIR GRUPOS - grupos não são contatos
      if (isGroup) {
        return null as any;
      }

      const { canonical } = safeNormalizePhoneNumber(numberRaw);
      if (!canonical || !isValidCanonicalPhoneNumber(canonical)) {
        return null as any;
      }

      return {
        name: name || "",
        number: canonical,
        email: emailRaw ? String(emailRaw).trim() : ""
      };
    }).filter((c: any) => c && c.number && c.name);

    logger.info(`Pré-processamento (SQL path) gerou ${candidates.length} candidatos`);

    const chunkSize = Number(process.env.CONTACT_FILTER_INSERT_CHUNK_SIZE || 1000);
    const shouldValidate = String(process.env.CONTACT_FILTER_VALIDATE_WHATSAPP || 'false').toLowerCase() === 'true';
    const validationConcurrency = Number(process.env.CONTACT_FILTER_VALIDATION_CONCURRENCY || 10);

    const countBefore = await ContactListItem.count({ where: { contactListId } });

    if (shouldValidate) {
      const payload: any[] = [];
      let errors = 0;
      await processWithConcurrency(candidates, validationConcurrency, async cand => {
        try {
          // Grupos já foram excluídos, então todos os candidatos são contatos válidos
          const { canonical } = safeNormalizePhoneNumber(cand.number);
          if (!canonical || !isValidCanonicalPhoneNumber(canonical)) {
            errors++;
            return;
          }
          cand.number = canonical;

          // Validar número WhatsApp se habilitado
          if (shouldValidateWhatsappEarly) {
            try {
              const validatedNumber = await CheckContactNumber(cand.number, companyId, false);
              if (validatedNumber) {
                cand.number = validatedNumber;
                (cand as any).isWhatsappValid = true;
              } else {
                (cand as any).isWhatsappValid = false;
                errors++;
                return; // Pular contato inválido
              }
            } catch (error: any) {
              const msg = error?.message || "";
              if (
                msg === "invalidNumber" ||
                msg === "ERR_WAPP_INVALID_CONTACT" ||
                /não está cadastrado/i.test(msg)
              ) {
                (cand as any).isWhatsappValid = false;
                errors++;
                return; // Pular contato inválido
              } else {
                logger.warn(`Erro ao validar contato ${cand.name}:`, { number: cand.number, error: msg });
                (cand as any).isWhatsappValid = null;
              }
            }
          }

          // Normalizar número para garantir associação correta com Contact
          const canonicalNumber = safeNormalizePhoneNumber(cand.number).canonical || cand.number.replace(/\D/g, "");

          payload.push({
            contactListId,
            companyId,
            name: cand.name,
            number: cand.number,
            canonicalNumber,
            email: cand.email,
            isGroup: false,
            isWhatsappValid: (cand as any).isWhatsappValid
          });
        } catch {
          // ignora inválidos
          errors += 1;
        }
      });

      for (let i = 0; i < payload.length; i += chunkSize) {
        const slice = payload.slice(i, i + chunkSize);
        await ContactListItem.bulkCreate(slice as any[], { returning: false, validate: false, individualHooks: false, ignoreDuplicates: true });
      }
    } else {
      for (let i = 0; i < candidates.length; i += chunkSize) {
        const slice = candidates.slice(i, i + chunkSize).map(c => {
          // Grupos já foram excluídos, normalizar número
          const { canonical } = safeNormalizePhoneNumber(c.number);
          if (!canonical || !isValidCanonicalPhoneNumber(canonical)) {
            return null as any;
          }
          c.number = canonical;
          const canonicalNumber = safeNormalizePhoneNumber(c.number).canonical || c.number.replace(/\D/g, "");

          return {
            contactListId,
            companyId,
            name: c.name,
            number: c.number,
            canonicalNumber,
            email: c.email,
            isGroup: false,
            isWhatsappValid: null
          };
        }).filter((x: any) => x);
        await ContactListItem.bulkCreate(slice as any[], { returning: false, validate: false, individualHooks: false, ignoreDuplicates: true });
      }
    }


    const countAfter = await ContactListItem.count({ where: { contactListId } });
    const added = Math.max(0, countAfter - countBefore);
    const duplicated = Math.max(0, candidates.length - added);
    const errors = 0;

    logger.info(`Resultado da adição (SQL path): ${added} adicionados, ${duplicated} duplicados, ${errors} erros`);

    // Job assíncrono removido - validação volta a ser síncrona como era antes

    return { added, duplicated, errors };
  } catch (error: any) {
    // Capturar erros não tratados em outras partes do serviço
    logger.error('Erro não tratado no serviço de adição de contatos filtrados:', {
      message: error.message,
      stack: error.stack,
      contactListId,
      companyId,
      filters: JSON.stringify(filters, null, 2)
    });
    throw error;
  }
};

export default AddFilteredContactsToListService;
