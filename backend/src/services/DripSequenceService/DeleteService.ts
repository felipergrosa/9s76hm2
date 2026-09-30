import DripSequence from "../../models/DripSequence";
import AppError from "../../errors/AppError";

const DeleteService = async (
  id: string | number,
  companyId: number
): Promise<void> => {
  // N2 (IDOR): só localiza/exclui follow-up do próprio tenant
  const record = await DripSequence.findOne({ where: { id, companyId } });

  if (!record) {
    throw new AppError("Sequência de drip não encontrada", 404);
  }

  // ON DELETE CASCADE remove steps e enrollments associados (ver migration).
  await record.destroy();
};

export default DeleteService;
