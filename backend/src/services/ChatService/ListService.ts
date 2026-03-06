import { Op } from "sequelize";
import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import User from "../../models/User";

interface Request {
  companyId: number;
  ownerId: number;
  pageNumber?: string;
}

interface Response {
  records: Chat[];
  count: number;
  hasMore: boolean;
}

const ListService = async ({
  companyId,
  ownerId,
  pageNumber = "1"
}: Request): Promise<Response> => {
  const chatUsers = await ChatUser.findAll({
    where: { userId: ownerId }
  });

  const chatIds = chatUsers.map(chat => chat.chatId);

  if (chatIds.length === 0) {
    return {
      records: [],
      count: 0,
      hasMore: false
    };
  }

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: records } = await Chat.findAndCountAll({
    where: {
      companyId,
      id: {
        [Op.in]: chatIds
      }
    },
    include: [
      { model: User, as: "owner" },
      { model: ChatUser, as: "users", include: [{ model: User, as: "user" }] }
    ],
    limit,
    offset,
    order: [["updatedAt", "DESC"]]
  });

  const hasMore = count > offset + records.length;

  return {
    records,
    count,
    hasMore
  };
};

export default ListService;
