import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbotOrRecover } from "../../libs/wbot";
import Contact from "../../models/Contact";
import logger from "../../utils/logger";
import {
  buildAvatarJidCandidates,
  buildJidCandidatesFromNumber,
  getStoreAvatarUrl,
  fetchProfilePictureUrl
} from "../../utils/avatarResolver";

const GetProfilePicUrl = async (
  number: string,
  companyId: number,
  contact?: Contact,
): Promise<string> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(null, companyId);
  const fallback = `${process.env.FRONTEND_URL}/nopicture.png`;

  // Se a conexão padrão for API oficial, não há como buscar avatar do contato.
  // Retorna diretamente o avatar padrão para evitar ERR_WAPP_NOT_INITIALIZED.
  if (defaultWhatsapp.channelType === "official") {
    return fallback;
  }

  // CORREÇÃO: Usar getWbotOrRecover para aguardar sessão durante reconexão
  const wbot = await getWbotOrRecover(defaultWhatsapp.id, 30000);
  if (!wbot) {
    return fallback;
  }

  // Estratégia robusta (mesma do RefreshContactAvatarService): tenta múltiplos
  // candidatos de JID. Quando há um Contact, cobre remoteJid/lidJid/canônico —
  // essencial para contatos baseados em LID, que falhavam com o JID único.
  const candidateJids = contact
    ? buildAvatarJidCandidates(contact)
    : buildJidCandidatesFromNumber(number, !!contact?.isGroup);

  const jids = candidateJids.length
    ? candidateJids
    : [`${String(number).replace(/\D/g, "")}@s.whatsapp.net`];

  try {
    // Store-first: usa a imgUrl já sincronizada pela sessão, evitando HTTP/timeout/rate-limit.
    const storeUrl = getStoreAvatarUrl(wbot, contact || ({ number } as any), jids);
    if (storeUrl) {
      return storeUrl;
    }

    // PROTEÇÃO: timeout por tentativa para não travar o websocket em request HTTP.
    const fetched = await fetchProfilePictureUrl(wbot, jids, 5000);
    return fetched || fallback;
  } catch (error) {
    logger.debug(
      `[GetProfilePicUrl] Falha ao buscar avatar para ${number}: ${(error as any)?.message || error}`
    );
    return fallback;
  }
};

export default GetProfilePicUrl;
