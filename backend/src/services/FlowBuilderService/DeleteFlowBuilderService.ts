import AppError from "../../errors/AppError";
import { FlowBuilderModel } from "../../models/FlowBuilder";

const DeleteFlowBuilderService = async (
  id: number,
  companyId: number
): Promise<FlowBuilderModel> => {

  const flow = await FlowBuilderModel.findOne({
    where: { id: id, company_id: companyId }
  });

  if (!flow) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  await flow.destroy();

  return flow;
};

export default DeleteFlowBuilderService;
