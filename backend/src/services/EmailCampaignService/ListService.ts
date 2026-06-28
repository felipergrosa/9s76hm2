import { Op, fn, col, where, literal } from "sequelize";
import { isEmpty } from "lodash";
import EmailCampaign from "../../models/EmailCampaign";
import ContactList from "../../models/ContactList";

interface Request {
  companyId: number | string;
  searchParam?: string;
  pageNumber?: string;
}

interface Response {
  records: EmailCampaign[];
  count: number;
  hasMore: boolean;
}

const ListService = async ({
  searchParam = "",
  pageNumber = "1",
  companyId
}: Request): Promise<Response> => {
  let whereCondition: any = { companyId };

  if (!isEmpty(searchParam)) {
    whereCondition = {
      ...whereCondition,
      [Op.or]: [
        {
          name: where(
            fn("LOWER", col("EmailCampaign.name")),
            "LIKE",
            `%${searchParam.toLowerCase().trim()}%`
          )
        }
      ]
    };
  }

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: records } = await EmailCampaign.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [literal('"EmailCampaign"."scheduledAt" DESC NULLS LAST')],
    include: [{ model: ContactList }]
  });

  const hasMore = count > offset + records.length;

  return { records, count, hasMore };
};

export default ListService;
