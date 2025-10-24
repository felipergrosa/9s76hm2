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

    // Busca contatos que têm alguma tag de permissão (#) que o usuário NÃO possui
    const contactsWithDisallowedTags = await ContactTag.findAll({
      where: { 
        tagId: { [Op.notIn]: userAllowedContactTags }
      },
      include: [
        { 
          model: Tag, 
          as: "tags",
          attributes: [], 
          where: { name: { [Op.like]: "#%" } } // Apenas tags de permissão
        }
      ],
      attributes: ["contactId"],
      group: ["contactId"]
    });
    
    const disallowedContactIds = contactsWithDisallowedTags.map(ct => ct.contactId);
    
    // Busca contatos que têm pelo menos UMA tag permitida E não têm tags proibidas
    const whereClause: any = { 
      tagId: { [Op.in]: userAllowedContactTags }
    };
    
    if (disallowedContactIds.length > 0) {
      whereClause.contactId = { [Op.notIn]: disallowedContactIds };
    }
    
    const contactsWithAllowedTags = await ContactTag.findAll({
      where: whereClause,
      attributes: ["contactId"],
      group: ["contactId"]
    });
    
    const allowedContactIds = contactsWithAllowedTags.map(ct => ct.contactId);

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
