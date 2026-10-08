import { Op, fn, col, where, literal } from "sequelize";
import { isEmpty } from "lodash";
import MetaAutomationRule from "../../models/MetaAutomationRule";
import Whatsapp from "../../models/Whatsapp";
import { FlowBuilderModel } from "../../models/FlowBuilder";

interface Request {
  companyId: number | string;
  searchParam?: string;
  pageNumber?: string;
  whatsappId?: string;
  channel?: string;
  trigger?: string;
  active?: string;
}

interface Response {
  records: MetaAutomationRule[];
  count: number;
  hasMore: boolean;
}

const ListService = async ({
  searchParam = "",
  pageNumber = "1",
  whatsappId,
  channel,
  trigger,
  active,
  companyId
}: Request): Promise<Response> => {
  const whereCondition: any = { companyId };

  if (!isEmpty(searchParam)) {
    whereCondition.name = where(
      fn("LOWER", col("MetaAutomationRule.name")),
      "LIKE",
      `%${searchParam.toLowerCase().trim()}%`
    );
  }

  if (!isEmpty(whatsappId)) {
    whereCondition.whatsappId = Number(whatsappId);
  }

  if (!isEmpty(channel)) {
    whereCondition.channel = channel;
  }

  if (!isEmpty(trigger)) {
    whereCondition.trigger = trigger;
  }

  if (active === "true" || active === "false") {
    whereCondition.active = active === "true";
  }

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: records } = await MetaAutomationRule.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [literal('"MetaAutomationRule"."createdAt" DESC')],
    include: [
      { model: Whatsapp, attributes: ["id", "name", "channel", "channelType"] },
      { model: FlowBuilderModel, as: "flow", attributes: ["id", "name"] }
    ]
  });

  const hasMore = count > offset + records.length;

  return { records, count, hasMore };
};

export default ListService;
