import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import CompaniesSettings from "../../models/CompaniesSettings";
import { markMessageAsDeletedByWid } from "../MessageServices/MessageCommandService";

const MarkDeleteWhatsAppMessage = async (from: any, timestamp?: any, msgId?: string, companyId?: number): Promise<Message> => {

    from = from.replace('@c.us', '').replace('@s.whatsapp.net', '')

    if (msgId && companyId) {
        try {
            // Verificar configurações LGPD
            const settings = await CompaniesSettings.findOne({
                where: { companyId }
            });

            // Determinar o corpo da mensagem baseado nas configurações LGPD
            const newBody = (settings?.lgpdDeleteMessage === "enabled" && settings?.enableLGPD === "enabled")
                ? "🚫 _Mensagem Apagada_"
                : undefined;

            // CQRS: Usar MessageCommandService para marcar como deletada
            // Isso já faz: busca + update + emite evento via EventBus
            const updatedMessage = await markMessageAsDeletedByWid(msgId, companyId, newBody);

            if (updatedMessage) {
                // Atualizar lastMessage do ticket
                const ticket = await Ticket.findByPk(updatedMessage.ticketId);
                if (ticket) {
                    await UpdateTicketService({ 
                        ticketData: { lastMessage: " _Mensagem Apagada_" }, 
                        ticketId: ticket.id, 
                        companyId 
                    });
                }
                
                console.log(`[MarkDeleteWhatsAppMessage] Mensagem ${msgId} marcada como deletada via CQRS`);
            }
        } catch (err) {
            console.log("Erro ao tentar marcar a mensagem como excluída:", err);
        }

        return timestamp;
    };

}

export default MarkDeleteWhatsAppMessage;