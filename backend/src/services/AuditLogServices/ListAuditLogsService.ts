import { Op } from "sequelize";
import AuditLog from "../../models/AuditLog";
import User from "../../models/User";

interface Request {
  companyId: number;
  searchParam?: string;
  action?: string;
  entity?: string;
  userId?: number;
  startDate?: string;
  endDate?: string;
  pageNumber?: string | number;
}

interface Response {
  logs: AuditLog[];
  count: number;
  hasMore: boolean;
}

const ListAuditLogsService = async ({
  companyId,
  searchParam = "",
  action,
  entity,
  userId,
  startDate,
  endDate,
  pageNumber = "1"
}: Request): Promise<Response> => {
  const limit = 20;
  const offset = limit * (Number(pageNumber) - 1);

  const whereCondition: any = {
    companyId
  };

  // Filtro por ação
  if (action && action !== "Todos") {
    whereCondition.action = action;
  }

  // Filtro por entidade
  if (entity && entity !== "Todos") {
    whereCondition.entity = entity;
  }

  // Filtro por usuário
  if (userId) {
    whereCondition.userId = userId;
  }

  // Filtro por período
  if (startDate && endDate) {
    whereCondition.createdAt = {
      [Op.between]: [new Date(startDate), new Date(endDate)]
    };
  } else if (startDate) {
    whereCondition.createdAt = {
      [Op.gte]: new Date(startDate)
    };
  } else if (endDate) {
    whereCondition.createdAt = {
      [Op.lte]: new Date(endDate)
    };
  }

  // Busca por texto (nome de usuário, código da entidade, detalhes)
  if (searchParam) {
    whereCondition[Op.or] = [
      { userName: { [Op.iLike]: `%${searchParam}%` } },
      { entityId: { [Op.iLike]: `%${searchParam}%` } },
      { details: { [Op.iLike]: `%${searchParam}%` } }
    ];
  }

  const { count, rows: logs } = await AuditLog.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "name", "email"]
      }
    ]
  });

  const hasMore = count > offset + logs.length;

  return {
    logs,
    count,
    hasMore
  };
};

export default ListAuditLogsService;
