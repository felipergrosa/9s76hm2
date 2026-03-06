import Chat from "../../models/Chat";
import AppError from "../../errors/AppError";
import ChatUser from "../../models/ChatUser";
import User from "../../models/User";

interface Request {
  uuid: string;
  userId: number;
  companyId: number;
}

const ShowFromUuidService = async ({ uuid, userId, companyId }: Request): Promise<Chat> => {
  const record = await Chat.findOne({
    where: { uuid, companyId },
    include: [
      { model: ChatUser, as: "users", include: [{ model: User, as: "user" }] },
      { model: User, as: "owner" }
    ]
  });

  if (!record) {
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }

  const isParticipant = Array.isArray(record.users) && record.users.some(user => user.userId === userId);

  if (!isParticipant) {
    throw new AppError("UNAUTHORIZED", 403);
  }

  return record;
};

export default ShowFromUuidService;
