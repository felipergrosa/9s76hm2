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

    // Construir corpo da mensagem para salvar no histórico
    let messageBody = templateDefinition?.body || `Template: ${templateName}`;
    let mediaUrl: string | undefined = undefined;
    let mediaType: string | undefined = undefined;

    // Substituir variáveis no corpo da mensagem
    if (templateDefinition && finalComponents) {
      // Pegar parâmetros do BODY
      const bodyComponent = finalComponents.find(c => c.type === "body");
      if (bodyComponent?.parameters) {
        bodyComponent.parameters.forEach((param: any, index: number) => {
          if (param.type === "text") {
            // Substituir {{1}}, {{2}}, etc. pelos valores reais
            messageBody = messageBody.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), param.text);
          }
        });
      }

      // Adicionar informação do header se for documento/imagem/vídeo
      if (templateDefinition.headerFormat && ["DOCUMENT", "IMAGE", "VIDEO"].includes(templateDefinition.headerFormat)) {
        mediaType = templateDefinition.headerFormat.toLowerCase();
        mediaUrl = templateDefinition.headerHandle; // URL original do arquivo

        logger.info(`[SendTemplateToContact] Salvando ${mediaType} na mensagem: ${mediaUrl}`);
      }
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
