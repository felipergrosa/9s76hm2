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

  // Restrição por tag pessoal: usuário só vê contatos com PELO MENOS UMA das suas tags pessoais
  if (userId && profile !== "admin") {
    const user = await User.findByPk(userId, {
      attributes: ["id", "allowedContactTags"]
    });
    
    if (user && Array.isArray((user as any).allowedContactTags) && (user as any).allowedContactTags.length > 0) {
      // Filtrar apenas tags pessoais (começam com # mas não com ##)
      const personalTags = await Tag.findAll({
        where: {
          id: { [Op.in]: (user as any).allowedContactTags },
          companyId,
          name: {
            [Op.and]: [
              { [Op.like]: "#%" },
              { [Op.notLike]: "##%" }
            ]
          }
        },
        attributes: ["id"]
      });
      const personalTagIds = personalTags.map(t => t.id);
      
      if (personalTagIds.length > 0) {
        // Busca contatos que têm PELO MENOS UMA das tags pessoais do usuário
        const contactsWithAnyTag = await ContactTag.findAll({
          where: { tagId: { [Op.in]: personalTagIds }, companyId },
          attributes: [[literal('DISTINCT "contactId"'), 'contactId']],
          raw: true
        });
        const allowedIds = contactsWithAnyTag.map((ct: any) => Number(ct.contactId)).filter(Number.isInteger);
        options.where = {
          ...options.where,
          companyId,
          id: { [Op.in]: allowedIds.length > 0 ? allowedIds : [0] }
        };
      } else {
        options.where = { ...options.where, companyId };
      }
    } else {
      options.where = { ...options.where, companyId };
    }
  } else {
    options.where = { ...options.where, companyId };
  }

  const contacts = await Contact.findAll(options);

  if (!contacts) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  return contacts;
};

export default SimpleListService;
