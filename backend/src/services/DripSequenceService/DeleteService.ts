import DripSequence from "../../models/DripSequence";
import AppError from "../../errors/AppError";

const DeleteService = async (id: string | number): Promise<void> => {
  const record = await DripSequence.findByPk(id);

  if (!record) {
    throw new AppError("Sequência de drip não encontrada", 404);
  }

  // ON DELETE CASCADE remove steps e enrollments associados (ver migration).
  await record.destroy();
};

export default DeleteService;
