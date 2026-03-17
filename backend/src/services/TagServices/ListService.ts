import { Op, literal, fn, col, Sequelize } from "sequelize";
import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";
import TicketTag from "../../models/TicketTag";

import removeAccents from "remove-accents";
import Contact from "../../models/Contact";

interface Request {
  companyId: number;
  searchParam?: string;
  pageNumber?: string | number;
  kanban?: number;
  tagId?: number;
  profile?: string;
  userId?: number | string;
}

interface Response {
  tags: Tag[];
  count: number;
  hasMore: boolean;
}

const ListService = async ({
  companyId,
  searchParam = "",
  pageNumber = "1",
  kanban = 0,
  tagId = 0,
  profile = "user",
  userId
}: Request): Promise<Response> => {
  console.log("[ListService] Iniciando busca de tags:", { companyId, searchParam, pageNumber, kanban, tagId, profile, userId });
  
  let whereCondition: any = {};

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const sanitizedSearchParam = removeAccents(searchParam.toLocaleLowerCase().trim());

  if (Number(kanban) === 0) {
    if (searchParam) {
      whereCondition = {
        [Op.or]: [
          {
            name: Sequelize.where(
              Sequelize.fn("LOWER", Sequelize.col("Tag.name")),
              "LIKE",
              `%${sanitizedSearchParam}%`
            )
          },
          { color: { [Op.like]: `%${sanitizedSearchParam}%` } }
          // { kanban: { [Op.like]: `%${searchParam}%` } }
        ]
      };
    }

    // Usuários não-admin veem apenas tags transacionais (sem #)
    // E apenas tags globais ou suas próprias tags
    // EXCEÇÃO: Se tem permissão users.edit, vê todas (para poder atribuir a outros usuários)
    console.log("[ListService] Verificando filtro: profile =", profile, ", userId =", userId);
    
    if (profile !== "admin" && !userId) {
      console.log("[ListService] Aplicando filtro de tags transacionais (sem #) para não-admin");
      whereCondition = {
        ...whereCondition,
        name: { [Op.notLike]: "#%" },
        [Op.or]: [
          { userId: null },
          { userId: userId }
        ]
      };
    } else {
      console.log("[ListService] Admin ou userId presente - mostrando todas as tags");
    }

    console.log("[ListService] whereCondition final:", JSON.stringify({ ...whereCondition, companyId, kanban }, null, 2));

    const { count, rows: tags } = await Tag.findAndCountAll({
      where: { ...whereCondition, companyId, kanban },
      limit,
      include: [
        {
          // model: ContactTag,
          // as: "contactTags",
          // include: [
          //   {
          model: Contact,
          as: "contacts",
          //   }
          // ]
        },
      ],
      attributes: [
        'id',
        'name',
        'color',
        'kanban',
      ],
      offset,
      order: [["name", "ASC"]],
    });

    console.log("[ListService] Tags encontradas:", tags?.length);
    console.log("[ListService] Total count:", count);
    console.log("[ListService] Tags (nomes):", tags?.map(t => t.name));

    const hasMore = count > offset + tags.length;

    return {
      tags,
      count,
      hasMore
    };

  } else {
    if (searchParam) {
      whereCondition = {
        [Op.or]: [
          {
            name: Sequelize.where(
              Sequelize.fn("LOWER", Sequelize.col("Tag.name")),
              "LIKE",
              `%${sanitizedSearchParam}%`
            )
          },
          { color: { [Op.like]: `%${sanitizedSearchParam}%` } }
          // { kanban: { [Op.like]: `%${searchParam}%` } }
        ]
      };
    }

    if (tagId > 0) {
      whereCondition = {
        ...whereCondition,
        id: { [Op.ne]: [tagId] }
      }
    }

    // console.log(whereCondition)
    const { count, rows: tags } = await Tag.findAndCountAll({
      where: { ...whereCondition, companyId, kanban },
      limit,
      offset,
      order: [["name", "ASC"]],
      include: [
        {
          model: TicketTag,
          as: "ticketTags",

        },
      ],
      attributes: [
        'id',
        'name',
        'color',
        'kanban',
      ],
    });

    const hasMore = count > offset + tags.length;

    return {
      tags,
      count,
      hasMore
    };
  }
};

export default ListService;
