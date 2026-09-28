import User from "../../models/User";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import UpdateDeletedUserOpenTicketsStatus from "../../helpers/UpdateDeletedUserOpenTicketsStatus";
import fs from "fs";
import path from "path";
import { buildCompanyBase } from "../../utils/publicPath";
import { serviceCache } from "../../utils/serviceCache";

const DeleteUserService = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  const user = await User.findOne({
    where: { id }
  });

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const userOpenTickets: Ticket[] = await user.$get("tickets", {
    where: { status: "open" }
  });

  if (userOpenTickets.length > 0) {
    UpdateDeletedUserOpenTicketsStatus(userOpenTickets, companyId);
  }

  // Remove pasta do avatar do usuário se existir
  try {
    if (user.profileImage) {
      const publicRoot = path.resolve(__dirname, "..", "..", "..", "public");
      const userDirRelative = path.posix.dirname(user.profileImage); // ex: users/username
      const absUserDir = path.resolve(publicRoot, buildCompanyBase(companyId), userDirRelative);
      if (fs.existsSync(absUserDir)) {
        fs.rmSync(absUserDir, { recursive: true, force: true });
      }
    }
  } catch (e) {
    // silencioso
  }

  await user.destroy();

  // Invalida o cache do usuário usado pelo middleware checkPermission (chave user:{id})
  serviceCache.invalidate(`user:${id}`);
};

export default DeleteUserService;
