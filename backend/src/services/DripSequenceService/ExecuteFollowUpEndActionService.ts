import { Op } from "sequelize";
import DripSequence from "../../models/DripSequence";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import TicketTag from "../../models/TicketTag";
import Tag from "../../models/Tag";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";

/**
 * Executa a ação configurada para quando o contato conclui todas as etapas
 * do follow-up: mover de lane/tag, mudar status do ticket ou mover carteira
 * (fila/atendente). Opera sobre o ticket aberto/mais recente do contato na
 * mesma conexão da sequência — se não houver ticket, só aplica move_tag via
 * ContactTag não é suportado (lanes vivem em tickets), então registra e sai.
 */
const ExecuteFollowUpEndActionService = async (
  sequence: DripSequence,
  contact: Contact
): Promise<void> => {
  const action = sequence.endAction || "none";
  if (action === "none") return;

  const ticket = await Ticket.findOne({
    where: {
      contactId: contact.id,
      companyId: sequence.companyId,
      ...(sequence.whatsappId ? { whatsappId: sequence.whatsappId } : {})
    },
    order: [["updatedAt", "DESC"]]
  });

  if (!ticket) {
    logger.warn(
      `[FollowUp] End action "${action}" ignorada: contato ${contact.id} sem ticket na empresa ${sequence.companyId}`
    );
    return;
  }

  try {
    switch (action) {
      case "move_tag": {
        if (!sequence.endActionTagId) return;
        // Remove a lane atual (a tag gatilho da sequência) e aplica a de destino
        await TicketTag.destroy({
          where: {
            ticketId: ticket.id,
            companyId: sequence.companyId,
            tagId: { [Op.in]: [sequence.tagId, sequence.endActionTagId] }
          }
        });
        await TicketTag.create({
          ticketId: ticket.id,
          tagId: sequence.endActionTagId,
          companyId: sequence.companyId
        });
        break;
      }
      case "ticket_status": {
        if (!sequence.endActionStatus) return;
        await ticket.update({ status: sequence.endActionStatus });
        break;
      }
      case "assign_queue": {
        if (!sequence.endActionQueueId) return;
        await ticket.update({ queueId: sequence.endActionQueueId });
        break;
      }
      case "assign_user": {
        if (!sequence.endActionUserId) return;
        await ticket.update({ userId: sequence.endActionUserId });
        break;
      }
      default:
        return;
    }

    // Notifica o frontend para atualizar ticket/kanban em tempo real
    const io = getIO();
    const updated = await ShowTicketService(ticket.id, sequence.companyId);
    io.of(`/workspace-${sequence.companyId}`).emit(
      `company-${sequence.companyId}-ticket`,
      { action: "update", ticket: updated }
    );

    const endTag = sequence.endActionTagId
      ? await Tag.findByPk(sequence.endActionTagId, { attributes: ["name"] })
      : null;
    logger.info(
      `[FollowUp] End action "${action}" executada no ticket #${ticket.id} (contato ${contact.id})${endTag ? ` → lane "${endTag.name}"` : ""}`
    );
  } catch (err: any) {
    logger.error(
      `[FollowUp] Erro na end action "${action}" do ticket #${ticket.id}: ${err.message}`
    );
  }
};

export default ExecuteFollowUpEndActionService;
