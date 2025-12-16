import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";
import { FindOptions, Op, literal } from "sequelize";
import Ticket from "../../models/Ticket";
import ContactTag from "../../models/ContactTag";
import User from "../../models/User";
import Tag from "../../models/Tag";
import GetUserWalletContactIds from "../../helpers/GetUserWalletContactIds";

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

  // Restrição de carteira: se usuário não for admin, limita por carteira (inclui gerenciados)
  if (userId) {
    const walletResult = await GetUserWalletContactIds(userId, Number(companyId));
    if (walletResult.hasWalletRestriction) {
      const allowedContactIds = walletResult.contactIds;
      options.where = {
        ...options.where,
        companyId,
        id: { [Op.in]: allowedContactIds.length > 0 ? allowedContactIds : [0] }
      };
    } else {
      options.where = {
        ...options.where,
        companyId
      };
    }
  } else {
    options.where = {
      ...options.where,
      companyId
    };
  }

  const contacts = await Contact.findAll(options);

  if (!contacts) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  return contacts;
};

export default SimpleListService;
