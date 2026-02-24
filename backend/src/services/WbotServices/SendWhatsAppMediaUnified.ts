import * as Sentry from "@sentry/node";
import fs from "fs";
import path from "path";
import AppError from "../../errors/AppError";
import { GetTicketAdapter } from "../../helpers/GetWhatsAppAdapter";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import formatBody from "../../helpers/Mustache";
import logger from "../../utils/logger";
import { IWhatsAppMessage } from "../../libs/whatsapp";
import ResolveSendJid from "../../helpers/ResolveSendJid";
import { generatePdfThumbnail } from "../../helpers/PdfThumbnailGenerator";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
  isPrivate?: boolean;
  isForwarded?: boolean;
}

/**
 * Serviço unificado de envio de mídia WhatsApp
 * Suporta Baileys e Official API
 * 
 * Tipos de mídia suportados:
 * - Imagem: jpg, jpeg, png, gif, webp
 * - Áudio: mp3, ogg, aac, opus
 * - Vídeo: mp4, 3gp, avi, mov
 * - Documento: pdf, doc, docx, xls, xlsx, ppt, pptx, txt, zip
 */
const SendWhatsAppMediaUnified = async ({
  media,
  ticket,
  body,
  isPrivate = false,
  isForwarded = false
}: Request): Promise<IWhatsAppMessage | any> => {
  
  try {
    logger.info(`[SendMediaUnified] ========== INÍCIO ENVIO MÍDIA ==========`);
    logger.info(`[SendMediaUnified] Ticket: ${ticket.id}, ContactId: ${ticket.contactId}, CompanyId: ${ticket.companyId}`);
    logger.info(`[SendMediaUnified] Media: ${media.originalname}, Mimetype: ${media.mimetype}, Size: ${media.size}`);
    
    // Obter adapter apropriado
    logger.debug(`[SendMediaUnified] Obtendo adapter...`);
    const adapter = await GetTicketAdapter(ticket);
    const channelType = adapter.channelType;
    logger.info(`[SendMediaUnified] Adapter obtido: channelType=${channelType}`);
    
    // Obter contato
    logger.debug(`[SendMediaUnified] Buscando contato ${ticket.contactId}...`);
    const contact = await Contact.findByPk(ticket.contactId);
    if (!contact) {
      logger.error(`[SendMediaUnified] Contato não encontrado: ${ticket.contactId}`);
      throw new AppError("ERR_CONTACT_NOT_FOUND", 404);
    }
    logger.info(`[SendMediaUnified] Contato: id=${contact.id}, number=${contact.number}, remoteJid=${contact.remoteJid}`);

    // Resolver JID correto para envio (trata LIDs → número real)
    logger.debug(`[SendMediaUnified] Resolvendo JID...`);
    const number = await ResolveSendJid(contact, ticket.isGroup, ticket.whatsappId);
    logger.info(`[SendMediaUnified] JID resolvido: ${number}`);

    // VALIDAÇÃO: Verificar se o número é válido (não PENDING_)
    if (!number || number.includes("PENDING_") || number.includes("@lid@s.whatsapp.net")) {
      logger.error(`[SendMediaUnified] Número inválido para envio: ${number}`);
      throw new AppError(
        "Não é possível enviar mídia: contato ainda não foi vinculado a um número de telefone válido. " +
        "Aguarde o contato enviar uma mensagem primeiro ou atualize o contato manualmente.",
        400
      );
    }

    // Validar mimetype
    if (!media.mimetype) {
      logger.error(`[SendMediaUnified] Mimetype undefined! Media: ${JSON.stringify({
        originalname: media.originalname,
        filename: media.filename,
        size: media.size,
        mimetype: media.mimetype
      })}`);
      throw new AppError("Tipo de arquivo não identificado (mimetype ausente)", 400);
    }

    // Determinar tipo de mídia baseado no mimetype
    let mediaType: "image" | "audio" | "video" | "document" = "document";
    
    if (media.mimetype.startsWith("image/")) {
      mediaType = "image";
    } else if (media.mimetype.startsWith("audio/")) {
      mediaType = "audio";
    } else if (media.mimetype.startsWith("video/")) {
      mediaType = "video";
    }
    
    logger.info(`[SendMediaUnified] Mimetype: ${media.mimetype}, MediaType: ${mediaType}`);

    // Formatar corpo da mensagem (caption)
    const formattedBody = body ? formatBody(body, ticket) : undefined;

    let sentMessage: IWhatsAppMessage;

    // ===== BAILEYS: Envia arquivo local =====
    if (channelType === "baileys") {
      logger.info(`[SendMediaUnified] Usando Baileys para envio...`);
      
      // Caminho completo do arquivo (com contact{id}/ se necessário)
      let publicPath = path.join(
        process.cwd(),
        "public",
        `company${ticket.companyId}`,
        media.filename
      );
      logger.debug(`[SendMediaUnified] Caminho primário: ${publicPath}, existe: ${fs.existsSync(publicPath)}`);
      
      // Se arquivo não existe, tentar com contact{id}/ prefixo
      if (!fs.existsSync(publicPath)) {
        publicPath = path.join(
          process.cwd(),
          "public",
          `company${ticket.companyId}`,
          `contact${contact.id}`,
          media.filename
        );
        logger.debug(`[SendMediaUnified] Caminho alternativo: ${publicPath}, existe: ${fs.existsSync(publicPath)}`);
      }

      if (!fs.existsSync(publicPath)) {
        logger.error(`[SendMediaUnified] Arquivo não encontrado em nenhum caminho`);
        throw new AppError(`Arquivo não encontrado: ${publicPath}`, 404);
      }
      logger.info(`[SendMediaUnified] Arquivo encontrado: ${publicPath}`);

      // Gerar thumbnail se for PDF
      if (media.mimetype === "application/pdf") {
        try {
          await generatePdfThumbnail(publicPath);
        } catch (thumbErr: any) {
          logger.warn(`[SendMediaUnified] Falha ao gerar thumbnail PDF (baileys): ${thumbErr?.message}`);
        }
      }

      logger.info(`[SendMediaUnified] Enviando via caminho local: ${publicPath}`);

      // Baileys aceita caminho local via Buffer (não data URI)
      sentMessage = await adapter.sendMessage({
        to: number.split("@")[0],
        mediaPath: publicPath,
        mediaType,
        caption: formattedBody,
        filename: media.originalname,
        mimetype: media.mimetype
      });
      
      logger.info(`[SendMediaUnified] Baileys - Mensagem enviada para ${number.split("@")[0]}, ID: ${(sentMessage as any)?.key?.id || sentMessage?.id || 'unknown'}`);
    } 
    // ===== OFFICIAL API: Precisa de URL pública =====
    else if (channelType === "official") {
      // Construir URL pública do arquivo
      const backendUrl = process.env.BACKEND_URL || "http://localhost:8080";
      
      // Caminhos físicos possíveis
      const rootPath = path.join(
        process.cwd(),
        "public",
        `company${ticket.companyId}`,
        media.filename
      );

      const pathWithContact = path.join(
        process.cwd(),
        "public",
        `company${ticket.companyId}`,
        `contact${contact.id}`,
        media.filename
      );

      const filePath = fs.existsSync(pathWithContact) ? pathWithContact : rootPath;

      // Tentar primeiro com contact{id}/ prefixo (formato novo)
      let mediaUrl = `${backendUrl}/public/company${ticket.companyId}/contact${contact.id}/${media.filename}`;
      
      // Se não existir na pasta contact, usar formato antigo (raiz)
      if (!fs.existsSync(pathWithContact)) {
        mediaUrl = `${backendUrl}/public/company${ticket.companyId}/${media.filename}`;
      }

      // Gerar thumbnail se for PDF
      if (media.mimetype === "application/pdf") {
        try {
          await generatePdfThumbnail(filePath);
        } catch (thumbErr: any) {
          logger.warn(`[SendMediaUnified] Falha ao gerar thumbnail PDF (official): ${thumbErr?.message}`);
        }
      }

      logger.info(`[SendMediaUnified] URL pública da mídia: ${mediaUrl}`);

      sentMessage = await adapter.sendMessage({
        to: number.split("@")[0],
        mediaUrl,
        mediaType,
        caption: formattedBody,
        filename: media.originalname
      });
      
      logger.info(`[SendMediaUnified] Official API - Mensagem enviada para ${number.split("@")[0]}, ID: ${sentMessage?.id || 'unknown'}`);
    } else {
      throw new AppError(`Tipo de canal não suportado: ${channelType}`, 400);
    }

    // Salvar mensagem no banco (para API Oficial e Baileys)
    const CreateMessageService = require("../MessageServices/CreateMessageService").default;
    
    // Extrair ID da mensagem
    let messageId: string;
    if ('id' in sentMessage) {
      messageId = sentMessage.id;
    } else if ((sentMessage as any).key?.id) {
      messageId = (sentMessage as any).key.id;
    } else {
      messageId = `${Date.now()}`;
    }
    
    // Determinar mediaType para salvar no banco
    // O frontend usa "application" para PDFs e "document" para outros documentos
    let mediaTypeDb = "document";
    if (mediaType === "image") mediaTypeDb = "image";
    else if (mediaType === "video") mediaTypeDb = "video";
    else if (mediaType === "audio") mediaTypeDb = "audio";
    else if (media.mimetype === "application/pdf") mediaTypeDb = "application";
    else if (media.mimetype.startsWith("application/")) mediaTypeDb = "application";
    
    // Salvar no banco
    await CreateMessageService({
      messageData: {
        wid: messageId,
        ticketId: ticket.id,
        contactId: ticket.contactId,
        body: formattedBody || media.originalname,
        fromMe: true,
        mediaType: mediaTypeDb,
        mediaUrl: `contact${ticket.contactId}/${media.filename}`, // Incluir contactId no caminho
        read: true,
        ack: 1,
        remoteJid: ticket.contact?.remoteJid,
      },
      companyId: ticket.companyId
    });
    
    logger.info(`[SendMediaUnified] Mensagem de mídia salva no banco: ${messageId}`);
    
    // Atualizar última mensagem do ticket
    const lastMessage = formattedBody || `📎 ${media.originalname}`;
    await ticket.update({
      lastMessage,
      imported: null
    });

    logger.info(`[SendMediaUnified] Mídia enviada com sucesso para ticket ${ticket.id}`);

    return sentMessage;

  } catch (error: any) {
    Sentry.captureException(error);
    
    // Log detalhado para debug (sem serializar data que pode ser base64)
    logger.error(`[SendMediaUnified] Erro ao enviar mídia: ${error.message}`);
    logger.error(`[SendMediaUnified] Código: ${error.code || 'N/A'}`);
    logger.error(`[SendMediaUnified] StatusCode: ${error.statusCode || 'N/A'}`);
    logger.error(`[SendMediaUnified] Stack: ${error.stack}`);
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      error.message || "ERR_SENDING_MEDIA_MSG",
      error.statusCode || 500
    );
  }
};

export default SendWhatsAppMediaUnified;
