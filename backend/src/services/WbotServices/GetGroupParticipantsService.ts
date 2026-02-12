import { Op, QueryTypes } from "sequelize";
import { getWbot } from "../../libs/wbot";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import { normalizePhoneNumber } from "../../utils/phone";

interface GroupParticipant {
  id: string; // JID do participante (ex: 5511999999999@s.whatsapp.net)
  number: string; // Número limpo (ex: 5511999999999)
  name: string; // Nome do participante (pushName ou número)
  isAdmin: boolean;
  isSuperAdmin: boolean;
  profilePicUrl?: string; // URL do contato no banco
  imgUrlBaileys?: string | null; // URL do avatar do Baileys store
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

  // Sincronizar nome do grupo se mudou no WhatsApp
  const currentSubject = groupMetadata.subject || groupContact.name || "Grupo";
  if (currentSubject !== groupContact.name) {
    try {
      await groupContact.update({ name: currentSubject });
      logger.info(`[GetGroupParticipants] Nome do grupo atualizado: "${groupContact.name}" → "${currentSubject}"`);
    } catch (err) {
      logger.warn(`[GetGroupParticipants] Erro ao atualizar nome do grupo: ${err}`);
    }
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

  // === ESTRATÉGIA DE RESOLUÇÃO ===
  // 1) Para @s.whatsapp.net: buscar contato por número (canonicalNumber/number)
  // 2) Para @lid: buscar contato via mapeamento participant→contactId das mensagens salvas
  //    (mesma fonte que o chat usa para exibir nomes corretamente)
  // 3) Fallback: lidJid/remoteJid no contato, signalRepository, pushName
  // 4) NOVO: Buscar em todo o banco por número parcial do LID

  // Pré-carregar contatos por número (participantes @s.whatsapp.net)
  const pnNumbers: string[] = [];
  for (const p of groupMetadata.participants || []) {
    if (!p.id.includes("@lid")) {
      const raw = p.id.split("@")[0].replace(/\D/g, "");
      const { canonical } = normalizePhoneNumber(raw);
      pnNumbers.push(canonical || raw);
      if (raw !== (canonical || raw)) pnNumbers.push(raw);
    }
  }

  let contactsMap = new Map<string, Contact>();
  if (pnNumbers.length > 0) {
    try {
      const contacts = await Contact.findAll({
        where: {
          companyId,
          isGroup: false,
          [Op.or]: [
            { canonicalNumber: { [Op.in]: pnNumbers } },
            { number: { [Op.in]: pnNumbers } }
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
  }

  // Para participantes @lid: buscar mapeamento participant→contact das mensagens salvas
  // Essa é a mesma fonte que o chat usa para exibir nomes corretamente
  const lidParticipantJids = (groupMetadata.participants || [])
    .filter((p: any) => p.id.includes("@lid"))
    .map((p: any) => p.id);

  const lidContactMap = new Map<string, Contact>();
  if (lidParticipantJids.length > 0) {
    try {
      // Buscar tickets deste grupo
      const groupTickets = await Ticket.findAll({
        where: { contactId, companyId, isGroup: true },
        attributes: ["id"]
      });
      const ticketIds = groupTickets.map(t => t.id);

      if (ticketIds.length > 0) {
        // Buscar o contactId mais recente para cada participant @lid
        // usando as mensagens salvas (mesma fonte que o chat)
        const sequelize = Contact.sequelize!;
        const mappings: any[] = await sequelize.query(`
          SELECT DISTINCT ON (m.participant)
            m.participant,
            m."contactId",
            c.name,
            c.number,
            c."canonicalNumber",
            c."profilePicUrl",
            c."isGroup" as "contactIsGroup"
          FROM "Messages" m
          JOIN "Contacts" c ON c.id = m."contactId"
          WHERE m."ticketId" IN (:ticketIds)
            AND m."fromMe" = false
            AND m.participant IN (:participants)
            AND c."isGroup" = false
          ORDER BY m.participant, m.id DESC
        `, {
          replacements: { ticketIds, participants: lidParticipantJids },
          type: QueryTypes.SELECT
        });

        for (const row of mappings) {
          // Criar um objeto Contact-like para o mapa
          const contact = await Contact.findByPk(row.contactId);
          if (contact) {
            lidContactMap.set(row.participant, contact);
          }
        }
      }
    } catch (err) {
      logger.warn(`[GetGroupParticipants] Erro ao buscar mapeamento LID→Contact: ${err}`);
    }

    // Fallback: buscar contatos que tenham lidJid ou remoteJid @lid
    try {
      const lidContacts = await Contact.findAll({
        where: {
          companyId,
          isGroup: false,
          [Op.or]: [
            { lidJid: { [Op.in]: lidParticipantJids } },
            { remoteJid: { [Op.in]: lidParticipantJids } }
          ]
        }
      });
      for (const c of lidContacts) {
        if (c.lidJid && !lidContactMap.has(c.lidJid)) lidContactMap.set(c.lidJid, c);
        if (c.remoteJid && !lidContactMap.has(c.remoteJid)) lidContactMap.set(c.remoteJid, c);
      }
    } catch {
      // Ignorar
    }
  }

  for (const p of groupMetadata.participants || []) {
    const participantJid = p.id;
    const isLid = participantJid.includes("@lid");
    const rawNumber = participantJid.split("@")[0].replace(/\D/g, "");
    const isAdmin = p.admin === "admin" || p.admin === "superadmin";
    const isSuperAdmin = p.admin === "superadmin";

    let participantNumber = rawNumber;
    let isValidPhoneNumber = false;
    let contactRecord: Contact | null = null;
    let resolvedName: string | null = null;

    if (isLid) {
      // Buscar contato pelo mapeamento das mensagens salvas
      contactRecord = lidContactMap.get(participantJid) || null;

      if (contactRecord) {
        // Usar número real do contato encontrado
        const contactNum = (contactRecord.canonicalNumber || contactRecord.number || "").replace(/\D/g, "");
        if (contactNum.length >= 7 && contactNum.length <= 15) {
          participantNumber = contactNum;
          isValidPhoneNumber = true;
        }
        resolvedName = contactRecord.name || null;
      }
    } else {
      // Participante com número real (@s.whatsapp.net)
      const { canonical } = normalizePhoneNumber(rawNumber);
      participantNumber = canonical || rawNumber;
      isValidPhoneNumber = participantNumber.length >= 7 && participantNumber.length <= 15;
      contactRecord = contactsMap.get(participantNumber) || contactsMap.get(rawNumber) || null;
    }

    // NOVO: Tentar resolver via store do Baileys (chats/contacts) para TODOS os tipos de participantes
    // O store mantém mapeamento LID -> phoneNumber e também pushNames (notify)
    if (!resolvedName || !isValidPhoneNumber) {
      try {
        const store = (wbot as any).store;
        if (store && store.contacts) {
          const allContacts = Object.values(store.contacts) as any[];
          const baileysContact = allContacts.find(c => c.id === participantJid);

          if (baileysContact) {
            // Se for LID,phoneNumber contém o número real
            if (isLid && !isValidPhoneNumber) {
              const realNumber = baileysContact.phoneNumber ||
                baileysContact.id?.split("@")[0]?.replace(/\D/g, "");
              if (realNumber && realNumber.length >= 7 && realNumber.length <= 15) {
                participantNumber = realNumber;
                isValidPhoneNumber = true;
              }
            }

            // Capturar pushName (notify) se não tivermos nome ainda
            if (!resolvedName) {
              resolvedName = baileysContact.name ||
                baileysContact.notify ||
                baileysContact.verifiedName || null;
            }
          }
        }
      } catch (err) {
        logger.debug(`[GetGroupParticipants] Erro ao acessar store para ${participantJid}: ${err}`);
      }
    }

    // Fallback LID: Tentar buscar contato no banco por número parcial se ainda não validamos
    if (isLid && !isValidPhoneNumber && rawNumber.length >= 7) {
      try {
        // Alguns LIDs contêm o número no final
        const possibleNumber = rawNumber.slice(-12); // Pegar últimos 12 dígitos
        if (possibleNumber.length >= 10) {
          const { canonical } = normalizePhoneNumber(possibleNumber);
          if (canonical) {
            const foundContact = await Contact.findOne({
              where: {
                companyId,
                isGroup: false,
                [Op.or]: [
                  { canonicalNumber: { [Op.like]: `%${possibleNumber}` } },
                  { number: { [Op.like]: `%${possibleNumber}` } }
                ]
              }
            });
            if (foundContact) {
              contactRecord = foundContact;
              participantNumber = foundContact.canonicalNumber || foundContact.number || possibleNumber;
              isValidPhoneNumber = true;
              if (!resolvedName) {
                resolvedName = foundContact.name;
              }
            }
          }
        }
      } catch {
        // Ignorar
      }
    }

    // Determinar nome: 1) resolvido anteriormente, 2) contato do sistema, 3) pushName do WhatsApp, 4) nome direto do Baileys, 5) número formatado
    let contactName: string;
    if (resolvedName) {
      contactName = resolvedName;
    } else if (contactRecord?.name) {
      contactName = contactRecord.name;
    } else if (p.name) {
      // Nome direto do participante no metadata do grupo
      contactName = p.name;
    } else if (p.notify) {
      // pushName do WhatsApp (campo "notify" no Baileys)
      contactName = p.notify;
    } else if (isValidPhoneNumber) {
      contactName = `+${participantNumber}`;
    } else {
      // Fallback final: usar número formatado se possível, senão "Participante"
      if (isValidPhoneNumber && participantNumber.length >= 10) {
        const ddi = participantNumber.slice(0, 2);
        const ddd = participantNumber.slice(2, 4);
        const rest = participantNumber.slice(4);
        if (rest.length === 9) {
          contactName = `+${ddi} ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
        } else if (rest.length === 8) {
          contactName = `+${ddi} ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
        } else {
          contactName = `+${participantNumber}`;
        }
      } else {
        contactName = "Participante";
      }
    }

    // Número exibido: preferir número real formatado com DDI
    let displayNumber: string;
    if (isValidPhoneNumber && participantNumber.length >= 10) {
      // Tentar formatar com DDI
      const ddi = participantNumber.slice(0, 2);
      const ddd = participantNumber.slice(2, 4);
      const rest = participantNumber.slice(4);
      if (rest.length === 9) {
        // Celular: +55 11 91234-5678
        displayNumber = `+${ddi} ${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
      } else if (rest.length === 8) {
        // Fixo: +55 11 1234-5678
        displayNumber = `+${ddi} ${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
      } else {
        displayNumber = `+${participantNumber}`;
      }
    } else {
      displayNumber = p.notify || rawNumber;
    }

    // Usar foto do contato do sistema ou do Baileys
    let profilePicUrl = contactRecord?.profilePicUrl;
    let imgUrlBaileys: string | null = null;

    // Se temos imgUrl do Baileys e é uma URL válida, usar como fallback
    if (!profilePicUrl) {
      // Tentar obter do store do Baileys diretamente
      try {
        const store = (wbot as any).store;
        if (store && store.contacts) {
          const allContacts = Object.values(store.contacts) as any[];
          const bc = allContacts.find(c => c.id === participantJid);
          if (bc && bc.imgUrl && bc.imgUrl !== 'changed' && bc.imgUrl.startsWith('http')) {
            imgUrlBaileys = bc.imgUrl;
            profilePicUrl = imgUrlBaileys;
          }
        }
      } catch {
        // Ignorar
      }
    }

    participants.push({
      id: participantJid,
      number: displayNumber,
      name: contactName,
      isAdmin,
      isSuperAdmin,
      profilePicUrl,
      imgUrlBaileys,
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
