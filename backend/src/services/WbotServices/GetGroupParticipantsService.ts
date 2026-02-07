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

  for (const p of groupMetadata.participants || []) {
    const participantJid = p.id;
    const rawNumber = participantJid.split("@")[0].replace(/\D/g, "");
    const isAdmin = p.admin === "admin" || p.admin === "superadmin";
    const isSuperAdmin = p.admin === "superadmin";

    // Normalizar número para busca consistente
    const { canonical } = normalizePhoneNumber(rawNumber);
    const participantNumber = canonical || rawNumber;

    // Tentar buscar contato existente no sistema (por canonicalNumber ou number)
    let contactRecord: Contact | null = null;
    let contactName = participantNumber;
    let profilePicUrl: string | undefined;

    try {
      contactRecord = await Contact.findOne({
        where: {
          companyId,
          isGroup: false,
          [Op.or]: [
            { canonicalNumber: participantNumber },
            { number: participantNumber },
            ...(rawNumber !== participantNumber ? [{ number: rawNumber }, { canonicalNumber: rawNumber }] : [])
          ]
        }
      });

      if (contactRecord) {
        contactName = contactRecord.name || participantNumber;
        profilePicUrl = contactRecord.profilePicUrl || undefined;
      }
    } catch {
      // Ignorar erros na busca de contato
    }

    // Se não encontrou contato, tentar buscar foto de perfil via Baileys
    if (!profilePicUrl) {
      try {
        profilePicUrl = await wbot.profilePictureUrl(participantJid, "image");
      } catch {
        // Participante pode não ter foto
      }
    }

    participants.push({
      id: participantJid,
      number: participantNumber,
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
