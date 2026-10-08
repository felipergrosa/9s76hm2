// Util de "SLA" do Kanban.
// Dois critérios, em ordem de prioridade:
//  1) SLA real por fila — quando a fila do ticket tem `slaMinutes` > 0
//     (campo da tabela Queues, retornado em ticket.queue.slaMinutes pelo
//     /ticket/kanban), o ticket está vencido quando há mensagens não lidas
//     (cliente aguardando resposta) e o tempo desde a última atualização
//     ultrapassa o SLA da fila. Com SLA configurado, os fallbacks abaixo
//     NÃO se aplicam — a regra da fila é a fonte de verdade.
//  2) Fallback (fila sem SLA ou ticket sem fila):
//     a) sessionWindowExpiresAt — expiração da janela de 24h da API
//        oficial do WhatsApp (campo real do Ticket);
//     b) heurística — mensagens não lidas sem atualização há mais de
//        SLA_HOURS (cliente aguardando resposta).
const SLA_HOURS = 24;

export const isTicketSlaOverdue = (ticket, now = new Date()) => {
  if (!ticket) return false;
  try {
    // Critério primário: SLA configurado na fila (minutos)
    const queueSlaMinutes = Number(ticket.queue?.slaMinutes) || 0;
    if (queueSlaMinutes > 0) {
      const unread = Number(ticket.unreadMessages) || 0;
      if (unread <= 0 || !ticket.updatedAt) return false;
      const updated = new Date(ticket.updatedAt);
      if (isNaN(updated)) return false;
      return now - updated > queueSlaMinutes * 60 * 1000;
    }

    // Fallback: janela de 24h expirada = cliente esperando fora do prazo
    if (ticket.sessionWindowExpiresAt) {
      const expires = new Date(ticket.sessionWindowExpiresAt);
      if (!isNaN(expires) && expires < now) return true;
    }
    // Fallback: não lidas paradas há mais de SLA_HOURS
    const unread = Number(ticket.unreadMessages) || 0;
    if (unread > 0 && ticket.updatedAt) {
      const updated = new Date(ticket.updatedAt);
      if (!isNaN(updated) && now - updated > SLA_HOURS * 3600 * 1000) return true;
    }
  } catch (e) { }
  return false;
};

export default isTicketSlaOverdue;
