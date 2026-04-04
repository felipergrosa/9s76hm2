import AppError from "../../errors/AppError";
import { isNil } from "lodash";

import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import GetDefaultWhatsAppByUser from "../../helpers/GetDefaultWhatsAppByUser";
import ShowContactService from "../ContactServices/ShowContactService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import CompaniesSettings from "../../models/CompaniesSettings";
import FindOrCreateTicketService from "./FindOrCreateTicketService";
import ShowTicketService from "./ShowTicketService";
import Ticket from "../../models/Ticket";

interface Request {
  contactId: number;
  status: string;
  userId: number | null;
  companyId: number;
  queueId?: number;
  whatsappId: string;
}

const CreateTicketService = async ({
  contactId,
  status,
  userId,
  queueId,
  companyId,
  whatsappId = ""
}: Request): Promise<Ticket> => {

  let whatsapp;
  let defaultWhatsapp

  if (whatsappId !== "undefined" && whatsappId !== null && whatsappId !== "") {
    // console.log("GETTING WHATSAPP CREATE TICKETSERVICE", whatsappId)
    whatsapp = await ShowWhatsAppService(whatsappId, companyId)
  }


  const userIdNumber = userId ? Number(userId) : null;
  defaultWhatsapp = userIdNumber ? await GetDefaultWhatsAppByUser(userIdNumber) : null;

  if (whatsapp) {
    defaultWhatsapp = whatsapp;
  }
  if (!defaultWhatsapp)
    defaultWhatsapp = await GetDefaultWhatsApp(whatsapp?.id, companyId, userIdNumber || undefined);

  const contact = await ShowContactService(contactId, companyId);
  const isGroup = contact.isGroup;
  const settings = await CompaniesSettings.findOne({
    where: { companyId }
  });

  let ticket = await FindOrCreateTicketService(
    contact as any,
    defaultWhatsapp as any,
    0,
    companyId,
    queueId ?? null,
    userIdNumber,
    isGroup ? (contact as any) : null,
    defaultWhatsapp.channel,
    false,
    false,
    settings,
    false,
    false,
    true
  );

  const nextStatus = isGroup ? "group" : (status || "open");
  const nextQueueId = !isNil(queueId) ? queueId : ticket.queueId;
  const nextUserId = nextStatus === "pending" ? null : userIdNumber;

  await ticket.update({
    status: nextStatus,
    queueId: nextQueueId,
    userId: nextUserId,
    isActiveDemand: true
  });

  ticket = await ShowTicketService(ticket.id, companyId);

  if (!ticket) {
    throw new AppError("ERR_CREATING_TICKET");
  }

  return ticket;
};

export default CreateTicketService;
