import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";

export interface GetSessionWindowParams {
  whatsappId: number;
  contactId: number;
  companyId: number;
}

export interface SessionWindowResult {
  hasOpenSession: boolean;
  lastUserMessageAt: Date | null;
  diffHours: number | null;
}

const HOURS_WINDOW = 24;

export const GetSessionWindow = async ({
  whatsappId,
  contactId,
  companyId
}: GetSessionWindowParams): Promise<SessionWindowResult> => {
  try {
    logger.info(
      `[GetSessionWindow] Verificando janela para whatsappId=${whatsappId}, contactId=${contactId}, companyId=${companyId}`
    );

    const whatsapp = await Whatsapp.findOne({
      where: { id: whatsappId, companyId }
    });

    if (!whatsapp) {
      throw new Error("WhatsApp não encontrado");
    }

    // Para conexões que não são API Oficial, não aplicamos regra de 24h aqui
    if (whatsapp.channelType !== "official") {
      logger.info(
        `[GetSessionWindow] Conexão ${whatsappId} não é API Oficial (channelType=${whatsapp.channelType}). Considerando janela aberta.`
      );
      return {
        hasOpenSession: true,
        lastUserMessageAt: null,
        diffHours: null
      };
    }

    const lastInbound = await Message.findOne({
      where: {
        contactId,
        companyId,
        fromMe: false
      },
      include: [
        {
          model: Ticket,
          as: "ticket",
          where: { whatsappId: whatsapp.id },
          attributes: []
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    if (!lastInbound) {
      logger.info(
        `[GetSessionWindow] Nenhuma mensagem de cliente encontrada para contactId=${contactId}, whatsappId=${whatsappId}`
      );
      return {
        hasOpenSession: false,
        lastUserMessageAt: null,
        diffHours: null
      };
    }

    const now = Date.now();
    const last = new Date(lastInbound.createdAt).getTime();
    const diffMs = Math.max(0, now - last);
    const diffHours = diffMs / (1000 * 60 * 60);
    const hasOpenSession = diffHours < HOURS_WINDOW;

    logger.info(
      `[GetSessionWindow] contactId=${contactId}, whatsappId=${whatsappId}, diffHours=${diffHours.toFixed(
        2
      )}, hasOpenSession=${hasOpenSession}`
    );

    return {
      hasOpenSession,
      lastUserMessageAt: lastInbound.createdAt,
      diffHours
    };
  } catch (error: any) {
    logger.error("[GetSessionWindow] Erro ao verificar janela de sessão", {
      message: error.message
    });
    throw error;
  }
};

export default GetSessionWindow;
