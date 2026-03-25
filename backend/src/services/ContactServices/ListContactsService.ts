import { Sequelize, fn, col, where, Op, Filterable, literal } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import ContactTag from "../../models/ContactTag";
import { intersection } from "lodash";
import Tag from "../../models/Tag";
import removeAccents from "remove-accents";
import Whatsapp from "../../models/Whatsapp";
import User from "../../models/User";
import ShowUserService from "../UserServices/ShowUserService";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  companyId: number;
  tagsIds?: number[];
  isGroup?: string;
  userId?: number;
  profile?: string;
  allowedContactTags?: number[];
  limit?: string;
  orderBy?: string;
  order?: string;
  segment?: string | string[];
  dtUltCompraStart?: string;
  dtUltCompraEnd?: string;
  channels?: string[];
  representativeCode?: string[];
  city?: string[];
  situation?: string[];
  foundationMonths?: number[];
  minCreditLimit?: number;
  maxCreditLimit?: number;
  minVlUltCompra?: number;
  maxVlUltCompra?: number;
  florder?: boolean;
  bzEmpresa?: string[];
  isWhatsappValid?: boolean;
  whatsappIds?: number[];
}

interface Response {
  contacts: Contact[];
  count: number;
  hasMore: boolean;
}

const ListContactsService = async ({
  searchParam = "",
  pageNumber = "1",
  companyId,
  tagsIds,
  isGroup,
  userId,
  profile,
  allowedContactTags, // Adicionar a nova propriedade
  limit,
  orderBy,
  order,
  segment,
  dtUltCompraStart,
  dtUltCompraEnd,
  channels,
  representativeCode,
  city,
  situation,
  foundationMonths,
  minCreditLimit,
  maxCreditLimit,
  minVlUltCompra,
  maxVlUltCompra,
  florder,
  bzEmpresa,
  isWhatsappValid,
  whatsappIds
}: Request): Promise<Response> => {
  let whereCondition: Filterable["where"] = {};
  const additionalWhere: any[] = [];

  // Restrição por tag pessoal: usuário só vê contatos que têm sua tag pessoal
  if (userId && profile !== "admin") {
    const user = await User.findByPk(userId, {
      attributes: ["id", "allowedContactTags"]
    });
    
    if (user) {
      const userTagId = (user as any).getPersonalTagId?.() || 
                        (Array.isArray((user as any).allowedContactTags) && (user as any).allowedContactTags.length > 0 
                          ? (user as any).allowedContactTags[0] 
                          : null);
      
      if (userTagId) {
        const taggedContacts = await ContactTag.findAll({
          where: { tagId: userTagId },
          attributes: [[literal('DISTINCT "contactId"'), 'contactId']],
          raw: true
        });
        const allowedIds = taggedContacts.map((ct: any) => Number(ct.contactId)).filter(Number.isInteger);
        whereCondition.id = allowedIds.length > 0 ? { [Op.in]: allowedIds } : { [Op.in]: [] };
      }
    }
  }

  // Filtro de segurança: tags permitidas do usuário (allowedContactTags)
  // REGRA CORRETA: O contato deve ter PELO MENOS UMA das tags pessoais (#) do usuário.
  // Exemplo: Usuário com [#FERNANDA] vê contatos que tenham #FERNANDA (podem ter outras tags também).
  // EXCEÇÃO: Admin não tem restrição de tags (vê todos os contatos)
  if (profile !== "admin" && Array.isArray(allowedContactTags) && allowedContactTags.length > 0) {
    // Filtrar apenas tags pessoais (começam com # mas não com ##)
    const personalTags = await Tag.findAll({
      where: { 
        id: { [Op.in]: allowedContactTags }, 
        companyId,
        name: {
          [Op.and]: [
            { [Op.like]: "#%" },
            { [Op.notLike]: "##%" }
          ]
        }
      },
      attributes: ["id"]
    });
    const personalTagIds = personalTags.map(t => t.id);
    
    if (personalTagIds.length > 0) {
      // Busca contatos que têm PELO MENOS UMA das tags pessoais do usuário
      const contactsWithAnyTag = await ContactTag.findAll({
        where: { tagId: { [Op.in]: personalTagIds }, companyId },
        attributes: [[literal('DISTINCT "contactId"'), 'contactId']],
        raw: true
      });
      const allowedContactIds = contactsWithAnyTag.map((ct: any) => Number(ct.contactId)).filter(Number.isInteger);

      const currentIdFilter: any = (whereCondition as any).id;
      const currentIn: number[] | undefined = currentIdFilter?.[Op.in];
      if (Array.isArray(currentIn)) {
        // Intersecção de filtros
        const set = new Set(allowedContactIds);
        const filtered = currentIn.filter(id => set.has(id));
        (whereCondition as any).id = { [Op.in]: filtered };
      } else if (currentIdFilter) {
        additionalWhere.push({ id: { [Op.in]: allowedContactIds } });
      } else {
        (whereCondition as any).id = { [Op.in]: allowedContactIds };
      }
    } else {
      // Tags configuradas mas não encontradas/sem correspondência: não mostrar nada
      (whereCondition as any).id = { [Op.in]: [] };
    }
  }

  // Filtro por intervalo de última compra
  if (dtUltCompraStart || dtUltCompraEnd) {
    const range: any = {};
    if (dtUltCompraStart) {
      range[Op.gte] = dtUltCompraStart;
    }
    if (dtUltCompraEnd) {
      range[Op.lte] = dtUltCompraEnd;
    }
    whereCondition = {
      ...whereCondition,
      dtUltCompra: range
    };
  }

  if (searchParam) {
    const trimmedSearchParam = searchParam.trim();
    const sanitizedSearchParam = removeAccents(trimmedSearchParam.toLocaleLowerCase());
    
    // Verificar se é um número puro (telefone, CPF/CNPJ, etc.)
    const isPureNumber = /^\d+$/.test(trimmedSearchParam);
    
    // BUSCA POR NOME: separar palavras e buscar cada uma (AND)
    // Ex: "Felipe Rosa" -> busca nomes que contenham "felipe" AND "rosa"
    const nameSearchWords = sanitizedSearchParam
      .split(/\s+/)
      .filter(word => word.length > 0)
      .map(word => word.replace(/[^a-z0-9]/g, ''));
    
    // Constrói condição AND para cada palavra do nome
    const nameConditions = nameSearchWords.length > 0
      ? {
          [Op.and]: nameSearchWords.map(word => ({
            name: where(
              fn("LOWER", fn("unaccent", col("Contact.name"))),
              "LIKE",
              `%${word}%`
            )
          }))
        }
      : null;
    
    whereCondition = {
      ...whereCondition,
      [Op.or]: isPureNumber
        ? [
            // Busca apenas em campos numéricos quando é número puro
            { number: { [Op.like]: `%${trimmedSearchParam}%` } },
            { cpfCnpjNormalized: { [Op.like]: `%${trimmedSearchParam.replace(/\D/g, '')}%` } },
            {
              cpfCnpj: where(
                fn("LOWER", fn("unaccent", col("Contact.cpfCnpj"))),
                "LIKE",
                `%${sanitizedSearchParam}%`
              )
            },
            {
              clientCode: where(
                fn("LOWER", col("Contact.clientCode")),
                "LIKE",
                `%${trimmedSearchParam.toLowerCase()}%`
              )
            }
          ]
        : [
            // Busca em campos de nome/texto quando não é número
            // BUSCA POR NOME: todas as palavras devem estar presentes
            ...(nameConditions ? [nameConditions] : []),
            // Fallback para contactName
            {
              contactName: where(
                fn("LOWER", fn("unaccent", col("Contact.contactName"))),
                "LIKE",
                `%${sanitizedSearchParam}%`
              )
            },
            {
              fantasyName: where(
                fn("LOWER", fn("unaccent", col("Contact.fantasyName"))),
                "LIKE",
                `%${sanitizedSearchParam}%`
              )
            },
            {
              email: where(
                fn("LOWER", col("Contact.email")),
                "LIKE",
                `%${sanitizedSearchParam.toLowerCase()}%`
              )
            },
            // Condição especial para encontrar contatos não validados
            ...(sanitizedSearchParam.includes("sem nome") || sanitizedSearchParam.includes("nao validados") ? [
              {
                [Op.and]: [
                  where(col("Contact.number"), col("Contact.name")),
                  { name: { [Op.ne]: null } },
                  { name: { [Op.ne]: "" } }
                ]
              }
            ] : [])
          ]
    };
  }

  whereCondition = {
    ...whereCondition,
    companyId
  };

  if (Array.isArray(channels) && channels.length > 0) {
    whereCondition = {
      ...whereCondition,
      channels: { [Op.overlap]: channels } as any
    };
  }

  if (Array.isArray(representativeCode) && representativeCode.length > 0) {
    whereCondition = {
      ...whereCondition,
      representativeCode: { [Op.in]: representativeCode }
    };
  }

  if (Array.isArray(city) && city.length > 0) {
    whereCondition = {
      ...whereCondition,
      city: { [Op.in]: city }
    };
  }

  if (Array.isArray(situation) && situation.length > 0) {
    whereCondition = {
      ...whereCondition,
      situation: { [Op.in]: situation }
    };
  }

  if (typeof isWhatsappValid === "boolean") {
    whereCondition = {
      ...whereCondition,
      isWhatsappValid
    };
  }

  if (Array.isArray(bzEmpresa) && bzEmpresa.length > 0) {
    const likeConditions = bzEmpresa
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(item => ({ bzEmpresa: { [Op.iLike]: `%${item}%` } }));

    if (likeConditions.length === 1) {
      whereCondition = {
        ...whereCondition,
        ...likeConditions[0]
      };
    } else if (likeConditions.length > 1) {
      additionalWhere.push({ [Op.or]: likeConditions });
    }
  }

  if (Array.isArray(foundationMonths) && foundationMonths.length > 0) {
    // BUG-26 fix: Cast explícito para Number e validação antes de interpolar no SQL
    const months = foundationMonths
      .map(m => Number(m))
      .filter(m => Number.isInteger(m) && m >= 1 && m <= 12);
    if (months.length > 0) {
      additionalWhere.push(literal('"foundationDate" IS NOT NULL'));
      const safeMonths = months.map(m => String(m)).join(',');
      additionalWhere.push(literal(`EXTRACT(MONTH FROM "foundationDate") IN (${safeMonths})`));
    }
  }

  if (typeof minCreditLimit === "number" || typeof maxCreditLimit === "number") {
    const creditLimitExpr = literal(`CAST(
      CASE
        WHEN TRIM("creditLimit") = '' THEN NULL
        WHEN POSITION(',' IN TRIM("creditLimit")) > 0 THEN
          REPLACE(REPLACE(REPLACE(TRIM(REPLACE("creditLimit", 'R$', '')), '.', ''), ',', '.'), ' ', '')
        ELSE
          REPLACE(TRIM(REPLACE("creditLimit", 'R$', '')), ' ', '')
      END AS NUMERIC
    )`);

    additionalWhere.push(literal('"creditLimit" IS NOT NULL'));
    additionalWhere.push(literal("TRIM(\"creditLimit\") <> ''"));

    if (typeof minCreditLimit === "number" && typeof maxCreditLimit === "number") {
      additionalWhere.push(Sequelize.where(creditLimitExpr, { [Op.between]: [minCreditLimit, maxCreditLimit] }));
    } else if (typeof minCreditLimit === "number") {
      additionalWhere.push(Sequelize.where(creditLimitExpr, { [Op.gte]: minCreditLimit }));
    } else if (typeof maxCreditLimit === "number") {
      additionalWhere.push(Sequelize.where(creditLimitExpr, { [Op.lte]: maxCreditLimit }));
    }
  }

  if (typeof minVlUltCompra === "number" || typeof maxVlUltCompra === "number") {
    additionalWhere.push(literal('"vlUltCompra" IS NOT NULL'));

    if (typeof minVlUltCompra === "number" && typeof maxVlUltCompra === "number") {
      additionalWhere.push(Sequelize.where(col("vlUltCompra"), { [Op.between]: [minVlUltCompra, maxVlUltCompra] }));
    } else if (typeof minVlUltCompra === "number") {
      additionalWhere.push(Sequelize.where(col("vlUltCompra"), { [Op.gte]: minVlUltCompra }));
    } else if (typeof maxVlUltCompra === "number") {
      additionalWhere.push(Sequelize.where(col("vlUltCompra"), { [Op.lte]: maxVlUltCompra }));
    }
  }

  if (typeof segment !== "undefined") {
    const normalize = (v: any) => (typeof v === "string" ? v.trim() : v);
    const segNorm = Array.isArray(segment)
      ? segment.map(s => normalize(s)).filter(Boolean)
      : normalize(segment);

    if (Array.isArray(segNorm) && segNorm.length > 0) {
      whereCondition = {
        ...whereCondition,
        segment: { [Op.in]: segNorm }
      };
    } else if (typeof segNorm === "string" && segNorm !== "") {
      whereCondition = {
        ...whereCondition,
        segment: segNorm
      };
    } else {
      // vazio/indefinido: não aplica filtro de segmento
    }
  }

  if (Array.isArray(tagsIds) && tagsIds.length > 0) {
    const contactTagFilter: any[] | null = [];
    const contactTags = await ContactTag.findAll({
      where: { tagId: { [Op.in]: tagsIds } }
    });
    if (contactTags) {
      contactTagFilter.push(contactTags.map(t => t.contactId));
    }

    const contactTagsIntersection: number[] = intersection(...contactTagFilter);

    whereCondition = {
      ...whereCondition,
      id: {
        [Op.in]: contactTagsIntersection
      }
    };
  }

  if (isGroup === "false") {
    whereCondition = {
      ...whereCondition,
      isGroup: false
    }
  }

  // FILTRO: Ocultar contatos de participantes de grupo sem ticket individual
  // Contatos criados automaticamente pelo ensureParticipantContact têm:
  // - isGroup=false
  // - name = número (ex: "+5511999999999")
  // - Sem ticket individual
  // Esses contatos só devem aparecer na listagem se tiverem ticket individual
  if (isGroup !== "true") {
    // Buscar IDs de contatos que têm pelo menos um ticket individual (não-grupo)
    const contactsWithTicket = await Ticket.findAll({
      attributes: [[literal('DISTINCT "contactId"'), 'contactId']],
      where: {
        companyId,
        isGroup: false
      },
      raw: true
    });
    const ticketContactIds = new Set(contactsWithTicket.map((t: any) => Number(t.contactId)).filter(Number.isInteger));

    // Buscar contatos que NÃO têm ticket individual e têm nome igual ao número
    // (criados automaticamente por ensureParticipantContact)
    const hiddenContacts = await Contact.findAll({
      attributes: ['id'],
      where: {
        companyId,
        isGroup: false,
        id: { [Op.notIn]: Array.from(ticketContactIds) },
        // Nome é igual ao número ou começa com + (número formatado)
        [Op.or]: [
          where(col('name'), col('number')),
          { name: { [Op.like]: '+%' } },
          { name: '' },
          literal('"name" IS NULL')
        ]
      },
      raw: true
    });
    const hiddenContactIds = hiddenContacts.map((c: any) => c.id);

    // Excluir contatos ocultos da listagem
    if (hiddenContactIds.length > 0) {
      const currentIdFilter: any = (whereCondition as any).id;
      if (currentIdFilter?.[Op.in]) {
        // Intersecção: remover hidden IDs
        const allowed = (currentIdFilter[Op.in] as number[]).filter(id => !hiddenContactIds.includes(id));
        (whereCondition as any).id = { [Op.in]: allowed };
      } else if (currentIdFilter?.[Op.notIn]) {
        // Já tem filtro notIn, adicionar mais
        (whereCondition as any).id = { 
          ...currentIdFilter,
          [Op.notIn]: [...(currentIdFilter[Op.notIn] || []), ...hiddenContactIds]
        };
      } else {
        // Adicionar filtro notIn
        (whereCondition as any).id = { [Op.notIn]: hiddenContactIds };
      }
    }
  }

  // Filtro por conexões WhatsApp
  if (Array.isArray(whatsappIds) && whatsappIds.length > 0) {
    whereCondition = {
      ...whereCondition,
      whatsappId: { [Op.in]: whatsappIds }
    };
  }

  const pageLimit = Number(limit) || 100;
  const offset = pageLimit * (+pageNumber - 1);

  // Ordenação segura (whitelist)
  const allowedFields: Record<string, string> = {
    name: "name",
    number: "number",
    email: "email",
    city: "city",
    status: "situation"
  };
  const field = orderBy && allowedFields[orderBy] ? allowedFields[orderBy] : "name";
  const dir = (order && order.toUpperCase() === "DESC") ? "DESC" : "ASC";

  const finalWhere: any = { ...whereCondition };
  if (additionalWhere.length > 0) {
    finalWhere[Op.and] = [
      ...(Array.isArray(finalWhere[Op.and]) ? finalWhere[Op.and] : []),
      ...additionalWhere
    ];
  }

  // Include de tags sem filtro (já filtramos por whereCondition.id acima)
  const tagsInclude: any = {
    association: "tags",
    attributes: ["id", "name", "color"],
    required: false
  };

  // CONTAGEM SEPARADA: Evita inflação causada pelo JOIN com tags
  // O findAndCountAll com includes conta linhas do JOIN, não contatos únicos
  const count = await Contact.count({
    where: finalWhere
  });

  // BUSCA COM INCLUDES: Retorna contatos com suas tags
  const contacts = await Contact.findAll({
    where: finalWhere,
    attributes: [
      "id",
      "name",
      "number",
      "email",
      "isGroup",
      "urlPicture",
      "active",
      "companyId",
      "channels",
      // Adiciona novos campos aos atributos
      "contactName",
      "cpfCnpj",
      "clientCode",
      "representativeCode",
      "city",
      "instagram",
      "situation",
      "fantasyName",
      "foundationDate",
      "creditLimit",
      "segment",
      "dtUltCompra",
      "bzEmpresa",
      // Campos persistidos
      "isWhatsappValid",
      "validatedAt"
    ],
    include: [tagsInclude],
    limit: pageLimit,
    offset,
    order: [[field, dir]]
  });

  const hasMore = count > offset + contacts.length;

  return {
    contacts,
    count,
    hasMore
  };
};

export default ListContactsService;
