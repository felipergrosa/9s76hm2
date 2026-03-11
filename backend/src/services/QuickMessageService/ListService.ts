import { Sequelize, Op, Filterable } from "sequelize";
import QuickMessage from "../../models/QuickMessage";
import User from "../../models/User";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  companyId: number | string;
  userId?: number | string;
  isAdmin?: boolean;
  sortBy?: string;
  groupName?: string;
}

interface Response {
  records: QuickMessage[];
  count: number;
  hasMore: boolean;
}

const ListService = async ({
  searchParam = "",
  pageNumber = "1",
  companyId,
  userId,
  isAdmin = false,
  sortBy,
  groupName
}: Request): Promise<Response> => {
  const sanitizedSearchParam = searchParam.toLocaleLowerCase().trim();

  let whereCondition: Filterable["where"] = {
    companyId
  };

  // Filtro de busca por shortcode E message
  if (sanitizedSearchParam) {
    whereCondition = {
      ...whereCondition,
      [Op.or]: [
        {
          shortcode: Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("shortcode")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        },
        {
          message: Sequelize.where(
            Sequelize.fn("LOWER", Sequelize.col("message")),
            "LIKE",
            `%${sanitizedSearchParam}%`
          )
        }
      ]
    };
  }

  // Filtro de visibilidade por perfil
  // Admin/superadmin veem todas da company
  // User padrão vê APENAS AS SUAS (strict permission)
  if (!isAdmin) {
    whereCondition = {
      ...whereCondition,
      userId
    };
  }

  // Filtro opcional por groupName
  if (groupName) {
    whereCondition = {
      ...whereCondition,
      groupName
    };
  }

  const limit = 200; // Aumentado para o painel do ticket carregar tudo
  const offset = limit * (+pageNumber - 1);

  // Ordenação
  let order: any[] = [["shortcode", "ASC"]];
  if (sortBy === "useCount") {
    order = [["useCount", "DESC"], ["shortcode", "ASC"]];
  } else {
    order = [["groupName", "ASC"], ["shortcode", "ASC"]];
  }

  const { count, rows: records } = await QuickMessage.findAndCountAll({
    where: whereCondition,
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "name"]
      }
    ],
    limit,
    offset,
    order
  });

  const hasMore = count > offset + records.length;

  return {
    records,
    count,
    hasMore
  };
};

export default ListService;
