import { initWASocket, getWbotIsReconnecting, getWbotSessionExists } from "../../libs/wbot";
import { acquireWbotLock, renewWbotLock, releaseWbotLock } from "../../libs/wbotMutex";
import { WhatsAppFactory } from "../../libs/whatsapp";
import Whatsapp from "../../models/Whatsapp";
import wbotMessageListener from "./wbotMessageListener";
import { getIO } from "../../libs/socket";
import wbotMonitor from "./wbotMonitor";
import logger from "../../utils/logger";
import * as Sentry from "@sentry/node";

/**
 * Inicia sessão WhatsApp usando adapters (Baileys ou Official API)
 * Versão unificada que detecta automaticamente o tipo de canal
 */
export const StartWhatsAppSessionUnified = async (
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  const channelType = whatsapp.channelType || "baileys";

  // PROTEÇÃO: Evitar inicialização duplicada
  if (getWbotIsReconnecting(whatsapp.id)) {
    logger.warn(`[StartSession] whatsappId=${whatsapp.id} já está sendo iniciado/reconectado. Ignorando chamada duplicada.`);
    return;
  }

  // PROTEÇÃO: Verificar se sessão já está ativa
  if (getWbotSessionExists(whatsapp.id)) {
    logger.warn(`[StartSession] whatsappId=${whatsapp.id} já está conectado. Ignorando chamada duplicada.`);
    return;
  }

  logger.info(`[StartSession] Iniciando ${channelType} para whatsappId=${whatsapp.id}`);


  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-whatsappSession`, {
      action: "update",
      session: whatsapp
    });

  try {
    if (channelType === "baileys") {
      // ===== BAILEYS (não oficial) =====
      logger.info(`[StartSession] Usando Baileys para whatsappId=${whatsapp.id}`);

      // NOTA: Lock simplificado para single-instance - sempre retorna true
      // A flag reconnectingWhatsapps em wbot.ts previne reconexões duplicadas
      await acquireWbotLock(whatsapp.id, "StartWhatsAppSessionUnified-Baileys");

      await whatsapp.update({ status: "OPENING" });

      const wbot = await initWASocket(whatsapp);

      // se retornou null, é pq houve algum erro na inicialização
      if (!wbot) {
        logger.error(`[StartSession] initWASocket retornou null para whatsappId=${whatsapp.id}, limpando flag de reconexão`);
        // LIMPAR FLAG de reconexão para permitir novas tentativas
        const { clearReconnectingFlag } = await import("../../libs/wbot");
        clearReconnectingFlag(whatsapp.id);
        return;
      }

      if (wbot.id) {
        // Configurar listeners Baileys (código existente)
        wbotMessageListener(wbot, companyId);
        wbotMonitor(wbot, whatsapp, companyId);

        // NOTA: lid-mapping.update é tratado pelo wbotMonitor.ts (handler unificado)
        // O handler do wbotMonitor faz persistência + merge de contatos duplicados + promoção de PENDING_

        // NOTA: Lock simplificado para single-instance - não precisa de heartbeat
        // A flag reconnectingWhatsapps em wbot.ts previne reconexões duplicadas

        logger.info(`[StartSession] Baileys iniciado com sucesso: ${wbot.user?.id}`);
      }
      // Casos raros onde wbot é criado mas sem ID (falha parcial) - não precisa de ação especial

    } else if (channelType === "official") {
      // ===== WHATSAPP BUSINESS API OFICIAL =====
      logger.info(`[StartSession] Usando Official API para whatsappId=${whatsapp.id}`);

      // NOTA: Lock simplificado para single-instance - sempre retorna true
      await acquireWbotLock(whatsapp.id, "StartWhatsAppSessionUnified-Official");

      await whatsapp.update({ status: "OPENING" });

      try {
        // Criar adapter da API oficial
        const adapter = await WhatsAppFactory.createAdapter(whatsapp);

        // Inicializar (verifica credenciais e conecta)
        await adapter.initialize();

        // Registrar callback de conexão
        let lastLoggedStatus: string | null = null;
        adapter.onConnectionUpdate((status) => {
          // Evitar logs repetitivos do mesmo status
          if (status !== lastLoggedStatus) {
            logger.info(`[StartSession] Official API status changed: ${status}`);
            lastLoggedStatus = status;
          }

          // Atualizar status no banco
          if (status === "connected") {
            whatsapp.update({ status: "CONNECTED" });
          } else if (status === "disconnected") {
            whatsapp.update({ status: "DISCONNECTED" });
          }

          // Emitir evento via Socket.IO
          io.of(`/workspace-${companyId}`)
            .emit(`company-${companyId}-whatsappSession`, {
              action: "update",
              session: whatsapp
            });
        });

        // Registrar callback de mensagens recebidas
        adapter.onMessage((message) => {
          logger.debug(`[StartSession] Mensagem recebida via Official API: ${message.id}`);
          // O processamento da mensagem será feito pelo webhook handler
        });

        // Atualizar status
        await whatsapp.update({
          status: "CONNECTED",
          number: adapter.getPhoneNumber()
        });

        logger.info(`[StartSession] Official API conectada: ${adapter.getPhoneNumber()}`);

        // Emitir evento de conexão
        io.of(`/workspace-${companyId}`)
          .emit(`company-${companyId}-whatsappSession`, {
            action: "update",
            session: whatsapp
          });

      } catch (err) {
        throw err;
      }

    } else {
      throw new Error(`Tipo de canal não suportado: ${channelType}`);
    }

  } catch (err: any) {
    Sentry.captureException(err);
    logger.error(`[StartSession] Erro ao iniciar sessão: ${err.message}`);

    // Atualizar status de erro
    await whatsapp.update({ status: "DISCONNECTED" });

    // Emitir evento de erro
    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-whatsappSession`, {
        action: "update",
        session: whatsapp
      });

    throw err;
  }
};

/**
 * Para manter compatibilidade, exportar também a versão original
 * Apenas delega para a versão unificada
 */
export const StartWhatsAppSession = StartWhatsAppSessionUnified;

export default StartWhatsAppSession;
