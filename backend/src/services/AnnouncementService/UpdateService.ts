import AppError from "../../errors/AppError";
import Announcement from "../../models/Announcement";

interface Data {
  id: number | string;
  priority: string;
  title: string;
  text: string;
  status: string;
  companyId: number;
}

const UpdateService = async (data: Data): Promise<Announcement> => {
  const { id, companyId } = data;

  const record = await Announcement.findOne({
    where: { id, companyId }
  });

  if (!record) {
    throw new AppError("ERR_NO_ANNOUNCEMENT_FOUND", 404);
  }

  // companyId nunca é atualizado a partir do payload
  const { companyId: _ignored, ...safeData } = data;
  await record.update(safeData);

  return record;
};

export default UpdateService;
