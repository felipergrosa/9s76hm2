import { Op, Sequelize } from "sequelize";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import removeAccents from "remove-accents";

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
    
    if (profile !== "admin" && !userId) {
      whereCondition = {
        ...whereCondition,
        name: { [Op.notLike]: "#%" },
        [Op.or]: [
          { userId: null },
          { userId: userId }
        ]
      };
    }

    const { count, rows: tags } = await Tag.findAndCountAll({
      where: { ...whereCondition, companyId, kanban },
      limit,
      attributes: [
        'id',
        'name',
        'color',
        'kanban',
        'userId',
        'companyId'
      ],
      offset,
      order: [["name", "ASC"]],
    });

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
