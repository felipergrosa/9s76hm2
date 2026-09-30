import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import User from "../../models/User";
import Files from "../../models/Files";
import QueueIntegrations from "../../models/QueueIntegrations";

interface ChatbotRefs {
  optQueueId?: number | string | null;
  optUserId?: number | string | null;
  optFileId?: number | string | null;
  optIntegrationId?: number | string | null;
}

/**
 * Valida que as referências opcionais do chatbot pertencem ao tenant.
 * Evita que um usuário aponte o fluxo para filas/usuários/arquivos/
 * integrações de outra empresa.
 */
const validateChatbotRefs = async (
  refs: ChatbotRefs,
  companyId: number
): Promise<void> => {
  const { optQueueId, optUserId, optFileId, optIntegrationId } = refs;

  if (optQueueId) {
    const queue = await Queue.findOne({ where: { id: optQueueId, companyId } });
    if (!queue) throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
  }

  if (optUserId) {
    const user = await User.findOne({ where: { id: optUserId, companyId } });
    if (!user) throw new AppError("ERR_USER_NOT_FOUND", 404);
  }

  if (optFileId) {
    const file = await Files.findOne({ where: { id: optFileId, companyId } });
    if (!file) throw new AppError("ERR_FILE_NOT_FOUND", 404);
  }

  if (optIntegrationId) {
    const integration = await QueueIntegrations.findOne({
      where: { id: optIntegrationId, companyId }
    });
    if (!integration) throw new AppError("ERR_NO_DIALOG_FOUND", 404);
  }
};

export default validateChatbotRefs;
