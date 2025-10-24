import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";
import { FindOptions, Op, literal } from "sequelize";
import Ticket from "../../models/Ticket";
import ContactTag from "../../models/ContactTag";
import User from "../../models/User";
import Tag from "../../models/Tag";

export interface SearchContactParams {
  companyId: string | number;
  name?: string;
  userId?: number;
  profile?: string;
}

const SimpleListService = async ({ name, companyId, userId, profile }: SearchContactParams): Promise<Contact[]> => {
  let options: FindOptions = {
    order: [
      ['name', 'ASC']
    ]
  }

  if (name) {
    options.where = {
      name: {
        [Op.like]: `%${name}%`
      }
    }
  }

  // Regra de acesso por tags: usuário deve ter TODAS as tags de permissão (#) que o contato possui
  // Tags de permissão são aquelas que começam com '#'
  if (profile !== "admin" && userId) {
    const user = await User.findByPk(userId);
    const userAllowedContactTags = user && Array.isArray(user.allowedContactTags) ? user.allowedContactTags : [];

    if (userAllowedContactTags.length === 0) {
      // Usuário sem tags permitidas => nenhum contato
      return [];
    }

    // Busca contatos que possuem TODAS as tags permitidas do usuário (lógica AND)
    // Usa COUNT para garantir que o contato tenha exatamente todas as tags
    const contactsWithAllTags = await ContactTag.findAll({
      where: { tagId: { [Op.in]: userAllowedContactTags } },
      attributes: ["contactId"],
      group: ["contactId"],
      having: literal(`COUNT(DISTINCT "tagId") = ${userAllowedContactTags.length}`)
    });
    
    const allowedContactIds = contactsWithAllTags.map(ct => ct.contactId);

    if (allowedContactIds.length === 0) {
      return [];
    }

    options.where = {
      ...options.where,
      companyId,
      id: { [Op.in]: allowedContactIds }
    };
  } else {
    options.where = {
      ...options.where,
      companyId
    }
  }

  const contacts = await Contact.findAll(options);

  if (!contacts) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  return contacts;
};

export default SimpleListService;
