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

  // Regra de acesso por tags (AND) considerando SOMENTE tags de permissão (nome iniciando com '#'):
  // - Admin: vê tudo
  // - Usuário normal:
  //   (a) Sempre pode ver contatos SEM TAG DE PERMISSÃO (sem nenhuma tag '#')
  //   (b) Pode ver contatos de tickets dele
  //   (c) Pode ver contatos cujas tags de permissão (se existirem) sejam TODAS contidas em allowedContactTags
  if (profile !== "admin" && userId) {
    const user = await User.findByPk(userId);

    // (a) Contatos sem TAG DE PERMISSÃO (sem nenhuma tag cujo name LIKE '#%')
    const contactsWithPermRows = await ContactTag.findAll({
      include: [{ model: Tag, attributes: [], where: { name: { [Op.like]: "#%" } } }],
      attributes: ["contactId"],
      group: ["contactId"]
    });
    const contactsWithPermIds = contactsWithPermRows.map(r => r.contactId);
    const noPermRows = await Contact.findAll({
      where: { companyId, id: { [Op.notIn]: contactsWithPermIds.length ? contactsWithPermIds : [-1] } },
      attributes: ["id"]
    });
    const noTagIds = noPermRows.map(c => c.id);

    // (b) Contatos de tickets do usuário
    const userTickets = await Ticket.findAll({
      where: { userId, companyId },
      attributes: ["contactId"],
      group: ["contactId"]
    });
    const fromTickets = userTickets.map(t => t.contactId);

    let allowedIds = Array.from(new Set([...noTagIds, ...fromTickets]));

    // (c) AND: contatos cujas TAGS DE PERMISSÃO estão TODAS contidas em allowedContactTags
    if (user && Array.isArray(user.allowedContactTags) && user.allowedContactTags.length > 0) {
      // contatos com alguma TAG DE PERMISSÃO fora do conjunto permitido
      const disallowed = await ContactTag.findAll({
        where: { tagId: { [Op.notIn]: user.allowedContactTags } },
        include: [{ model: Tag, attributes: [], where: { name: { [Op.like]: "#%" } } }],
        attributes: ["contactId"],
        group: ["contactId"]
      });
      const disallowedIds = disallowed.map(r => r.contactId);
      const allowedWithTags = await ContactTag.findAll({
        where: { contactId: { [Op.notIn]: disallowedIds } },
        include: [{ model: Tag, attributes: [], where: { name: { [Op.like]: "#%" } } }],
        attributes: ["contactId"],
        group: ["contactId"]
      });
      const fromAndTags = allowedWithTags.map(r => r.contactId);
      allowedIds = Array.from(new Set([...allowedIds, ...fromAndTags]));
    }

    // Se não houver nenhum contato permitido, retorna lista vazia
    if (allowedIds.length === 0) {
      return [];
    }

    options.where = {
      ...options.where,
      companyId,
      id: { [Op.in]: allowedIds }
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
