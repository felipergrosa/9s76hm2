import { WASocket } from "@whiskeysockets/baileys";
import { getWbotOrRecover } from "../libs/wbot";
import GetDefaultWhatsApp from "./GetDefaultWhatsApp";
import Ticket from "../models/Ticket";

type Session = WASocket & {
  id?: number;
};

const GetTicketWbot = async (ticket: Ticket): Promise<Session> => {
  if (!ticket.whatsappId) {
    const defaultWhatsapp = await GetDefaultWhatsApp(ticket.whatsappId, ticket.companyId);

    await ticket.$set("whatsapp", defaultWhatsapp);
  }

  // CORREÇÃO: Usar getWbotOrRecover para aguardar sessão durante reconexão
  const wbot = await getWbotOrRecover(ticket.whatsappId, 30000);
  if (!wbot) {
    throw new Error("ERR_WAPP_NOT_INITIALIZED");
  }
  return wbot;
};

export default GetTicketWbot;
