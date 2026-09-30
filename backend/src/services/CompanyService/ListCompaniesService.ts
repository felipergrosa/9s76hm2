import { Sequelize, Op } from "sequelize";
import Company from "../../models/Company";
import Plan from "../../models/Plan";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  // Obrigatório para requisitante não-super: limita a listagem à própria empresa
  companyId?: number;
}

interface Response {
  companies: Company[];
  count: number;
  hasMore: boolean;
}

const ListCompaniesService = async ({
  searchParam = "",
  pageNumber = "1",
  companyId
}: Request): Promise<Response> => {

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  // Filtro multi-tenant: companyId restringe à própria empresa (não-super);
  // searchParam filtra por nome — antes era ignorado.
  const where: any = {};
  if (companyId !== undefined) {
    where.id = companyId;
  }
  if (searchParam) {
    where.name = { [Op.iLike]: `%${searchParam}%` };
  }

  const { count, rows: companies } = await Company.findAndCountAll({
    where,
    include: [{
      model: Plan,
      as: "plan",
      attributes: ["name"]
    }],
    limit,
    offset,
    order: [["name", "ASC"]]
  });

  const hasMore = count > offset + companies.length;

  return {
    companies,
    count,
    hasMore
  };
};

export default ListCompaniesService;
