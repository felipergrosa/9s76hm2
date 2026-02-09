import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { Op } from "sequelize";

interface GroupInfo {
  contactId: number;
  name: string;
  number: string;
  profilePicUrl: string | null;
  whatsappId: number;
  whatsappName: string;
}

interface GroupsByConnection {
  whatsappId: number;
  whatsappName: string;
  groups: GroupInfo[];
}

/**
 * Lista todos os grupos disponíveis na empresa, agrupados por conexão.
 * Busca contatos isGroup=true que possuem tickets associados.
 */
const ListAvailableGroupsService = async (
  companyId: number
): Promise<GroupsByConnection[]> => {
  // Buscar todos os tickets de grupo da empresa com seus contatos e conexões
  const groupTickets = await Ticket.findAll({
    where: {
      companyId,
      isGroup: true,
    },
    attributes: ["id", "contactId", "whatsappId"],
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "profilePicUrl"],
        where: { isGroup: true },
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name"],
      },
    ],
    group: ["Ticket.contactId", "Ticket.whatsappId", "Ticket.id", "contact.id", "whatsapp.id"],
  });

  // Agrupar por conexão, evitando duplicatas de contactId
  const connectionMap = new Map<number, GroupsByConnection>();
  const seenContacts = new Set<string>(); // chave: `${whatsappId}-${contactId}`

  for (const ticket of groupTickets) {
    if (!ticket.whatsapp || !ticket.contact) continue;

    const key = `${ticket.whatsappId}-${ticket.contactId}`;
    if (seenContacts.has(key)) continue;
    seenContacts.add(key);

    if (!connectionMap.has(ticket.whatsappId)) {
      connectionMap.set(ticket.whatsappId, {
        whatsappId: ticket.whatsappId,
        whatsappName: ticket.whatsapp.name,
        groups: [],
      });
    }

    connectionMap.get(ticket.whatsappId)!.groups.push({
      contactId: ticket.contact.id,
      name: ticket.contact.name,
      number: ticket.contact.number,
      profilePicUrl: ticket.contact.profilePicUrl,
      whatsappId: ticket.whatsappId,
      whatsappName: ticket.whatsapp.name,
    });
  }

  // Ordenar grupos por nome dentro de cada conexão
  const result = Array.from(connectionMap.values());
  for (const conn of result) {
    conn.groups.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }

  // Ordenar conexões por nome
  result.sort((a, b) => (a.whatsappName || "").localeCompare(b.whatsappName || ""));

  return result;
};

export default ListAvailableGroupsService;
