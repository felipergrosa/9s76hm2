import AppError from "../../errors/AppError";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { FlowCampaignModel } from "../../models/FlowCampaign";
import { WebhookModel } from "../../models/Webhook";
import { randomString } from "../../utils/randomCode";

interface Request {
  userId: number;
  name: string;
  companyId: number
  flowId: number;
  phrase: string;
  whatsappId: string;
}

const CreateFlowCampaignService = async ({
  userId,
  name,
  companyId,
  phrase,
  whatsappId,
  flowId
}: Request): Promise<FlowCampaignModel> => {
  try {
    // flowId precisa pertencer ao tenant — evita campanha apontando para
    // fluxo de outra empresa (IDOR)
    const flowExists = await FlowBuilderModel.findOne({
      where: { id: flowId, company_id: companyId }
    });
    if (!flowExists) {
      throw new AppError("ERR_NO_FLOW_FOUND", 404);
    }

    const flow = await FlowCampaignModel.create({
      userId: userId,
      companyId: companyId,
      name: name,
      phrase: phrase,
      flowId: flowId,
      whatsappId: whatsappId
    });

    return flow;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error("Erro ao inserir o usuário:", error);

    return error
  }
};

export default CreateFlowCampaignService;
