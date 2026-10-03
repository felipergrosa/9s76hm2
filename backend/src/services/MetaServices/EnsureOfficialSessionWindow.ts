import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import { Op } from "sequelize";

/**
 * Mensagens livres da Cloud API só podem sair dentro da janela do cliente.
 *
 * A janela de 24h da Meta pertence ao par (contato × conexão), mas é
 * persistida por ticket — quando o atendente responde por outro ticket do
 * mesmo contato (novo ciclo após fechamento, campanha, transferência), o
 * campo deste ticket pode estar nulo/antigo apesar de o cliente ter
 * escrito há poucos minutos. Por isso a checagem usa o MAIOR
 * sessionWindowExpiresAt entre todos os tickets do contato nesta conexão
 * e faz backfill no ticket atual (self-healing do badge/input).
 */
export default async function EnsureOfficialSessionWindow(ticket: Ticket): Promise<void> {
  // Janela efetiva = maior sessionWindowExpiresAt entre tickets do mesmo
  // contato nesta conexão (a janela da Meta é do par contato×número).
  const current = await Ticket.findOne({
    where: {
      companyId: ticket.companyId,
      contactId: ticket.contactId,
      whatsappId: ticket.whatsappId,
      sessionWindowExpiresAt: { [Op.ne]: null }
    },
    attributes: ["sessionWindowExpiresAt"],
    order: [["sessionWindowExpiresAt", "DESC"]]
  });

  const expiresAtMs = current?.sessionWindowExpiresAt
    ? new Date(current.sessionWindowExpiresAt).getTime()
    : 0;

  if (!expiresAtMs || expiresAtMs <= Date.now()) {
    throw new AppError("Janela de 24 horas encerrada. Envie um template aprovado para iniciar a conversa.", 400);
  }

  // Backfill: se a janela válida vive em outro ticket, replica para este —
  // mantém badge, input e GetSessionWindowStatus consistentes.
  const ticketExpiresAtMs = ticket.sessionWindowExpiresAt
    ? new Date(ticket.sessionWindowExpiresAt).getTime()
    : 0;

  if (ticketExpiresAtMs < expiresAtMs) {
    try {
      await Ticket.update(
        { sessionWindowExpiresAt: current.sessionWindowExpiresAt },
        { where: { id: ticket.id, companyId: ticket.companyId } }
      );
    } catch {
      // Não impede o envio se o backfill falhar — a janela já foi validada.
    }
  }
}
