import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import SendWhatsAppMessageUnified from "../WbotServices/SendWhatsAppMessageUnified";

/**
 * Envia uma etapa de drip sequence reaproveitando os mesmos serviços já usados
 * pelo restante do sistema (tickets/bot/campanhas com template oficial):
 * `FindOrCreateTicketService` (cria/reusa o ticket do contato na conexão) +
 * `SendWhatsAppMessageUnified` (abstrai Baileys vs API Oficial via adapter,
 * já aplica o template Mustache de `formatBody` — por isso a mensagem aceita
 * placeholders como {{name}}/{{firstName}}).
 *
 * Não reaproveita `handleDispatchCampaign` (queues.ts) de propósito: aquela
 * função concentra proteções específicas de disparo em massa (cap/backoff/
 * pacing, templates Meta obrigatórios) que não se aplicam a um envio pontual
 * e de baixo volume como uma etapa de drip.
 */
const SendDripStepMessageService = async (
  contact: Contact,
  whatsapp: Whatsapp,
  companyId: number,
  message: string
): Promise<void> => {
  const ticket = await FindOrCreateTicketService(
    contact,
    whatsapp,
    0,
    companyId,
    null,
    null,
    undefined,
    undefined,
    false,
    false,
    undefined,
    false,
    true // isCampaign: usa o mesmo caminho de criação de ticket que disparos em massa
  );

  await SendWhatsAppMessageUnified({ body: message, ticket });
};

export default SendDripStepMessageService;
