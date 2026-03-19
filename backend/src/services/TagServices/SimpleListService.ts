import { Op } from "sequelize";
import Tag from "../../models/Tag";

interface Request {
  companyId: number;
  searchParam?: string;
  kanban?: number;
  profile?: string;
  userId?: number | string;
}

const ListService = async ({
  companyId,
  searchParam,
  kanban = 0,
  profile = "user",
  userId
}: Request): Promise<Tag[]> => {
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

    return tags;
  } catch (err) {
    console.error("[SimpleListService] Erro ao buscar tags:", err);
    throw err;
  }
};

export default ListService;
