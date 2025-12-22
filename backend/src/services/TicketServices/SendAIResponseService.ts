import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import AppError from "../../errors/AppError";
import ResolveAIAgentForTicketService from "../AIAgentServices/ResolveAIAgentForTicketService";
import ResolveAIIntegrationService from "../IA/ResolveAIIntegrationService";
import IAClientFactory from "../IA/IAClientFactory";
import logger from "../../utils/logger";
import { getIO } from "../../libs/socket";

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

    // Criar mensagem no banco de dados
    const newMessage = await Message.create({
      body: responseText,
      ticketId: ticket.id,
      contactId: ticket.contactId,
      fromMe: true,
      read: true,
      mediaType: "chat",
      quotedMsgId: null,
      ack: 2, // Enviada
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

    logger.info(`[SendAIResponse] AI response sent successfully for ticket ${ticketId}`);

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
