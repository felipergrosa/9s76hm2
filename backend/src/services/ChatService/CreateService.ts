import AppError from "../../errors/AppError";
import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import User from "../../models/User";

interface Data {
  ownerId: number;
  companyId: number;
  users: any[];
  title: string;
}

const CreateService = async (data: Data): Promise<Chat> => {
  const { ownerId, companyId, users, title } = data;

  const normalizedUserIds = Array.from(
    new Set(
      [ownerId, ...(Array.isArray(users) ? users.map(user => Number(user.id)) : [])].filter(
        userId => Number.isInteger(userId) && userId > 0
      )
    )
  );

  const participantUsers = await User.findAll({
    where: {
      id: normalizedUserIds,
      companyId
    },
    attributes: ["id", "name"]
  });

  const participantIds = participantUsers.map(user => user.id);

  if (participantIds.length < 2) {
    throw new AppError("ERR_CHAT_PARTICIPANTS_REQUIRED", 400);
  }

  if (!participantIds.includes(ownerId)) {
    throw new AppError("ERR_CHAT_OWNER_NOT_FOUND", 404);
  }

  const isDirect = participantIds.length === 2;
  const directParticipantIds = [...participantIds].sort((a, b) => a - b);
  const directKey = isDirect ? directParticipantIds.join(":") : null;

  if (!isDirect && (!title || !String(title).trim())) {
    throw new AppError("ERR_CHAT_TITLE_REQUIRED", 400);
  }

  if (directKey) {
    const existingDirectChat = await Chat.findOne({
      where: {
        companyId,
        type: "direct",
        directKey
      },
      include: [
        { model: ChatUser, as: "users", include: [{ model: User, as: "user" }] },
        { model: User, as: "owner" }
      ]
    });

    if (existingDirectChat) {
      (existingDirectChat as any).wasExisting = true;
      return existingDirectChat;
    }
  }

  const record = await Chat.create({
    ownerId,
    companyId,
    title: isDirect ? "" : title,
    type: isDirect ? "direct" : "group",
    directKey: directKey || null
  });

  for (const participantId of participantIds) {
    await ChatUser.create({ chatId: record.id, userId: participantId, unreads: 0 });
  }

  await record.reload({
    include: [
      { model: ChatUser, as: "users", include: [{ model: User, as: "user" }] },
      { model: User, as: "owner" }
    ]
  });

  return record;
};

export default CreateService;
