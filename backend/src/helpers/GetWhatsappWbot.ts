import { getWbotOrRecover } from "../libs/wbot";
import Whatsapp from "../models/Whatsapp";

const GetWhatsappWbot = async (whatsapp: Whatsapp) => {
  // CORREÇÃO: Usar getWbotOrRecover para aguardar sessão durante reconexão
  const wbot = await getWbotOrRecover(whatsapp.id, 30000);
  return wbot;
};

export default GetWhatsappWbot;
