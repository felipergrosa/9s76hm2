import ListWhatsAppsService from "../WhatsappService/ListWhatsAppsService";
import { StartWhatsAppSessionUnified } from "./StartWhatsAppSessionUnified";
import * as Sentry from "@sentry/node";
import logger from "../../utils/logger";

export const StartAllWhatsAppsSessions = async (
  companyId: number
): Promise<void> => {
  try {
    const whatsapps = await ListWhatsAppsService({ companyId });
    if (whatsapps.length > 0) {
      const promises = whatsapps.map(async (whatsapp) => {
        const isWhatsAppChannel = whatsapp.channel === "whatsapp" || !whatsapp.channel;
        const isOfficial = whatsapp.channelType === "official";
        // API oficial é stateless (não depende de QR/sessão Baileys): uma falha
        // transitória de inicialização marcava a conexão como DISCONNECTED e ela
        // nunca mais era reiniciada. Com credenciais presentes, sempre tentar
        // subir — se o token estiver inválido, initialize() falha e o status
        // volta a DISCONNECTED corretamente.
        const officialRecoverable =
          isOfficial && !!(whatsapp.wabaPhoneNumberId && whatsapp.wabaAccessToken);

        if (
          isWhatsAppChannel &&
          (whatsapp.status !== "DISCONNECTED" || officialRecoverable)
        ) {
          return StartWhatsAppSessionUnified(whatsapp, companyId);
        }
      });
      // Aguardar a resolução de todas as promessas
      await Promise.all(promises);
    }

    // fechar os tickets automaticamente
    // if (whatsapps.length > 0) {
    //   whatsapps.forEach(whatsapp => {
    //     const timeClosed = whatsapp.expiresTicket ? (((whatsapp.expiresTicket * 60) * 60) * 1000) : 500000;
    //     setInterval(() => {
    //       ClosedAllOpenTickets();
    //     }, timeClosed);
    //   });
    // }

  } catch (e: any) {
    logger.error(`[StartAllWhatsAppsSessions] Erro ao iniciar sessões da empresa ${companyId}: ${e?.message || e}`);
    logger.error(`[StartAllWhatsAppsSessions] Stack: ${e?.stack}`);
    Sentry.captureException(e);
  }
};
