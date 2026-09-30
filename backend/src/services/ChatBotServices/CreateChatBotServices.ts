import Chatbot from "../../models/Chatbot";
import validateChatbotRefs from "./validateChatbotRefs";

interface ChatbotData {
  name: string;
  color: string;
  greetingMessage?: string;
  queueType?: string;
  optUserId?: number;
  optQueueId?: number;
  optIntegrationId?: number;
  optFileId?: number;
  closeTicket?: boolean;
}

const CreateChatBotServices = async (
  chatBotData: ChatbotData,
  companyId: number
): Promise<Chatbot> => {
  // Referências opcionais precisam pertencer ao mesmo tenant
  await validateChatbotRefs(chatBotData, companyId);

  const chatBot = await Chatbot.create({ ...chatBotData, companyId });
  return chatBot;
};

export default CreateChatBotServices;
