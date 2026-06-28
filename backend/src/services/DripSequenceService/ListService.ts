import { Op, fn, col, where, literal } from "sequelize";
import { isEmpty } from "lodash";
import DripSequence from "../../models/DripSequence";
import Tag from "../../models/Tag";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  companyId: number | string;
  searchParam?: string;
  pageNumber?: string;
}

interface Response {
  records: DripSequence[];
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
            fn("LOWER", col("DripSequence.name")),
            "LIKE",
            `%${searchParam.toLowerCase().trim()}%`
          )
        }
      ]
    };
  }

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: records } = await DripSequence.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [literal('"DripSequence"."createdAt" DESC')],
    include: [
      { model: Tag, attributes: ["id", "name", "color"] },
      { model: Whatsapp, attributes: ["id", "name"] }
    ]
  });

  const hasMore = count > offset + records.length;

  return { records, count, hasMore };
};

export default ListService;
