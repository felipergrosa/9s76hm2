import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbotOrRecover } from "../../libs/wbot";
import { safeNormalizePhoneNumber } from "../../utils/phone";

const CheckContactNumber = async (
  number: string,
  companyId: number,
  isGroup: boolean = false
): Promise<string> => {
  const whatsapp = await GetDefaultWhatsApp(null, companyId);

  // Conexão API oficial ou Meta (facebook/instagram/webchat): apenas
  // normaliza o número, sem consulta remota — esses canais não têm socket
  // Baileys e não sabem consultar "onWhatsApp".
  if (whatsapp.channelType === "official" ||
      (whatsapp.channel && whatsapp.channel !== "whatsapp")) {
    if (isGroup) {
      throw new AppError("Validação de grupos não suportada via API oficial");
    }

    const { canonical } = safeNormalizePhoneNumber(number);
    return canonical || number.replace(/\D/g, "");
  }

  // Fluxo padrão Baileys (Web)
  // CORREÇÃO: Usar getWbotOrRecover para aguardar sessão durante reconexão
  const wbot = await getWbotOrRecover(whatsapp.id, 30000);
  if (!wbot) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }

  let numberArray;

  if (isGroup) {
    // PROTEÇÃO: Timeout para prevenir travamento do websocket
    const grupoMeta = await Promise.race([
      wbot.groupMetadata(number),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout ao verificar grupo')), 10000)
      )
    ]) as any;
    
    numberArray = [
      {
        jid: grupoMeta.id,
        exists: true
      }
    ];
  } else {
    const { canonical } = safeNormalizePhoneNumber(number);
    const digits = canonical || number.replace(/\D/g, "");
    numberArray = await wbot.onWhatsApp(`${digits}@s.whatsapp.net`);
  }

  const isNumberExit = numberArray;

  if (!isNumberExit[0]?.exists) {
    throw new AppError("Este número não está cadastrado no whatsapp");
  }

  return isGroup ? number.split("@")[0] : isNumberExit[0].jid.split("@")[0];
};

export default CheckContactNumber;