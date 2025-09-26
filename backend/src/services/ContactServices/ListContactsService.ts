import { Sequelize, fn, col, where, Op, Filterable } from "sequelize";
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
  limit?: string;
  orderBy?: string;
  order?: string;
  segment?: string | string[];
  dtUltCompraStart?: string;
  dtUltCompraEnd?: string;
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
                                     limit,
                                     orderBy,
                                     order,
                                     segment,
                                     dtUltCompraStart,
                                     dtUltCompraEnd
                                   }: Request): Promise<Response> => {
  let whereCondition: Filterable["where"] = {};

  if (profile !== 'admin') {
    const userTickets = await Ticket.findAll({
      where: { userId },
      attributes: ["contactId"],
      group: ["contactId"]
    });

    const contactIds = userTickets.map(t => t.contactId);

    whereCondition.id = {
      [Op.in]: contactIds
    };
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

  const { count, rows: contacts } = await Contact.findAndCountAll({
    where: whereCondition,
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
    include: [
      {
        association: "tags",
        attributes: ["id", "name", "color"]
      },
    ],
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
