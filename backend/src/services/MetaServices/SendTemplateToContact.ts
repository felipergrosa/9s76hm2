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

interface SendTemplateToContactParams {
  whatsappId: number;
  contactId: number;
  companyId: number;
  userId: number;
  queueId?: number;
  templateName: string;
  languageCode?: string;
  components?: any[];
  variablesConfig?: Record<string, any>;  // NOVO: mapeamento de variáveis
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
  variablesConfig  // NOVO
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
    }

    // IMPORTANTE: Se template tem HEADER mas não tem parâmetros de header,
    // ainda assim precisa incluir componente header vazio no beginning do array
    // (Meta API pode exigir isso)
    if (templateDefinition?.hasHeader && finalComponents) {
      const hasHeaderComponent = finalComponents.some((c: any) => c.type === "header");
      if (!hasHeaderComponent) {
        logger.info(`[SendTemplateToContact] Template tem header fixo - incluindo componente header vazio`);
        finalComponents = [
          { type: "header", parameters: [] },
          ...finalComponents
        ];
      }
    }

    console.log("[SendTemplateToContact] finalComponents antes de enviar:", JSON.stringify(finalComponents, null, 2));

    // Obter adapter oficial ANTES de criar ticket
    const adapter = await GetWhatsAppAdapter(whatsapp);
    if (adapter.channelType !== "official") {
      throw new AppError("Adapter obtido não é API Oficial", 500);
    }

    const official: any = adapter as any;
    if (typeof official.sendTemplate !== "function") {
      throw new AppError("Adapter oficial não suporta envio de templates", 500);
    }

    // ENVIAR TEMPLATE PRIMEIRO (antes de criar ticket)
    // Se falhar, lança exceção e não cria ticket
    const sent = await official.sendTemplate(
      contact.number,
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
    } else {
      // Criar novo ticket apenas se não existir um aberto
      ticket = await CreateTicketService({
        contactId: contact.id,
        status: "open",
        userId,
        companyId,
        queueId,
        whatsappId: String(whatsappId)
      });
      logger.info(
        `[SendTemplateToContact] Novo ticket #${ticket.id} criado para mensagem enviada com sucesso`
      );
    }

    const message = await CreateMessageService({
      messageData: {
        wid: sent.id,
        ticketId: ticket.id,
        contactId: contact.id,
        body: sent.body || `Template: ${templateName}`,
        fromMe: true,
        read: true,
        mediaType: "template",
        ack: sent.ack ?? 1,
        remoteJid: ticket.contact?.remoteJid
      },
      companyId
    });

    return { ticket, message };
  } catch (error: any) {
    logger.error("[SendTemplateToContact] Erro ao enviar template para contato", {
      message: error.message
    });
    throw error;
  }
};

export default SendTemplateToContact;
