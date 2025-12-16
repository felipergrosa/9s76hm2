import ContactReleaseRequest from "../../models/ContactReleaseRequest";
import Contact from "../../models/Contact";
import User from "../../models/User";

interface Request {
  companyId: number;
}

const ListContactReleaseRequestsService = async ({ companyId }: Request) => {
  const records = await ContactReleaseRequest.findAll({
    where: {
      companyId,
      status: "pending"
    } as any,
    include: [
      { model: Contact, as: "contact", attributes: ["id", "name", "number"] },
      { model: User, as: "requester", attributes: ["id", "name", "profile"] }
    ],
    order: [["createdAt", "DESC"]]
  });

  return records;
};

export default ListContactReleaseRequestsService;
