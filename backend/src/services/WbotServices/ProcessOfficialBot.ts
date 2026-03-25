import logger from "../../utils/logger";
import path from "path";
import * as Sentry from "@sentry/node";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import Queue from "../../models/Queue";
import { handleOpenAi } from "../IntegrationsServices/OpenAiService";

interface ProcessOfficialBotParams {
  message: Message;
  ticket: Ticket;
  contact: Contact;
  whatsapp: Whatsapp;
  companyId: number;
}

/**
 * Processa bot/IA para mensagens recebidas via API Oficial do WhatsApp
 * 
 * Fluxo:
 * 1. Busca AI Agent da fila
 * 2. Chama IA (OpenAI/Gemini) via handleOpenAi
 */
export async function processOfficialBot({
  message,
  ticket,
  contact,
  whatsapp,
  companyId
}: ProcessOfficialBotParams): Promise<void> {

  try {
    logger.info(`[ProcessOfficialBot] Iniciando processamento para ticket ${ticket.id}`);

    // Buscar fila
    const queue = await Queue.findByPk(ticket.queueId);

    if (!queue) {
      logger.warn(`[ProcessOfficialBot] Fila ${ticket.queueId} não encontrada`);
      return;
    }

    // CRÍTICO: Atribuir a queue completa ao ticket para que o ActionExecutor
    // tenha acesso a folderId e fileListId
    ticket.queue = queue;

    // 🛡️ VERIFICAÇÕES DE SEGURANÇA

    // 1. Verificar status do ticket - CRÍTICO!
    // Só processar IA se ticket estiver em modo bot
    if (ticket.status !== "bot") {
      logger.info(`[ProcessOfficialBot] Ticket ${ticket.id} não está em modo bot (status=${ticket.status}) - pulando IA`);
      return;
    }

    // 2. Não processar mensagens próprias (fromMe)
    if (message.fromMe) {
      logger.info(`[ProcessOfficialBot] Mensagem fromMe - ignorando`);
      return;
    }

    // 3. Não processar grupos (política padrão - pode ser ajustado)
    if (ticket.isGroup) {
      logger.info(`[ProcessOfficialBot] Ticket ${ticket.id} é grupo - não processa IA`);
      return;
    }

    // 4. Respeitar desativação do bot por contato
    try {
      const contact = await Contact.findByPk(ticket.contactId);
      if ((contact as any)?.disableBot) {
        logger.info(`[ProcessOfficialBot] Contato ${ticket.contactId} com bot desabilitado - pulando IA`);
        return;
      }
    } catch (e) {
      // silencioso
    }

    // AI Agent tem PRIORIDADE TOTAL (sistema antigo de Prompt foi removido)
    logger.info(`[ProcessOfficialBot] Processando com AI Agent - sem prompt legado`);

    // Chamar IA (handleOpenAi) - aiConfig undefined = AI Agent tem prioridade
    const aiConfig = undefined;

    // Chamar IA (handleOpenAi)
    // NOTA: handleOpenAi foi feito para Baileys (proto.IWebMessageInfo e wbot: Session)
    // Precisamos adaptar para API Oficial ou criar versão específica

    // Por enquanto, vamos criar uma mensagem mock no formato Baileys para usar handleOpenAi
    // Detectar tipo de mídia e construir mensagem apropriada
    let mockMessageContent: any = {};
    
    if (message.mediaType === "audio" && message.mediaUrl) {
      // Áudio: passar como audioMessage para que handleOpenAi processe transcrição
      logger.info(`[ProcessOfficialBot] Mensagem de áudio detectada: ${message.mediaUrl}`);
      mockMessageContent = {
        audioMessage: {
          url: message.mediaUrl,
          mimetype: "audio/ogg",
          // Marcar que já foi baixado (mediaUrl é o caminho local)
          _localPath: message.mediaUrl
        }
      };
    } else if (message.mediaType === "image" && message.mediaUrl) {
      mockMessageContent = {
        imageMessage: {
          url: message.mediaUrl,
          caption: message.body || ""
        }
      };
    } else if (message.mediaType === "video" && message.mediaUrl) {
      mockMessageContent = {
        videoMessage: {
          url: message.mediaUrl,
          caption: message.body || ""
        }
      };
    } else if (message.mediaType === "document" && message.mediaUrl) {
      mockMessageContent = {
        documentMessage: {
          url: message.mediaUrl,
          fileName: message.body || "documento",
          caption: message.body || ""
        }
      };
    } else {
      // Texto normal
      mockMessageContent = {
        conversation: message.body
      };
    }
    
    const mockBaileysMessage = {
      key: {
        remoteJid: `${contact.number}@s.whatsapp.net`,
        fromMe: false,
        id: message.wid
      },
      message: mockMessageContent,
      messageTimestamp: Math.floor(new Date().getTime() / 1000)
    };

    // Mock do wbot (Session) para API Oficial
    const mockWbot = {
      id: whatsapp.id,
      channelType: "official",
      isOfficial: true,
      sendMessage: async (jid: string, content: any) => {
        logger.info(`[ProcessOfficialBot] Enviando resposta do bot para ${jid}`, { contentType: Object.keys(content) });

        try {
          // Usar adapter correto (Official ou Baileys)
          const { GetTicketAdapter } = await import("../../helpers/GetWhatsAppAdapter");
          const adapter = await GetTicketAdapter(ticket);

          // Extrair número do JID (remove @s.whatsapp.net)
          const to = jid.split("@")[0];

          let sentMessage: any;
          let messageBody = "";
          let mediaType = "conversation";

          // Verificar tipo de conteúdo
          let mediaUrl: string | null = null;

          if (content.document) {
            // ENVIAR DOCUMENTO (PDF, Excel, etc)
            logger.info(`[ProcessOfficialBot] Enviando documento: ${content.fileName}`);

            const fs = await import("fs");
            const fileBuffer = content.document instanceof Buffer
              ? content.document
              : fs.readFileSync(content.document);

            sentMessage = await adapter.sendDocumentMessage(
              to,
              fileBuffer,
              content.fileName || "documento.pdf",
              content.mimetype || "application/pdf"
            );

            messageBody = content.fileName || "documento.pdf";
            mediaType = "document";
            
            // Construir mediaUrl RELATIVO (formato: contact123/arquivo.pdf)
            // O getter do modelo Message já adiciona company{id}/ automaticamente
            if (typeof content.document === "string") {
              const normalized = path.normalize(content.document);
              // Extrair caminho relativo após /public/company{id}/
              // Ex: /public/company1/contact123/arquivo.pdf → contact123/arquivo.pdf
              const publicMatch = normalized.match(/public[\/\\]company\d+[\/\\](.+)$/i);
              if (publicMatch && publicMatch[1]) {
                // Caminho relativo SEM company: contact123/arquivo.pdf
                mediaUrl = publicMatch[1].replace(/\\/g, "/");
                logger.info(`[ProcessOfficialBot] mediaUrl relativo (sem company): ${mediaUrl}`);
              } else {
                // Fallback: tentar extrair após /public/ e remover company manualmente
                const fallbackMatch = normalized.match(/public[\/\\](.+)$/i);
                if (fallbackMatch && fallbackMatch[1]) {
                  let relativePath = fallbackMatch[1].replace(/\\/g, "/");
                  // Remover company{id}/ se presente
                  relativePath = relativePath.replace(/^company\d+\//i, "");
                  mediaUrl = relativePath;
                  logger.info(`[ProcessOfficialBot] mediaUrl relativo (fallback): ${mediaUrl}`);
                }
              }
            }

            // Caso já venha um mediaUrl no conteúdo, priorizar
            if (!mediaUrl && content.mediaUrl) {
              mediaUrl = content.mediaUrl;
            }

            logger.info(`[ProcessOfficialBot] Documento enviado: ${sentMessage.id}, mediaUrl: ${mediaUrl || 'N/A'}`);

          } else if (content.text) {
            // ENVIAR TEXTO - Remover espaços extras e caracteres especiais
            messageBody = content.text
              .replace(/\u200e/g, '') // Remove LEFT-TO-RIGHT MARK
              .replace(/\u200f/g, '') // Remove RIGHT-TO-LEFT MARK  
              .trim();
            sentMessage = await adapter.sendTextMessage(to, messageBody);
            mediaType = "conversation";

            logger.info(`[ProcessOfficialBot] Texto enviado: ${sentMessage.id}`);
          } else {
            logger.warn(`[ProcessOfficialBot] Tipo de conteúdo desconhecido:`, Object.keys(content));
            return;
          }

          // Salvar mensagem no banco (apenas para API Oficial)
          if (adapter.channelType === "official" && sentMessage) {
            const CreateMessageService = (await import("../MessageServices/CreateMessageService")).default;
            await CreateMessageService({
              messageData: {
                wid: sentMessage.id,
                ticketId: ticket.id,
                contactId: ticket.contactId,
                body: messageBody,
                fromMe: true,
                read: true,
                ack: 1,
                mediaType,
                mediaUrl: mediaUrl || undefined
              },
              companyId
            });

            logger.info(`[ProcessOfficialBot] Mensagem do bot salva no banco: ${sentMessage.id}`);
          }

          // Atualizar última mensagem do ticket
          await ticket.update({
            lastMessage: messageBody,
            imported: null
          });

        } catch (error: any) {
          logger.error(`[ProcessOfficialBot] Erro ao enviar mensagem: ${error.message}`);
          throw error;
        }
      },
      // ADICIONAR MÉTODO sendDocumentMessage para ActionExecutor
      // Aceita filePath opcional como 5º parâmetro para construir mediaUrl
      sendDocumentMessage: async (recipient: string, fileBuffer: Buffer, fileName: string, mimeType: string, filePath?: string) => {
        logger.info(`[ProcessOfficialBot] sendDocumentMessage chamado diretamente:`, { recipient, fileName, mimeType, filePath: filePath || 'N/A' });

        try {
          const { GetTicketAdapter } = await import("../../helpers/GetWhatsAppAdapter");
          const adapter = await GetTicketAdapter(ticket);

          // Remover @s.whatsapp.net se presente
          const to = recipient.replace("@s.whatsapp.net", "").replace(/\D/g, "");

          const sentMessage = await adapter.sendDocumentMessage(
            to,
            fileBuffer,
            fileName,
            mimeType
          );

          logger.info(`[ProcessOfficialBot] Documento enviado via sendDocumentMessage: ${sentMessage.id}`);

          // Construir mediaUrl relativo se filePath foi fornecido
          // Formato esperado: contact123/arquivo.pdf (SEM company{id}/)
          // O getter do modelo Message já adiciona company{id}/ automaticamente
          let mediaUrl: string | undefined;
          if (filePath) {
            const normalized = path.normalize(filePath);
            // Extrair caminho relativo após /public/company{id}/
            const publicMatch = normalized.match(/public[\/\\]company\d+[\/\\](.+)$/i);
            if (publicMatch && publicMatch[1]) {
              mediaUrl = publicMatch[1].replace(/\\/g, "/");
              logger.info(`[ProcessOfficialBot] mediaUrl construído (sem company): ${mediaUrl}`);
            } else {
              // Fallback: tentar extrair após /public/ e remover company manualmente
              const fallbackMatch = normalized.match(/public[\/\\](.+)$/i);
              if (fallbackMatch && fallbackMatch[1]) {
                let relativePath = fallbackMatch[1].replace(/\\/g, "/");
                relativePath = relativePath.replace(/^company\d+\//i, "");
                mediaUrl = relativePath;
                logger.info(`[ProcessOfficialBot] mediaUrl construído (fallback): ${mediaUrl}`);
              }
            }
          }

          // Salvar mensagem no banco
          if (adapter.channelType === "official" && sentMessage) {
            const CreateMessageService = (await import("../MessageServices/CreateMessageService")).default;
            await CreateMessageService({
              messageData: {
                wid: sentMessage.id,
                ticketId: ticket.id,
                contactId: ticket.contactId,
                body: fileName,
                fromMe: true,
                read: true,
                ack: 1,
                mediaType: "document",
                mediaUrl: mediaUrl || undefined
              },
              companyId
            });

            logger.info(`[ProcessOfficialBot] Documento salvo no banco: ${sentMessage.id}, mediaUrl: ${mediaUrl || 'N/A'}`);
          }

          // Atualizar última mensagem do ticket
          await ticket.update({
            lastMessage: fileName,
            imported: null
          });

          return sentMessage;

        } catch (error: any) {
          logger.error(`[ProcessOfficialBot] Erro ao enviar documento: ${error.message}`);
          throw error;
        }
      },
      
      // MÉTODO sendImageMessage para ActionExecutor
      sendImageMessage: async (recipient: string, fileBuffer: Buffer, fileName: string, filePath?: string) => {
        logger.info(`[ProcessOfficialBot] sendImageMessage chamado:`, { recipient, fileName, filePath: filePath || 'N/A' });

        try {
          const { GetTicketAdapter } = await import("../../helpers/GetWhatsAppAdapter");
          const adapter = await GetTicketAdapter(ticket);
          const to = recipient.replace("@s.whatsapp.net", "").replace(/\D/g, "");

          // Enviar imagem via adapter (usando método específico para Buffer)
          const sentMessage = await adapter.sendImageMessage(to, fileBuffer, fileName);

          logger.info(`[ProcessOfficialBot] Imagem enviada: ${sentMessage?.id || 'N/A'}`);

          // Construir mediaUrl relativo
          let mediaUrl: string | undefined;
          if (filePath) {
            const normalized = path.normalize(filePath);
            const publicMatch = normalized.match(/public[\/\\]company\d+[\/\\](.+)$/i);
            if (publicMatch && publicMatch[1]) {
              mediaUrl = publicMatch[1].replace(/\\/g, "/");
            } else {
              const fallbackMatch = normalized.match(/public[\/\\](.+)$/i);
              if (fallbackMatch && fallbackMatch[1]) {
                mediaUrl = fallbackMatch[1].replace(/\\/g, "/").replace(/^company\d+\//i, "");
              }
            }
          }

          // Salvar mensagem no banco
          if (adapter.channelType === "official" && sentMessage) {
            const CreateMessageService = (await import("../MessageServices/CreateMessageService")).default;
            await CreateMessageService({
              messageData: {
                wid: sentMessage.id,
                ticketId: ticket.id,
                contactId: ticket.contactId,
                body: fileName,
                fromMe: true,
                read: true,
                ack: 1,
                mediaType: "image",
                mediaUrl: mediaUrl || undefined
              },
              companyId
            });
            logger.info(`[ProcessOfficialBot] Imagem salva no banco: ${sentMessage.id}, mediaUrl: ${mediaUrl || 'N/A'}`);
          }

          await ticket.update({ lastMessage: `📷 ${fileName}`, imported: null });
          return sentMessage;

        } catch (error: any) {
          logger.error(`[ProcessOfficialBot] Erro ao enviar imagem: ${error.message}`);
          throw error;
        }
      },

      // MÉTODO sendVideoMessage para ActionExecutor
      sendVideoMessage: async (recipient: string, fileBuffer: Buffer, fileName: string, filePath?: string) => {
        logger.info(`[ProcessOfficialBot] sendVideoMessage chamado:`, { recipient, fileName, filePath: filePath || 'N/A' });

        try {
          const { GetTicketAdapter } = await import("../../helpers/GetWhatsAppAdapter");
          const adapter = await GetTicketAdapter(ticket);
          const to = recipient.replace("@s.whatsapp.net", "").replace(/\D/g, "");

          // Enviar vídeo via adapter (usando método específico para Buffer)
          const sentMessage = await adapter.sendVideoMessage(to, fileBuffer, fileName);

          logger.info(`[ProcessOfficialBot] Vídeo enviado: ${sentMessage?.id || 'N/A'}`);

          // Construir mediaUrl relativo
          let mediaUrl: string | undefined;
          if (filePath) {
            const normalized = path.normalize(filePath);
            const publicMatch = normalized.match(/public[\/\\]company\d+[\/\\](.+)$/i);
            if (publicMatch && publicMatch[1]) {
              mediaUrl = publicMatch[1].replace(/\\/g, "/");
            } else {
              const fallbackMatch = normalized.match(/public[\/\\](.+)$/i);
              if (fallbackMatch && fallbackMatch[1]) {
                mediaUrl = fallbackMatch[1].replace(/\\/g, "/").replace(/^company\d+\//i, "");
              }
            }
          }

          // Salvar mensagem no banco
          if (adapter.channelType === "official" && sentMessage) {
            const CreateMessageService = (await import("../MessageServices/CreateMessageService")).default;
            await CreateMessageService({
              messageData: {
                wid: sentMessage.id,
                ticketId: ticket.id,
                contactId: ticket.contactId,
                body: fileName,
                fromMe: true,
                read: true,
                ack: 1,
                mediaType: "video",
                mediaUrl: mediaUrl || undefined
              },
              companyId
            });
            logger.info(`[ProcessOfficialBot] Vídeo salvo no banco: ${sentMessage.id}, mediaUrl: ${mediaUrl || 'N/A'}`);
          }

          await ticket.update({ lastMessage: `🎬 ${fileName}`, imported: null });
          return sentMessage;

        } catch (error: any) {
          logger.error(`[ProcessOfficialBot] Erro ao enviar vídeo: ${error.message}`);
          throw error;
        }
      },

      // MÉTODO sendAudioMessage para ActionExecutor
      sendAudioMessage: async (recipient: string, fileBuffer: Buffer, fileName: string, filePath?: string) => {
        logger.info(`[ProcessOfficialBot] sendAudioMessage chamado:`, { recipient, fileName, filePath: filePath || 'N/A' });

        try {
          const { GetTicketAdapter } = await import("../../helpers/GetWhatsAppAdapter");
          const adapter = await GetTicketAdapter(ticket);
          const to = recipient.replace("@s.whatsapp.net", "").replace(/\D/g, "");

          // Enviar áudio via adapter (usando método específico para Buffer)
          const sentMessage = await adapter.sendAudioMessage(to, fileBuffer, fileName);

          logger.info(`[ProcessOfficialBot] Áudio enviado: ${sentMessage?.id || 'N/A'}`);

          // Construir mediaUrl relativo
          let mediaUrl: string | undefined;
          if (filePath) {
            const normalized = path.normalize(filePath);
            const publicMatch = normalized.match(/public[\/\\]company\d+[\/\\](.+)$/i);
            if (publicMatch && publicMatch[1]) {
              mediaUrl = publicMatch[1].replace(/\\/g, "/");
            } else {
              const fallbackMatch = normalized.match(/public[\/\\](.+)$/i);
              if (fallbackMatch && fallbackMatch[1]) {
                mediaUrl = fallbackMatch[1].replace(/\\/g, "/").replace(/^company\d+\//i, "");
              }
            }
          }

          // Salvar mensagem no banco
          if (adapter.channelType === "official" && sentMessage) {
            const CreateMessageService = (await import("../MessageServices/CreateMessageService")).default;
            await CreateMessageService({
              messageData: {
                wid: sentMessage.id,
                ticketId: ticket.id,
                contactId: ticket.contactId,
                body: fileName,
                fromMe: true,
                read: true,
                ack: 1,
                mediaType: "audio",
                mediaUrl: mediaUrl || undefined
              },
              companyId
            });
            logger.info(`[ProcessOfficialBot] Áudio salvo no banco: ${sentMessage.id}, mediaUrl: ${mediaUrl || 'N/A'}`);
          }

          await ticket.update({ lastMessage: `🎵 ${fileName}`, imported: null });
          return sentMessage;

        } catch (error: any) {
          logger.error(`[ProcessOfficialBot] Erro ao enviar áudio: ${error.message}`);
          throw error;
        }
      }
    } as any;

    // Chamar handleOpenAi
    try {
      await handleOpenAi(
        aiConfig,
        mockBaileysMessage as any,
        mockWbot,
        ticket,
        contact,
        message,
        null // ticketTraking
      );

      logger.info(`[ProcessOfficialBot] Processamento IA concluído para ticket ${ticket.id}`);

    } catch (aiError: any) {
      logger.error(`[ProcessOfficialBot] Erro ao processar IA: ${aiError.message}`);
      // Fallback (mensagem de desculpas) já é tratado dentro de handleOpenAi
      Sentry.captureException(aiError);
    }

    logger.info(`[ProcessOfficialBot] Processamento concluído para ticket ${ticket.id}`);

  } catch (error: any) {
    logger.error(`[ProcessOfficialBot] Erro crítico: ${error.message}`);
    Sentry.captureException(error);
    throw error;
  }
}
