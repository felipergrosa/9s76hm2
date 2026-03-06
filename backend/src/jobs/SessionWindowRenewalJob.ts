import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import Contact from "../models/Contact";
import logger from "../utils/logger";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";

/**
 * Job Bull Queue para renovação de janela 24h - Processa UM ticket específico
 * 
 * Vantagens sobre cron:
 * - Sem polling no banco (zero overhead constante)
 * - Um job por ticket (escalável para milhares)
 * - Agenda exata (23h após mensagem do cliente)
 * - Retry automático se falhar
 * 
 * Job ID único: `window-renewal-${ticketId}` (evita duplicatas)
 */
export default {
  key: `${process.env.DB_NAME}-SessionWindowRenewal`,

  async handle({ data }) {
    const { ticketId, companyId } = data || {};

    if (!ticketId || !companyId) {
      logger.error("[SessionWindowRenewalJob] Payload inválido", { ticketId, companyId });
      throw new Error("Payload inválido: ticketId e companyId obrigatórios");
    }

    const now = new Date();
    logger.info(`[SessionWindowRenewalJob] Processando ticket ${ticketId} (company ${companyId})`);

    try {
      // Buscar ticket atualizado
      const ticket = await Ticket.findByPk(ticketId, {
        include: [
          { model: Contact, as: "contact", attributes: ["id", "name", "number", "remoteJid"] },
          { model: Whatsapp, as: "whatsapp", attributes: ["id", "name", "channelType", "sessionWindowRenewalMessage"] }
        ]
      });

      if (!ticket) {
        logger.warn(`[SessionWindowRenewalJob] Ticket ${ticketId} não encontrado`);
        return; // Não lançar erro - ticket pode ter sido deletado
      }

      // Verificações de segurança
      if (ticket.whatsapp?.channelType !== "official") {
        logger.info(`[SessionWindowRenewalJob] Ticket ${ticketId} não é API Oficial. Pulando.`);
        return;
      }

      if (!ticket.whatsapp?.sessionWindowRenewalMessage) {
        logger.info(`[SessionWindowRenewalJob] Conexão ${ticket.whatsapp?.name} sem mensagem de renovação configurada`);
        return;
      }

      if (ticket.status !== "open") {
        logger.info(`[SessionWindowRenewalJob] Ticket ${ticketId} status=${ticket.status} (não está open). Pulando.`);
        return;
      }

      if (!ticket.sessionWindowExpiresAt) {
        logger.info(`[SessionWindowRenewalJob] Ticket ${ticketId} sem janela de sessão. Pulando.`);
        return;
      }

      // Verificar se a janela ainda está prestes a expirar
      const expiresAt = ticket.sessionWindowExpiresAt;
      const expiresInMs = expiresAt.getTime() - now.getTime();
      const expiresInMin = Math.floor(expiresInMs / 60000);

      // Se a janela já foi renovada (expira daqui a mais de 120 min), pular
      if (expiresInMin > 120) {
        logger.info(
          `[SessionWindowRenewalJob] Ticket ${ticketId}: janela já renovada ` +
          `(expira em ${expiresInMin}min > 120min). Pulando.`
        );
        return;
      }

      // Se a janela já expirou completamente, não adianta enviar
      if (expiresInMin <= 0) {
        logger.info(
          `[SessionWindowRenewalJob] Ticket ${ticketId}: janela já EXPIROU ` +
          `(há ${Math.abs(expiresInMin)}min). Pulando.`
        );
        return;
      }

      // Verificar se já enviamos recentemente (proteção extra)
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      if (ticket.sessionWindowRenewalSentAt && ticket.sessionWindowRenewalSentAt > twelveHoursAgo) {
        logger.info(
          `[SessionWindowRenewalJob] Ticket ${ticketId}: mensagem já enviada ` +
          `(${ticket.sessionWindowRenewalSentAt.toISOString()}). Pulando.`
        );
        return;
      }

      if (!ticket.contact?.remoteJid) {
        logger.warn(`[SessionWindowRenewalJob] Ticket ${ticketId} sem remoteJid. Pulando.`);
        return;
      }

      // ENVIAR mensagem de renovação
      const message = ticket.whatsapp.sessionWindowRenewalMessage;
      
      logger.info(
        `[SessionWindowRenewalJob] >>> ENVIANDO mensagem para ticket ${ticket.id} ` +
        `(contato: ${ticket.contact.name}, expira em: ${expiresInMin}min)`
      );

      await SendWhatsAppMessage({ 
        body: message, 
        ticket 
      });

      // Marcar como enviado
      await ticket.update({
        sessionWindowRenewalSentAt: new Date()
      });

      logger.info(
        `[SessionWindowRenewalJob] ✅ Mensagem ENVIADA para ticket ${ticket.id}. ` +
        `Janela expiraria em ${expiresInMin}min.`
      );

    } catch (error: any) {
      logger.error(
        `[SessionWindowRenewalJob] ❌ Erro ao processar ticket ${ticketId}: ${error.message}`,
        { stack: error.stack }
      );
      throw error; // Relançar para Bull fazer retry
    }
  }
};
