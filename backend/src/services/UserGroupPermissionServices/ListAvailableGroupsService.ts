import Contact from "../../models/Contact";
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
 * Busca contatos isGroup=true diretamente (sem duplicatas).
 * Filtra apenas conexões ativas (CONNECTED).
 */
const ListAvailableGroupsService = async (
  companyId: number
): Promise<GroupsByConnection[]> => {
  // Buscar conexões ativas da empresa
  const activeWhatsapps = await Whatsapp.findAll({
    where: {
      companyId,
      status: "CONNECTED"
    },
    attributes: ["id", "name"]
  });

  const activeWhatsappIds = activeWhatsapps.map(w => w.id);
  const whatsappMap = new Map<number, string>();
  activeWhatsapps.forEach(w => whatsappMap.set(w.id, w.name));

  if (activeWhatsappIds.length === 0) {
    return [];
  }

  // Buscar contatos de grupo diretamente (sem passar por tickets)
  // Isso evita duplicatas e é mais eficiente
  const groupContacts = await Contact.findAll({
    where: {
      companyId,
      isGroup: true,
      whatsappId: { [Op.in]: activeWhatsappIds },
      // Filtrar apenas grupos reais (número termina com @g.us ou tem formato de grupo)
      number: { [Op.like]: '%@g.us' }
    },
    attributes: ["id", "name", "number", "profilePicUrl", "whatsappId"],
    order: [["name", "ASC"]]
  });

  // Agrupar por conexão
  const connectionMap = new Map<number, GroupsByConnection>();
  const seenContactIds = new Set<number>(); // Evitar duplicatas por contactId

  for (const contact of groupContacts) {
    if (!contact.whatsappId) continue;
    
    // Evitar duplicatas
    if (seenContactIds.has(contact.id)) continue;
    seenContactIds.add(contact.id);

    const whatsappName = whatsappMap.get(contact.whatsappId);
    if (!whatsappName) continue; // Conexão não está ativa

    if (!connectionMap.has(contact.whatsappId)) {
      connectionMap.set(contact.whatsappId, {
        whatsappId: contact.whatsappId,
        whatsappName,
        groups: [],
      });
    }

    connectionMap.get(contact.whatsappId)!.groups.push({
      contactId: contact.id,
      name: contact.name,
      number: contact.number,
      profilePicUrl: contact.profilePicUrl,
      whatsappId: contact.whatsappId,
      whatsappName,
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
