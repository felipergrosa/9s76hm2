import DripSequence from "../../models/DripSequence";
import DripSequenceStep from "../../models/DripSequenceStep";
import Tag from "../../models/Tag";
import Whatsapp from "../../models/Whatsapp";
import Queue from "../../models/Queue";
import User from "../../models/User";
import AppError from "../../errors/AppError";

const ShowService = async (id: string | number): Promise<DripSequence> => {
  const record = await DripSequence.findByPk(id, {
    include: [
      { model: Tag, as: "tag", attributes: ["id", "name", "color", "kanban"] },
      { model: Whatsapp, attributes: ["id", "name", "channelType"] },
      { model: Tag, as: "endActionTag", attributes: ["id", "name", "color", "kanban"] },
      { model: Queue, as: "endActionQueue", attributes: ["id", "name", "color"] },
      { model: User, as: "endActionUser", attributes: ["id", "name"] },
      { model: DripSequenceStep, separate: true, order: [["order", "ASC"]] }
    ]
  });

  if (!record) {
    throw new AppError("Follow-up não encontrado", 404);
  }

  return record;
};

export default ShowService;
