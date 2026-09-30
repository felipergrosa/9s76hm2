import { Sequelize, Op } from "sequelize";
import Invoices from "../../models/Invoices";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  companyId?: number;
  isSuper?: boolean;
}

interface Response {
  invoices: Invoices[];
  count: number;
  hasMore: boolean;
}

const ListInvoicesServices = async ({
  searchParam = "",
  pageNumber = "1",
  companyId,
  isSuper
}: Request): Promise<Response> => {
  const whereCondition: any = {
    [Op.or]: [
      {
        name: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("detail")),
          "LIKE",
          `%${searchParam.toLowerCase().trim()}%`
        )
      }
    ]
  };

  // Isolamento por empresa: não-super só enxerga faturas da própria empresa
  if (!isSuper && companyId !== undefined) {
    whereCondition.companyId = companyId;
  }
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: invoices } = await Invoices.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["id", "ASC"]]
  });

  const hasMore = count > offset + invoices.length;

  return {
    invoices,
    count,
    hasMore
  };
};

export default ListInvoicesServices;
