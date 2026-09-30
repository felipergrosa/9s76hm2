import TicketNote from "../../models/TicketNote";

const FindAllTicketNotesService = async (companyId: number): Promise<TicketNote[]> => {
  const ticketNote = await TicketNote.findAll({
    where: { companyId }
  });
  return ticketNote;
};

export default FindAllTicketNotesService;
