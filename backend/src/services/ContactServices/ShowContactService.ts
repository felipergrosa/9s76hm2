import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";

const ShowContactService = async (
  id: string | number,
  companyId: number,
  requestUserId?: number
): Promise<Contact> => {
  const contact = await Contact.findByPk(id, {
    include: ["extraInfo", "tags",
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

  // Restrição de carteira REMOVIDA da visualização
  // Usuário pode VISUALIZAR qualquer contato da empresa
  // Restrição aplicada apenas em update/delete (ver UpdateContactService/DeleteContactService)

  return contact;
};

export default ShowContactService;
