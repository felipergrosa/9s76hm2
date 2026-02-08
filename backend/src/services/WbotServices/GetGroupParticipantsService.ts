import { Op } from "sequelize";
import { getWbot } from "../../libs/wbot";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import { normalizePhoneNumber } from "../../utils/phone";

interface GroupParticipant {
  id: string; // JID do participante (ex: 5511999999999@s.whatsapp.net)
  number: string; // Número limpo (ex: 5511999999999)
  name: string; // Nome do participante (pushName ou número)
  isAdmin: boolean;
  isSuperAdmin: boolean;
  profilePicUrl?: string;
  contactId?: number; // ID do contato no sistema, se existir
}

interface GroupInfo {
  id: string; // JID do grupo
  subject: string; // Nome do grupo
  description?: string;
  owner?: string; // JID do criador
  creation?: number; // Timestamp de criação
  size: number; // Número de participantes
  participants: GroupParticipant[];
  profilePicUrl?: string;
  announce?: boolean; // Apenas admins podem enviar mensagens
  restrict?: boolean; // Apenas admins podem editar dados do grupo
}

interface Request {
  contactId: number;
  companyId: number;
}

/**
 * Busca metadados e participantes de um grupo WhatsApp via Baileys.
 * Requer que a conexão esteja ativa.
 */
const GetGroupParticipantsService = async ({
  contactId,
  companyId
}: Request): Promise<GroupInfo> => {
  // Buscar contato do grupo no banco
  const groupContact = await Contact.findOne({
    where: {
      id: contactId,
      companyId,
      isGroup: true
    }
  });

  if (!groupContact) {
    throw new Error("Grupo não encontrado");
  }

  // Determinar o JID do grupo
  let groupJid = groupContact.number;
  if (!groupJid.includes("@g.us")) {
    groupJid = `${groupJid}@g.us`;
  }

  // Buscar conexão WhatsApp associada ao grupo
  const whatsappId = groupContact.whatsappId;
  if (!whatsappId) {
    throw new Error("Grupo não está associado a nenhuma conexão WhatsApp");
  }

  const whatsapp = await Whatsapp.findByPk(whatsappId);
  if (!whatsapp || whatsapp.status !== "CONNECTED") {
    throw new Error("Conexão WhatsApp não está ativa");
  }

  // Obter instância do Baileys
  const wbot = getWbot(whatsappId);

  // Buscar metadados do grupo via Baileys
  let groupMetadata: any;
  try {
    groupMetadata = await wbot.groupMetadata(groupJid);
  } catch (error: any) {
    logger.error(`[GetGroupParticipants] Erro ao buscar metadados do grupo ${groupJid}: ${error.message}`);
    throw new Error("Não foi possível obter dados do grupo. Verifique se a conexão está ativa.");
  }

  // Buscar foto do grupo
  let groupPicUrl: string | undefined;
  try {
    groupPicUrl = await wbot.profilePictureUrl(groupJid, "image");
  } catch {
    // Grupo pode não ter foto
  }

  // Mapear participantes
  const participants: GroupParticipant[] = [];

  // Pré-carregar todos os contatos da company de uma vez (evita N+1 queries)
  const allRawNumbers = (groupMetadata.participants || []).map((p: any) => {
    const raw = p.id.split("@")[0].replace(/\D/g, "");
    const { canonical } = normalizePhoneNumber(raw);
    return { raw, canonical: canonical || raw };
  });

  const searchNumbers = allRawNumbers.flatMap((n: any) => {
    const nums = [n.canonical];
    if (n.raw !== n.canonical) nums.push(n.raw);
    return nums;
  });

  // Busca única no banco para todos os participantes
  let contactsMap = new Map<string, Contact>();
  try {
    const contacts = await Contact.findAll({
      where: {
        companyId,
        isGroup: false,
        [Op.or]: [
          { canonicalNumber: { [Op.in]: searchNumbers } },
          { number: { [Op.in]: searchNumbers } }
        ]
      }
    });
    for (const c of contacts) {
      if (c.canonicalNumber) contactsMap.set(c.canonicalNumber, c);
      if (c.number) contactsMap.set(c.number, c);
    }
  } catch {
    // Ignorar erros na busca batch
  }

  for (const p of groupMetadata.participants || []) {
    const participantJid = p.id;
    const rawNumber = participantJid.split("@")[0].replace(/\D/g, "");
    const isAdmin = p.admin === "admin" || p.admin === "superadmin";
    const isSuperAdmin = p.admin === "superadmin";

    // Normalizar número para busca consistente
    const { canonical } = normalizePhoneNumber(rawNumber);
    const participantNumber = canonical || rawNumber;

    // Validar se é um número de telefone válido (qualquer país)
    // Números de telefone reais: 7-15 dígitos
    // IDs internos Meta/Facebook: geralmente > 15 dígitos
    const isValidPhoneNumber = participantNumber.length >= 7 && participantNumber.length <= 15;

    // Buscar contato no mapa pré-carregado
    const contactRecord = contactsMap.get(participantNumber) || contactsMap.get(rawNumber) || null;

    // Determinar nome: 1) contato do sistema, 2) pushName do WhatsApp, 3) número formatado
    let contactName: string;
    if (contactRecord?.name) {
      contactName = contactRecord.name;
    } else if (p.notify) {
      // pushName do WhatsApp (campo "notify" no Baileys)
      contactName = p.notify;
    } else if (isValidPhoneNumber) {
      // Formatar número como nome legível (ex: +55 19 99246-1008)
      contactName = `+${participantNumber}`;
    } else {
      contactName = "Participante";
    }

    // Usar foto do contato do sistema (sem buscar via Baileys para performance)
    const profilePicUrl = contactRecord?.profilePicUrl || undefined;

    participants.push({
      id: participantJid,
      number: isValidPhoneNumber ? participantNumber : rawNumber,
      name: contactName,
      isAdmin,
      isSuperAdmin,
      profilePicUrl,
      contactId: contactRecord?.id
    });
  }

  // Ordenar: superadmin primeiro, depois admins, depois membros
  participants.sort((a, b) => {
    if (a.isSuperAdmin && !b.isSuperAdmin) return -1;
    if (!a.isSuperAdmin && b.isSuperAdmin) return 1;
    if (a.isAdmin && !b.isAdmin) return -1;
    if (!a.isAdmin && b.isAdmin) return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    id: groupJid,
    subject: groupMetadata.subject || groupContact.name || "Grupo",
    description: groupMetadata.desc || undefined,
    owner: groupMetadata.owner || undefined,
    creation: groupMetadata.creation || undefined,
    size: participants.length,
    participants,
    profilePicUrl: groupPicUrl,
    announce: groupMetadata.announce === true,
    restrict: groupMetadata.restrict === true
  };
};

export default GetGroupParticipantsService;
