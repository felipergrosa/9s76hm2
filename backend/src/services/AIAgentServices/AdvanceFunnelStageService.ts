import AIAgent from "../../models/AIAgent";
import FunnelStage, { IFunnelTransition } from "../../models/FunnelStage";
import TicketFunnelState from "../../models/TicketFunnelState";
import Ticket from "../../models/Ticket";
import logger from "../../utils/logger";

interface Request {
  ticket: Ticket;
  agent: AIAgent;
  currentStage: FunnelStage;
  stages: FunnelStage[];
  messageText?: string;
}

/**
 * Item 12 do plano: avalia se a etapa atual do funil deve avançar com base na
 * mensagem recebida do cliente, usando as transitions tipadas da etapa
 * (stageKey/transitions, em vez do antigo autoAdvanceCondition em texto livre
 * que nunca chegou a ser avaliado por nenhum código).
 *
 * Side-effect: se avançar, grava uma nova linha em TicketFunnelState (histórico).
 * Deve ser chamado UMA vez por mensagem recebida, antes de qualquer leitura
 * da etapa atual (ResolveAIAgentForTicketService só lê o estado mais recente).
 */
const AdvanceFunnelStageService = async ({
  ticket,
  agent,
  currentStage,
  stages,
  messageText
}: Request): Promise<FunnelStage> => {
  if (!messageText || !messageText.trim()) {
    return currentStage;
  }

  const transitions = (currentStage.transitions || []) as IFunnelTransition[];
  if (!Array.isArray(transitions) || transitions.length === 0) {
    return currentStage;
  }

  const textLower = messageText.toLowerCase();

  for (const transition of transitions) {
    if (
      transition?.type === "keyword" &&
      transition.value &&
      textLower.includes(String(transition.value).toLowerCase())
    ) {
      const targetStage = stages.find(s => s.stageKey === transition.targetStageKey);

      if (!targetStage) {
        logger.warn(
          `[FunnelEngine] Transition aponta para stageKey "${transition.targetStageKey}" que não existe no agente ${agent.id}`
        );
        continue;
      }

      if (targetStage.id === currentStage.id) {
        continue; // já está nessa etapa, nada a fazer
      }

      try {
        await TicketFunnelState.create({
          ticketId: ticket.id,
          funnelStageId: targetStage.id,
          agentId: agent.id,
          companyId: ticket.companyId,
          enteredAt: new Date()
        } as any);

        logger.info(
          `[FunnelEngine] Ticket ${ticket.id} avançou de "${currentStage.name}" para "${targetStage.name}" (gatilho: "${transition.value}")`
        );

        return targetStage;
      } catch (error) {
        logger.error("[FunnelEngine] Erro ao registrar avanço de etapa:", error);
        return currentStage;
      }
    }
  }

  return currentStage;
};

export default AdvanceFunnelStageService;
