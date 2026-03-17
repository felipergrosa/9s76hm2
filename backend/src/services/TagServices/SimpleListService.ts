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
  console.log("[SimpleListService] Params:", { companyId, searchParam, kanban, profile, userId });
  
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
    console.log("[SimpleListService] Filtro aplicado (não-admin):", whereCondition);
  } else {
    console.log("[SimpleListService] Admin detectado, sem filtro de userId");
  }

  console.log("[SimpleListService] whereCondition final:", { ...whereCondition, companyId, kanban });

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
        "contacts.ContactTag.createdAt",
        "contacts.ContactTag.updatedAt",
        "contacts.id"
      ]
    });

    console.log("[SimpleListService] Tags encontradas:", tags?.length);
    console.log("[SimpleListService] Tags (nomes):", tags?.map(t => t.name));
    
    return tags;
  } catch (err) {
    console.error("[SimpleListService] Erro ao buscar tags:", err);
    throw err;
  }
};

export default ListService;
