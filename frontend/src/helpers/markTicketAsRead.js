import api from "../../services/api";

export const markTicketAsRead = async (ticketId) => {
  try {
    await api.post(`/tickets/${ticketId}/mark-as-read`);
  } catch (err) {
    console.error("Erro ao marcar ticket como lido:", err);
  }
};
