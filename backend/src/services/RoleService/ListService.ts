import { Op } from "sequelize";
import { isEmpty } from "lodash";
import Role from "../../models/Role";

interface Request {
  companyId: number | string;
  searchParam?: string;
}

const ListService = async ({ companyId, searchParam = "" }: Request): Promise<Role[]> => {
  const whereCondition: any = { companyId };

  if (!isEmpty(searchParam)) {
    whereCondition.name = { [Op.iLike]: `%${searchParam.trim()}%` };
  }

  const roles = await Role.findAll({
    where: whereCondition,
    order: [["name", "ASC"]]
  });

  return roles;
};

export default ListService;
