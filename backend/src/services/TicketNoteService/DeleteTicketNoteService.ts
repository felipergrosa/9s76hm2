import TicketNote from "../../models/TicketNote";
import AppError from "../../errors/AppError";

const DeleteTicketNoteService = async (id: string, companyId: number): Promise<void> => {
  // Validação de tenant ANTES da exclusão
  const ticketnote = await TicketNote.findOne({
    where: { id, companyId }
  });

  if (!ticketnote) {
    throw new AppError("ERR_NO_TICKETNOTE_FOUND", 404);
  }

  await ticketnote.destroy();
};

export default DeleteTicketNoteService;
