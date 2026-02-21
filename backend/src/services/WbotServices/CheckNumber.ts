import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import { safeNormalizePhoneNumber } from "../../utils/phone";

const CheckContactNumber = async (
  number: string,
  companyId: number,
  isGroup: boolean = false
): Promise<string> => {
  const whatsapp = await GetDefaultWhatsApp(null, companyId);

  // Conexão API oficial: apenas normaliza o número para formato internacional,
  // sem consulta remota nem erro de "não cadastrado".
  if (whatsapp.channelType === "official") {
    if (isGroup) {
      throw new AppError("Validação de grupos não suportada via API oficial");
    }

    const { canonical } = safeNormalizePhoneNumber(number);
    return canonical || number.replace(/\D/g, "");
  }

  // Fluxo padrão Baileys (Web)
  const wbot = getWbot(whatsapp.id);

  let numberArray;

  if (isGroup) {
    const grupoMeta = await wbot.groupMetadata(number);
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