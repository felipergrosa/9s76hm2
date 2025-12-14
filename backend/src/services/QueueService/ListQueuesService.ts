import Queue from "../../models/Queue";
import Chatbot from "../../models/Chatbot";
import Prompt from "../../models/Prompt";
import AIAgent from "../../models/AIAgent";

interface Request {
  companyId: number;
  onlyWithBot?: boolean;
}

const ListQueuesService = async ({ companyId, onlyWithBot = false }: Request): Promise<Queue[]> => {
  const queues = await Queue.findAll({
    where: {
      companyId
    },
    include: onlyWithBot
      ? [
          {
            model: Chatbot,
            as: "chatbots",
            attributes: ["id"],
            required: false
          },
          {
            model: Prompt,
            as: "prompt",
            attributes: ["id"],
            required: false
          }
        ]
      : undefined,
    order: [["orderQueue", "ASC"]]
  });

  if (!onlyWithBot) {
    return queues;
  }

  // Filtrar filas que realmente têm bot configurado.
  // Critérios:
  // - chatbots (legacy)
  // - prompt (legacy)
  // - ragCollection (RAG)
  // - AI Agent ativo vinculado à fila
  const agentRows = await AIAgent.findAll({
    where: {
      companyId,
      status: "active"
    },
    attributes: ["queueIds"]
  });

  const agentQueueIds = new Set<number>();
  agentRows.forEach(row => {
    const ids = (row as any).queueIds;
    if (Array.isArray(ids)) {
      ids.forEach((id: any) => {
        const n = Number(id);
        if (Number.isInteger(n)) {
          agentQueueIds.add(n);
        }
      });
    }
  });

  return queues.filter(queue => {
    const hasChatbots = Array.isArray((queue as any).chatbots) && (queue as any).chatbots.length > 0;
    const hasPrompt = Array.isArray((queue as any).prompt) && (queue as any).prompt.length > 0;
    const hasRag = Boolean((queue as any).ragCollection && String((queue as any).ragCollection).trim());
    const hasAgent = agentQueueIds.has(queue.id);
    return hasChatbots || hasPrompt || hasRag || hasAgent;
  });
};

export default ListQueuesService;
