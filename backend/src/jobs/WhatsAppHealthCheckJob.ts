/**
 * WhatsAppHealthCheckJob.ts
 * 
 * Job periódico que verifica saúde das conexões WhatsApp
 * e reconecta automaticamente se necessário
 */

import Whatsapp from "../models/Whatsapp";
import { getWbot, removeWbot } from "../libs/wbot";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import { getIO } from "../libs/socket";
import logger from "../utils/logger";

// Intervalo de verificação em milissegundos (2 minutos)
const HEALTH_CHECK_INTERVAL_MS = 2 * 60 * 1000;

// Tempo mínimo entre reconexões da mesma sessão (5 minutos)
const MIN_RECONNECT_INTERVAL_MS = 5 * 60 * 1000;

// Mapa para controlar última tentativa de reconexão por whatsappId
const lastReconnectAttempt = new Map<number, number>();

/**
 * Verifica se o WebSocket de uma sessão está realmente conectado
 */
function isSocketHealthy(whatsappId: number): { healthy: boolean; reason: string } {
    try {
        const session = getWbot(whatsappId);

        if (!session) {
            return { healthy: false, reason: "sessão não encontrada" };
        }

        // Verificar estado do WebSocket interno
        const ws = (session as any).ws;
        if (!ws) {
            return { healthy: false, reason: "WebSocket não existe" };
        }

        // readyState: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
        const readyState = ws.readyState;
        if (typeof readyState !== "number") {
            return { healthy: false, reason: "readyState inválido" };
        }

        if (readyState === 1) {
            return { healthy: true, reason: "WebSocket aberto" };
        }

        const stateNames = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
        return { healthy: false, reason: `WebSocket ${stateNames[readyState] || readyState}` };

    } catch (error: any) {
        return { healthy: false, reason: error.message || "erro desconhecido" };
    }
}

/**
 * Verifica se podemos tentar reconectar (respeitando cooldown)
 */
function canAttemptReconnect(whatsappId: number): boolean {
    const lastAttempt = lastReconnectAttempt.get(whatsappId);
    if (!lastAttempt) return true;

    const elapsed = Date.now() - lastAttempt;
    return elapsed >= MIN_RECONNECT_INTERVAL_MS;
}

/**
 * Tenta reconectar uma sessão WhatsApp
 */
async function attemptReconnect(whatsapp: Whatsapp): Promise<boolean> {
    const { id, name, companyId } = whatsapp;

    try {
        // Registrar tentativa
        lastReconnectAttempt.set(id, Date.now());

        logger.info(`[WhatsAppHealthCheck] Iniciando reconexão para whatsappId=${id} (${name})`);

        // Remover sessão antiga sem fazer logout (não queremos invalidar credenciais)
        try {
            removeWbot(id, false);
        } catch (e) {
            // Ignorar erro se sessão já não existe
        }

        // Aguardar um momento antes de reconectar
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Iniciar nova sessão
        await StartWhatsAppSession(whatsapp, companyId);

        logger.info(`[WhatsAppHealthCheck] Reconexão iniciada com sucesso para whatsappId=${id}`);

        // Emitir evento para frontend
        const io = getIO();
        io.of(`/workspace-${companyId}`)
            .emit(`company-${companyId}-whatsappSession`, {
                action: "update",
                session: whatsapp
            });

        return true;

    } catch (error: any) {
        logger.error(`[WhatsAppHealthCheck] Falha ao reconectar whatsappId=${id}: ${error.message}`);
        return false;
    }
}

/**
 * Executa verificação de saúde de todas as conexões
 */
async function runHealthCheck(): Promise<void> {
    try {
        // Buscar apenas conexões BAILEYS que deveriam estar conectadas
        // IMPORTANTE: Ignorar API oficial e outros canais que não usam WebSocket do Baileys
        const whatsapps = await Whatsapp.findAll({
            where: {
                status: "CONNECTED"
            }
        });

        // Filtrar apenas conexões Baileys (não oficiais)
        const baileysConnections = whatsapps.filter(w => {
            const channelType = (w as any).channelType || "";
            // Ignorar API oficial, Facebook, Instagram, WebChat
            const isOfficial = channelType === "official" || channelType === "whatsapp_official";
            const isFacebook = channelType === "facebook";
            const isInstagram = channelType === "instagram";
            const isWebchat = channelType === "webchat";

            if (isOfficial || isFacebook || isInstagram || isWebchat) {
                logger.debug(`[WhatsAppHealthCheck] Ignorando whatsappId=${w.id} (${w.name}): tipo=${channelType}`);
                return false;
            }
            return true;
        });

        if (baileysConnections.length === 0) {
            logger.debug(`[WhatsAppHealthCheck] Nenhuma conexão Baileys ativa para verificar`);
            return;
        }

        logger.info(`[WhatsAppHealthCheck] Verificando ${baileysConnections.length} conexão(ões) Baileys ativa(s)`);

        let healthyCount = 0;
        let unhealthyCount = 0;
        let reconnectedCount = 0;

        for (const whatsapp of baileysConnections) {
            const { id, name } = whatsapp;
            const check = isSocketHealthy(id);

            if (check.healthy) {
                healthyCount++;
                logger.debug(`[WhatsAppHealthCheck] whatsappId=${id} (${name}): saudável`);
            } else {
                unhealthyCount++;
                logger.warn(`[WhatsAppHealthCheck] whatsappId=${id} (${name}): não saudável - ${check.reason}`);

                // Verificar cooldown antes de reconectar
                if (canAttemptReconnect(id)) {
                    const reconnected = await attemptReconnect(whatsapp);
                    if (reconnected) {
                        reconnectedCount++;
                    }
                } else {
                    const lastAttempt = lastReconnectAttempt.get(id);
                    const elapsed = lastAttempt ? Math.round((Date.now() - lastAttempt) / 1000) : 0;
                    logger.info(`[WhatsAppHealthCheck] whatsappId=${id}: aguardando cooldown (última tentativa: ${elapsed}s atrás)`);
                }
            }
        }

        // Log resumido
        if (unhealthyCount > 0) {
            logger.info(`[WhatsAppHealthCheck] Resumo: ${healthyCount} saudáveis, ${unhealthyCount} não saudáveis, ${reconnectedCount} reconectadas`);
        }

    } catch (error: any) {
        logger.error(`[WhatsAppHealthCheck] Erro na verificação: ${error.message}`);
    }
}

/**
 * Inicia o job de health check
 */
export function startWhatsAppHealthCheckJob(): void {
    logger.info(`[WhatsAppHealthCheck] Job iniciado - verificando a cada ${HEALTH_CHECK_INTERVAL_MS / 1000}s`);

    // Executar primeira verificação após 30 segundos (dar tempo para sessões iniciarem)
    setTimeout(() => {
        runHealthCheck();

        // Agendar execução periódica
        setInterval(runHealthCheck, HEALTH_CHECK_INTERVAL_MS);
    }, 30000);
}

export default startWhatsAppHealthCheckJob;
