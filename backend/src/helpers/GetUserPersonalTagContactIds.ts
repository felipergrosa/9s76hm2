import { Op, literal } from "sequelize";
import User from "../models/User";
import ContactTag from "../models/ContactTag";
import Tag from "../models/Tag";

interface WalletResult {
  hasWalletRestriction: boolean;
  contactIds: number[];
  managedUserIds: number[];
  excludedUserIds?: number[];
  supervisorViewMode?: "include" | "exclude";
}

/**
 * Retorna os IDs de contatos que o usuário pode ver baseado nas tags pessoais (#).
 * Substitui GetUserWalletContactIds após migração Wallet→Tags.
 * 
 * Lógica:
 * - Admin/Super: vê tudo (hasWalletRestriction = false)
 * - Usuário comum com allowedContactTags: vê contatos que têm TODAS as tags pessoais do usuário
 * - Usuário comum sem allowedContactTags: vê apenas seus próprios tickets
 */
const GetUserPersonalTagContactIds = async (
  userId: number,
  companyId: number
): Promise<WalletResult> => {
  // Buscar usuário com suas tags permitidas
  const user = await User.findByPk(userId, {
    attributes: ["id", "profile", "super", "allowedContactTags", "managedUserIds"]
  });

  if (!user) {
    return {
      hasWalletRestriction: true,
      contactIds: [],
      managedUserIds: [],
      excludedUserIds: []
    };
  }

  // Admin e Super veem tudo
  if (user.profile === "admin" || user.super) {
    return {
      hasWalletRestriction: false,
      contactIds: [],
      managedUserIds: [],
      excludedUserIds: []
    };
  }

  const userAllowedContactTags = user.allowedContactTags || [];
  const managedUserIds = (user.managedUserIds || []).map(Number);

  // Se usuário não tem tags pessoais configuradas, não tem restrição de carteira
  // (verá apenas tickets atribuídos a ele)
  if (!userAllowedContactTags.length) {
    return {
      hasWalletRestriction: false,
      contactIds: [],
      managedUserIds,
      excludedUserIds: []
    };
  }

  // Filtrar apenas tags pessoais (começam com # mas não com ##)
  const personalTags = await Tag.findAll({
    where: {
      id: { [Op.in]: userAllowedContactTags },
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

  // Se não há tags pessoais válidas, sem restrição
  if (!personalTagIds.length) {
    return {
      hasWalletRestriction: false,
      contactIds: [],
      managedUserIds,
      excludedUserIds: []
    };
  }

  // Buscar contatos que têm PELO MENOS UMA das tags pessoais do usuário
  const contactsWithAnyTag = await ContactTag.findAll({
    where: {
      tagId: { [Op.in]: personalTagIds },
      companyId
    },
    attributes: [[literal('DISTINCT "contactId"'), 'contactId']],
    raw: true
  });

  const contactIds = contactsWithAnyTag.map((ct: any) => Number(ct.contactId)).filter(Number.isInteger);

  return {
    hasWalletRestriction: true,
    contactIds,
    managedUserIds,
    excludedUserIds: [],
    supervisorViewMode: "include"
  };
};

export default GetUserPersonalTagContactIds;
