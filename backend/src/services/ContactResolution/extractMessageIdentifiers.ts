import { proto, jidNormalizedUser, WASocket } from "@whiskeysockets/baileys";
import { safeNormalizePhoneNumber } from "../../utils/phone";
import logger from "../../utils/logger";

/**
 * CAMADA 1: EXTRAÇÃO (pura, sem I/O de banco)
 *
 * Extrai identificadores de contato de uma mensagem Baileys.
 * Usa remoteJidAlt / participantAlt quando disponíveis (Baileys v6.8+).
 * Tenta signalRepository.getPNForLID como fallback in-memory.
 *
 * Retorno DETERMINÍSTICO: zero banco, zero efeito colateral.
 */

export interface ExtractedIdentifiers {
  /** JID de telefone real (@s.whatsapp.net) normalizado, ou null se desconhecido */
  pnJid: string | null;
  /** Dígitos do telefone real (ex: "5515999887766"), ou null */
  pnDigits: string | null;
  /** Canonical normalizado via safeNormalizePhoneNumber, ou null */
  pnCanonical: string | null;
  /** LID completo (@lid), ou null se mensagem não envolve LID */
  lidJid: string | null;
  /** pushName do remetente */
  pushName: string;
  /** Se é mensagem de grupo */
  isGroup: boolean;
  /** Se é mensagem enviada por nós */
  isFromMe: boolean;
  /** JID original do grupo (para busca de grupo) */
  groupJid: string | null;
}

type Session = WASocket & { id?: number; store?: any };

export function extractMessageIdentifiers(
  msg: proto.IWebMessageInfo,
  wbot: Session
): ExtractedIdentifiers {
  const key = msg.key;
  const remoteJid = key.remoteJid || "";
  const isGroup = remoteJid.includes("@g.us");
  const isFromMe = !!key.fromMe;

  // Para grupos: identificar o participante, não o grupo
  // Para DMs: identificar o remetente via remoteJid
  let primaryJid: string;
  let altJid: string | null = null;

  if (isGroup) {
    primaryJid = key.participant || (key as any).participantAlt || "";
    altJid = (key as any).participantAlt || null;
    // Se participant é LID e participantAlt é PN, usar Alt
    if (!altJid && (key as any).remoteJidAlt) {
      // remoteJidAlt em grupo não é o participante, ignorar
    }
  } else {
    primaryJid = remoteJid;
    altJid = (key as any).remoteJidAlt || null;
  }

  // Se fromMe, manter remoteJid como destinatário (correção crítica)
  // O remoteJid contém o JID da pessoa que RECEBEU a mensagem
  // NÃO devemos usar o JID do remetente (nós mesmos)

  // Normalizar primaryJid
  if (primaryJid) {
    try {
      primaryJid = jidNormalizedUser(primaryJid);
    } catch {
      // Manter como está se normalização falhar
    }
  }

  const isLid = primaryJid?.includes("@lid");
  const isPn = primaryJid?.includes("@s.whatsapp.net");

  let pnJid: string | null = null;
  let lidJid: string | null = null;

  if (isLid) {
    lidJid = primaryJid;

    // Estratégia 1: usar altJid se for PN válido
    if (altJid && altJid.includes("@s.whatsapp.net")) {
      const altDigits = altJid.replace(/\D/g, "");
      if (altDigits.length >= 10 && altDigits.length <= 13) {
        pnJid = jidNormalizedUser(altJid);
      }
    }

    // Estratégia 2: consultar signalRepository in-memory (sem I/O de banco)
    if (!pnJid) {
      try {
        const signalRepo = (wbot as any).authState?.keys?.signalRepository;
        if (signalRepo?.getPNForLID) {
          const pn = signalRepo.getPNForLID(primaryJid);
          if (pn) {
            const pnDigits = pn.replace(/\D/g, "");
            if (pnDigits.length >= 10 && pnDigits.length <= 13) {
              pnJid = jidNormalizedUser(pn);
            }
          }
        }
      } catch {
        // signalRepository não disponível - ok, seguir sem PN
      }
    }

    // Estratégia 3: campo senderPn do Baileys (se existir)
    if (!pnJid) {
      const senderPn = (msg as any).senderPn;
      if (senderPn) {
        const spDigits = senderPn.replace(/\D/g, "");
        if (spDigits.length >= 10 && spDigits.length <= 13) {
          pnJid = senderPn.includes("@") ? jidNormalizedUser(senderPn) : `${spDigits}@s.whatsapp.net`;
        }
      }
    }
  } else if (isPn) {
    pnJid = primaryJid;
    // Não temos LID neste caso (pode ser preenchido depois via lid-mapping.update)
  }

  // Extrair dígitos e canonical do PN
  let pnDigits: string | null = null;
  let pnCanonical: string | null = null;

  if (pnJid) {
    pnDigits = pnJid.replace(/\D/g, "");
    const { canonical } = safeNormalizePhoneNumber(pnDigits);
    pnCanonical = canonical;
  }

  const result: ExtractedIdentifiers = {
    pnJid,
    pnDigits,
    pnCanonical,
    lidJid,
    pushName: msg.pushName || "",
    isGroup,
    isFromMe,
    groupJid: isGroup ? remoteJid : null
  };

  logger.debug({ ...result, msgId: key.id }, "[extractMessageIdentifiers] Identificadores extraídos");

  return result;
}
