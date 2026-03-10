import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbotOrRecover } from "../../libs/wbot";
import Contact from "../../models/Contact";

const GetProfilePicUrl = async (
  number: string,
  companyId: number,
  contact?: Contact,
): Promise<string> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(null, companyId);

  // Se a conexão padrão for API oficial, não há como buscar avatar do contato.
  // Retorna diretamente o avatar padrão para evitar ERR_WAPP_NOT_INITIALIZED.
  if (defaultWhatsapp.channelType === "official") {
    return `${process.env.FRONTEND_URL}/nopicture.png`;
  }

  // CORREÇÃO: Usar getWbotOrRecover para aguardar sessão durante reconexão
  const wbot = await getWbotOrRecover(defaultWhatsapp.id, 30000);
  if (!wbot) {
    return `${process.env.FRONTEND_URL}/nopicture.png`;
  }

  let profilePicUrl: string;
  try {
    // PROTEÇÃO: Timeout para prevenir travamento do websocket durante HTTP request
    profilePicUrl = await Promise.race([
      wbot.profilePictureUrl(
        contact && contact.isGroup ? contact.remoteJid : `${number}@s.whatsapp.net`,
        "image"
      ),
      new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout ao buscar foto de perfil')), 5000)
      )
    ]);
  } catch (error) {
    profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
  }

  return profilePicUrl;
};

export default GetProfilePicUrl;
