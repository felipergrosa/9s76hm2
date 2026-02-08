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

  // Separar participantes por tipo de JID (@s.whatsapp.net vs @lid)
  const pnParticipants: any[] = [];
  const lidParticipants: any[] = [];

  for (const p of groupMetadata.participants || []) {
    if (p.id.includes("@lid")) {
      lidParticipants.push(p);
    } else {
      pnParticipants.push(p);
    }
  }

  // Pré-carregar contatos por número de telefone (participantes @s.whatsapp.net)
  const allRawNumbers = pnParticipants.map((p: any) => {
    const raw = p.id.split("@")[0].replace(/\D/g, "");
    const { canonical } = normalizePhoneNumber(raw);
    return { raw, canonical: canonical || raw };
  });

  const searchNumbers = allRawNumbers.flatMap((n: any) => {
    const nums = [n.canonical];
    if (n.raw !== n.canonical) nums.push(n.raw);
    return nums;
  });

  // Pré-carregar contatos por LID (participantes @lid)
  const lidJids = lidParticipants.map((p: any) => p.id);

  // Busca única no banco para todos os participantes (PN + LID)
  let contactsMap = new Map<string, Contact>();
  try {
    const whereConditions: any[] = [];
    if (searchNumbers.length > 0) {
      whereConditions.push({ canonicalNumber: { [Op.in]: searchNumbers } });
      whereConditions.push({ number: { [Op.in]: searchNumbers } });
    }
    if (lidJids.length > 0) {
      whereConditions.push({ lidJid: { [Op.in]: lidJids } });
      whereConditions.push({ remoteJid: { [Op.in]: lidJids } });
    }

    if (whereConditions.length > 0) {
      const contacts = await Contact.findAll({
        where: {
          companyId,
          isGroup: false,
          [Op.or]: whereConditions
        }
      });
      for (const c of contacts) {
        if (c.canonicalNumber) contactsMap.set(c.canonicalNumber, c);
        if (c.number) contactsMap.set(c.number, c);
        if (c.lidJid) contactsMap.set(c.lidJid, c);
        if (c.remoteJid) contactsMap.set(c.remoteJid, c);
      }
    }
  } catch {
    // Ignorar erros na busca batch
  }

  // Tentar resolver LID→PN via signalRepository do Baileys (in-memory, sem I/O)
  const signalRepo = (wbot as any).authState?.keys?.signalRepository;

  for (const p of groupMetadata.participants || []) {
    const participantJid = p.id;
    const isLid = participantJid.includes("@lid");
    const rawNumber = participantJid.split("@")[0].replace(/\D/g, "");
    const isAdmin = p.admin === "admin" || p.admin === "superadmin";
    const isSuperAdmin = p.admin === "superadmin";

    let participantNumber = rawNumber;
    let isValidPhoneNumber = false;
    let contactRecord: Contact | null = null;

    if (isLid) {
      // Participante com LID: tentar resolver para número real
      // 1) Buscar contato no banco por lidJid
      contactRecord = contactsMap.get(participantJid) || null;

      // 2) Tentar resolver LID→PN via signalRepository
      let resolvedPN: string | null = null;
      if (!contactRecord && signalRepo?.getPNForLID) {
        try {
          const pn = signalRepo.getPNForLID(participantJid);
          if (pn) {
            const pnDigits = String(pn).replace(/\D/g, "");
            if (pnDigits.length >= 7 && pnDigits.length <= 15) {
              resolvedPN = pnDigits;
              const { canonical } = normalizePhoneNumber(pnDigits);
              participantNumber = canonical || pnDigits;
              isValidPhoneNumber = true;
              // Buscar contato pelo número resolvido
              contactRecord = contactsMap.get(participantNumber) || contactsMap.get(pnDigits) || null;
            }
          }
        } catch {
          // signalRepository não disponível
        }
      }

      // Se encontrou contato por LID, usar o número do contato
      if (contactRecord?.number) {
        const contactNum = contactRecord.number.replace(/\D/g, "");
        if (contactNum.length >= 7 && contactNum.length <= 15) {
          participantNumber = contactNum;
          isValidPhoneNumber = true;
        }
      } else if (contactRecord?.canonicalNumber) {
        participantNumber = contactRecord.canonicalNumber;
        isValidPhoneNumber = participantNumber.length >= 7 && participantNumber.length <= 15;
      }
    } else {
      // Participante com número real (@s.whatsapp.net)
      const { canonical } = normalizePhoneNumber(rawNumber);
      participantNumber = canonical || rawNumber;
      isValidPhoneNumber = participantNumber.length >= 7 && participantNumber.length <= 15;
      contactRecord = contactsMap.get(participantNumber) || contactsMap.get(rawNumber) || null;
    }

    // Determinar nome: 1) contato do sistema, 2) pushName do WhatsApp, 3) número formatado
    let contactName: string;
    if (contactRecord?.name) {
      contactName = contactRecord.name;
    } else if (p.notify) {
      // pushName do WhatsApp (campo "notify" no Baileys)
      contactName = p.notify;
    } else if (isValidPhoneNumber) {
      contactName = `+${participantNumber}`;
    } else {
      contactName = "Participante";
    }

    // Número exibido: preferir número real, senão pushName, senão LID
    const displayNumber = isValidPhoneNumber
      ? participantNumber
      : (p.notify || rawNumber);

    // Usar foto do contato do sistema
    const profilePicUrl = contactRecord?.profilePicUrl || undefined;

    participants.push({
      id: participantJid,
      number: displayNumber,
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
