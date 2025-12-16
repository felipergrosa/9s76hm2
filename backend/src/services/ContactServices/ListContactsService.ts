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
                                     isWhatsappValid
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

  const { count, rows: contacts } = await Contact.findAndCountAll({
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
    distinct: true,
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
