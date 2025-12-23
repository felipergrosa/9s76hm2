import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import AppError from "../../errors/AppError";
import ResolveAIAgentForTicketService from "../AIAgentServices/ResolveAIAgentForTicketService";
import ResolveAIIntegrationService from "../IA/ResolveAIIntegrationService";
import IAClientFactory from "../IA/IAClientFactory";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import logger from "../../utils/logger";
import { getIO } from "../../libs/socket";
import { setTimeout } from "timers/promises";

interface SendAIResponseRequest {
  ticketId: number;
  aiAgentId?: number;
  companyId: number;
}

interface AIResponseResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Service para enviar resposta automática usando IA para um ticket
 * Utilizado no processamento em massa de tickets
 */
const SendAIResponseService = async ({
  ticketId,
  aiAgentId,
  companyId
}: SendAIResponseRequest): Promise<AIResponseResult> => {
  try {
    // Buscar ticket com relacionamentos necessários
    const ticket = await Ticket.findOne({
      where: { id: ticketId, companyId },
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: ["id", "name", "number", "profilePicUrl", "email"]
        }
      ]
    });

    if (!ticket) {
      throw new AppError("Ticket não encontrado", 404);
    }

    // Resolver configuração do AI Agent para o ticket
    const agentConfig = await ResolveAIAgentForTicketService({ ticket });

    if (!agentConfig) {
      logger.warn(`[SendAIResponse] No AI Agent configured for ticket ${ticketId}`);
      return {
        success: false,
        error: "Nenhum agente IA configurado para este ticket"
      };
    }

    logger.info(`[SendAIResponse] Using AI Agent "${agentConfig.agent.name}" for ticket ${ticketId}`);

    // Buscar histórico de mensagens do ticket (últimas 10)
    const pastMessages = await Message.findAll({
      where: { ticketId: ticket.id },
      order: [["createdAt", "DESC"]],
      limit: 10
    });

    // Inverter para ordem cronológica
    pastMessages.reverse();

    // Preparar contexto para a IA
    const messagesForAI = pastMessages
      .filter(msg => msg.mediaType === "conversation" || msg.mediaType === "extendedTextMessage")
      .map(msg => ({
        role: msg.fromMe ? "assistant" : "user",
        content: msg.body.replace(/\u200e/g, '').replace(/\u200f/g, '').trim()
      }));

    // Anti bot-bot: checar histórico mínimo
    const lastUserMessage = [...messagesForAI].reverse().find(m => m.role === "user");
    if (agentConfig.agent.requireHistoryForAI && messagesForAI.length === 0) {
      logger.warn(`[SendAIResponse] Bloqueado por requireHistoryForAI (ticket ${ticketId})`);
      return { success: false, error: "Aguardando histórico humano antes de o bot responder." };
    }

    // Anti bot-bot: detectar traços de bot no último user
    if (agentConfig.agent.antiBotTraitsRegex && lastUserMessage?.content) {
      try {
        const regex = new RegExp(agentConfig.agent.antiBotTraitsRegex, "i");
        if (regex.test(lastUserMessage.content)) {
          logger.warn(`[SendAIResponse] Mensagem suspeita de bot (ticket ${ticketId}) bloqueada`);
          return { success: false, error: "Mensagem suspeita de bot detectada; intervenção humana necessária." };
        }
      } catch (e) {
        logger.error("[SendAIResponse] Regex inválida em antiBotTraitsRegex", e);
      }
    }

    // Anti bot-bot: limitar loop de respostas seguidas do assistente
    if (agentConfig.agent.maxBotLoopMessages && agentConfig.agent.maxBotLoopMessages > 0) {
      let consecutiveAssistant = 0;
      for (let i = messagesForAI.length - 1; i >= 0; i--) {
        if (messagesForAI[i].role === "assistant") consecutiveAssistant += 1;
        else break;
      }
      if (consecutiveAssistant >= agentConfig.agent.maxBotLoopMessages) {
        logger.warn(`[SendAIResponse] Bloqueado por maxBotLoopMessages (${consecutiveAssistant}) ticket ${ticketId}`);
        return { success: false, error: "Limite de respostas automáticas atingido; peça ajuda humana." };
      }
    }

    // Adicionar prompt do sistema
    const systemPrompt = agentConfig.systemPrompt || "Você é um assistente virtual prestativo.";
    
    // Resolver integração (API key + provedor)
    const resolvedIntegration = await ResolveAIIntegrationService({
      companyId,
      queueId: ticket.queueId as any,
      whatsappId: (ticket as any)?.whatsappId,
      preferProvider: agentConfig.agent.aiProvider || undefined
    });

    if (!resolvedIntegration?.config?.apiKey) {
      throw new AppError("Nenhuma integração de IA configurada para este ticket", 400);
    }

    // Obter cliente IA
    const iaClient = IAClientFactory(
      resolvedIntegration.provider,
      resolvedIntegration.config.apiKey
    );

    // Preparar mensagens para a IA
    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messagesForAI
    ];

    // Se não houver mensagens do usuário, adicionar uma genérica
    if (messagesForAI.length === 0 || messagesForAI[messagesForAI.length - 1].role !== "user") {
      aiMessages.push({
        role: "user",
        content: "Olá"
      });
    }

    logger.info(`[SendAIResponse] Generating AI response for ticket ${ticketId} with ${aiMessages.length} messages`);

    // Gerar resposta da IA
    const aiResponse = await (iaClient as any).chat.completions.create({
      model: agentConfig.agent.aiModel || resolvedIntegration.config.model || "gpt-4o-mini",
      messages: aiMessages as any,
      temperature: agentConfig.agent.temperature ?? resolvedIntegration.config.temperature ?? 0.7,
      max_tokens: agentConfig.agent.maxTokens ?? resolvedIntegration.config.maxTokens ?? 500
    });

    const responseText = aiResponse.choices[0]?.message?.content;

    if (!responseText) {
      logger.error(`[SendAIResponse] No response generated for ticket ${ticketId}`);
      return {
        success: false,
        error: "IA não gerou resposta"
      };
    }

    logger.info(`[SendAIResponse] AI response generated: "${responseText.substring(0, 100)}..."`);

    // Delay inicial anti bot-bot com jitter
    if (agentConfig.agent.startDelayEnabled) {
      const base = Number(agentConfig.agent.startDelaySeconds || 0);
      const jitter = Number(agentConfig.agent.startDelayJitterSeconds || 0);
      const offset = jitter > 0 ? (Math.floor(Math.random() * (2 * jitter + 1)) - jitter) : 0;
      const delayMs = Math.max(0, (base + offset)) * 1000;
      if (delayMs > 0) {
        logger.info(`[SendAIResponse] Aplicando delay inicial de ${delayMs} ms (base ${base}s, jitter ${offset}s)`);
        await setTimeout(delayMs);
      }
    }

    // Enviar mensagem pelo WhatsApp (cria no banco e envia de verdade)
    try {
      await SendWhatsAppMessage({
        body: responseText,
        ticket
      });
      
      logger.info(`[SendAIResponse] AI response sent successfully via WhatsApp for ticket ${ticketId}`);
    } catch (sendError: any) {
      logger.error(`[SendAIResponse] Error sending WhatsApp message for ticket ${ticketId}:`, sendError);
      
      // Se falhar ao enviar, criar mensagem no banco mesmo assim
      const newMessage = await Message.create({
        body: responseText,
        ticketId: ticket.id,
        contactId: ticket.contactId,
        fromMe: true,
        read: true,
        mediaType: "chat",
        quotedMsgId: null,
        ack: 0, // Falha no envio
        isPrivate: false,
        companyId
      });

      // Emitir evento via Socket.IO
      const io = getIO();
      io.of(String(companyId))
        .to(String(ticketId))
        .to(`company-${companyId}-mainchannel`)
        .emit(`company-${companyId}-appMessage`, {
          action: "create",
          message: newMessage,
          ticket,
          contact: ticket.contact
        });

      throw sendError;
    }

    return {
      success: true,
      message: responseText
    };

  } catch (error: any) {
    logger.error(`[SendAIResponse] Error sending AI response for ticket ${ticketId}:`, error);
    return {
      success: false,
      error: error.message || "Erro ao gerar resposta com IA"
    };
  }
};

export default SendAIResponseService;
