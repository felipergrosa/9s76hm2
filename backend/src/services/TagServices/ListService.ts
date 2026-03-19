import { Op, Sequelize, literal } from "sequelize";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import ContactTag from "../../models/ContactTag";
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

interface TagWithCount {
  id: number;
  name: string;
  color: string;
  kanban: number;
  userId: number | null;
  companyId: number;
  contactCount: number;
}

interface Response {
  tags: TagWithCount[];
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
        ]
      };
    }

    // Usuários não-admin veem apenas tags transacionais (sem #)
    // E apenas tags globais ou suas próprias tags
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

    // ULTRALEVE: Buscar contagens de contatos para todas as tags em uma query só
    const tagIds = tags.map(t => t.id);
    let contactCounts: Map<number, number> = new Map();
    
    if (tagIds.length > 0) {
      const counts = await ContactTag.findAll({
        where: { 
          tagId: { [Op.in]: tagIds },
          companyId 
        },
        attributes: [
          ["tagId", "tagId"],
          [literal("COUNT(*)"), "count"]
        ],
        group: ["tagId"],
        raw: true
      });
      
      counts.forEach((row: any) => {
        contactCounts.set(Number(row.tagId), Number(row.count));
      });
    }

    // Adicionar contactCount a cada tag
    const tagsWithCount: TagWithCount[] = tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      kanban: tag.kanban,
      userId: tag.userId,
      companyId: tag.companyId,
      contactCount: contactCounts.get(tag.id) || 0
    }));

    const hasMore = count > offset + tags.length;

    return {
      tags: tagsWithCount,
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
        ]
      };
    }

    if (tagId > 0) {
      whereCondition = {
        ...whereCondition,
        id: { [Op.ne]: [tagId] }
      }
    }

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
        'userId',
        'companyId'
      ],
    });

    // ULTRALEVE: Buscar contagens para tags do kanban também
    const tagIds = tags.map(t => t.id);
    let contactCounts: Map<number, number> = new Map();
    
    if (tagIds.length > 0) {
      const counts = await ContactTag.findAll({
        where: { 
          tagId: { [Op.in]: tagIds },
          companyId 
        },
        attributes: [
          ["tagId", "tagId"],
          [literal("COUNT(*)"), "count"]
        ],
        group: ["tagId"],
        raw: true
      });
      
      counts.forEach((row: any) => {
        contactCounts.set(Number(row.tagId), Number(row.count));
      });
    }

    const tagsWithCount: TagWithCount[] = tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      kanban: tag.kanban,
      userId: tag.userId,
      companyId: tag.companyId,
      contactCount: contactCounts.get(tag.id) || 0
    }));

    const hasMore = count > offset + tags.length;

    return {
      tags: tagsWithCount,
      count,
      hasMore
    };
  }
};

export default ListService;
