import { Sequelize, Op } from "sequelize";
import Queue from "../../models/Queue";
import Company from "../../models/Company";
import User from "../../models/User";
import Plan from "../../models/Plan";
import Ticket from "../../models/Ticket";
import Tag from "../../models/Tag";

interface Request {
  searchParam?: string;
  pageNumber?: string | number;
  profile?: string;
  companyId?: number;
  requestUserId?: number | string;
}

interface Response {
  users: User[];
  count: number;
  hasMore: boolean;
}

const ListUsersService = async ({
  searchParam = "",
  pageNumber = "1",
  companyId,
  profile,
  requestUserId
}: Request): Promise<Response> => {
  let whereCondition: any = {
    [Op.or]: [
      {
        "$User.name$": Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("User.name")),
          "LIKE",
          `%${searchParam.toLowerCase()}%`
        )
      },
      { email: { [Op.like]: `%${searchParam.toLowerCase()}%` } }
    ],
    companyId: {
      [Op.eq]: companyId
    }
  };

  // Ghost Mode NÃO filtra lista de usuários
  // Usuários Ghost devem aparecer em seletores/dropdowns
  // O Ghost Mode oculta apenas os TICKETS em ListTicketsService/ListTicketsServiceKanban

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: users } = await User.findAndCountAll({
    where: whereCondition,
    attributes: [
      "name",
      "id",
      "email",
      "companyId",
      "profile",
      "online",
      "startWork",
      "endWork",
      "profileImage",
      "permissions",
      "allowedContactTags",
      "managedUserIds",
      "supervisorViewMode"
    ],
    limit,
    offset,
    order: [["name", "ASC"]],
    include: [
      { model: Queue, as: "queues", attributes: ["id", "name", "color"] },
      {
        model: Company,
        as: "company",
        attributes: ["id", "name", "dueDate", "document"],
        // include: [
        //   {
        //     model: Plan, as: "plan",
        //     attributes: ["id",
        //       "name",
        //       "amount",
        //       "useWhatsapp",
        //       "useFacebook",
        //       "useInstagram",
        //       "useCampaigns",
        //       "useSchedules",
        //       "useInternalChat",
        //       "useExternalApi",
        //       "useIntegrations",
        //       "useOpenAi",
        //       "useKanban"
        //     ]
        //   },
        // ]
      }
    ]
  });

  const hasMore = count > offset + users.length;

  // Buscar tags completas para cada usuário baseado em allowedContactTags
  const usersWithTags = await Promise.all(
    users.map(async (user) => {
      const userData = user.toJSON() as any;
      if (userData.allowedContactTags && userData.allowedContactTags.length > 0) {
        const tags = await Tag.findAll({
          where: {
            id: { [Op.in]: userData.allowedContactTags },
            companyId
          },
          attributes: ["id", "name", "color"]
        });
        userData.tags = tags;
      } else {
        userData.tags = [];
      }
      return userData;
    })
  );

  return {
    users: usersWithTags as any,
    count,
    hasMore
  };
};

export default ListUsersService;
