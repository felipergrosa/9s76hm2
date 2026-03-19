import { Op, literal } from "sequelize";
import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";

interface Request {
  companyId: number;
  searchParam?: string;
  kanban?: number;
  profile?: string;
  userId?: number | string;
}

// Interface de retorno estendida com contactCount
interface TagWithCount {
  id: number;
  name: string;
  color: string;
  kanban: number;
  userId: number | null;
  companyId: number;
  contactCount: number;
}

const ListService = async ({
  companyId,
  searchParam,
  kanban = 0,
  profile = "user",
  userId
}: Request): Promise<TagWithCount[]> => {
  let whereCondition: any = {};

  if (searchParam) {
    whereCondition = {
      [Op.or]: [
        { name: { [Op.like]: `%${searchParam}%` } },
        { color: { [Op.like]: `%${searchParam}%` } }
      ]
    };
  }

  // Admins/Super veem todas as tags (necessário para atribuir tags pessoais no UserModal)
  // Usuários comuns veem apenas tags globais (sem userId) ou suas próprias tags
  if (profile !== "admin") {
    whereCondition = {
      ...whereCondition,
      [Op.or]: [
        { userId: null },
        { userId: userId }
      ]
    };
  }

  try {
    // Query otimizada: busca tags sem incluir todos os contatos
    const tags = await Tag.findAll({
      where: { ...whereCondition, companyId, kanban },
      order: [["name", "ASC"]],
      attributes: ["id", "name", "color", "kanban", "userId", "companyId"]
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
      
      // Criar mapa de contagem
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

    return tagsWithCount;
  } catch (err) {
    console.error("[SimpleListService] Erro ao buscar tags:", err);
    throw err;
  }
};

export default ListService;
