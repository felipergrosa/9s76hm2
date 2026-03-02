import { Op, literal } from "sequelize";
import Tag from "../models/Tag";
import ContactTag from "../models/ContactTag";
import User from "../models/User";

interface GetUserWalletResult {
  contactIds: number[];
  hasWalletRestriction: boolean;
  managedUserIds: number[];
  excludedUserIds: number[];
  supervisorViewMode: "include" | "exclude";
}

// Cache em memória com TTL de 5 minutos (performance)
const walletCache = new Map<string, { data: GetUserWalletResult; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

// Função para invalidar cache (chamar quando usuário atualizar allowedContactTags)
export const invalidateWalletCache = (userId: number, companyId: number) => {
  const key = `${userId}:${companyId}`;
  walletCache.delete(key);
};

/**
 * Retorna os IDs de contatos que estão na "carteira" do usuário.
 * Carteira = contatos que têm pelo menos uma tag pessoal (#) do usuário.
 * 
 * Lógica de supervisão com supervisorViewMode:
 * - Admin sem managedUserIds: vê TUDO (sem restrição)
 * - supervisorViewMode = "include": vê sua carteira + carteiras dos usuários selecionados
 * - supervisorViewMode = "exclude": vê TUDO exceto carteiras dos usuários selecionados
 * 
 * @param userId - ID do usuário
 * @param companyId - ID da empresa
 * @returns Lista de contactIds permitidos, flag de restrição, IDs de usuários gerenciados/excluídos e modo
 */
const GetUserWalletContactIds = async (
  userId: number,
  companyId: number
): Promise<GetUserWalletResult> => {
  // Verifica cache primeiro
  const cacheKey = `${userId}:${companyId}`;
  const cached = walletCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    return cached.data;
  }

  try {
    const user = await User.findByPk(userId, {
      attributes: ["id", "profile", "allowedContactTags", "managedUserIds", "supervisorViewMode"]
    });

    if (!user) {
      return { contactIds: [], hasWalletRestriction: true, managedUserIds: [], excludedUserIds: [], supervisorViewMode: "include" };
    }

    const managedUserIds = Array.isArray((user as any).managedUserIds)
      ? (user as any).managedUserIds as number[]
      : [];

    const supervisorViewMode = ((user as any).supervisorViewMode || "include") as "include" | "exclude";

    // Admin sem usuários gerenciados = sem restrição (vê tudo)
    if (user.profile === "admin" && managedUserIds.length === 0) {
      const result = { contactIds: [], hasWalletRestriction: false, managedUserIds: [], excludedUserIds: [], supervisorViewMode };
      walletCache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL_MS });
      return result;
    }

    // Modo EXCLUDE: admin vê tudo EXCETO os usuários selecionados
    if (user.profile === "admin" && supervisorViewMode === "exclude" && managedUserIds.length > 0) {
      const result = { 
        contactIds: [], 
        hasWalletRestriction: false, 
        managedUserIds: [], 
        excludedUserIds: managedUserIds,
        supervisorViewMode 
      };
      walletCache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL_MS });
      return result;
    }

    // Coleta todas as tags pessoais: do próprio usuário + dos usuários gerenciados
    let allPersonalTagIds: number[] = [];

    // Tags do próprio usuário
    const userTags = Array.isArray((user as any).allowedContactTags)
      ? (user as any).allowedContactTags as number[]
      : [];

    if (userTags.length > 0) {
      const ownPersonalTags = await Tag.findAll({
        where: {
          id: { [Op.in]: userTags },
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
      allPersonalTagIds = ownPersonalTags.map(t => t.id);
    }

    // Tags dos usuários gerenciados
    if (managedUserIds.length > 0) {
      const managedUsers = await User.findAll({
        where: { id: { [Op.in]: managedUserIds } },
        attributes: ["id", "allowedContactTags"]
      });

      const managedUserTagIds: number[] = [];
      for (const managedUser of managedUsers) {
        const mTags = Array.isArray((managedUser as any).allowedContactTags)
          ? (managedUser as any).allowedContactTags as number[]
          : [];
        managedUserTagIds.push(...mTags);
      }

      if (managedUserTagIds.length > 0) {
        const managedPersonalTags = await Tag.findAll({
          where: {
            id: { [Op.in]: managedUserTagIds },
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
        allPersonalTagIds.push(...managedPersonalTags.map(t => t.id));
      }
    }

    // Remove duplicatas
    allPersonalTagIds = [...new Set(allPersonalTagIds)];

    if (allPersonalTagIds.length === 0) {
      // Sem tags pessoais = sem carteira
      const result = { contactIds: [], hasWalletRestriction: true, managedUserIds, excludedUserIds: [], supervisorViewMode };
      walletCache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL_MS });
      return result;
    }

    // Busca contatos que têm pelo menos uma tag pessoal permitida
    const contactsWithTag = await ContactTag.findAll({
      where: { tagId: { [Op.in]: allPersonalTagIds } },
      attributes: [[literal('DISTINCT "contactId"'), 'contactId']],
      raw: true
    });

    const contactIds = contactsWithTag.map((ct: any) => ct.contactId);

    const result = { contactIds, hasWalletRestriction: true, managedUserIds, excludedUserIds: [], supervisorViewMode };
    walletCache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (error) {
    console.error("[GetUserWalletContactIds] Erro:", error);
    return { contactIds: [], hasWalletRestriction: true, managedUserIds: [], excludedUserIds: [], supervisorViewMode: "include" };
  }
};

export default GetUserWalletContactIds;
