import AppError from "../../errors/AppError";
import TicketNote from "../../models/TicketNote";

interface TicketNoteData {
  note: string;
  id?: number | string;
}

const UpdateTicketNoteService = async (
  ticketNoteData: TicketNoteData,
  companyId: number
): Promise<TicketNote> => {
  const { id, note } = ticketNoteData;

  // Validação de tenant ANTES da atualização
  const ticketNote = await TicketNote.findOne({
    where: { id, companyId }
  });

  if (!ticketNote) {
    throw new AppError("ERR_NO_TICKETNOTE_FOUND", 404);
  }

  await ticketNote.update({
    note
  });

  return ticketNote;
};

export default UpdateTicketNoteService;
