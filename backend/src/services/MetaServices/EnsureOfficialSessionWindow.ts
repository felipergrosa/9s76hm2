import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";

/** Mensagens livres da Cloud API só podem sair dentro da janela do cliente. */
export default async function EnsureOfficialSessionWindow(ticket: Ticket): Promise<void> {
  const current = await Ticket.findOne({
    where: { id: ticket.id, companyId: ticket.companyId },
    attributes: ["sessionWindowExpiresAt"]
  });

  const expiresAt = current?.sessionWindowExpiresAt
    ? new Date(current.sessionWindowExpiresAt).getTime()
    : 0;

  if (!expiresAt || expiresAt <= Date.now()) {
    throw new AppError("Janela de 24 horas encerrada. Envie um template aprovado para iniciar a conversa.", 400);
  }
}
