import logger from "../../utils/logger";
import * as Sentry from "@sentry/node";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import Prompt from "../../models/Prompt";
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
 * 1. Busca prompt da fila
 * 2. Se tem prompt, chama IA (OpenAI/Gemini)
 * 3. Se não tem prompt mas tem chatbot, ignora (já foi processado)
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

    // Buscar fila com prompt
    const queue = await Queue.findByPk(ticket.queueId, {
      include: [
        {
          model: Prompt,
          as: "prompt",
          where: { companyId },
          required: false
        }
      ]
    });

    if (!queue) {
      logger.warn(`[ProcessOfficialBot] Fila ${ticket.queueId} não encontrada`);
      return;
    }

    // CRÍTICO: Atribuir a queue completa ao ticket para que o ActionExecutor
    // tenha acesso a folderId e fileListId
    ticket.queue = queue;

    // 🛡️ VERIFICAÇÕES DE SEGURANÇA (Legacy Validations)

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

    // Verificar se fila tem prompt (sistema legado - BAIXA PRIORIDADE)
    const prompts = queue.prompt;
    let prompt = null;

    if (prompts && prompts.length > 0) {
      prompt = prompts[0];
      logger.info(`[ProcessOfficialBot] Prompt legado encontrado: "${prompt.name}" (ID: ${prompt.id})`);
    } else {
      logger.info(`[ProcessOfficialBot] Sem prompt legado - AI Agent terá prioridade total`);
    }

    // IMPORTANTE: Se NÃO houver Prompt, passar undefined para openAiSettings
    // Isso força o handleOpenAi a usar APENAS o AI Agent (PRIORITY 1)
    // Se houver Prompt, usar como fallback
    const aiConfig = prompt ? {
      name: prompt.name,
      prompt: prompt.prompt,
      voice: prompt.voice || "",
      voiceKey: prompt.voiceKey || "",
      voiceRegion: prompt.voiceRegion || "",
      maxTokens: Number(prompt.maxTokens) || 500,
      temperature: Number(prompt.temperature) || 0.7,
      apiKey: prompt.apiKey || "",
      queueId: prompt.queueId,
      maxMessages: Number(prompt.maxMessages) || 10,
      model: prompt.model || "gpt-3.5-turbo-1106"
    } : undefined; // undefined = AI Agent tem PRIORIDADE TOTAL

    if (aiConfig) {
      logger.info(`[ProcessOfficialBot] Config Prompt (fallback): modelo=${aiConfig.model}`);
    } else {
      logger.info(`[ProcessOfficialBot] Sem Prompt - AI Agent terá 100% prioridade`);
    }

    // Chamar IA (handleOpenAi)
    // NOTA: handleOpenAi foi feito para Baileys (proto.IWebMessageInfo e wbot: Session)
    // Precisamos adaptar para API Oficial ou criar versão específica

    // Por enquanto, vamos criar uma mensagem mock no formato Baileys para usar handleOpenAi
    const mockBaileysMessage = {
      key: {
        remoteJid: `${contact.number}@s.whatsapp.net`,
        fromMe: false,
        id: message.wid
      },
      message: {
        conversation: message.body
      },
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

            logger.info(`[ProcessOfficialBot] Documento enviado: ${sentMessage.id}`);

          } else if (content.text) {
            // ENVIAR TEXTO
            messageBody = content.text;
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
                mediaType
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
