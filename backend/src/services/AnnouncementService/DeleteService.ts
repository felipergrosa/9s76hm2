import Announcement from "../../models/Announcement";
import AppError from "../../errors/AppError";

const DeleteService = async (id: string, companyId: number): Promise<void> => {
  const record = await Announcement.findOne({
    where: { id, companyId }
  });

  if (!record) {
    throw new AppError("ERR_NO_ANNOUNCEMENT_FOUND", 404);
  }

  await record.destroy();
};

export default DeleteService;
