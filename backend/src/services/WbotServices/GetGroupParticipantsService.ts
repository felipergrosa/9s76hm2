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

  // Obter instância do Baileys com auto-recovery
  // Aguarda até 30s pela sessão se estiver sendo recuperada
  const wbot = await getWbotOrRecover(whatsappId, 30000);
  if (!wbot) {
    throw new Error("Não foi possível obter a sessão WhatsApp. Tente novamente em alguns segundos.");
  }

  // Buscar metadados do grupo via Baileys
  // PROTEÇÃO: Timeout para prevenir travamento do websocket
  let groupMetadata: any;
  try {
    const TIMEOUT_MS = 10000; // 10 segundos timeout
    
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

  logger.info(`[GetGroupParticipants] Total de participantes LID: ${lidParticipantJids.length}`);

  const lidContactMap = new Map<string, Contact>();
  if (lidParticipantJids.length > 0) {
    try {
      // Buscar tickets deste grupo
      const groupTickets = await Ticket.findAll({
        where: { contactId, companyId, isGroup: true },
        attributes: ["id"]
      });
      const ticketIds = groupTickets.map(t => t.id);

      logger.info(`[GetGroupParticipants] Tickets do grupo: ${ticketIds.length}`);

      if (ticketIds.length > 0) {
        // Buscar senderName diretamente das mensagens (não depende do contactId)
        // Isso resolve o problema de mensagens salvas com contactId do grupo
        const sequelize = Contact.sequelize!;
        
        // PRIMEIRA BUSCA: Apenas no grupo atual
        const senderMappings: any[] = await sequelize.query(`
          SELECT DISTINCT ON (m.participant)
            m.participant,
            m."senderName"
          FROM "Messages" m
          WHERE m."ticketId" IN (:ticketIds)
            AND m."fromMe" = false
            AND m.participant IN (:participants)
            AND m."senderName" IS NOT NULL
            AND m."senderName" != ''
          ORDER BY m.participant, m.id DESC
        `, {
          replacements: { ticketIds, participants: lidParticipantJids },
          type: QueryTypes.SELECT
        });

        logger.info(`[GetGroupParticipants] senderName no grupo atual: ${senderMappings.length}`);
        senderMappings.forEach(m => {
          logger.info(`[GetGroupParticipants] senderName: ${m.participant} → "${m.senderName}"`);
        });

        // Salvar senderNames no mapa para uso posterior
        for (const row of senderMappings) {
          if (row.senderName) {
            lidContactMap.set(row.participant, {
              name: row.senderName,
              number: null,
              canonicalNumber: null,
              profilePicUrl: null
            } as any);
          }
        }

        // SEGUNDA BUSCA: Buscar senderName em TODOS os grupos da empresa para LIDs não encontrados
        const missingLids = lidParticipantJids.filter((lid: string) => !lidContactMap.has(lid));
        if (missingLids.length > 0) {
          logger.info(`[GetGroupParticipants] Buscando ${missingLids.length} LIDs em outros grupos da empresa...`);
          
          const globalSenderMappings: any[] = await sequelize.query(`
            SELECT DISTINCT ON (m.participant)
              m.participant,
              m."senderName"
            FROM "Messages" m
            JOIN "Tickets" t ON t.id = m."ticketId"
            WHERE t."companyId" = :companyId
              AND t."isGroup" = true
              AND m."fromMe" = false
              AND m.participant IN (:participants)
              AND m."senderName" IS NOT NULL
              AND m."senderName" != ''
            ORDER BY m.participant, m.id DESC
          `, {
            replacements: { companyId, participants: missingLids },
            type: QueryTypes.SELECT
          });

          logger.info(`[GetGroupParticipants] senderName em outros grupos: ${globalSenderMappings.length}`);
          globalSenderMappings.forEach(m => {
            logger.info(`[GetGroupParticipants] senderName global: ${m.participant} → "${m.senderName}"`);
            lidContactMap.set(m.participant, {
              name: m.senderName,
              number: null,
              canonicalNumber: null,
              profilePicUrl: null
            } as any);
          });
        }

        // Buscar também contatos individuais via contactId (para ter número real)
        const contactMappings: any[] = await sequelize.query(`
          SELECT DISTINCT ON (m.participant)
            m.participant,
            m."contactId",
            c.name,
            c.number,
            c."canonicalNumber",
            c."profilePicUrl"
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

        logger.info(`[GetGroupParticipants] Contatos individuais encontrados: ${contactMappings.length}`);
        contactMappings.forEach(m => {
          logger.info(`[GetGroupParticipants] Contato: ${m.participant} → ${m.name} (${m.number})`);
        });

        // Sobrescrever com contatos reais (têm mais dados)
        for (const row of contactMappings) {
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
      logger.info(`[GetGroupParticipants] Contatos com LID no banco: ${lidContacts.length}`);
      for (const c of lidContacts) {
        if (c.lidJid && !lidContactMap.has(c.lidJid)) lidContactMap.set(c.lidJid, c);
        if (c.remoteJid && !lidContactMap.has(c.remoteJid)) lidContactMap.set(c.remoteJid, c);
      }
    } catch (err) {
      logger.warn(`[GetGroupParticipants] Erro ao buscar contatos por LID: ${err}`);
    }
  }

  logger.info(`[GetGroupParticipants] lidContactMap final: ${lidContactMap.size} entradas`);

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
      
      // LOG DETALHADO: Mostrar objeto completo do participante
      logger.info(`[GetGroupParticipants] LID ${participantJid} - Dados do participante:`, {
        id: p.id,
        phoneNumber: (p as any).phoneNumber,
        name: p.name,
        notify: p.notify,
        admin: p.admin,
        // Mostrar todas as propriedades disponíveis
        allKeys: Object.keys(p)
      });
      
      if (baileysPhoneNumber && typeof baileysPhoneNumber === 'string') {
        const { canonical } = normalizePhoneNumber(baileysPhoneNumber);
        if (canonical) {
          participantNumber = canonical;
          isValidPhoneNumber = true;
          logger.info(`[GetGroupParticipants] LID ${participantJid} resolvido via phoneNumber direto: ${participantNumber}`);
        }
      }

      // Buscar contato pelo mapeamento das mensagens salvas (se ainda não temos número)
      if (!isValidPhoneNumber) {
        contactRecord = lidContactMap.get(participantJid) || null;

        if (contactRecord) {
          logger.info(`[GetGroupParticipants] LID ${participantJid} encontrado no lidContactMap:`, {
            name: contactRecord.name,
            number: contactRecord.number,
            canonicalNumber: contactRecord.canonicalNumber
          });
          // Usar número real do contato encontrado
          const contactNum = (contactRecord.canonicalNumber || contactRecord.number || "").replace(/\D/g, "");
          if (contactNum.length >= 7 && contactNum.length <= 15) {
            participantNumber = contactNum;
            isValidPhoneNumber = true;
          }
          resolvedName = contactRecord.name || null;
        } else {
          logger.info(`[GetGroupParticipants] LID ${participantJid} NÃO encontrado no lidContactMap`);
        }
      }
    } else {
      // Participante com número real (@s.whatsapp.net)
      const { canonical } = normalizePhoneNumber(rawNumber);
      participantNumber = canonical || rawNumber;
      isValidPhoneNumber = isValidCanonicalPhoneNumber(participantNumber) && participantNumber.replace(/\D/g, "").length <= 14;
      contactRecord = contactsMap.get(participantNumber) || contactsMap.get(rawNumber) || null;
    }

    // NOVO: Tentar resolver via store do Baileys (chats/contacts) para TODOS os tipos de participantes
    // O store mantém mapeamento LID -> phoneNumber e também pushNames (notify)
    // NOTA: Para Baileys v7, phoneNumber já vem diretamente no objeto do participante quando é LID
    if (!resolvedName) {
      try {
        const store = (wbot as any).store;
        if (store && store.contacts) {
          const allContacts = Object.values(store.contacts) as any[];
          const baileysContact = allContacts.find(c => c.id === participantJid);

          if (baileysContact) {
            logger.info(`[GetGroupParticipants] LID ${participantJid} encontrado no store:`, {
              id: baileysContact.id,
              name: baileysContact.name,
              notify: baileysContact.notify,
              verifiedName: baileysContact.verifiedName,
              phoneNumber: baileysContact.phoneNumber,
              allKeys: Object.keys(baileysContact)
            });
            
            // Capturar phoneNumber do store (fallback para quando não veio diretamente no participante)
            if (isLid && !isValidPhoneNumber) {
              const realNumber = baileysContact.phoneNumber ||
                baileysContact.id?.split("@")[0]?.replace(/\D/g, "");
              if (realNumber && realNumber.length >= 7 && realNumber.length <= 15) {
                participantNumber = realNumber;
                isValidPhoneNumber = true;
                logger.info(`[GetGroupParticipants] LID ${participantJid} resolvido via store: ${participantNumber}`);
              }
            }

            // Capturar pushName (notify) se não tivermos nome ainda
            if (!resolvedName) {
              resolvedName = baileysContact.name ||
                baileysContact.notify ||
                baileysContact.verifiedName || null;
              if (resolvedName) {
                logger.info(`[GetGroupParticipants] LID ${participantJid} nome resolvido via store: ${resolvedName}`);
              }
            }
          } else {
            logger.info(`[GetGroupParticipants] LID ${participantJid} NÃO encontrado no store (total contatos: ${allContacts.length})`);
          }
        } else {
          logger.warn(`[GetGroupParticipants] Store não disponível ou sem contatos`);
        }
      } catch (err) {
        logger.warn(`[GetGroupParticipants] Erro ao acessar store para ${participantJid}: ${err}`);
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
    
    logger.info(`[GetGroupParticipants] Resolvendo nome para ${participantJid}:`, {
      resolvedName,
      contactRecordName: contactRecord?.name,
      pName: p.name,
      pNotify: p.notify,
      isValidPhoneNumber,
      participantNumber
    });
    
    if (resolvedName) {
      contactName = resolvedName;
      logger.info(`[GetGroupParticipants] Usando resolvedName: "${contactName}"`);
    } else if (contactRecord?.name) {
      contactName = contactRecord.name;
      logger.info(`[GetGroupParticipants] Usando contactRecord.name: "${contactName}"`);
    } else if (p.name) {
      // Nome direto do participante no metadata do grupo
      contactName = p.name;
      logger.info(`[GetGroupParticipants] Usando p.name: "${contactName}"`);
    } else if (p.notify) {
      // pushName do WhatsApp (campo "notify" no Baileys)
      contactName = p.notify;
      logger.info(`[GetGroupParticipants] Usando p.notify: "${contactName}"`);
    } else if (isValidPhoneNumber) {
      contactName = `+${participantNumber}`;
      logger.info(`[GetGroupParticipants] Usando número: "${contactName}"`);
    } else {
      // Fallback final: Se for LID ou inválido, não exibir o número
      contactName = "Participante";
      logger.warn(`[GetGroupParticipants] FALLBACK para "Participante" - participantJid: ${participantJid}`);
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
