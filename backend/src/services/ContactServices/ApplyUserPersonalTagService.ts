import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";
import User from "../../models/User";
import { Op } from "sequelize";

interface Request {
  contactId: number;
  userId: number;
  companyId: number;
}

/**
 * Aplica a tag pessoal do usuário ao contato.
 * Tag pessoal = tag que começa com # mas NÃO com ##
 * Usada para vincular o contato à "carteira" do usuário.
 */
const ApplyUserPersonalTagService = async ({
  contactId,
  userId,
  companyId
}: Request): Promise<void> => {
  try {
    // Busca o usuário e suas tags permitidas
    const user = await User.findByPk(userId, {
      attributes: ["id", "name", "allowedContactTags"]
    });

    if (!user) {
      console.log(`[ApplyUserPersonalTag] Usuário ${userId} não encontrado`);
      return;
    }

    const userTags = Array.isArray((user as any).allowedContactTags)
      ? (user as any).allowedContactTags as number[]
      : [];

    if (userTags.length === 0) {
      console.log(`[ApplyUserPersonalTag] Usuário ${userId} não tem tags configuradas`);
      return;
    }

    // Busca as tags pessoais do usuário (começam com # mas não com ##)
    const personalTags = await Tag.findAll({
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
      attributes: ["id", "name"]
    });

    if (personalTags.length === 0) {
      console.log(`[ApplyUserPersonalTag] Usuário ${userId} não tem tags pessoais (#)`);
      return;
    }

    // Aplica cada tag pessoal ao contato (se ainda não tiver)
    for (const tag of personalTags) {
      const existingContactTag = await ContactTag.findOne({
        where: {
          contactId,
          tagId: tag.id
        }
      });

      if (!existingContactTag) {
        await ContactTag.create({
          contactId,
          tagId: tag.id
        });
        console.log(`[ApplyUserPersonalTag] Tag "${tag.name}" aplicada ao contato ${contactId}`);
      }
    }

    console.log(`[ApplyUserPersonalTag] Tags pessoais do usuário ${user.name} aplicadas ao contato ${contactId}`);
  } catch (error) {
    console.error("[ApplyUserPersonalTag] Erro ao aplicar tag pessoal:", error);
  }
};

export default ApplyUserPersonalTagService;
