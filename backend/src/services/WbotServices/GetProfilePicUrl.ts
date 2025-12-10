import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
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

  const wbot = getWbot(defaultWhatsapp.id);

  let profilePicUrl: string;
  try {
    profilePicUrl = await wbot.profilePictureUrl(
      contact && contact.isGroup ? contact.remoteJid : `${number}@s.whatsapp.net`,
      "image"
    );
  } catch (error) {
    profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
  }

  return profilePicUrl;
};

export default GetProfilePicUrl;
