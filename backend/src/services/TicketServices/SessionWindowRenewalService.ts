import { Op } from "sequelize";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import logger from "../../utils/logger";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";

/**
 * Serviço para verificar e renovar janelas de sessão 24h prestes a expirar
 * 
 * Fluxo:
 * 1. Busca tickets abertos com janela prestes a expirar (dentro de X minutos)
 * 2. Verifica se a conexão tem mensagem de renovação configurada
 * 3. Envia a mensagem para o contato
 * 4. A resposta do cliente abrirá uma nova janela de 24h
 */
export const SessionWindowRenewalService = async (): Promise<void> => {
  try {
    const now = new Date();
    
    // Buscar todas as conexões API Oficial com mensagem de renovação configurada
    const whatsapps = await Whatsapp.findAll({
      where: {
        channelType: "official",
        sessionWindowRenewalMessage: { 
          [Op.and]: [
            { [Op.ne]: null },
            { [Op.ne]: "" }
          ]
        }
      },
      attributes: ["id", "name", "sessionWindowRenewalMessage", "sessionWindowRenewalMinutes"]
    });

    if (whatsapps.length === 0) {
      logger.debug("[SessionWindowRenewal] Nenhuma conexão com mensagem de renovação configurada");
      return;
    }

    for (const whatsapp of whatsapps) {
      const renewalMinutes = whatsapp.sessionWindowRenewalMinutes || 5;
      const threshold = new Date(now.getTime() + renewalMinutes * 60 * 1000);

      // Buscar tickets abertos com janela prestes a expirar
      // - status = open (ticket em atendimento)
      // - sessionWindowExpiresAt dentro do threshold
      // - isGroup = false (grupos não têm janela 24h)
      const tickets = await Ticket.findAll({
        where: {
          whatsappId: whatsapp.id,
          status: "open",
          isGroup: false,
          sessionWindowExpiresAt: {
            [Op.and]: [
              { [Op.ne]: null },
              { [Op.gt]: now },        // Ainda não expirou
              { [Op.lte]: threshold }  // Mas vai expirar em breve
            ]
          }
        },
        include: [
          {
            model: Contact,
            as: "contact",
            attributes: ["id", "name", "number", "remoteJid"]
          }
        ]
      });

      logger.info(`[SessionWindowRenewal] Encontrados ${tickets.length} tickets para renovar na conexão ${whatsapp.name}`);

      for (const ticket of tickets) {
        try {
          if (!ticket.contact?.remoteJid) {
            logger.warn(`[SessionWindowRenewal] Ticket ${ticket.id} sem remoteJid. Pulando.`);
            continue;
          }

          // Enviar mensagem de renovação
          const message = whatsapp.sessionWindowRenewalMessage || "";
          
          logger.info(
            `[SessionWindowRenewal] Enviando mensagem de renovação para ticket ${ticket.id} ` +
            `(contato: ${ticket.contact.name}, expira em: ${ticket.sessionWindowExpiresAt})`
          );

          // Usar o SendWhatsAppMessage padrão (passa ticket completo)
          await SendWhatsAppMessage({ 
            body: message, 
            ticket: ticket 
          });

          logger.info(
            `[SessionWindowRenewal] Mensagem enviada para ticket ${ticket.id}. ` +
            `Aguardando resposta do cliente para abrir nova janela.`
          );

        } catch (err: any) {
          logger.error(`[SessionWindowRenewal] Erro ao enviar para ticket ${ticket.id}: ${err.message}`);
        }
      }
    }
  } catch (err: any) {
    logger.error(`[SessionWindowRenewal] Erro geral: ${err.message}`);
  }
};

export default SessionWindowRenewalService;
