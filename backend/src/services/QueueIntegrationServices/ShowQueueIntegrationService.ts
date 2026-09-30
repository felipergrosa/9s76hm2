import QueueIntegrations from "../../models/QueueIntegrations";
import AppError from "../../errors/AppError";


const ShowQueueIntegrationService = async (id: string | number, companyId: number): Promise<QueueIntegrations> => {
  const integration = await QueueIntegrations.findByPk(id);

  if (!integration) {
    throw new AppError("ERR_NO_DIALOG_FOUND", 404);
  }

  // Isolamento por tenant — integração de outra empresa não pode ser lida
  if (Number(integration.companyId) !== Number(companyId)) {
    throw new AppError("Não é possível acessar registro de outra empresa", 403);
  }

  return integration;
};

export default ShowQueueIntegrationService;
