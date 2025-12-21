import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import AppError from "../../errors/AppError";
import logger from "../../utils/logger";
import CreateTicketService from "../TicketServices/CreateTicketService";
import GetWhatsAppAdapter from "../../helpers/GetWhatsAppAdapter";
import CreateMessageService from "../MessageServices/CreateMessageService";
import GetTemplateDefinition, { TemplateDefinition } from "./GetTemplateDefinition";
import MapTemplateParameters from "./MapTemplateParameters";
import { Op } from "sequelize";  // NOVO: para query de ticket existente
import { safeNormalizePhoneNumber } from "../../utils/phone";

interface SendTemplateToContactParams {
  whatsappId: number;
  contactId: number;
  companyId: number;
  userId: number | null;  // null = ticket fica em AGUARDANDO (sem usuário atribuído)
  queueId?: number;
  templateName: string;
  languageCode?: string;
  components?: any[];
  variablesConfig?: Record<string, any>;  // NOVO: mapeamento de variáveis
  statusTicket?: string;  // Status do ticket: "open", "pending", "closed"
}

interface SendTemplateToContactResult {
  ticket: Ticket;
  message: Message;
}

const SendTemplateToContact = async ({
  whatsappId,
  contactId,
  companyId,
  userId,
  queueId,
  templateName,
  languageCode = "pt_BR",
  components,
  variablesConfig,  // NOVO
  statusTicket = "open"  // Status padrão: open, mas pode ser "pending" ou "closed"
}: SendTemplateToContactParams): Promise<SendTemplateToContactResult> => {
  try {
    logger.info(
      `[SendTemplateToContact] Enviando template ${templateName} para contactId=${contactId} via whatsappId=${whatsappId}`
    );

    const whatsapp = await Whatsapp.findOne({ where: { id: whatsappId, companyId } });
    if (!whatsapp) {
      throw new AppError("WhatsApp não encontrado", 404);
    }

    if (whatsapp.channelType !== "official") {
      throw new AppError("Conexão não é API Oficial", 400);
    }

    const contact = await Contact.findOne({ where: { id: contactId, companyId } });
    if (!contact) {
      throw new AppError("Contato não encontrado", 404);
    }

    if (contact.isGroup) {
      throw new AppError("Envio de template não é suportado para grupos", 400);
    }

    // Buscar definição do template para saber quais parâmetros espera
    let templateDefinition: TemplateDefinition | null = null;
    try {
      templateDefinition = await GetTemplateDefinition(
        whatsappId,
        templateName,
        languageCode
      );
      logger.info(
        `[SendTemplateToContact] Template ${templateName} tem ${templateDefinition.parameters.length} parâmetros e ${templateDefinition.buttons.length} botões`
      );
    } catch (err: any) {
      logger.warn(
        `[SendTemplateToContact] Não foi possível buscar definição do template: ${err.message}`
      );
    }

    // Montar components automaticamente se:
    // 1. components não foi fornecido E
    // 2. template tem parâmetros esperados
    let finalComponents = components;
    
    // DEBUG: Log para verificar o que está chegando
    console.log("[SendTemplateToContact] components recebido:", JSON.stringify(components));
    console.log("[SendTemplateToContact] variablesConfig recebido:", JSON.stringify(variablesConfig));
    
    if ((!finalComponents || finalComponents.length === 0) && templateDefinition) {
      if (templateDefinition.parameters.length > 0) {
        finalComponents = MapTemplateParameters(
          templateDefinition.parameters,
          contact,
          variablesConfig  // NOVO: passar mapeamento configurado
        );
        logger.info(
          `[SendTemplateToContact] Auto-mapeamento de parâmetros concluído`
        );
      }
    } else if (finalComponents && finalComponents.length > 0) {
      logger.info(`[SendTemplateToContact] Usando components pré-mapeados (${finalComponents.length} componentes)`);
    }

    // Obter adapter oficial ANTES de montar header (preciso do uploadMedia)
    const adapter = await GetWhatsAppAdapter(whatsapp);
    if (adapter.channelType !== "official") {
      throw new AppError("Adapter obtido não é API Oficial", 500);
    }

    const official: any = adapter as any;
    if (typeof official.sendTemplate !== "function") {
      throw new AppError("Adapter oficial não suporta envio de templates", 500);
    }

    // IMPORTANTE: Se template tem HEADER com mídia (DOCUMENT/IMAGE/VIDEO),
    // fazer upload via Media API e usar media_id ao invés do link direto
    if (templateDefinition?.headerFormat &&
      ["DOCUMENT", "IMAGE", "VIDEO"].includes(templateDefinition.headerFormat) &&
      templateDefinition.headerHandle) {

      logger.info(`[SendTemplateToContact] Template tem header ${templateDefinition.headerFormat} - fazendo upload`);

      try {
        // Fazer upload da mídia e obter media_id
        const mediaId = await official.uploadMedia(
          templateDefinition.headerHandle,
          templateDefinition.headerFormat.toLowerCase() as "document" | "image" | "video"
        );

        logger.info(`[SendTemplateToContact] Upload concluído, media_id: ${mediaId}`);

        const headerComponent: any = {
          type: "header",
          parameters: [{
            type: templateDefinition.headerFormat.toLowerCase(),
            [templateDefinition.headerFormat.toLowerCase()]: {
              id: mediaId  // Usar media_id ao invés de link
            }
          }]
        };

        // Inserir header component NO INÍCIO do array
        if (finalComponents) {
          finalComponents = [headerComponent, ...finalComponents];
        } else {
          finalComponents = [headerComponent];
        }

      } catch (uploadError: any) {
        logger.error(`[SendTemplateToContact] Erro no upload de mídia: ${uploadError.message}`);
        // Re-throw para que o template não seja enviado com header quebrado
        throw uploadError;
      }
    }

    console.log("[SendTemplateToContact] finalComponents antes de enviar:", JSON.stringify(finalComponents, null, 2));

    const normalizedRecipient = safeNormalizePhoneNumber(contact.canonicalNumber || contact.number);
    const recipient = normalizedRecipient?.canonical;
    if (!recipient || recipient.replace(/\D/g, "").length < 10) {
      throw new AppError(
        `Número do contato inválido para envio de template: "${contact.number}" (canonical: "${recipient || ""}")`,
        400
      );
    }

    // ENVIAR TEMPLATE PRIMEIRO (antes de criar ticket)
    // Se falhar, lança exceção e não cria ticket
    const sent = await official.sendTemplate(
      recipient,
      templateName,
      languageCode,
      finalComponents
    );

    logger.info(
      `[SendTemplateToContact] Template ${templateName} enviado com sucesso. messageId=${sent.id}`
    );

    // APENAS APÓS SUCESSO DO ENVIO: Verificar se já existe ticket aberto
    // Se existir, REUSAR o ticket (especialmente importante para campanhas)
    let ticket = await Ticket.findOne({
      where: {
        contactId: contact.id,
        whatsappId,
        companyId,
        status: { [Op.or]: ["open", "pending"] }
      }
    });

    if (ticket) {
      logger.info(
        `[SendTemplateToContact] Reusando ticket existente #${ticket.id} para mensagem enviada`
      );
      // Se a campanha pede status "pending", garantir que fique em AGUARDANDO (sem userId)
      if (statusTicket === "pending") {
        if (ticket.status !== "pending" || ticket.userId !== null) {
          await ticket.update({
            status: "pending",
            userId: null  // Sem usuário = fica em AGUARDANDO
          });
          logger.info(
            `[SendTemplateToContact] Ticket #${ticket.id} atualizado para status="pending" (AGUARDANDO)`
          );
        }
      } else if (statusTicket === "open" && userId) {
        // Se status for "open" e tiver usuário, atribuir ao usuário
        if (ticket.status !== "open" || ticket.userId !== userId) {
          await ticket.update({
            status: "open",
            userId
          });
          logger.info(
            `[SendTemplateToContact] Ticket #${ticket.id} atualizado para status="open" com userId=${userId}`
          );
        }
      }
    } else {
      // Criar novo ticket apenas se não existir um aberto
      // Usar o statusTicket da campanha (pode ser "open", "pending" ou "closed")
      const finalStatus = statusTicket === "closed" ? "open" : statusTicket; // Se closed, cria como open e fecha depois
      // Para status "pending", não atribuir usuário (fica em AGUARDANDO)
      const finalUserId = finalStatus === "pending" ? null : userId;
      ticket = await CreateTicketService({
        contactId: contact.id,
        status: finalStatus,
        userId: finalUserId,
        companyId,
        queueId,
        whatsappId: String(whatsappId)
      });
      logger.info(
        `[SendTemplateToContact] Novo ticket #${ticket.id} criado com status="${finalStatus}" userId=${finalUserId} para mensagem enviada com sucesso`
      );
    }

    // Construir corpo da mensagem para salvar no histórico
    let messageBody = templateDefinition?.body || `Template: ${templateName}`;
    let mediaUrl: string | undefined = undefined;
    let mediaType: string | undefined = undefined;

    // Substituir variáveis no corpo da mensagem (garantir texto salvo mesmo com header de imagem)
    if (finalComponents) {
      // Pegar parâmetros do BODY
      const bodyComponent = finalComponents.find(c => c.type === "body");

      // Se existe templateDefinition.body, substitui placeholders; senão, monta texto a partir dos parâmetros
      if (bodyComponent?.parameters) {
        const texts: string[] = [];
        bodyComponent.parameters.forEach((param: any, index: number) => {
          if (param.type === "text") {
            if (templateDefinition?.body) {
              messageBody = messageBody.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), param.text);
            }
            texts.push(param.text);
          }
        });

        // Se não havia templateDefinition.body, usa os textos concatenados
        if (!templateDefinition?.body && texts.length) {
          messageBody = texts.join("\n");
        }
      }
    }

    // Adicionar informação do header se for documento/imagem/vídeo
    if (templateDefinition && templateDefinition.headerFormat && ["DOCUMENT", "IMAGE", "VIDEO"].includes(templateDefinition.headerFormat)) {
      mediaType = templateDefinition.headerFormat.toLowerCase();
      mediaUrl = templateDefinition.headerHandle; // URL original do arquivo

      logger.info(`[SendTemplateToContact] Salvando ${mediaType} na mensagem: ${mediaUrl}`);
    }

    const message = await CreateMessageService({
      messageData: {
        wid: sent.id,
        ticketId: ticket.id,
        contactId: contact.id,
        body: messageBody,  // Corpo formatado com variáveis substituídas
        fromMe: true,
        read: true,
        mediaType: mediaType || "template",  // "document", "image", "video", ou "template"
        mediaUrl,  // URL do arquivo se houver
        ack: sent.ack ?? 1,
        remoteJid: ticket.contact?.remoteJid,
        isCampaign: true  // Evita emitir para a sala da conversa (background)
      },
      companyId
    });

    // Se statusTicket for "closed", fechar o ticket após enviar a mensagem
    if (statusTicket === "closed" && ticket.status !== "closed") {
      await ticket.update({ status: "closed" });
      logger.info(`[SendTemplateToContact] Ticket #${ticket.id} fechado conforme configuração da campanha`);
    }

    return { ticket, message };
  } catch (error: any) {
    logger.error("[SendTemplateToContact] Erro ao enviar template para contato", {
      message: error.message
    });
    throw error;
  }
};

export default SendTemplateToContact;
