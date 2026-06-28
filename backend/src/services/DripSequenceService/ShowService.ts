import DripSequence from "../../models/DripSequence";
import DripSequenceStep from "../../models/DripSequenceStep";
import Tag from "../../models/Tag";
import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";

const ShowService = async (id: string | number): Promise<DripSequence> => {
  const record = await DripSequence.findByPk(id, {
    include: [
      { model: Tag, attributes: ["id", "name", "color"] },
      { model: Whatsapp, attributes: ["id", "name"] },
      { model: DripSequenceStep, separate: true, order: [["order", "ASC"]] }
    ]
  });

  if (!record) {
    throw new AppError("Sequência de drip não encontrada", 404);
  }

  return record;
};

export default ShowService;
