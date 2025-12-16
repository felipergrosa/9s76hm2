import ContactReleaseRequest from "../../models/ContactReleaseRequest";
import Contact from "../../models/Contact";
import User from "../../models/User";
import { emitToCompanyRoom } from "../../libs/socketEmit";

interface Request {
  companyId: number;
  contactId: number;
  requesterId: number;
  reason?: string;
}

const CreateContactReleaseRequestService = async ({
  companyId,
  contactId,
  requesterId,
  reason
}: Request): Promise<ContactReleaseRequest> => {
  const [record] = await ContactReleaseRequest.findOrCreate({
    where: {
      companyId,
      contactId,
      status: "pending"
    } as any,
    defaults: {
      companyId,
      contactId,
      requesterId,
      status: "pending",
      reason: reason || null
    }
  });

  // Atualiza requester/reason se já existia (mantém uma pendente por contato)
  if (record.requesterId !== requesterId || (reason && record.reason !== reason)) {
    await record.update({ requesterId, reason: reason || record.reason });
  }

  // Carregar dados mínimos p/ payload
  const contact = await Contact.findByPk(contactId, { attributes: ["id", "name", "number"] });
  const requester = await User.findByPk(requesterId, { attributes: ["id", "name", "profile"] });

  await emitToCompanyRoom(
    companyId,
    "notification",
    `company-${companyId}-contactReleaseRequest`,
    {
      action: "create",
      record: {
        id: record.id,
        companyId,
        contactId,
        requesterId,
        reason: record.reason,
        status: record.status,
        createdAt: record.createdAt,
        contact,
        requester
      }
    }
  );

  return record;
};

export default CreateContactReleaseRequestService;
