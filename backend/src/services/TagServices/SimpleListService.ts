import { Op, Sequelize } from "sequelize";
import Tag from "../../models/Tag";
import Contact from "../../models/Contact";

interface Request {
  companyId: number;
  searchParam?: string;
  kanban?: number;
  profile?: string;
  userId?: number | string;
}

const ListService = async ({
  companyId,
  searchParam,
  kanban = 0,
  profile = "user",
  userId
}: Request): Promise<Tag[]> => {
  let whereCondition: any = {};

  if (searchParam) {
    whereCondition = {
      [Op.or]: [
        { name: { [Op.like]: `%${searchParam}%` } },
        { color: { [Op.like]: `%${searchParam}%` } }
      ]
    };
  }

  // Admins/Super veem todas as tags (necessário para atribuir tags pessoais no UserModal)
  // Usuários comuns veem apenas tags globais (sem userId) ou suas próprias tags
  if (profile !== "admin") {
    whereCondition = {
      ...whereCondition,
      [Op.or]: [
        { userId: null },
        { userId: userId }
      ]
    };
  }

  try {
    const tags = await Tag.findAll({
      where: { ...whereCondition, companyId, kanban },
      order: [["name", "ASC"]],
      include: [
        {
          model: Contact,
          as: "contacts"
        }
      ],
      attributes: {
        exclude: ["createdAt", "updatedAt"],
        include: [
          [Sequelize.fn("COUNT", Sequelize.col("contacts.id")), "contactsCount"]
        ]
      },
      group: [
        "Tag.id",
        "contacts.ContactTag.tagId",
        "contacts.ContactTag.contactId",
        "contacts.ContactTag.companyId",
        "contacts.ContactTag.createdAt",
        "contacts.ContactTag.updatedAt",
        "contacts.id"
      ]
    });

    return tags;
  } catch (err) {
    console.error("[SimpleListService] Erro ao buscar tags:", err);
    throw err;
  }
};

export default ListService;
