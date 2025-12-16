import ContactReleaseRequest from "../../models/ContactReleaseRequest";
import User from "../../models/User";
import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";
import { emitToCompanyRoom } from "../../libs/socketEmit";

interface Request {
  id: number;
  companyId: number;
  resolverId: number;
}

const ResolveContactReleaseRequestService = async ({
  id,
  companyId,
  resolverId
}: Request): Promise<ContactReleaseRequest> => {
  const record = await ContactReleaseRequest.findOne({ where: { id, companyId } });
  if (!record) {
    throw new AppError("Solicitação não encontrada", 404);
  }

  if (record.status === "resolved") {
    return record;
  }

  await record.update({
    status: "resolved",
    resolvedById: resolverId,
    resolvedAt: new Date()
  });

  const resolver = await User.findByPk(resolverId, { attributes: ["id", "name", "profile"] });
  const contact = await Contact.findByPk(record.contactId, { attributes: ["id", "name", "number"] });

  await emitToCompanyRoom(
    companyId,
    "notification",
    `company-${companyId}-contactReleaseRequest`,
    {
      action: "resolve",
      record: {
        id: record.id,
        companyId,
        contactId: record.contactId,
        status: "resolved",
        resolvedById: resolverId,
        resolvedAt: record.resolvedAt,
        resolver,
        contact
      }
    }
  );

  return record;
};

export default ResolveContactReleaseRequestService;
