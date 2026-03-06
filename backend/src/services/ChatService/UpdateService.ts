import AppError from "../../errors/AppError";
import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import User from "../../models/User";

interface ChatData {
  id: number;
  companyId: number;
  userId: number;
  title?: string;
  users?: any[];
}

export default async function UpdateService(data: ChatData) {
  const { users } = data;
  const record = await Chat.findByPk(data.id, {
    include: [{ model: ChatUser, as: "users" }]
  });

  if (!record || record.companyId !== data.companyId) {
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }

  if (record.ownerId !== data.userId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (record.type === "direct") {
    throw new AppError("ERR_DIRECT_CHAT_CANNOT_BE_EDITED", 400);
  }

  const { ownerId } = record;

  await record.update({ title: data.title });

  if (Array.isArray(users)) {
    const normalizedUserIds = Array.from(
      new Set(
        [ownerId, ...users.map(user => Number(user.id))].filter(userId => Number.isInteger(userId) && userId > 0)
      )
    );

    const participantUsers = await User.findAll({
      where: {
        id: normalizedUserIds,
        companyId: data.companyId
      },
      attributes: ["id"]
    });

    if (participantUsers.length < 2) {
      throw new AppError("ERR_CHAT_PARTICIPANTS_REQUIRED", 400);
    }

    await ChatUser.destroy({ where: { chatId: record.id } });

    for (const participant of participantUsers) {
      await ChatUser.create({ chatId: record.id, userId: participant.id, unreads: 0 });
    }
  }

  await record.reload({
    include: [
      { model: ChatUser, as: "users", include: [{ model: User, as: "user" }] },
      { model: User, as: "owner" }
    ]
  });

  return record;
}
