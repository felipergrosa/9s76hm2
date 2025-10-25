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

  // Regra de acesso hierárquica:
  // Contato deve ter PELO MENOS UMA tag pessoal (#) do usuário
  // E PELO MENOS UMA tag complementar (## ou ###) do usuário
  if (profile !== "admin" && userId) {
    const user = await User.findByPk(userId);
    let userPersonalTags: number[] = [];
    let userComplementaryTags: number[] = [];
    
    if (user && Array.isArray(user.allowedContactTags) && user.allowedContactTags.length > 0) {
      // Busca tags de permissão (que começam com #)
      const { categorizeTagsByName } = require("../../helpers/TagCategoryHelper");
      
      const permissionTags = await Tag.findAll({
        where: {
          id: { [Op.in]: user.allowedContactTags },
          name: { [Op.like]: "#%" }
        },
        attributes: ["id", "name"]
      });
      
      const categorized = categorizeTagsByName(permissionTags);
      userPersonalTags = categorized.personal;
      userComplementaryTags = categorized.complementary;
    }

    if (userPersonalTags.length === 0) {
      // Usuário sem tags pessoais => nenhum contato
      return [];
    }

    // Busca contatos que têm pelo menos uma tag pessoal do usuário
    const contactsWithPersonalTag = await ContactTag.findAll({
      where: { tagId: { [Op.in]: userPersonalTags } },
      attributes: [[literal('DISTINCT "contactId"'), 'contactId']],
      raw: true
    });
    
    let allowedContactIds = contactsWithPersonalTag.map((ct: any) => ct.contactId);
    
    // Se usuário tem tags complementares, filtra ainda mais
    if (userComplementaryTags.length > 0 && allowedContactIds.length > 0) {
      // Contatos devem ter também pelo menos uma tag complementar
      const contactsWithComplementaryTag = await ContactTag.findAll({
        where: { 
          contactId: { [Op.in]: allowedContactIds },
          tagId: { [Op.in]: userComplementaryTags }
        },
        attributes: [[literal('DISTINCT "contactId"'), 'contactId']],
        raw: true
      });
      
      allowedContactIds = contactsWithComplementaryTag.map((ct: any) => ct.contactId);
    }

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
