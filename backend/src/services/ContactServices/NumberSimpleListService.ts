import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";
import { FindOptions, Op } from "sequelize";
import GetUserWalletContactIds from "../../helpers/GetUserWalletContactIds";

export interface SearchContactParams {
  companyId: string | number;
  number: string;
  userId?: number;
}

const NumberSimpleListService = async ({ number, companyId, userId }: SearchContactParams): Promise<Contact[]> => {
  let options: FindOptions = {
    order: [
      ['name', 'ASC']
    ]
  }

  if (number) {
    options.where = {
      [Op.or]: [
        { number: { [Op.like]: `%${number}%` } },
        { cpfCnpj: { [Op.like]: `%${number}%` } }
      ]
    };
  }

  options.where = {
    ...options.where,
    companyId
  }

  // Restrição de carteira: limita por carteira (inclui gerenciados)
  if (userId) {
    const walletResult = await GetUserWalletContactIds(userId, Number(companyId));
    if (walletResult.hasWalletRestriction) {
      const allowedContactIds = walletResult.contactIds;
      options.where = {
        ...(options.where as any),
        id: { [Op.in]: allowedContactIds.length > 0 ? allowedContactIds : [0] }
      };
    }
  }

  const contacts = await Contact.findAll(options);

  if (!contacts) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  return contacts;
};

export default NumberSimpleListService;
