import { Sequelize, Op, literal } from "sequelize";
import Contact from "../../models/Contact";
import ContactListItem from "../../models/ContactListItem";
import ContactTag from "../../models/ContactTag";
import logger from "../../utils/logger";
import CheckContactNumber from "../WbotServices/CheckNumber";

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

const registerNumber = (
  value: string | null | undefined,
  numbers: Set<string>,
  digitsSet: Set<string>
): void => {
  if (!value) return;
  numbers.add(value);
  const digits = String(value).replace(/\D/g, "");
  if (digits) digitsSet.add(digits);
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
        (filters as any).tags = (Array.isArray((filters as any).tags) ? (filters as any).tags : [ (filters as any).tags ])
          .map((t: any) => typeof t === "string" ? parseInt(t, 10) : t)
          .filter((t: any) => Number.isInteger(t));
      } catch (e) {
        logger.warn(`Falha ao normalizar tags`, { tags: (filters as any).tags, error: (e as any)?.message });
      }
    }

    logger.info(`Filtros após normalização: ${JSON.stringify(filters)}`);

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
      try {
        logger.info(`Filtrando por tags: ${filters.tags.join(', ')}`);
        
        // Buscar contatos que possuem todas as tags especificadas
        const contactTags = await ContactTag.findAll({
          where: { tagId: { [Op.in]: filters.tags } },
          attributes: ['contactId', 'tagId'],
          raw: true
        });
        
        // Agrupar por contactId
        const contactTagsMap = new Map();
        contactTags.forEach(ct => {
          if (!contactTagsMap.has(ct.contactId)) {
            contactTagsMap.set(ct.contactId, new Set());
          }
          contactTagsMap.get(ct.contactId).add(ct.tagId);
        });
        
        const contactIdsWithTags = Array.from(contactTagsMap.entries())
          .filter(([_, tagIds]) => filters.tags!.every(tagId => tagIds.has(tagId)))
          .map(([contactId, _]) => contactId);
        
        logger.info(`Encontrados ${contactIdsWithTags.length} contatos com as tags especificadas`);
        
        if (contactIdsWithTags.length > 0) {
          whereConditions.push({ id: { [Op.in]: contactIdsWithTags } });
        } else {
          // Se não houver contatos com todas as tags, retornar vazio
          return { added: 0, duplicated: 0, errors: 0 };
        }
      } catch (error: any) {
        logger.error(`Erro ao processar filtro de tags:`, {
          message: error.message,
          stack: error.stack,
          tags: filters.tags
        });
        throw new Error(`Erro ao processar filtro de tags: ${error.message}`);
      }
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

    // Buscar itens já existentes na lista para evitar duplicatas
    const existingItems = await ContactListItem.findAll({
      where: { contactListId },
      attributes: ['number', 'email'],
      raw: true
    });
    logger.info(`Encontrados ${existingItems.length} contatos já existentes na lista (checando por número e email)`);

    // Criar conjuntos para verificação rápida de duplicatas
    const existingNumbers = new Set((existingItems as any[]).map(item => item.number).filter(Boolean));
    const existingNumbersDigits = new Set(
      (existingItems as any[])
        .map(item => (item.number ? String(item.number).replace(/\D/g, "") : null))
        .filter(Boolean) as string[]
    );
    const existingEmails = new Set((existingItems as any[]).map(item => item.email).filter(Boolean));
  
    // Adicionar contatos à lista
    let added = 0;
    let duplicated = 0;
    let errors = 0;

    for (const contact of contacts) {
      try {
        const rawNumber = contact.number ? String(contact.number) : "";
        const digitsRaw = rawNumber.replace(/\D/g, "");
        const { normalized: normalizedNumber, digits: normalizedDigits } = normalizePhoneNumber(contact.number);
        const hasNormalized = !!normalizedNumber;

        const isDuplicateByNumber =
          (!!rawNumber && existingNumbers.has(rawNumber)) ||
          (hasNormalized && existingNumbers.has(normalizedNumber!)) ||
          (!!digitsRaw && existingNumbersDigits.has(digitsRaw)) ||
          (!!normalizedDigits && existingNumbersDigits.has(normalizedDigits));

        const isDuplicateByEmail = contact.email && existingEmails.has(contact.email);

        if (isDuplicateByNumber || isDuplicateByEmail) {
          logger.debug(`Contato duplicado por ${isDuplicateByNumber ? 'número' : 'email'}: ${contact.name} (${contact.number || contact.email})`);
          duplicated++;
          continue;
        }

        // Validar número antes de inserir
        let validationStatus: 'valid' | 'invalid' | 'unknown' = 'unknown';
        let validatedNumber: string | null = null;
        const numberToCheck = hasNormalized ? normalizedNumber! : (contact.number ? String(contact.number) : null);

        if (numberToCheck) {
          try {
            const response = await CheckContactNumber(numberToCheck, companyId);
            if (response) {
              validationStatus = 'valid';
              validatedNumber = response;
            }
          } catch (e: any) {
            const msg = e?.message || "";
            if (
              msg === "invalidNumber" ||
              msg === "ERR_WAPP_INVALID_CONTACT" ||
              /não está cadastrado/i.test(msg)
            ) {
              validationStatus = 'invalid';
              logger.info(`[AddFilteredContacts] número inválido – contato ignorado`, {
                number: numberToCheck,
                contactListId,
                companyId
              });
            } else {
              validationStatus = 'unknown';
              logger.warn(`[AddFilteredContacts] falha ao validar número no WhatsApp; mantendo verificação como desconhecida`, {
                number: numberToCheck,
                contactListId,
                companyId,
                error: msg
              });
            }
          }
        }

        if (validationStatus === 'invalid') {
          errors++;
          continue;
        }

        const finalNumber = validatedNumber || (hasNormalized ? normalizedNumber : contact.number);

        // Adicionar contato à lista
        const newItem = await ContactListItem.create({
          contactListId,
          name: contact.name,
          number: finalNumber,
          email: contact.email,
          companyId,
          city: (contact as any).city || null,
          segment: (contact as any).segment || null,
          situation: (contact as any).situation || null,
          creditLimit: (contact as any).creditLimit || null,
          bzEmpresa: (contact as any).bzEmpresa || null,
          isWhatsappValid: validationStatus === 'valid' ? true : null
        });

        // Atualizar os conjuntos de verificação para evitar duplicatas na mesma execução
        if (contact.number) {
          registerNumber(contact.number, existingNumbers, existingNumbersDigits);
        }
        if (hasNormalized) {
          registerNumber(normalizedNumber!, existingNumbers, existingNumbersDigits);
        }
        if (finalNumber) {
          registerNumber(finalNumber, existingNumbers, existingNumbersDigits);
        }
        if (contact.email) existingEmails.add(contact.email);

        added++;
      } catch (error: any) {
        logger.error(`Erro ao adicionar contato ${contact.id} à lista:`, {
          message: error.message,
          stack: error.stack,
          contactId: contact.id,
          contactListId,
          name: contact.name,
          number: contact.number
        });
        errors++;
      }
    }

    logger.info(`Resultado da adição: ${added} adicionados, ${duplicated} duplicados, ${errors} erros`);

    return {
      added,
      duplicated,
      errors
    };
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
