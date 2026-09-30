import { Request, Response } from "express";
import AppError from "../errors/AppError";
import TicketTag from '../models/TicketTag';
import Tag from '../models/Tag'
import { getIO } from "../libs/socket";
import Ticket from "../models/Ticket";
import ShowTicketService from "../services/TicketServices/ShowTicketService";

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId, tagId } = req.params;
  const { companyId } = req.user;

  try {
    // Validação de tenant ANTES de criar: ticket e tag devem pertencer à empresa
    const ticket = await ShowTicketService(ticketId, companyId);

    const tag = await Tag.findOne({ where: { id: tagId, companyId } });
    if (!tag) {
      throw new AppError("ERR_NO_TAG_FOUND", 404);
    }

    const ticketTag = await TicketTag.create({ ticketId, tagId, companyId });

    const io = getIO();
    io.of(`/workspace-${companyId}`)
      // .to(ticket.status)
      .emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });

    return res.status(201).json(ticketTag);
  } catch (error: any) {
    console.error(`[TicketTag] Erro ao criar ticketTag:`, error?.message || error);
    return res.status(500).json({ error: 'Failed to store ticket tag.', details: error?.message });
  }
};

/*
export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;

  console.log("remove");
  console.log(req.params);

  try {
    await TicketTag.destroy({ where: { ticketId } });
    return res.status(200).json({ message: 'Ticket tags removed successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to remove ticket tags.' });
  }
};
*/
export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;

  console.log(`[TicketTag] Removendo ticketTag: ticketId=${ticketId}, companyId=${companyId}`);

  try {
    // Validação de tenant ANTES de remover: ticket deve pertencer à empresa
    await ShowTicketService(ticketId, companyId);

    // Retrieve tagIds associated with the provided ticketId from TicketTags
    const ticketTags = await TicketTag.findAll({ where: { ticketId, companyId } });
    const tagIds = ticketTags.map((ticketTag) => ticketTag.tagId);

    // Find the tagIds with kanban = 1 in the Tags table
    const tagsWithKanbanOne = await Tag.findAll({
      where: {
        id: tagIds,
        kanban: 1,
        companyId,
      },
    });

    // Remove the tagIds with kanban = 1 from TicketTags
    const tagIdsWithKanbanOne = tagsWithKanbanOne.map((tag) => tag.id);
    if (tagIdsWithKanbanOne && tagIdsWithKanbanOne.length > 0)
      await TicketTag.destroy({ where: { ticketId, tagId: tagIdsWithKanbanOne, companyId } });


    const ticket = await ShowTicketService(ticketId, companyId);

    const io = getIO();
    io.of(`/workspace-${companyId}`)
      // .to(ticket.status)
      .emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });
    return res.status(200).json({ message: 'Ticket tags removed successfully.' });
  } catch (error: any) {
    console.error(`[TicketTag] Erro ao remover ticketTag:`, error?.message || error);
    return res.status(500).json({ error: 'Failed to remove ticket tags.', details: error?.message });
  }
};