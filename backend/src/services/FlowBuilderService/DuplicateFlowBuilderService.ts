import AppError from "../../errors/AppError";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { WebhookModel } from "../../models/Webhook";
import { randomString } from "../../utils/randomCode";

interface Request {
  id: number;
  companyId: number;
}

const DuplicateFlowBuilderService = async ({
  id,
  companyId
}: Request): Promise<FlowBuilderModel> => {
  try {
    const flow = await FlowBuilderModel.findOne({
      where: {
        id: id,
        company_id: companyId
      }
    });

    if (!flow) {
      throw new AppError("ERR_NO_FLOW_FOUND", 404);
    }

    const duplicate = await FlowBuilderModel.create({
      name: flow.name + " - copy",
      flow: flow.flow,
      user_id: flow.user_id,
      company_id: flow.company_id
    });

    return duplicate;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error("Erro ao duplicar o fluxo:", error);

    return error;
  }
};

export default DuplicateFlowBuilderService;
