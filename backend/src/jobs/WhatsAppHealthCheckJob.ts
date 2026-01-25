/**
 * WhatsAppHealthCheckJob.ts
 * 
 * Job periódico que verifica saúde das conexões WhatsApp
 * e reconecta automaticamente se necessário
 */

import Whatsapp from "../models/Whatsapp";
import { getWbot, removeWbot, getWbotIsReconnecting } from "../libs/wbot";
import { getWbotLockOwner, getCurrentInstanceId } from "../libs/wbotMutex";
import { StartWhatsAppSessionUnified as StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSessionUnified";
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
 * Compatível com Baileys v6/v7
 */
function isSocketHealthy(whatsappId: number): { healthy: boolean; reason: string } {
    try {
        const session = getWbot(whatsappId);

        if (!session) {
            return { healthy: false, reason: "sessão não encontrada" };
        }

        // No Baileys v6/v7, se session.user existe, a conexão está ativa
        const user = (session as any).user;
        if (user && user.id) {
            return { healthy: true, reason: `conectado como ${user.id}` };
        }

        // Verificar estado do WebSocket interno (fallback)
        const ws = (session as any).ws;
        if (ws) {
            // Tentar acessar readyState diretamente ou via socket interno
            const socket = ws.socket || ws;
            const readyState = socket?.readyState;

            if (readyState === 1) {
                return { healthy: true, reason: "WebSocket aberto" };
            }

            if (typeof readyState === "number") {
                const stateNames = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
                return { healthy: false, reason: `WebSocket ${stateNames[readyState] || readyState}` };
            }
        }

        // Se chegou aqui, não conseguimos determinar - assumir saudável se houver sessão
        // O sistema de eventos do Baileys vai detectar desconexões automaticamente
        return { healthy: true, reason: "sessão existe (estado indeterminado)" };

    } catch (error: any) {
        return { healthy: false, reason: error.message || "erro desconhecido" };
    }
}

// Set para controlar reconexões em andamento
const reconnectingIds = new Set<number>();

/**
 * Verifica se podemos tentar reconectar (respeitando cooldown e verificando se já está reconectando)
 */
function canAttemptReconnect(whatsappId: number): boolean {
    // Se já está reconectando, não tentar novamente
    if (reconnectingIds.has(whatsappId)) {
        logger.debug(`[WhatsAppHealthCheck] whatsappId=${whatsappId} já está em processo de reconexão`);
        return false;
    }

    // Verificar se o próprio wbot já está tratando a reconexão (backoff/conflito)
    if (getWbotIsReconnecting(whatsappId)) {
        logger.debug(`[WhatsAppHealthCheck] whatsappId=${whatsappId} já está reconectando via wbot (backoff). Ignorando.`);
        return false;
    }


    const lastAttempt = lastReconnectAttempt.get(whatsappId);
    if (!lastAttempt) return true;

    const elapsed = Date.now() - lastAttempt;
    return elapsed >= MIN_RECONNECT_INTERVAL_MS;
}

/**
 * Tenta reconectar uma sessão WhatsApp
 * IMPORTANTE: Só deve ser chamado se canAttemptReconnect retornar true
 */
async function attemptReconnect(whatsapp: Whatsapp): Promise<boolean> {
    const { id, name, companyId } = whatsapp;

    // Marcar como em processo de reconexão
    reconnectingIds.add(id);

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

        // Aguardar um momento antes de reconectar (5 segundos para evitar conflitos)
        await new Promise(resolve => setTimeout(resolve, 5000));

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
    } finally {
        // SEMPRE remover do set de reconexões em andamento
        reconnectingIds.delete(id);
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
                // Verificar se a sessão está ativa em OUTRO nó (Sharding)
                const lockOwner = await getWbotLockOwner(id);
                const myId = getCurrentInstanceId();

                if (lockOwner && lockOwner !== myId) {
                    logger.debug(`[WhatsAppHealthCheck] whatsappId=${id} (${name}): saudável (REMOTO em ${lockOwner})`);
                    healthyCount++; // Conta como saudável pois está rodando no cluster
                    continue; // Não tenta reconectar
                }

                unhealthyCount++;
                logger.warn(`[WhatsAppHealthCheck] whatsappId=${id} (${name}): não saudável - ${check.reason} (Owner: ${lockOwner || "Nenhum"})`);

                // REABILITADO: Reconexão automática com proteções de cooldown (5 min) e verificação de conflito
                // As proteções já existem em canAttemptReconnect() e attemptReconnect()
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
