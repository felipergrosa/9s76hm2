import MetaAutomationRule from "../../models/MetaAutomationRule";
import Whatsapp from "../../models/Whatsapp";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import AppError from "../../errors/AppError";

const ShowService = async (
  id: string | number,
  companyId: number
): Promise<MetaAutomationRule> => {
  const record = await MetaAutomationRule.findOne({
    where: { id, companyId },
    include: [
      { model: Whatsapp, attributes: ["id", "name", "channel", "channelType"] },
      { model: FlowBuilderModel, as: "flow", attributes: ["id", "name"] }
    ]
  });

  if (!record) {
    throw new AppError("Automação não encontrada", 404);
  }

  return record;
};

export default ShowService;
