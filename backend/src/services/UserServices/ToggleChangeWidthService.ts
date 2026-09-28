import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import User from "../../models/User";
import { serviceCache } from "../../utils/serviceCache";

interface Request {
  userId: string;
  defaultTicketsManagerWidth: number | string;
}

const ToggleChangeWidthService = async ({
  userId,
  defaultTicketsManagerWidth
}: Request): Promise<User> => {
  const user = await User.findOne({
    where: { id: userId },
    attributes: ["id", "defaultTicketsManagerWidth"]
  });

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }


  await user.update({
    defaultTicketsManagerWidth: Number(defaultTicketsManagerWidth)
  });

  // Invalida o cache do usuário usado pelo middleware checkPermission (chave user:{id})
  serviceCache.invalidate(`user:${userId}`);

  await user.reload({
    include: ["queues", "whatsapp", "company"]
  });

  return user;
};

export default ToggleChangeWidthService;
