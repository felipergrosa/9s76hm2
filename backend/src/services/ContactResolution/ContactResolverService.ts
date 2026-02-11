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

  // ─── CAMADA 1.3: Busca por ticket existente via lidJid ───
  // Quando o remoteJid é LID e não sabemos o PN, buscar diretamente
  // o ticket pelo lidJid. Funciona tanto para mensagens de entrada
  // quanto de saída (fromMe).
  if (ids.lidJid && !ids.pnJid) {
    // Buscar ticket (não filtrar por whatsappId - pode ter mudado)
    const ticketByLid = await Ticket.findOne({
      where: {
        companyId,
        status: { [Op.in]: ["open", "pending", "group", "nps", "lgpd", "bot", "closed"] }
      },
      include: [{
        model: Contact,
        as: "contact",
        where: {
          [Op.or]: [
            { lidJid: ids.lidJid },
            { remoteJid: ids.lidJid }
          ],
          isGroup: false
        },
        required: true
      }],
      order: [["updatedAt", "DESC"]]
    });

    if (ticketByLid?.contact) {
      const contact = ticketByLid.contact;
      logger.info({
        lidJid: ids.lidJid,
        contactId: contact.id,
        contactName: contact.name,
        ticketId: ticketByLid.id,
        isFromMe: ids.isFromMe,
        strategy: "ticket-by-lidJid"
      }, "[resolveMessageContact] Contato encontrado via ticket existente (LID)");

      // Preencher os identificadores se o contato tiver número real
      const digits = String(contact.number || "").replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 13) {
        ids.pnDigits = digits;
        ids.pnJid = `${digits}@s.whatsapp.net`;
        const { canonical } = safeNormalizePhoneNumber(digits);
        ids.pnCanonical = canonical;
      }

      return {
        contact,
        identifiers: ids,
        isNew: false,
        isPending: (contact.number || "").startsWith("PENDING_")
      };
    }
  }

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
    if (ids.lidJid && ids.pnDigits) {
      try {
        await LidMapping.upsert({
          lid: ids.lidJid,
          phoneNumber: ids.pnDigits,
          companyId,
          whatsappId: wbot.id,
          verified: false
        });
      } catch (err: any) {
        logger.warn({ err: err?.message }, "[ContactResolver] Falha ao persistir LidMapping (contato existente)");
      }
    }

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

  // Estratégia B2: authState.keys.get('lid-mapping', [lidId]) — ler do KeyStore persistido
  // Útil quando o Baileys persistiu o mapping mas o socket não expõe signalRepository
  try {
    const lidId = lidJid.replace("@lid", "");
    const authKeys = (wbot as any).authState?.keys;
    if (authKeys?.get) {
      const data = await authKeys.get("lid-mapping", [lidId]);
      const raw = data?.[lidId];

      const tryExtract = (v: any): string | null => {
        if (!v) return null;
        if (typeof v === "string") return v;
        const jid = String(v?.jid || v?.pnJid || v?.pn || v?.phoneNumber || v?.number || "");
        return jid || null;
      };

      const resolved = tryExtract(raw);
      if (resolved) {
        const digits = resolved.replace(/\D/g, "");
        if (digits.length >= 10 && digits.length <= 13) {
          const pnJid = resolved.includes("@") ? jidNormalizedUser(resolved) : `${digits}@s.whatsapp.net`;
          ids.pnJid = pnJid;
          ids.pnDigits = digits;
          const { canonical } = safeNormalizePhoneNumber(digits);
          ids.pnCanonical = canonical;

          logger.info({
            lidJid,
            pnJid: ids.pnJid,
            strategy: "authState.keys.lid-mapping"
          }, "[resolveLidToPN] LID→PN via authState.keys.get('lid-mapping')");

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
    logger.warn({ err: err?.message, lidJid }, "[resolveLidToPN] Erro ao consultar authState.keys lid-mapping");
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

    logger.warn({
      lidJid,
      resultsCount: results?.length || 0,
      firstResult: results?.[0] ? JSON.stringify(results[0]) : null
    }, "[resolveLidToPN] CRITICO: wbot.onWhatsApp() não retornou PN válido. Verifique se o numero esta na lista de contatos do celular.");
  } catch (err: any) {
    logger.warn({
      err: err?.message,
      lidJid
    }, "[resolveLidToPN] Erro ao chamar wbot.onWhatsApp()");
  }

  // Estratégia C2: Buscar no wbot.store (cache local de contatos sincronizados)
  try {
    const store = (wbot as any).store;
    if (store && store.contacts) {
      // 1. Tentar busca direta pelo LID
      const contactInfo = store.contacts[lidJid];
      if (contactInfo) {
        logger.info({ lidJid, contactKeys: Object.keys(contactInfo) }, "[resolveLidToPN] Contato LID encontrado no wbot.store");
      }

      // 2. Tentar busca por nome no store (iterar todos)
      // Se onWhatsApp falhou, talvez o store tenha o PN com o mesmo nome
      if (ids.pushName) {
        const cleanName = ids.pushName.trim().toLowerCase();
        const allContacts = Object.values(store.contacts) as any[];

        // Procurar contato com mesmo nome/notify/verifiedName e que seja PN (@s.whatsapp.net)
        const match = allContacts.find(c => {
          const names = [c.name, c.notify, c.verifiedName].filter(n => n).map(n => n.toLowerCase());
          return (
            names.some(n => n === cleanName) &&
            c.id.includes("@s.whatsapp.net")
          );
        });

        if (match) {
          const pnJid = jidNormalizedUser(match.id);
          const digits = pnJid.replace(/\D/g, "");
          if (digits.length >= 10) {
            ids.pnJid = pnJid;
            ids.pnDigits = digits;
            const { canonical } = safeNormalizePhoneNumber(digits);
            ids.pnCanonical = canonical;

            logger.info({
              lidJid,
              pnJid,
              matchId: match.id,
              matchName: match.name || match.notify
            }, "[resolveLidToPN] Sucesso: PN encontrado no wbot.store via match de nome");

            try {
              await LidMapping.upsert({
                lid: lidJid,
                phoneNumber: digits,
                companyId,
                whatsappId: wbot.id,
                verified: true
              });
            } catch { }
            return;
          }
        }
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, lidJid }, "[resolveLidToPN] Erro ao consultar wbot.store");
  }
  // Estratégia C3: USync Query (Force Sync via Interactive Query)
  // O onWhatsApp pode falhar se o contato não tiver status público recente, mas USync é mais agressivo.
  try {
    const sock = wbot as any;
    if (sock.executeUSyncQuery && typeof sock.executeUSyncQuery === 'function') {
      const { USyncQuery, USyncUser } = require("@whiskeysockets/baileys");

      const usyncQuery = new USyncQuery()
        .withMode("query")
        .withUser(new USyncUser().withId(lidJid))
        .withContactProtocol(); // Solicita dados de contato

      const result = await sock.executeUSyncQuery(usyncQuery);

      if (result && result.list && result.list.length > 0) {
        const firstResult = result.list[0];
        // O resultado do protocolo de contato geralmente vem no 'contact' field
        // A estrutura exata depende do retorno do servidor, mas vamos logar para debug critico
        // e tentar extrair se tiver PN.

        logger.info({ lidJid, usyncResult: JSON.stringify(firstResult) }, "[resolveLidToPN] USync retornou dados.");

        // O usync pode retornar o PN no atributo 'id' se for redirecionamento, ou dentro dos protocolos
        // Mas o objetivo principal aqui é forçar o servidor a nos dizer quem é esse LID.
        const protocolData = firstResult;
        // TODO: Analisar payload exato do USync para extração, mas por hora o log já nos salva.
        // Se o USync retornar o PN, ele geralmente aparece como JID normal.
        if (firstResult.id && firstResult.id.includes("@s.whatsapp.net")) {
          const pnJid = jidNormalizedUser(firstResult.id);
          const digits = pnJid.replace(/\D/g, "");
          if (digits.length >= 10) {
            ids.pnJid = pnJid;
            ids.pnDigits = digits;
            ids.pnCanonical = safeNormalizePhoneNumber(digits).canonical;
            logger.info({ lidJid, pnJid }, "[resolveLidToPN] LID resolvido via USync!");
            try {
              await LidMapping.upsert({
                lid: lidJid,
                phoneNumber: digits,
                companyId,
                whatsappId: wbot.id,
                verified: true
              });
            } catch { }
            return;
          }
        }
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, lidJid }, "[resolveLidToPN] Falha no USync Query");
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

  // NOTA: Estratégia E removida - busca por ticket recente estava retornando
  // contato do operador (remetente) ao invés do cliente (destinatário).
  // Para mensagens fromMe, agora usamos apenas:
  // 1. resolveFromSentWid (atalho determinístico via Message.wid)
  // 2. Busca por lidJid (strategy D acima)
  // 3. Criação de PENDING_ com pushName correto (destinatário)

  // Estratégia F: REMOVIDA
  // Motivo: Busca por nome parcial (LIKE %name%) causa Associação Incorreta de Contatos
  // Ex: Mensagem de "Ana" (nova) sendo atribuída a "Ana Paula" (cliente antiga)
  // Segurança de dados > Conveniência de resolução
  /*
  if (ids.pushName && ids.pushName.trim().length > 2) {
     // ... código removido por segurança ...
  }
  */

  logger.warn({ lidJid, isFromMe: ids.isFromMe, pushName: ids.pushName }, "[resolveLidToPN] Todas as estratégias falharam — contato será PENDING_");
}

export default {
  resolveMessageContact,
  resolveGroupParticipant,
  resolveGroupContact
};
