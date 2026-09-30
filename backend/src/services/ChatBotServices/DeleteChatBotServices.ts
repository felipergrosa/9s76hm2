import ShowChatBotServices from "./ShowChatBotServices";

const DeleteChatBotServices = async (
  chatbotId: number | string,
  companyId: number
): Promise<void> => {
  const chatbot = await ShowChatBotServices(chatbotId, companyId);

  await chatbot.destroy();
};

export default DeleteChatBotServices;
