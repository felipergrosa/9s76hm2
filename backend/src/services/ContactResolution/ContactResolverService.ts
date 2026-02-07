import { proto, WASocket, jidNormalizedUser } from "@whiskeysockets/baileys";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import LidMapping from "../../models/LidMapping";
import logger from "../../utils/logger";
import { extractMessageIdentifiers, ExtractedIdentifiers } from "./extractMessageIdentifiers";
import { resolveContact } from "./resolveContact";
import { createContact } from "./createContact";
import { safeNormalizePhoneNumber } from "../../utils/phone";

/**
 * ContactResolverService — Orquestrador das 3 camadas de resolução de contato.
 *
 * Fluxo:
 *   1. extractMessageIdentifiers() — extrai pnJid, lidJid, pushName da mensagem (sem I/O)
 *   2. resolveContact() — busca contato existente no banco (até 3 queries)
 *   3. createContact() — cria contato se resolução retorna null
 *
 * Também persiste mapeamento LID↔PN quando ambos são conhecidos.
 */

type Session = WASocket & { id?: number; store?: any };

export interface ContactResolutionResult {
  /** Contato resolvido (existente ou recém-criado) */
  contact: Contact;
  /** Identificadores extraídos da mensagem */
  identifiers: ExtractedIdentifiers;
  /** Se o contato foi criado nesta resolução */
  isNew: boolean;
  /** Se é um contato pendente (sem número real) */
  isPending: boolean;
}

/**
 * Resolve o contato de uma mensagem WhatsApp.
 * Ponto de entrada único — substitui getContactMessage + verifyContact.
 */
export async function resolveMessageContact(
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number
): Promise<ContactResolutionResult> {
  // ─── CAMADA 1: Extração (pura, sem I/O) ───
  const ids = extractMessageIdentifiers(msg, wbot);

  // ─── CAMADA 1.4: Atalho determinístico (fromMe + LID) via histórico local (Message.wid) ───
  // Quando você envia mensagem pelo painel, salvamos no banco com wid = msg.key.id.
  // Se o Baileys entregar o remoteJid como LID e não fornecer PN/Alt, usamos o wid para achar o ticket/contato real.
  if (ids.isFromMe && ids.lidJid && !ids.pnJid && msg?.key?.id) {
    const contactByWid = await resolveFromSentWid(msg.key.id, ids.lidJid, companyId, wbot);
    if (contactByWid) {
      try {
        const digits = String(contactByWid.number || "").replace(/\D/g, "");
        if (digits.length >= 10 && digits.length <= 13) {
          ids.pnDigits = digits;
          ids.pnJid = `${digits}@s.whatsapp.net`;
          const { canonical } = safeNormalizePhoneNumber(digits);
          ids.pnCanonical = canonical;
        }
      } catch {
        // Não bloquear fluxo
      }
      return {
        contact: contactByWid,
        identifiers: ids,
        isNew: false,
        isPending: (contactByWid.number || "").startsWith("PENDING_")
      };
    }
  }

  // ─── CAMADA 1.5: Resolução async LID→PN (quando extração não conseguiu) ───
  if (ids.lidJid && !ids.pnJid) {
    await resolveLidToPN(ids, wbot, companyId, msg);
  }

  // ─── CAMADA 2: Resolução (busca, sem criação) ───
  const { contact: existingContact, pnFromMapping } = await resolveContact(ids, companyId);

  if (existingContact) {
    // Atualizar pushName se necessário (sem sobrescrever nome personalizado)
    if (ids.pushName && existingContact.name !== ids.pushName) {
      const currentName = (existingContact.name || "").trim();
      const currentNumber = (existingContact.number || "").replace(/\D/g, "");
      const currentIsNumber = currentName === currentNumber || currentName === "";

      // Só atualizar se nome atual é vazio ou é o próprio número
      if (currentIsNumber) {
        try {
          await existingContact.update({ name: ids.pushName });
        } catch {
          // Não bloquear fluxo por falha de atualização de nome
        }
      }
    }

    return {
      contact: existingContact,
      identifiers: ids,
      isNew: false,
      isPending: (existingContact.number || "").startsWith("PENDING_")
    };
  }

  // ─── CAMADA 3: Criação (último recurso) ───
  const newContact = await createContact(ids, companyId, wbot, pnFromMapping);

  // Persistir mapeamento LID↔PN se ambos conhecidos
  if (ids.lidJid && ids.pnDigits) {
    try {
      await LidMapping.upsert({
        lid: ids.lidJid,
        phoneNumber: ids.pnDigits,
        companyId,
        whatsappId: wbot.id,
        verified: true
      });
    } catch (err: any) {
      logger.warn({ err: err?.message }, "[ContactResolver] Falha ao persistir LidMapping");
    }
  }

  return {
    contact: newContact,
    identifiers: ids,
    isNew: true,
    isPending: (newContact.number || "").startsWith("PENDING_")
  };
}

/**
 * Resolve contato para mensagem de grupo.
 * Retorna o contato do PARTICIPANTE (remetente), não do grupo.
 * O contato do grupo em si é tratado separadamente.
 */
export async function resolveGroupParticipant(
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number
): Promise<ContactResolutionResult> {
  // Para grupos, extractMessageIdentifiers já extrai o participant
  return resolveMessageContact(msg, wbot, companyId);
}

/**
 * Resolve contato de grupo (o grupo em si, não o participante).
 */
export async function resolveGroupContact(
  msg: proto.IWebMessageInfo,
  wbot: Session,
  companyId: number
): Promise<Contact> {
  const remoteJid = msg.key.remoteJid || "";
  if (!remoteJid.includes("@g.us")) {
    throw new Error("[resolveGroupContact] Mensagem não é de grupo");
  }

  const groupNumber = remoteJid.replace("@g.us", "");

  // Buscar grupo existente
  const existing = await Contact.findOne({
    where: {
      companyId,
      isGroup: true,
      number: remoteJid
    }
  });

  if (existing) return existing;

  // Buscar por número sem @g.us
  const existingByNumber = await Contact.findOne({
    where: {
      companyId,
      isGroup: true,
      number: groupNumber
    }
  });

  if (existingByNumber) return existingByNumber;

  // Buscar metadados do grupo
  let groupName = remoteJid;
  try {
    const groupMetadata = await wbot.groupMetadata(remoteJid);
    groupName = groupMetadata?.subject || remoteJid;
  } catch {
    // Se não conseguir metadados, usar JID como nome
  }

  // Criar contato do grupo via serviço existente
  const CreateOrUpdateContactService = (
    await import("../ContactServices/CreateOrUpdateContactService")
  ).default;

  const groupContact = await CreateOrUpdateContactService({
    name: groupName,
    number: remoteJid,
    isGroup: true,
    companyId,
    remoteJid,
    whatsappId: wbot.id,
    wbot
  });

  return groupContact;
}

async function resolveFromSentWid(
  wid: string,
  lidJid: string,
  companyId: number,
  wbot: Session
): Promise<Contact | null> {
  try {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    let msgRow: Message | null = null;

    // Retry curto: o upsert do Baileys pode chegar antes do save via API.
    for (let attempt = 1; attempt <= 3; attempt++) {
      msgRow = await Message.findOne({
        where: {
          companyId,
          wid,
          fromMe: true
        },
        include: [
          {
            model: Ticket,
            as: "ticket",
            required: false,
            include: [{ model: Contact, as: "contact", required: false }]
          },
          { model: Contact, as: "contact", required: false }
        ]
      });
      if (msgRow) break;
      if (attempt < 3) await delay(200);
    }

    if (!msgRow) {
      logger.info({ wid, lidJid, companyId }, "[resolveMessageContact] wid não encontrado no banco (mensagem pode não ter sido enviada pelo painel)");
      return null;
    }

    const contact = (msgRow as any)?.ticket?.contact || (msgRow as any)?.contact || null;
    if (!contact) return null;

    // Atualizar lidJid do contato real para futuras resoluções
    if (!contact.lidJid) {
      try {
        await contact.update({ lidJid });
      } catch {
        // Não bloquear fluxo (pode falhar por constraint unique)
      }
    }

    // Persistir LidMapping com base no number do contato real (cura para próximas mensagens)
    try {
      const digits = String(contact.number || "").replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 13) {
        const whatsappId = (msgRow as any)?.ticket?.whatsappId || wbot.id;
        await LidMapping.upsert({
          lid: lidJid,
          phoneNumber: digits,
          companyId,
          whatsappId,
          verified: false
        });
      }
    } catch {
      // Não bloquear fluxo
    }

    logger.info({
      wid,
      lidJid,
      contactId: contact.id,
      strategy: "sent-wid"
    }, "[resolveMessageContact] Contato resolvido via wid (mensagem enviada)");

    return contact;
  } catch (err: any) {
    logger.warn({ err: err?.message, wid, lidJid }, "[resolveMessageContact] Erro ao resolver via wid");
    return null;
  }
}

/**
 * Resolução async LID→PN.
 * Chamada quando extractMessageIdentifiers retorna lidJid mas sem pnJid.
 * Tenta:
 *   1. LidMapping no banco
 *   2. wbot.onWhatsApp() (chamada ao WhatsApp — resolve LID para número real)
 *
 * Muta o objeto `ids` preenchendo pnJid/pnDigits/pnCanonical se resolver.
 */
async function resolveLidToPN(
  ids: ExtractedIdentifiers,
  wbot: Session,
  companyId: number,
  msg?: proto.IWebMessageInfo
): Promise<void> {
  const lidJid = ids.lidJid!;

  // Estratégia A: LidMapping no banco
  try {
    const mapping = await LidMapping.findOne({
      where: { lid: lidJid, companyId }
    });
    if (mapping?.phoneNumber) {
      const digits = mapping.phoneNumber.replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 13) {
        ids.pnJid = `${digits}@s.whatsapp.net`;
        ids.pnDigits = digits;
        const { canonical } = safeNormalizePhoneNumber(digits);
        ids.pnCanonical = canonical;
        logger.info({
          lidJid,
          pnJid: ids.pnJid,
          strategy: "LidMapping-async"
        }, "[resolveLidToPN] LID→PN via LidMapping");
        return;
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, lidJid }, "[resolveLidToPN] Erro ao consultar LidMapping");
  }

  // Estratégia B: signalRepository.lidMapping.getPNForLID() — API oficial do Baileys v7 (async)
  try {
    const sock = wbot as any;
    const lidStore = sock.signalRepository?.lidMapping;
    if (lidStore?.getPNForLID) {
      const lidId = lidJid.replace("@lid", "");
      const resolvedPN = await lidStore.getPNForLID(lidId);
      if (resolvedPN) {
        const digits = resolvedPN.replace(/\D/g, "");
        if (digits.length >= 10 && digits.length <= 13) {
          const pnJid = resolvedPN.includes("@") ? jidNormalizedUser(resolvedPN) : `${digits}@s.whatsapp.net`;
          ids.pnJid = pnJid;
          ids.pnDigits = digits;
          const { canonical } = safeNormalizePhoneNumber(digits);
          ids.pnCanonical = canonical;

          logger.info({
            lidJid,
            pnJid: ids.pnJid,
            strategy: "signalRepository.lidMapping"
          }, "[resolveLidToPN] LID→PN via signalRepository.lidMapping.getPNForLID()");

          // Persistir mapeamento para futuras consultas
          try {
            await LidMapping.upsert({
              lid: lidJid,
              phoneNumber: digits,
              companyId,
              whatsappId: wbot.id,
              verified: true
            });
          } catch {
            // Não bloquear fluxo
          }

          return;
        }
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, lidJid }, "[resolveLidToPN] Erro ao usar signalRepository.lidMapping");
  }

  // Estratégia C: wbot.onWhatsApp() — consulta direta ao WhatsApp
  try {
    const results = await (wbot as any).onWhatsApp(lidJid);

    if (results && results.length > 0) {
      const result = results[0];
      // result.jid deve ser o PN real (@s.whatsapp.net)
      if (result.jid && result.jid.includes("@s.whatsapp.net")) {
        const pnJid = jidNormalizedUser(result.jid);
        const digits = pnJid.replace(/\D/g, "");
        if (digits.length >= 10 && digits.length <= 13) {
          ids.pnJid = pnJid;
          ids.pnDigits = digits;
          const { canonical } = safeNormalizePhoneNumber(digits);
          ids.pnCanonical = canonical;

          logger.info({
            lidJid,
            pnJid: ids.pnJid,
            strategy: "onWhatsApp"
          }, "[resolveLidToPN] LID→PN via wbot.onWhatsApp()");

          // Persistir mapeamento para futuras consultas
          try {
            await LidMapping.upsert({
              lid: lidJid,
              phoneNumber: digits,
              companyId,
              whatsappId: wbot.id,
              verified: true
            });
          } catch {
            // Não bloquear fluxo
          }

          return;
        }
      }
    }

    logger.info({
      lidJid,
      resultsCount: results?.length || 0,
      firstResult: results?.[0] ? { jid: results[0].jid, exists: results[0].exists } : null
    }, "[resolveLidToPN] wbot.onWhatsApp() não retornou PN válido");
  } catch (err: any) {
    logger.warn({
      err: err?.message,
      lidJid
    }, "[resolveLidToPN] Erro ao chamar wbot.onWhatsApp()");
  }

  // Estratégia D: buscar contato existente pelo lidJid no banco
  // (pode ter sido criado anteriormente com número real)
  try {
    const existingContact = await Contact.findOne({
      where: {
        companyId,
        lidJid,
        isGroup: false
      }
    });

    if (existingContact && existingContact.number && !existingContact.number.startsWith("PENDING_")) {
      const digits = existingContact.number.replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 13) {
        ids.pnJid = `${digits}@s.whatsapp.net`;
        ids.pnDigits = digits;
        const { canonical } = safeNormalizePhoneNumber(digits);
        ids.pnCanonical = canonical;

        logger.info({
          lidJid,
          pnJid: ids.pnJid,
          contactId: existingContact.id,
          strategy: "existing-contact-lidJid"
        }, "[resolveLidToPN] LID→PN via contato existente com lidJid");
        return;
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, lidJid }, "[resolveLidToPN] Erro ao buscar contato por lidJid");
  }

  // Estratégia E: Para mensagens fromMe, buscar ticket recente na mesma conexão
  // Cruza com pushName para encontrar o contato correto
  if (ids.isFromMe && wbot.id) {
    try {
      // Construir filtro do contato: sempre excluir PENDING_ e grupos
      const contactWhere: any = {
        isGroup: false,
        number: { [Op.notLike]: "PENDING_%" }
      };

      // Se temos pushName, filtrar por nome para evitar match errado
      if (ids.pushName && ids.pushName.trim().length > 2) {
        contactWhere.name = ids.pushName.trim();
      }

      const recentTicket = await Ticket.findOne({
        where: {
          companyId,
          whatsappId: wbot.id
        },
        include: [{
          model: Contact,
          as: "contact",
          where: contactWhere,
          required: true
        }],
        order: [["updatedAt", "DESC"]]
      });

      let resolvedContact: Contact | null = recentTicket?.contact || null;
      let resolvedTicketId = recentTicket?.id;

      // Fallback: se não encontrou com filtro de nome, tentar sem filtro
      // MAS apenas se houver exatamente 1 ticket aberto (evita ambiguidade)
      if (!resolvedContact && ids.pushName && ids.pushName.trim().length > 2) {
        const fallbackTickets = await Ticket.findAll({
          where: {
            companyId,
            whatsappId: wbot.id
          },
          include: [{
            model: Contact,
            as: "contact",
            where: {
              isGroup: false,
              number: { [Op.notLike]: "PENDING_%" }
            },
            required: true
          }],
          order: [["updatedAt", "DESC"]],
          limit: 2
        });

        if (fallbackTickets.length === 1 && fallbackTickets[0]?.contact) {
          resolvedContact = fallbackTickets[0].contact;
          resolvedTicketId = fallbackTickets[0].id;
          logger.info({
            lidJid,
            contactName: resolvedContact.name,
            pushName: ids.pushName,
            strategy: "recent-ticket-fromMe-single"
          }, "[resolveLidToPN] Único ticket aberto na conexão — usando como fallback");
        }
      }

      if (resolvedContact) {
        const digits = (resolvedContact.number || "").replace(/\D/g, "");
        if (digits.length >= 10 && digits.length <= 13) {
          ids.pnJid = `${digits}@s.whatsapp.net`;
          ids.pnDigits = digits;
          const { canonical } = safeNormalizePhoneNumber(digits);
          ids.pnCanonical = canonical;

          logger.info({
            lidJid,
            pnJid: ids.pnJid,
            contactId: resolvedContact.id,
            contactName: resolvedContact.name,
            ticketId: resolvedTicketId,
            strategy: "recent-ticket-fromMe"
          }, "[resolveLidToPN] LID→PN via ticket recente (fromMe)");

          // Persistir mapeamento e atualizar lidJid do contato
          try {
            await LidMapping.upsert({
              lid: lidJid,
              phoneNumber: digits,
              companyId,
              whatsappId: wbot.id,
              verified: false
            });
            if (!resolvedContact.lidJid) {
              await resolvedContact.update({ lidJid });
            }
          } catch {
            // Não bloquear fluxo
          }

          return;
        }
      }
    } catch (err: any) {
      logger.warn({ err: err?.message, lidJid }, "[resolveLidToPN] Erro na estratégia de ticket recente");
    }
  }

  // Estratégia F: Buscar contato pelo pushName exato (último recurso)
  // pushName é o nome do destinatário — pode encontrar contato existente
  if (ids.pushName && ids.pushName.trim().length > 2) {
    try {
      const contactByName = await Contact.findOne({
        where: {
          companyId,
          name: ids.pushName.trim(),
          isGroup: false,
          number: { [Op.notLike]: "PENDING_%" }
        },
        order: [["updatedAt", "DESC"]]
      });

      if (contactByName) {
        const digits = (contactByName.number || "").replace(/\D/g, "");
        if (digits.length >= 10 && digits.length <= 13) {
          ids.pnJid = `${digits}@s.whatsapp.net`;
          ids.pnDigits = digits;
          const { canonical } = safeNormalizePhoneNumber(digits);
          ids.pnCanonical = canonical;

          logger.info({
            lidJid,
            pnJid: ids.pnJid,
            contactId: contactByName.id,
            contactName: contactByName.name,
            strategy: "pushName-match"
          }, "[resolveLidToPN] LID→PN via pushName");

          // Persistir mapeamento e atualizar lidJid do contato
          try {
            await LidMapping.upsert({
              lid: lidJid,
              phoneNumber: digits,
              companyId,
              whatsappId: wbot.id,
              verified: false
            });
            if (!contactByName.lidJid) {
              await contactByName.update({ lidJid });
            }
          } catch {
            // Não bloquear fluxo
          }

          return;
        }
      }
    } catch (err: any) {
      logger.warn({ err: err?.message, lidJid }, "[resolveLidToPN] Erro na estratégia pushName");
    }
  }

  logger.warn({ lidJid, isFromMe: ids.isFromMe, pushName: ids.pushName }, "[resolveLidToPN] Todas as estratégias falharam — contato será PENDING_");
}

export default {
  resolveMessageContact,
  resolveGroupParticipant,
  resolveGroupContact
};
