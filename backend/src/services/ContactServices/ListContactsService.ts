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
import GetUserWalletContactIds from "../../helpers/GetUserWalletContactIds";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  companyId: number;
  tagsIds?: number[];
  isGroup?: string;
  userId?: number;
  profile?: string;
  allowedContactTags?: number[]; // Adicionar a nova propriedade
  limit?: string;
  orderBy?: string;
  order?: string;
  segment?: string | string[];
  dtUltCompraStart?: string;
  dtUltCompraEnd?: string;
  channel?: string[];
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
  walletIds?: number[]; // Novo: IDs de usuários para filtro de carteira
  whatsappIds?: number[]; // Novo: IDs de conexões WhatsApp
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
  channel,
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
  walletIds, // Novo: IDs de usuários para filtro de carteira
  whatsappIds // Novo: IDs de conexões WhatsApp
}: Request): Promise<Response> => {
  let whereCondition: Filterable["where"] = {};
  const additionalWhere: any[] = [];

  // Restrição de carteira: vê contatos de sua carteira + carteiras gerenciadas
  if (userId) {
    const walletResult = await GetUserWalletContactIds(userId, companyId);
    if (walletResult.hasWalletRestriction) {
      const allowedContactIds = walletResult.contactIds;
      whereCondition.id = allowedContactIds.length > 0 ? { [Op.in]: allowedContactIds } : { [Op.in]: [] };
    }

    // Modo EXCLUDE: excluir contatos que pertencem à carteira (tags pessoais) dos usuários bloqueados
    if (Array.isArray(walletResult.excludedUserIds) && walletResult.excludedUserIds.length > 0) {
      try {
        const blockedUsers = await User.findAll({
          where: { id: { [Op.in]: walletResult.excludedUserIds } },
          attributes: ["id", "allowedContactTags"]
        });

        const blockedTagIdsRaw: number[] = [];
        for (const bu of blockedUsers) {
          const tagIds = Array.isArray((bu as any).allowedContactTags)
            ? ((bu as any).allowedContactTags as number[])
            : [];
          blockedTagIdsRaw.push(...tagIds);
        }

        if (blockedTagIdsRaw.length > 0) {
          const blockedPersonalTags = await Tag.findAll({
            where: {
              id: { [Op.in]: blockedTagIdsRaw },
              companyId,
              name: {
                [Op.and]: [{ [Op.like]: "#%" }, { [Op.notLike]: "##%" }]
              }
            },
            attributes: ["id"]
          });
          const blockedPersonalTagIds = blockedPersonalTags.map(t => t.id);

          if (blockedPersonalTagIds.length > 0) {
            const blockedContacts = await ContactTag.findAll({
              where: { tagId: { [Op.in]: blockedPersonalTagIds } },
              attributes: [[literal('DISTINCT "contactId"'), 'contactId']],
              raw: true
            });
            const blockedContactIds = blockedContacts.map((ct: any) => Number(ct.contactId)).filter(Number.isInteger);

            if (blockedContactIds.length > 0) {
              const currentIdFilter: any = (whereCondition as any).id;
              const currentIn: number[] | undefined = currentIdFilter?.[Op.in];
              if (Array.isArray(currentIn)) {
                // Intersect do filtro atual com NOT IN (mais seguro do que empilhar operadores)
                const filtered = currentIn.filter(id => !blockedContactIds.includes(id));
                (whereCondition as any).id = { [Op.in]: filtered };
              } else if (currentIdFilter) {
                // Caso raro: já existe alguma condição id diferente de IN
                additionalWhere.push({ id: { [Op.notIn]: blockedContactIds } });
              } else {
                (whereCondition as any).id = { [Op.notIn]: blockedContactIds };
              }
            }
          }
        }
      } catch (e: any) {
        // Se falhar, não bloqueia listagem inteira; apenas loga
        // (evita quebrar a UX do usuário)
        // logger está disponível no arquivo
      }
    }
  }

  // Filtro de segurança: tags permitidas do usuário (allowedContactTags)
  // Regra: se o usuário tem tags permitidas configuradas, ele só enxerga contatos que possuam ao menos uma delas.
  if (Array.isArray(allowedContactTags) && allowedContactTags.length > 0) {
    const allowedTags = await Tag.findAll({
      where: { id: { [Op.in]: allowedContactTags }, companyId },
      attributes: ["id"]
    });
    const allowedTagIds = allowedTags.map(t => t.id);
    if (allowedTagIds.length > 0) {
      const allowedContacts = await ContactTag.findAll({
        where: { tagId: { [Op.in]: allowedTagIds } },
        attributes: [[literal('DISTINCT "contactId"'), 'contactId']],
        raw: true
      });
      const allowedContactIds = allowedContacts.map((ct: any) => Number(ct.contactId)).filter(Number.isInteger);

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
    const sanitizedSearchParam = removeAccents(searchParam.toLocaleLowerCase().trim());
    whereCondition = {
      ...whereCondition,
      [Op.or]: [
        {
          name: where(
            fn("LOWER", fn("unaccent", col("Contact.name"))),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        {
          contactName: where(
            fn("LOWER", fn("unaccent", col("Contact.contactName"))),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        { number: { [Op.like]: `%${sanitizedSearchParam}%` } },
        {
          cpfCnpj: where(
            fn("LOWER", fn("unaccent", col("Contact.cpfCnpj"))),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        {
          representativeCode: where(
            fn("LOWER", fn("unaccent", col("Contact.representativeCode"))),
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
          city: where(
            fn("LOWER", fn("unaccent", col("Contact.city"))),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        {
          segment: where(
            fn("LOWER", fn("unaccent", col("Contact.segment"))),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        {
          bzEmpresa: where(
            fn("LOWER", fn("unaccent", col("Contact.bzEmpresa"))),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        }
      ]
    };
  }

  whereCondition = {
    ...whereCondition,
    companyId
  };

  if (Array.isArray(channel) && channel.length > 0) {
    whereCondition = {
      ...whereCondition,
      channel: { [Op.in]: channel }
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
    const months = foundationMonths.filter(m => Number.isInteger(m) && m >= 1 && m <= 12);
    if (months.length > 0) {
      additionalWhere.push(literal('"foundationDate" IS NOT NULL'));
      additionalWhere.push(literal(`EXTRACT(MONTH FROM "foundationDate") IN (${months.join(',')})`));
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

  // Filtro por carteira (usuários responsáveis)
  if (Array.isArray(walletIds) && walletIds.length > 0) {
    try {
      // Para cada usuário selecionado, obter IDs dos contatos na carteira
      const allWalletContactIds = new Set<number>();

      for (const userId of walletIds) {
        const walletResult = await GetUserWalletContactIds(userId, companyId);
        if (walletResult.hasWalletRestriction && walletResult.contactIds.length > 0) {
          // Adiciona todos os IDs ao Set (união)
          walletResult.contactIds.forEach(id => allWalletContactIds.add(id));
        }
      }

      // Se não encontrou nenhum contato nas carteiras selecionadas, retorna lista vazia
      if (allWalletContactIds.size === 0) {
        whereCondition.id = { [Op.in]: [] };
      } else {
        // Converter Set para array
        const walletContactIdsArray = Array.from(allWalletContactIds);

        // Combinar com filtro existente de carteira (se houver)
        const currentIdFilter: any = (whereCondition as any).id;
        if (currentIdFilter && currentIdFilter[Op.in]) {
          // Interseção com filtro existente de carteira do usuário logado
          const existingIds = currentIdFilter[Op.in];
          const finalIntersection = walletContactIdsArray.filter(id => existingIds.includes(id));
          (whereCondition as any).id = { [Op.in]: finalIntersection };
        } else {
          (whereCondition as any).id = { [Op.in]: walletContactIdsArray };
        }
      }
    } catch (error: any) {
      // Se falhar, não bloqueia listagem; apenas loga
      console.warn("[ListContactsService] Erro ao filtrar por carteira:", error.message);
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
      "channel",
      // Adiciona novos campos aos atributos
      "contactName",
      "cpfCnpj",
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
