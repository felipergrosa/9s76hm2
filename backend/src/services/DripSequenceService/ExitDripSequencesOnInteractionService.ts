import { Op } from "sequelize";
import DripSequence from "../../models/DripSequence";
import DripSequenceEnrollment from "../../models/DripSequenceEnrollment";
import TicketTag from "../../models/TicketTag";
import Ticket from "../../models/Ticket";
import logger from "../../utils/logger";

/**
 * Interação do contato (mensagem recebida) — cancela as inscrições ativas em
 * drip sequences e remove do ticket as lanes (tags kanban) que disparam essas
 * sequências, fazendo o contato "sair da lane" automaticamente.
 *
 * Chamado uma vez por mensagem inbound em CreateMessageService (ponto de
 * convergência de todos os canais: Baileys, Oficial, Facebook/Instagram).
 */
const ExitDripSequencesOnInteractionService = async ({
  companyId,
  contactId,
  ticketId
}: {
  companyId: number;
  contactId: number;
  ticketId: number;
}): Promise<void> => {
  const enrollments = await DripSequenceEnrollment.findAll({
    where: { contactId, companyId, status: "active" },
    include: [{ model: DripSequence, attributes: ["id", "tagId"] }]
  });

  if (enrollments.length === 0) return;

  const tagIds = enrollments
    .map(e => e.dripSequence?.tagId)
    .filter((t): t is number => Boolean(t));

  for (const enrollment of enrollments) {
    await enrollment.update({
      status: "cancelled",
      lastError: "Cancelado por interação do contato"
    });
  }

  // Remove do ticket as lanes vinculadas às sequências canceladas —
  // o card sai da coluna do Kanban automaticamente.
  if (tagIds.length > 0) {
    const removed = await TicketTag.destroy({
      where: { ticketId, companyId, tagId: { [Op.in]: tagIds } }
    });
    if (removed > 0) {
      logger.info(
        `[DripSequence] Contato ${contactId} saiu da lane (ticket #${ticketId}) por interação — tags ${tagIds.join(",")}`
      );
    }
  }

  logger.info(
    `[DripSequence] ${enrollments.length} inscrição(ões) cancelada(s) para contato ${contactId} por interação`
  );
};

export default ExitDripSequencesOnInteractionService;
