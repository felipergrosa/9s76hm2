import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import QueueOption from "../../models/QueueOption";
import { FindOptions } from "sequelize/types";
import Chatbot from "../../models/Chatbot";

const ShowWhatsAppServiceAdmin = async (
  id: string | number,
  companyId: number,
): Promise<Whatsapp> => {

  const findOptions: FindOptions = {
    // Escopo por empresa: impede IDOR entre tenants
    where: { id, companyId },
    include: [
      {
        model: Queue,
        as: "queues",
        attributes: ["id", "name", "color", "greetingMessage", "integrationId", "fileListId", "closeTicket"],
        include: [
          {
            model: Chatbot,
            as: "chatbots",
            attributes: ["id", "name", "greetingMessage", "closeTicket"]
          }
        ]
      }
    ],
    order: [
      ["queues", "orderQueue", "ASC"],
      ["queues", "chatbots", "id", "ASC"]
    ]
  };
  const whatsapp = await Whatsapp.findOne(findOptions);

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  return whatsapp;
};

export default ShowWhatsAppServiceAdmin;
