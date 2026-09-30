import AppError from "../../errors/AppError";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { FlowCampaignModel } from "../../models/FlowCampaign";
import { WebhookModel } from "../../models/Webhook";
import { randomString } from "../../utils/randomCode";

interface Request {
  companyId: number;
  name: string;
  flowId: number;
  phrase:string
  id: number
  status: boolean
}

const UpdateFlowCampaignService = async ({
  companyId,
  name,
  flowId,
  phrase,
  id,
  status
}: Request): Promise<String> => {
  try {

    // flowId novo também precisa pertencer ao tenant
    if (flowId) {
      const flowExists = await FlowBuilderModel.findOne({
        where: { id: flowId, company_id: companyId }
      });
      if (!flowExists) {
        throw new AppError("ERR_NO_FLOW_FOUND", 404);
      }
    }

    const flow = await FlowCampaignModel.update({ name, phrase, flowId, status }, {
      where: {id: id, companyId}
    });

    return 'ok';
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error("Erro ao inserir o usuário:", error);

    return error
  }
};

export default UpdateFlowCampaignService;
