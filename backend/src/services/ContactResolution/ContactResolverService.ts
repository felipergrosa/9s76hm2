import { proto, WASocket, jidNormalizedUser } from "@whiskeysockets/baileys";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import LidMapping from "../../models/LidMapping";
import logger from "../../utils/logger";
import { extractMessageIdentifiers, ExtractedIdentifiers } from "./extractMessageIdentifiers";
import { resolveContact } from "./resolveContact";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import { safeNormalizePhoneNumber, isRealPhoneNumber } from "../../utils/phone";
import RefreshContactAvatarService from "../ContactServices/RefreshContactAvatarService";

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
  /** Se precisa de resolução de LID (contato não foi criado) */
  needsLidResolution?: boolean;
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

  // ─── CAMADA 0: Verificação de Self-LID (Correção de "Novo Grupo") ───
  // Se o LID for do próprio bot, NÃO criar contato - é mensagem do próprio bot
  const botId = wbot.user?.id;
  const botLid = botId?.includes("@lid") ? jidNormalizedUser(botId) : null;

  // Se o bot não sabe seu próprio LID, tentar descobrir nos keys
  let myLid = botLid;
  if (!myLid) {
    const authState = (wbot as any).authState;
    myLid = authState?.creds?.me?.lid;
  }

  // Verificar se o remoteJid/LID é do próprio bot
  const isSelfMessage = myLid && jidNormalizedUser(myLid) === ids.lidJid;

  if (ids.lidJid && !ids.isFromMe && isSelfMessage) {
    // Mensagem recebida de outro dispositivo do próprio bot
    logger.info({
      lidJid: ids.lidJid,
      myLid,
      originalFromMe: ids.isFromMe
    }, "[resolveMessageContact] LID identificado como sendo o próprio bot. Forçando isFromMe=true.");
    ids.isFromMe = true;
  }

  // Se é mensagem do próprio bot (fromMe=true e remoteJid é LID do bot), IGNORAR
  // Não deve criar contato para o próprio bot
  if (ids.isFromMe && isSelfMessage) {
    logger.info({
      lidJid: ids.lidJid,
      myLid,
      isFromMe: ids.isFromMe
    }, "[resolveMessageContact] Mensagem do próprio bot para si mesmo. Ignorando criação de contato.");
    
    // Retornar null para indicar que não deve processar esta mensagem
    // O chamador deve verificar e ignorar
    return {
      contact: null as any,
      identifiers: ids,
      isNew: false,
      isPending: true,
      needsLidResolution: false
    };
  }

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

      // Validação: O contato encontrado tem um número válido?
      const digits = String(contact.number || "").replace(/\D/g, "");
      const hasValidNumber = isRealPhoneNumber(digits) && !contact.number?.includes("@lid");

      if (hasValidNumber) {
        logger.info({
          lidJid: ids.lidJid,
          contactId: contact.id,
          contactName: contact.name,
          ticketId: ticketByLid.id,
          isFromMe: ids.isFromMe,
          strategy: "ticket-by-lidJid"
        }, "[resolveMessageContact] Contato encontrado via ticket existente (LID)");

        ids.pnDigits = digits;
        ids.pnJid = `${digits}@s.whatsapp.net`;
        const { canonical } = safeNormalizePhoneNumber(digits);
        ids.pnCanonical = canonical;

        return {
          contact,
          identifiers: ids,
          isNew: false,
          isPending: (contact.number || "").startsWith("PENDING_")
        };
      } else {
        logger.info({
          lidJid: ids.lidJid,
          contactId: contact.id,
          ticketId: ticketByLid.id,
          currentNumber: contact.number
        }, "[resolveMessageContact] Ticket encontrado via LID, mas contato não tem PN válido. Tentando resolver...");
        // Não retorna aqui! Deixa cair para o Layer 1.5 (resolveLidToPN)
        // Se resolver lá, vamos atualizar este contato nas próximas etapas ou aqui mesmo?
        // O ideal é deixar o fluxo seguir para Layer 1.5 e depois verificar novamente se temos contato.
      }

      // Refresh Avatar (async throttle)
      RefreshContactAvatarService({
        contactId: contact.id,
        companyId,
        whatsappId: wbot.id
      });
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
        if (isRealPhoneNumber(digits)) {
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

    // pushName NÃO é usado para atualizar contatos existentes
    // pushName só deve ser preenchido quando name == number (tratado no CreateOrUpdateContactService)

    // CORREÇÃO CRÍTICA: Se descobrimos o PN agora (via LidMapping ou USync),
    // mas o contato foi encontrado pelo LID (e tem number = LID ou PENDING),
    // devemos atualizar o number/remoteJid para o PN real!
    if (ids.pnJid && ids.pnDigits) {
      const currentNumber = existingContact.number || "";
      const isLidNumber = currentNumber.includes("@lid") || currentNumber.includes("@") || currentNumber.startsWith("PENDING_");
      // Se number não parece um telefone válido (tem letras, @, ou length errado)
      const currentDigits = currentNumber.replace(/\D/g, "");
      const isInvalidNumber = currentDigits.length < 10 && ids.pnDigits.length >= 10;

      if (isLidNumber || isInvalidNumber) {
        try {
          await existingContact.update({
            number: ids.pnDigits,
            remoteJid: ids.pnJid,
            canonicalNumber: ids.pnCanonical || undefined
          });

          logger.info({
            contactId: existingContact.id,
            oldNumber: currentNumber,
            newNumber: ids.pnDigits,
            strategy: "enrich-existing-contact"
          }, "[resolveMessageContact] Contato atualizado com PN descoberto");
        } catch (err: any) {
          logger.warn({ err: err?.message }, "[resolveMessageContact] Falha ao atualizar contato com PN descoberto");
        }
      }
    }

    // Refresh Avatar (async throttle)
    RefreshContactAvatarService({
      contactId: existingContact.id,
      companyId,
      whatsappId: wbot.id
    });

    return {
      contact: existingContact,
      identifiers: ids,
      isNew: false,
      isPending: (existingContact.number || "").startsWith("PENDING_")
    };
  }

  // ─── CAMADA 3: Criação (último recurso) ───
  const contactRemoteJid = ids.pnJid || ids.lidJid;
  const isLidOnly = !ids.pnDigits && !!ids.lidJid;

  let newContact: Contact | null = null;

  // IMPORTANTE: Para mensagens fromMe, o pushName é do REMETENTE (usuário), não do DESTINATÁRIO
  // Não usar pushName para nomear contato em mensagens enviadas pelo próprio usuário
  const effectivePushName = ids.isFromMe ? null : ids.pushName;

  if (!isLidOnly) {
    // CASO A: Temos o número real (PN) → criar contato normalmente
    // Para fromMe, usar número como nome se não houver outra fonte
    const contactName = effectivePushName || ids.pnDigits;
    const contactNumber = ids.pnDigits || "";

    logger.info({
      contactNumber,
      contactName,
      strategy: "CreateOrUpdateContactService-PN"
    }, "[ContactResolver] Criando contato com número real");

    newContact = await CreateOrUpdateContactService({
      name: contactName,
      number: contactNumber,
      isGroup: false,
      companyId,
      whatsappId: wbot.id,
      remoteJid: contactRemoteJid,
      wbot,
      checkProfilePic: true
    });
  }

  if (!newContact && isLidOnly) {
    // =================================================================
    // BAILEYS v7: Aceitar LID como identificador válido
    // =================================================================
    // Documentação oficial: "THE GOAL OF YOUR PROGRAM SHOULDN'T BE TO 
    // RESTORE THE PN JID ANYMORE, MIGRATE TO LIDs"
    // 
    // Quando um cliente nos chama, o WhatsApp pode enviar apenas LID
    // (sem número) em alguns casos:
    // - Usuário com privacidade restrita
    // - Usuário não está na agenda do celular
    // - Sessão nova sem mapeamento sincronizado
    //
    // SOLUÇÃO: Tentar resolver LID proativamente antes de criar PENDING_
    // =================================================================
    
    // Para mensagens fromMe, o pushName é do REMETENTE, não do destinatário
    // Usar um nome genérico baseado no LID ou número
    const contactName = effectivePushName || ids.lidJid?.replace("@lid", "") || "Contato";
    
    logger.info({
      lidJid: ids.lidJid,
      contactName,
      strategy: "LID-proactive-resolution"
    }, "[ContactResolver] Tentando resolver LID proativamente...");

    // ═══════════════════════════════════════════════════════════════════
    // TENTAR RESOLVER LID PROATIVAMENTE via LidResolverService
    // ═══════════════════════════════════════════════════════════════════
    try {
      const LidResolverService = (await import("./LidResolverService")).default;
      const resolution = await LidResolverService.resolveLidToPhoneNumber(
        ids.lidJid!,
        wbot,
        companyId,
        contactName
      );

      if (resolution.success && resolution.phoneNumber) {
        logger.info({
          lidJid: ids.lidJid,
          phoneNumber: resolution.phoneNumber,
          strategy: resolution.strategy
        }, "[ContactResolver] LID resolvido proativamente!");

        // Criar contato com número real
        newContact = await CreateOrUpdateContactService({
          name: contactName,
          number: resolution.phoneNumber,
          isGroup: false,
          companyId,
          remoteJid: resolution.pnJid,
          lidJid: ids.lidJid,
          pushName: effectivePushName || contactName,  // Não usar pushName do remetente para fromMe
          whatsappId: wbot.id,
          wbot
        });

        if (newContact) {
          logger.info({
            contactId: newContact.id,
            phoneNumber: resolution.phoneNumber,
            strategy: resolution.strategy
          }, "[ContactResolver] Contato criado com número real via resolução proativa");

          return {
            contact: newContact,
            identifiers: ids,
            isNew: true,
            isPending: false
          };
        }
      }
    } catch (resolveErr: any) {
      logger.warn({
        err: resolveErr?.message,
        lidJid: ids.lidJid
      }, "[ContactResolver] Resolução proativa falhou, criando contato PENDING_");
    }

    // ═══════════════════════════════════════════════════════════════════
    // FALLBACK: Criar contato PENDING_ (aguardando resolução futura)
    // ═══════════════════════════════════════════════════════════════════
    logger.info({
      lidJid: ids.lidJid,
      contactName,
      strategy: "LID-accept"
    }, "[ContactResolver] Criando contato com LID como identificador temporário (aguardando número real)");

    try {
      const CompaniesSettings = (await import("../../models/CompaniesSettings")).default;
      const settings = await CompaniesSettings.findOne({ where: { companyId } });
      const acceptAudioMessageContact = (settings as any)?.acceptAudioMessageContact === "enabled";

      // Criar contato com LID como identificador
      // number = PENDING_<lid> (identificador temporário até descobrir o número real)
      // remoteJid = LID (para buscas futuras)
      // lidJid = LID (para reconciliação)
      const pendingNumber = `PENDING_${ids.lidJid}`;
      
      newContact = await Contact.findOrCreate({
        where: {
          companyId,
          [Op.or]: [
            { remoteJid: ids.lidJid },
            { lidJid: ids.lidJid },
            { number: pendingNumber }
          ]
        },
        defaults: {
          name: contactName,
          number: pendingNumber, // PENDING_<lid> como identificador temporário
          isGroup: false,
          companyId,
          remoteJid: ids.lidJid,
          lidJid: ids.lidJid,
          channel: "whatsapp",
          acceptAudioMessage: acceptAudioMessageContact,
          whatsappId: wbot.id
        }
      }).then(([c]) => c);
      
      logger.info({
        contactId: newContact?.id,
        lidJid: ids.lidJid,
        contactName
      }, "[ContactResolver] Contato criado com LID - número será atualizado quando revelado");
      
    } catch (createErr: any) {
      logger.error({ err: createErr?.message, lidJid: ids.lidJid }, "[ContactResolver] Falha ao criar contato LID");
      throw new Error(`LID_CREATION_FAILED: Não foi possível criar contato para ${ids.lidJid}`);
    }
  }

  if (!newContact) {
    // Fallback final: CreateOrUpdateContactService retornou null por outro motivo
    logger.error({ ids }, "[ContactResolver] Não foi possível criar contato por nenhuma estratégia");
    throw new Error(`CONTACT_CREATION_FAILED: Sem PN e sem LID para criar contato`);
  }

  // Refresh Avatar (async throttle) - O Service já faz, mas mal não faz garantir
  /*
  RefreshContactAvatarService({
    contactId: newContact.id,
    companyId,
    whatsappId: wbot.id
  });
  */

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
      if (isRealPhoneNumber(digits)) {
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
      if (isRealPhoneNumber(digits)) {
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
        if (isRealPhoneNumber(digits)) {
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
        if (isRealPhoneNumber(digits)) {
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
        if (isRealPhoneNumber(digits)) {
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
      // IMPORTANTE: Não usar para mensagens fromMe (pushName é do remetente, não do destinatário)
      if (ids.pushName && !ids.isFromMe) {
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
      if (isRealPhoneNumber(digits)) {
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
