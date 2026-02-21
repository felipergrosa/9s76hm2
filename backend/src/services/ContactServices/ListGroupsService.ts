import { Op, Filterable, literal } from "sequelize";
import Contact from "../../models/Contact";
import ContactTag from "../../models/ContactTag";
import Tag from "../../models/Tag";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  companyId: number;
  userId: number;
  userProfile: string;
  allowedConnectionIds?: number[];
  whatsappId?: number;
  isPrivate?: boolean;
  limit?: string;
}

interface Response {
  groups: Contact[];
  count: number;
  hasMore: boolean;
}

/**
 * Serviço especializado para listar grupos WhatsApp
 * com controle de permissões por conexão
 */
const ListGroupsService = async ({
  searchParam = "",
  pageNumber = "1",
  companyId,
  userId,
  userProfile,
  allowedConnectionIds = [],
  whatsappId,
  isPrivate = false,
  limit = "20"
}: Request): Promise<Response> => {
  let whereCondition: Filterable["where"] = {
    companyId,
    isGroup: true // Sempre filtrar apenas grupos
  };

  // REGRA DE PERMISSÃO: Quais conexões o usuário pode ver grupos?
  let visibleWhatsappIds: number[] = [];

  if (userProfile === "superadmin" || userProfile === "admin") {
    // Admin/Superadmin: Se isPrivate=true, só vê suas conexões permitidas
    // Se isPrivate=false, vê todas as conexões
    if (isPrivate && allowedConnectionIds.length > 0) {
      visibleWhatsappIds = allowedConnectionIds;
    }
    // Se isPrivate=false e não há allowedConnectionIds, não aplica filtro (vê tudo)
  } else {
    // Usuário comum: Só vê grupos de sua conexão primária + conexões permitidas
    const userConnections: number[] = [];

    if (whatsappId) {
      userConnections.push(whatsappId);
    }

    if (allowedConnectionIds.length > 0) {
      userConnections.push(...allowedConnectionIds);
    }

    visibleWhatsappIds = [...new Set(userConnections)]; // Remove duplicados
  }

  // Aplicar filtro de conexões visíveis (se houver)
  // Sempre incluir grupos com whatsappId NULL (ainda não associados a conexão)
  if (visibleWhatsappIds.length > 0) {
    whereCondition = {
      ...whereCondition,
      whatsappId: { [Op.or]: [{ [Op.in]: visibleWhatsappIds }, null] }
    };
  }

  // Filtro de busca por nome ou número
  if (searchParam) {
    whereCondition = {
      ...whereCondition,
      [Op.or]: [
        { name: { [Op.iLike]: `%${searchParam}%` } },
        { number: { [Op.iLike]: `%${searchParam}%` } }
      ]
    };
  }

  const pageLimit = Number(limit) || 20;
  const offset = pageLimit * (+pageNumber - 1);

  // Buscar grupos
  const { count, rows: groups } = await Contact.findAndCountAll({
    where: whereCondition,
    attributes: [
      "id",
      "name",
      "number",
      "urlPicture",
      "whatsappId",
      "createdAt",
      "updatedAt",
      "companyId",
      [
        literal(`(
          SELECT COALESCE(SUM(t."unreadMessages"), 0)
          FROM "Tickets" t
          WHERE t."contactId" = "Contact"."id"
          AND t."status" != 'closed'
        )`),
        "unreadCount"
      ],
      [
        literal(`(
          SELECT COALESCE(MAX(t."updatedAt"), "Contact"."createdAt")
          FROM "Tickets" t
          WHERE t."contactId" = "Contact"."id"
        )`),
        "lastMessageDate"
      ]
    ],
    include: [
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name", "status", "number"],
        required: false
      },
      {
        model: ContactTag,
        as: "contactTags",
        attributes: ["tagId"],
        include: [
          {
            model: Tag,
            as: "tags",
            attributes: ["id", "name", "color"]
          }
        ],
        required: false
      }
    ],
    limit: pageLimit,
    offset,
    order: [[literal('"lastMessageDate"'), "DESC"]]
  });

  const hasMore = count > offset + groups.length;

  return {
    groups,
    count,
    hasMore
  };
};

export default ListGroupsService;
