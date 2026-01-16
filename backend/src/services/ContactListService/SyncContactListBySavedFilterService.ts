import ContactList from "../../models/ContactList";
import ContactListItem from "../../models/ContactListItem";
import Contact from "../../models/Contact";
import AddFilteredContactsToListService from "../ContactListItemService/AddFilteredContactsToListService";
import logger from "../../utils/logger";
import { Op, QueryTypes } from "sequelize";
import sequelize from "../../database";

interface Request {
  contactListId: number;
  companyId: number;
}

interface SyncResult {
  added: number;
  duplicated: number;
  errors: number;
  removed: number;
}

/**
 * Sincroniza lista de contatos com o filtro salvo.
 * Estratégia COMPLETA:
 * 1. Adiciona novos contatos que atendem ao filtro
 * 2. Remove contatos que NÃO atendem mais ao filtro
 */
const SyncContactListBySavedFilterService = async ({ contactListId, companyId }: Request): Promise<SyncResult> => {
  const list = await ContactList.findByPk(contactListId);
  if (!list) {
    logger.warn(`Lista ${contactListId} não encontrada para sincronização`);
    return { added: 0, duplicated: 0, errors: 0, removed: 0 };
  }

  const savedFilter = (list as any).savedFilter;
  if (!savedFilter) {
    logger.info(`Lista ${contactListId} sem savedFilter. Ignorando.`);
    return { added: 0, duplicated: 0, errors: 0, removed: 0 };
  }

  logger.info(`Sincronizando lista ${contactListId} com savedFilter (modo COMPLETO: adiciona novos + remove obsoletos)`);

  // 1. Adicionar novos contatos que atendem ao filtro
  const addResult = await AddFilteredContactsToListService({
    contactListId,
    companyId,
    filters: savedFilter
  });

  logger.info(`Adição concluída: ${addResult.added} novos, ${addResult.duplicated} duplicados`);

  // 2. Obter os canonicalNumbers que DEVERIAM estar na lista (baseado no filtro atual)
  // Vamos buscar diretamente da tabela Contacts aplicando os mesmos filtros
  let removed = 0;

  try {
    // Buscar todos os canonicalNumbers válidos que atendem ao filtro
    const validCanonicalNumbers = await getValidCanonicalNumbersForFilter(companyId, savedFilter);

    if (validCanonicalNumbers.size === 0) {
      logger.warn(`Nenhum contato atende ao filtro - mantendo lista atual para evitar remoção acidental`);
    } else {
      // Buscar itens da lista que NÃO estão mais no filtro
      const itemsToRemove = await ContactListItem.findAll({
        where: {
          contactListId,
          canonicalNumber: {
            [Op.notIn]: Array.from(validCanonicalNumbers)
          },
          isGroup: false // Não remove grupos
        },
        attributes: ['id', 'name', 'canonicalNumber']
      });

      if (itemsToRemove.length > 0) {
        const idsToRemove = itemsToRemove.map(item => item.id);

        logger.info(`Removendo ${itemsToRemove.length} contatos que não atendem mais ao filtro:`,
          itemsToRemove.slice(0, 5).map(i => ({ id: i.id, name: i.name }))
        );

        await ContactListItem.destroy({
          where: { id: { [Op.in]: idsToRemove } }
        });

        removed = itemsToRemove.length;
      }
    }
  } catch (err: any) {
    logger.error(`Erro ao remover contatos obsoletos da lista ${contactListId}:`, { message: err.message });
  }

  logger.info(`Sincronização completa da lista ${contactListId}: +${addResult.added} novos, -${removed} removidos`);

  return {
    added: addResult.added,
    duplicated: addResult.duplicated,
    errors: addResult.errors,
    removed
  };
};

/**
 * Obtém os canonicalNumbers de todos os contatos que atendem ao filtro
 */
async function getValidCanonicalNumbersForFilter(companyId: number, filters: any): Promise<Set<string>> {
  const conds: string[] = ['c."companyId" = :companyId'];
  const repl: any = { companyId };

  // Apenas contatos com canonicalNumber válido, EXCLUINDO GRUPOS
  conds.push('c."isGroup" = false');
  conds.push('c."canonicalNumber" IS NOT NULL');
  conds.push('LENGTH(c."canonicalNumber") BETWEEN 10 AND 16');


  // Aplicar os mesmos filtros do AddFilteredContactsToListService
  const addIn = (col: string, arr?: string[]) => {
    if (arr && arr.length > 0) {
      const key = col.replace(/\W/g, '_');
      conds.push(`c.${col} IN (:${key})`);
      repl[key] = arr;
    }
  };

  // Normaliza arrays
  const normalizeArr = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(v => String(v).trim()).filter(Boolean);
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean);
      } catch { }
      if (val.includes(',')) return val.split(',').map(s => s.trim()).filter(Boolean);
      return [val.trim()].filter(Boolean);
    }
    return [];
  };

  addIn('"channel"', normalizeArr(filters.channel));
  addIn('"representativeCode"', normalizeArr(filters.representativeCode));
  addIn('"city"', normalizeArr(filters.city));
  addIn('"segment"', normalizeArr(filters.segment));
  addIn('"situation"', normalizeArr(filters.situation));

  if (filters.bzEmpresa && String(filters.bzEmpresa).trim()) {
    repl.bzEmpresa = `%${String(filters.bzEmpresa).trim()}%`;
    conds.push('c."bzEmpresa" ILIKE :bzEmpresa');
  }

  if (filters.florder !== undefined && filters.florder !== null) {
    const s = String(filters.florder).toLowerCase();
    const b = typeof filters.florder === 'boolean' ? filters.florder
      : ["true", "1", "sim", "yes"].includes(s) ? true
        : ["false", "0", "nao", "não", "no"].includes(s) ? false : null;
    if (b !== null) {
      repl.florder = b;
      conds.push('c."florder" = :florder');
    }
  }

  if (filters.dtUltCompraStart) {
    repl.dtStart = filters.dtUltCompraStart;
    conds.push('c."dtUltCompra" >= :dtStart');
  }
  if (filters.dtUltCompraEnd) {
    repl.dtEnd = filters.dtUltCompraEnd;
    conds.push('c."dtUltCompra" <= :dtEnd');
  }

  if (filters.foundationMonths && Array.isArray(filters.foundationMonths) && filters.foundationMonths.length > 0) {
    const months = filters.foundationMonths.map((n: any) => Number(n)).filter((n: number) => n >= 1 && n <= 12);
    if (months.length > 0) {
      conds.push('c."foundationDate" IS NOT NULL');
      conds.push(`EXTRACT(MONTH FROM c."foundationDate") IN (${months.join(',')})`);
    }
  }

  if (filters.minCreditLimit || filters.maxCreditLimit) {
    const parseMoney = (val: string): number => {
      const raw = String(val).trim().replace(/\s+/g, '').replace(/R\$?/gi, '');
      if (raw.includes(',')) return parseFloat(raw.replace(/\./g, '').replace(/,/g, '.'));
      return parseFloat(raw);
    };
    const creditSql = `CAST(CASE WHEN TRIM(c."creditLimit") = '' THEN NULL WHEN POSITION(',' IN TRIM(c."creditLimit")) > 0 THEN REPLACE(REPLACE(REPLACE(TRIM(REPLACE(c."creditLimit", 'R$', '')), '.', ''), ',', '.'), ' ', '') ELSE REPLACE(TRIM(REPLACE(c."creditLimit", 'R$', '')), ' ', '') END AS NUMERIC)`;

    if (filters.minCreditLimit) {
      repl.minCredit = parseMoney(filters.minCreditLimit);
      conds.push(`${creditSql} >= :minCredit`);
    }
    if (filters.maxCreditLimit) {
      repl.maxCredit = parseMoney(filters.maxCreditLimit);
      conds.push(`${creditSql} <= :maxCredit`);
    }
  }

  if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
    const tagIds = filters.tags.map((t: any) => Number(t)).filter((t: number) => Number.isInteger(t));
    if (tagIds.length > 0) {
      repl.tagIds = tagIds;
      repl.tagsLen = tagIds.length;
      conds.push(`c."id" IN (SELECT "contactId" FROM (SELECT "contactId", COUNT(DISTINCT "tagId") AS tag_count FROM "ContactTags" WHERE "tagId" IN (:tagIds) GROUP BY "contactId") t WHERE t.tag_count = :tagsLen)`);
    }
  }

  const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const sql = `SELECT c."canonicalNumber" FROM "Contacts" c ${whereSql}`;

  const results: any[] = await sequelize.query(sql, {
    replacements: repl,
    type: QueryTypes.SELECT
  });

  return new Set(results.map(r => r.canonicalNumber).filter(Boolean));
}

export default SyncContactListBySavedFilterService;

