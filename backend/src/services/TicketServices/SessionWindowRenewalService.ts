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
 * 
 * Melhorias:
 * - Tracking de envio para evitar duplicatas (sessionWindowRenewalSentAt)
 * - Logs detalhados para debug
 * - Verificação de janela já expirada (edge case pós-queda)
 * - Proteção contra envio múltiplo
 */
export const SessionWindowRenewalService = async (): Promise<void> => {
  try {
    const now = new Date();
    
    logger.info(`[SessionWindowRenewal] === INICIANDO VERIFICAÇÃO === ${now.toISOString()}`);
    
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
      logger.info("[SessionWindowRenewal] Nenhuma conexão API Oficial com mensagem de renovação configurada");
      return;
    }

    logger.info(`[SessionWindowRenewal] Encontradas ${whatsapps.length} conexão(ões) com renovação configurada`);

    for (const whatsapp of whatsapps) {
      const renewalMinutes = whatsapp.sessionWindowRenewalMinutes || 60; // Default: 60 minutos
      const threshold = new Date(now.getTime() + renewalMinutes * 60 * 1000);

      logger.info(
        `[SessionWindowRenewal] Conexão ${whatsapp.name} (#${whatsapp.id}): ` +
        `threshold=${renewalMinutes}min (${threshold.toISOString()})`
      );

      // Buscar tickets abertos com janela prestes a expirar
      // CRÍTICO: Só envia se ainda NÃO enviou (sessionWindowRenewalSentAt IS NULL)
      // ou se já enviou há mais de 12 horas (evita spam mas permite retry)
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
      
      const tickets = await Ticket.findAll({
        where: {
          whatsappId: whatsapp.id,
          status: "open",
          isGroup: false,
          sessionWindowExpiresAt: {
            [Op.and]: [
              { [Op.ne]: null },
              { [Op.gt]: now },        // Ainda não expirou
              { [Op.lte]: threshold }  // Mas vai expirar em breve (dentro do threshold)
            ]
          },
          [Op.or]: [
            { sessionWindowRenewalSentAt: null }, // Nunca enviou
            { sessionWindowRenewalSentAt: { [Op.lt]: twelveHoursAgo } } // Último envio há +12h
          ]
        },
        include: [
          {
            model: Contact,
            as: "contact",
            attributes: ["id", "name", "number", "remoteJid"]
          }
        ]
      });

      logger.info(
        `[SessionWindowRenewal] Conexão ${whatsapp.name}: ${tickets.length} ticket(s) elegíveis ` +
        `(janela expira em até ${renewalMinutes}min + não enviado ou envio>12h atrás)`
      );

      // Log detalhado de cada ticket encontrado
      for (const t of tickets) {
        const expiresAt = t.sessionWindowExpiresAt;
        const expiresInMs = expiresAt ? expiresAt.getTime() - now.getTime() : 0;
        const expiresInMin = Math.floor(expiresInMs / 60000);
        const lastSent = t.sessionWindowRenewalSentAt;
        
        logger.info(
          `[SessionWindowRenewal] Ticket #${t.id} | Contato: ${t.contact?.name} | ` +
          `Expira em: ${expiresInMin}min (${expiresAt?.toISOString()}) | ` +
          `Último envio: ${lastSent ? lastSent.toISOString() : 'NUNCA'}`
        );
      }

      for (const ticket of tickets) {
        try {
          if (!ticket.contact?.remoteJid) {
            logger.warn(`[SessionWindowRenewal] Ticket ${ticket.id} sem remoteJid. Pulando.`);
            continue;
          }

          // Double-check: verificar se a janela ainda está válida (pode ter sido renovada por mensagem do cliente)
          const ticketFresh = await Ticket.findByPk(ticket.id);
          if (!ticketFresh || !ticketFresh.sessionWindowExpiresAt) {
            logger.info(`[SessionWindowRenewal] Ticket ${ticket.id}: janela não encontrada (pode ter sido fechada). Pulando.`);
            continue;
          }
          
          const freshExpiresAt = ticketFresh.sessionWindowExpiresAt;
          const freshExpiresInMs = freshExpiresAt.getTime() - now.getTime();
          const freshExpiresInMin = Math.floor(freshExpiresInMs / 60000);
          
          // Se a janela foi renovada recentemente (expira daqui a mais de threshold), pular
          if (freshExpiresInMin > renewalMinutes) {
            logger.info(
              `[SessionWindowRenewal] Ticket ${ticket.id}: janela já foi renovada ` +
              `(expira em ${freshExpiresInMin}min > ${renewalMinutes}min). Pulando.`
            );
            continue;
          }

          // Verificar novamente se não enviamos recentemente (race condition)
          if (ticketFresh.sessionWindowRenewalSentAt && ticketFresh.sessionWindowRenewalSentAt > twelveHoursAgo) {
            logger.info(
              `[SessionWindowRenewal] Ticket ${ticket.id}: mensagem já enviada recentemente ` +
              `(${ticketFresh.sessionWindowRenewalSentAt.toISOString()}). Pulando.`
            );
            continue;
          }

          // Enviar mensagem de renovação
          const message = whatsapp.sessionWindowRenewalMessage || "";
          
          logger.info(
            `[SessionWindowRenewal] >>> ENVIANDO mensagem de renovação para ticket ${ticket.id} ` +
            `(contato: ${ticket.contact.name}, expira em: ${freshExpiresInMin}min)`
          );

          // Usar o SendWhatsAppMessage padrão (passa ticket completo)
          await SendWhatsAppMessage({ 
            body: message, 
            ticket: ticketFresh 
          });

          // MARCAR como enviado para evitar duplicata
          await ticketFresh.update({
            sessionWindowRenewalSentAt: new Date()
          });

          logger.info(
            `[SessionWindowRenewal] ✅ Mensagem ENVIADA e MARCADA para ticket ${ticket.id}. ` +
            `Aguardando resposta do cliente para abrir nova janela.`
          );

        } catch (err: any) {
          logger.error(`[SessionWindowRenewal] ❌ Erro ao enviar para ticket ${ticket.id}: ${err.message}`);
        }
      }
    }
    
    logger.info("[SessionWindowRenewal] === VERIFICAÇÃO CONCLUÍDA ===");
  } catch (err: any) {
    logger.error(`[SessionWindowRenewal] ❌❌❌ Erro geral no serviço: ${err.message}`);
  }
};

export default SessionWindowRenewalService;
