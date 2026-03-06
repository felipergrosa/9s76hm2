import Chat from "../../models/Chat";
import AppError from "../../errors/AppError";

interface Request {
  id: string;
  companyId: number;
  userId: number;
}

const DeleteService = async ({ id, companyId, userId }: Request): Promise<void> => {
  const record = await Chat.findOne({
    where: { id, companyId }
  });

  if (!record) {
    throw new AppError("ERR_NO_CHAT_FOUND", 404);
  }

  if (record.ownerId !== userId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await record.destroy();
};

export default DeleteService;
