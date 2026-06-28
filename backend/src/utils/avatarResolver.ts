import logger from "./logger";
import type Contact from "../models/Contact";

/**
 * Resolução de avatar do WhatsApp compartilhada.
 *
 * Centraliza a estratégia robusta usada para encontrar a URL da foto de perfil:
 * - múltiplos candidatos de JID (remoteJid, lidJid, número canônico, grupo);
 * - leitura do store do Baileys ANTES de qualquer chamada HTTP (evita timeout/rate-limit);
 * - fallback para wbot.profilePictureUrl tentando tipos "image" e "preview".
 *
 * Reaproveitado por RefreshContactAvatarService e GetProfilePicUrl para que a
 * captura tenha a MESMA cobertura (inclusive contatos baseados em LID).
 */

export const isUsableAvatarUrl = (url: unknown): url is string => {
  if (typeof url !== "string") return false;

  const normalized = url.trim();
  if (!normalized || normalized === "changed") return false;
  if (normalized.includes("/nopicture.png") || normalized.includes("nopicture.png")) return false;

  return /^https?:\/\//i.test(normalized);
};

const uniqueValues = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
};

export const buildAvatarJidCandidates = (contact: Contact): string[] => {
  const rawNumber = String(contact.number || "").replace(/\D/g, "");
  const canonicalNumber = String((contact as any).canonicalNumber || "").replace(/\D/g, "");
  const remoteJid = String(contact.remoteJid || "").trim();
  const lidJid = String((contact as any).lidJid || "").trim();

  if (contact.isGroup) {
    return uniqueValues([
      remoteJid.includes("@") ? remoteJid : null,
      rawNumber ? `${rawNumber}@g.us` : null,
      contact.number?.includes("@g.us") ? contact.number : null
    ]);
  }

  return uniqueValues([
    remoteJid.includes("@") ? remoteJid : null,
    lidJid.includes("@") ? lidJid : null,
    rawNumber ? `${rawNumber}@s.whatsapp.net` : null,
    canonicalNumber ? `${canonicalNumber}@s.whatsapp.net` : null
  ]);
};

/**
 * Constrói candidatos de JID a partir de um número avulso, quando não há objeto Contact.
 */
export const buildJidCandidatesFromNumber = (number: string, isGroup = false): string[] => {
  const rawNumber = String(number || "").replace(/\D/g, "");
  if (!rawNumber) return [];
  return isGroup
    ? [`${rawNumber}@g.us`]
    : [`${rawNumber}@s.whatsapp.net`];
};

export const getStoreAvatarUrl = (
  wbot: any,
  contact: Pick<Contact, "number"> & { canonicalNumber?: string } & Record<string, any>,
  candidateJids: string[]
): string | null => {
  const storeContacts = wbot?.store?.contacts;
  if (!storeContacts) return null;

  for (const jid of candidateJids) {
    const storeContact = storeContacts[jid];
    if (isUsableAvatarUrl(storeContact?.imgUrl)) {
      return storeContact.imgUrl;
    }
  }

  const numberCandidates = new Set(
    [
      contact.number,
      (contact as any).canonicalNumber,
      ...candidateJids
    ]
      .map(value => String(value || "").replace(/\D/g, ""))
      .filter(value => value.length >= 10 && value.length <= 13)
  );

  if (numberCandidates.size === 0) return null;

  for (const [jid, storeContact] of Object.entries<any>(storeContacts)) {
    const storeDigits = String(storeContact?.id || jid || "").replace(/\D/g, "");
    if (numberCandidates.has(storeDigits) && isUsableAvatarUrl(storeContact?.imgUrl)) {
      return storeContact.imgUrl;
    }
  }

  return null;
};

export const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeout: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};

export const fetchProfilePictureUrl = async (
  wbot: any,
  candidateJids: string[],
  timeoutMs: number
): Promise<string | null> => {
  let lastError: any = null;
  const profileTypes: Array<"image" | "preview"> = ["image", "preview"];

  for (const jid of candidateJids) {
    for (const profileType of profileTypes) {
      try {
        const url = await withTimeout(
          wbot.profilePictureUrl(jid, profileType),
          timeoutMs,
          `Timeout ao buscar foto de perfil (${jid}, ${profileType})`
        );

        if (isUsableAvatarUrl(url)) {
          return url;
        }
      } catch (err: any) {
        lastError = err;
        logger.debug(`[avatarResolver] Falha profilePictureUrl para ${jid}/${profileType}: ${err?.message || err}`);
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
};
