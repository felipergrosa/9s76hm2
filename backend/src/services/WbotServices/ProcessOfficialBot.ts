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

    // Verificar se fila tem prompt
    const prompts = queue.prompt;
    if (!prompts || prompts.length === 0) {
      logger.info(`[ProcessOfficialBot] Fila ${queue.name} não tem prompt configurado`);
      return;
    }

    const prompt = prompts[0];
    logger.info(`[ProcessOfficialBot] Usando prompt "${prompt.name}" (ID: ${prompt.id})`);

    // Montar configurações de IA a partir do Prompt
    const aiConfig = {
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
    };

    logger.info(`[ProcessOfficialBot] Config IA: modelo=${aiConfig.model}, maxTokens=${aiConfig.maxTokens}, temp=${aiConfig.temperature}`);

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
      sendMessage: async (jid: string, content: any) => {
        logger.info(`[ProcessOfficialBot] Enviando resposta do bot para ${jid}`);
        
        // Importar serviço de envio unificado
        const SendWhatsAppMessage = (await import("./SendWhatsAppMessage")).default;
        await SendWhatsAppMessage({
          body: content.text || "",
          ticket,
          quotedMsg: undefined
        });
      }
    } as any;

    // Chamar handleOpenAi
    await handleOpenAi(
      aiConfig,
      mockBaileysMessage as any,
      mockWbot,
      ticket,
      contact,
      message,
      null // ticketTraking
    );

    logger.info(`[ProcessOfficialBot] Processamento concluído para ticket ${ticket.id}`);

  } catch (error: any) {
    logger.error(`[ProcessOfficialBot] Erro: ${error.message}`);
    Sentry.captureException(error);
    throw error;
  }
}
