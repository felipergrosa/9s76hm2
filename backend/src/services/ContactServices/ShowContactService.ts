import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import GetUserWalletContactIds from "../../helpers/GetUserWalletContactIds";

const ShowContactService = async (
  id: string | number,
  companyId: number,
  requestUserId?: number
): Promise<Contact> => {
  const contact = await Contact.findByPk(id, {
    include: ["extraInfo", "tags",
      {
        association: "wallets",
        attributes: ["id", "name"]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name", "expiresTicket", "groupAsTicket"]
      },
    ]
  });

  if (contact?.companyId !== companyId) {
    throw new AppError("Não é possível excluir registro de outra empresa");
  }

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  // Restrição de carteira: se usuário é restrito, só permite abrir contato dentro da carteira (inclui gerenciados)
  if (requestUserId) {
    const walletResult = await GetUserWalletContactIds(requestUserId, companyId);
    if (walletResult.hasWalletRestriction) {
      const allowedContactIds = walletResult.contactIds;
      if (!allowedContactIds.includes(Number(contact.id))) {
        throw new AppError("FORBIDDEN_CONTACT_ACCESS", 403);
      }
    }
  }

  return contact;
};

export default ShowContactService;
