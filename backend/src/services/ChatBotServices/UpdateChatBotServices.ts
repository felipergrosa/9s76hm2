import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Chatbot from "../../models/Chatbot";
import validateChatbotRefs from "./validateChatbotRefs";

interface ChatbotData {
  id?: number;
  name?: string;
  greetingMessage?: string;
  options: Chatbot[];
  closeTicket?: boolean;
  optUserId?: number;
  optQueueId?: number;
  optIntegrationId?: number;
  optFileId?: number;
}

const UpdateChatBotServices = async (
  chatBotId: number | string,
  chatbotData: ChatbotData,
  companyId: number
): Promise<Chatbot> => {
  const { options } = chatbotData;

  const chatbot = await Chatbot.findOne({
    where: { id: chatBotId, companyId },
    include: ["options"],
    order: [["id", "asc"]]
  });

  if (!chatbot) {
    throw new AppError("ERR_NO_CHATBOT_FOUND", 404);
  }

  // Referências do nó raiz precisam pertencer ao tenant
  await validateChatbotRefs(chatbotData, companyId);

  if (options) {
    // Garante que ids de opções enviados pertencem ao tenant — um id de
    // outra empresa não pode ser "roubado" via upsert; nesse caso o id é
    // descartado e a opção é criada como registro novo.
    const optionIds = options
      .map(bot => bot.id)
      .filter(id => id !== null && id !== undefined);
    const owned = await Chatbot.findAll({
      where: { id: { [Op.in]: optionIds }, companyId },
      attributes: ["id"]
    });
    const ownedIds = new Set(owned.map(o => o.id));

    await Promise.all(
      options.map(async bot => {
        // Referências de cada opção também precisam pertencer ao tenant
        await validateChatbotRefs(bot, companyId);

        const payload = { ...bot, chatbotId: chatbot.id, companyId };
        if (payload.id && !ownedIds.has(payload.id)) {
          delete payload.id;
        }
        await Chatbot.upsert(payload);
      })
    );

    await Promise.all(
      chatbot.options.map(async oldBot => {
        const stillExists = options.findIndex(bot => bot.id === oldBot.id);

        if (stillExists === -1) {
          await Chatbot.destroy({ where: { id: oldBot.id, companyId } });
        }
      })
    );
  }

  // Nunca permite trocar id/companyId via payload do request
  delete (chatbotData as any).id;
  delete (chatbotData as any).companyId;

  await chatbot.update(chatbotData);

  await chatbot.reload({
    include: [
      {
        model: Chatbot,
        as: "mainChatbot",
        attributes: ["id", "name", "greetingMessage", "queueType", "optIntegrationId", "optQueueId", "optUserId","optFileId" ],
        order: [[{ model: Chatbot, as: "mainChatbot" }, "id", "ASC"]]
      },
      {
        model: Chatbot,
        as: "options",
        order: [[{ model: Chatbot, as: "options" }, "id", "ASC"]],
        attributes: ["id", "name", "greetingMessage", "queueType", "optIntegrationId", "optQueueId", "optUserId", "optFileId"]
      }
    ],
    order: [["id", "asc"]]
  });

  return chatbot;
};

export default UpdateChatBotServices;
