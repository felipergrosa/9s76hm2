import AppError from "../../errors/AppError";
import { FlowCampaignModel } from "../../models/FlowCampaign";

const DeleteFlowCampaignService = async (
  id: number,
  companyId: number
): Promise<FlowCampaignModel> => {

  const flow = await FlowCampaignModel.findOne({
    where: { id: id, companyId }
  });

  if (!flow) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  await flow.destroy();

  return flow;
};

export default DeleteFlowCampaignService;
