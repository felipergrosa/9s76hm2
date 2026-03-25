import { Op, QueryTypes } from "sequelize";
import { getWbot, getWbotOrRecover } from "../../libs/wbot";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import { normalizePhoneNumber, isValidCanonicalPhoneNumber } from "../../utils/phone";

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
 * OTIMIZADO: Timeouts reduzidos e queries simplificadas para resposta rápida.
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

  // Obter instância do Baileys - timeout reduzido para 5s
  // Se não estiver pronta em 5s, provavelmente há problema na conexão
  const wbot = await getWbotOrRecover(whatsappId, 5000);
  if (!wbot) {
    throw new Error("Sessão WhatsApp não disponível. Verifique se a conexão está ativa.");
  }

  // Buscar metadados do grupo via Baileys
  // PROTEÇÃO: Timeout de 5s para resposta rápida
  let groupMetadata: any;
  try {
    const TIMEOUT_MS = 5000; // 5 segundos timeout (reduzido de 10s)
    
    groupMetadata = await Promise.race([
      wbot.groupMetadata(groupJid),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout ao buscar metadados do grupo')), TIMEOUT_MS)
      )
    ]);
  } catch (error: any) {
    logger.error(`[GetGroupParticipants] Erro ao buscar metadados do grupo ${groupJid}: ${error.message}`);
    
    // Verificar se é erro de grupo inexistente/saiu do grupo
    if (error.message?.includes('bad-request') || error.message?.includes('not-authorized')) {
      throw new Error("Grupo não encontrado ou você não é mais participante deste grupo.");
    }
    
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
  // PROTEÇÃO: Timeout para prevenir travamento do websocket
  let groupPicUrl: string | undefined;
  try {
    groupPicUrl = await Promise.race([
      wbot.profilePictureUrl(groupJid, "image"),
      new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout ao buscar foto do grupo')), 5000)
      )
    ]);
  } catch {
    // Grupo pode não ter foto ou timeout
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
      logger.info(`[GetGroupParticipants] Encontrados ${contacts.length} contatos para ${pnNumbers.length} números de participantes`);
      for (const c of contacts) {
        if (c.canonicalNumber) contactsMap.set(c.canonicalNumber, c);
        if (c.number) contactsMap.set(c.number, c);
        logger.debug(`[GetGroupParticipants] Contato mapeado: ${c.number} / ${c.canonicalNumber} -> ${c.name} (ID: ${c.id}, avatar: ${c.profilePicUrl ? 'sim' : 'não'})`);
      }
    } catch (err) {
      logger.warn(`[GetGroupParticipants] Erro ao buscar contatos batch: ${err}`);
    }
  }

  // Para participantes @lid: buscar mapeamento participant→contact
  // OTIMIZADO: Query única consolidada para performance
  const lidParticipantJids = (groupMetadata.participants || [])
    .filter((p: any) => p.id.includes("@lid"))
    .map((p: any) => p.id);

  // TODOS os participantes (LID e não-LID) - buscar senderName de mensagens
  const allParticipantJids = (groupMetadata.participants || []).map((p: any) => p.id);

  const lidContactMap = new Map<string, any>();
  const senderNameMap = new Map<string, string>(); // participant -> senderName
  
  if (allParticipantJids.length > 0) {
    try {
      const sequelize = Contact.sequelize!;
      
      // QUERY: Buscar senderName de TODOS os grupos da empresa (não só o grupo atual)
      // Isso garante que pegamos nomes mesmo se participante só falou em outro grupo
      const senderNameRows: any[] = await sequelize.query(`
        WITH ranked AS (
          SELECT 
            m.participant,
            m."senderName",
            ROW_NUMBER() OVER (PARTITION BY m.participant ORDER BY m.id DESC) as rn
          FROM "Messages" m
          JOIN "Tickets" t ON t.id = m."ticketId"
          WHERE t."companyId" = :companyId
            AND t."isGroup" = true
            AND m."fromMe" = false
            AND m.participant IN (:participants)
            AND m."senderName" IS NOT NULL
            AND m."senderName" != ''
        )
        SELECT participant, "senderName" FROM ranked WHERE rn = 1
      `, {
        replacements: { companyId, participants: allParticipantJids },
        type: QueryTypes.SELECT
      });

      for (const row of senderNameRows) {
        if (row.senderName) {
          senderNameMap.set(row.participant, row.senderName);
          logger.debug(`[GetGroupParticipants] senderName encontrado: ${row.participant} -> ${row.senderName}`);
        }
      }

      logger.info(`[GetGroupParticipants] Encontrados ${senderNameMap.size} senderNames para ${allParticipantJids.length} participantes`);
    } catch (err) {
      logger.warn(`[GetGroupParticipants] Erro ao buscar senderName: ${err}`);
    }
  }
  
  if (lidParticipantJids.length > 0) {
    try {
      const sequelize = Contact.sequelize!;
      
      // QUERY ÚNICA: Buscar senderName e contatos em uma só query (já temos senderName acima, mas mantemos para compatibilidade)
      // Prioriza: 1) Contato real com número, 2) senderName das mensagens
      const mappings: any[] = await sequelize.query(`
        WITH ranked AS (
          SELECT 
            m.participant,
            m."senderName",
            m."contactId",
            c.name as contact_name,
            c.number as contact_number,
            c."canonicalNumber",
            c."profilePicUrl",
            c.id as real_contact_id,
            ROW_NUMBER() OVER (PARTITION BY m.participant ORDER BY 
              CASE WHEN c."isGroup" = false AND c.number IS NOT NULL THEN 0 ELSE 1 END,
              m.id DESC
            ) as rn
          FROM "Messages" m
          LEFT JOIN "Contacts" c ON c.id = m."contactId" AND c."isGroup" = false
          JOIN "Tickets" t ON t.id = m."ticketId"
          WHERE t."companyId" = :companyId
            AND t."isGroup" = true
            AND m."fromMe" = false
            AND m.participant IN (:participants)
        )
        SELECT * FROM ranked WHERE rn = 1
      `, {
        replacements: { companyId, participants: lidParticipantJids },
        type: QueryTypes.SELECT
      });

      for (const row of mappings) {
        lidContactMap.set(row.participant, {
          name: row.contact_name || row.senderName,
          number: row.contact_number,
          canonicalNumber: row.canonicalNumber,
          profilePicUrl: row.profilePicUrl,
          id: row.real_contact_id
        });
        // Também popula senderNameMap se ainda não temos
        if (row.senderName && !senderNameMap.has(row.participant)) {
          senderNameMap.set(row.participant, row.senderName);
        }
      }

      // Fallback: buscar contatos por lidJid/remoteJid para LIDs não encontrados
      const missingLids = lidParticipantJids.filter((lid: string) => !lidContactMap.has(lid));
      if (missingLids.length > 0) {
        const lidContacts = await Contact.findAll({
          where: {
            companyId,
            isGroup: false,
            [Op.or]: [
              { lidJid: { [Op.in]: missingLids } },
              { remoteJid: { [Op.in]: missingLids } }
            ]
          },
          attributes: ["id", "name", "number", "canonicalNumber", "profilePicUrl", "lidJid", "remoteJid"]
        });
        
        for (const c of lidContacts) {
          const key = c.lidJid || c.remoteJid;
          if (key && !lidContactMap.has(key)) {
            lidContactMap.set(key, c);
          }
        }
      }
    } catch (err) {
      logger.warn(`[GetGroupParticipants] Erro ao buscar mapeamento LID: ${err}`);
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

    // =====================================================================
    // BAILEYS V7 COMPATIBILITY: GroupMetadata.participants structure changed
    // =====================================================================
    // Baileys v7: When id is LID, phoneNumber field is present
    // Baileys v7: When id is PN, lid field is present
    // Ref: https://baileys.wiki/docs/migration/to-v7.0.0
    // =====================================================================
    
    if (isLid) {
      // BAILEYS V7: Quando id é LID, phoneNumber vem no próprio participante
      const baileysPhoneNumber = (p as any).phoneNumber;
      
      if (baileysPhoneNumber && typeof baileysPhoneNumber === 'string') {
        const { canonical } = normalizePhoneNumber(baileysPhoneNumber);
        if (canonical) {
          participantNumber = canonical;
          isValidPhoneNumber = true;
        }
      }

      // Buscar contato pelo mapeamento das mensagens salvas (se ainda não temos número)
      if (!isValidPhoneNumber) {
        const mappedContact = lidContactMap.get(participantJid);
        if (mappedContact) {
          const contactNum = (mappedContact.canonicalNumber || mappedContact.number || "").replace(/\D/g, "");
          if (contactNum.length >= 7 && contactNum.length <= 15) {
            participantNumber = contactNum;
            isValidPhoneNumber = true;
          }
          resolvedName = mappedContact.name || null;
          contactRecord = mappedContact as Contact;
        }
      }
    } else {
      // Participante com número real (@s.whatsapp.net)
      const { canonical } = normalizePhoneNumber(rawNumber);
      participantNumber = canonical || rawNumber;
      isValidPhoneNumber = isValidCanonicalPhoneNumber(participantNumber) && participantNumber.replace(/\D/g, "").length <= 14;
      contactRecord = contactsMap.get(participantNumber) || contactsMap.get(rawNumber) || null;
      
      if (contactRecord) {
        logger.info(`[GetGroupParticipants] Contato encontrado para ${participantJid}: ${contactRecord.name} (ID: ${contactRecord.id}, avatar: ${contactRecord.profilePicUrl ? 'sim' : 'não'})`);
      } else {
        logger.debug(`[GetGroupParticipants] Contato NÃO encontrado para ${participantJid} (número: ${participantNumber}, raw: ${rawNumber})`);
      }
    }

    // Tentar resolver via store do Baileys (pushNames)
    if (!resolvedName) {
      try {
        const store = (wbot as any).store;
        if (store?.contacts?.[participantJid]) {
          const bc = store.contacts[participantJid];
          
          // Capturar phoneNumber do store se ainda não temos
          if (isLid && !isValidPhoneNumber && bc.phoneNumber) {
            const realNumber = bc.phoneNumber.replace(/\D/g, "");
            if (realNumber.length >= 7 && realNumber.length <= 15) {
              participantNumber = realNumber;
              isValidPhoneNumber = true;
            }
          }

          // Capturar nome
          resolvedName = bc.name || bc.notify || bc.verifiedName || null;
        }
      } catch {
        // Ignorar erros do store
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

    // Determinar nome: prioridade 1) senderName do chat, 2) resolvido (Baileys), 3) contato do banco, 4) pushName, 5) número
    let contactName: string;
    const senderNameFromChat = senderNameMap.get(participantJid);
    
    if (senderNameFromChat && senderNameFromChat.trim() !== '') {
      contactName = senderNameFromChat;
      logger.debug(`[GetGroupParticipants] Usando senderName do chat para ${participantJid}: ${contactName}`);
    } else if (resolvedName) {
      contactName = resolvedName;
    } else if (contactRecord?.name) {
      contactName = contactRecord.name;
    } else if (p.name) {
      contactName = p.name;
    } else if (p.notify) {
      contactName = p.notify;
    } else if (isValidPhoneNumber) {
      contactName = `+${participantNumber}`;
    } else {
      contactName = "Participante";
    }

    // Número exibido: preferir número real formatado com DDI
    let displayNumber: string;
    if (isValidPhoneNumber && participantNumber.length >= 10 && participantNumber.length <= 14) {
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
      // Se tiver nome (notify/pushName), usa ele. Se não, oculta o ID técnico.
      displayNumber = p.notify || resolvedName || "Participante";
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
      profilePicUrl: contactRecord?.profilePicUrl || contactRecord?.urlPicture || profilePicUrl,
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
