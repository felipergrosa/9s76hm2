import AppError from "../../errors/AppError";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";
import { CheckNumberOfficial } from "../MetaServices/CheckNumberOfficial";

const CheckContactNumber = async (
  number: string,
  companyId: number,
  isGroup: boolean = false
): Promise<string> => {
  const whatsapp = await GetDefaultWhatsApp(null, companyId);

  // Se a conexão padrão for API Oficial, usar fluxo próprio
  if (whatsapp.channelType === "official") {
    // Para grupos pela API Oficial não há suporte a validação direta
    if (isGroup) {
      throw new AppError("Validação de grupos não suportada via API oficial");
    }

    const waId = await CheckNumberOfficial(number, companyId);

    if (!waId) {
      throw new AppError("Este número não está cadastrado no whatsapp");
    }

    // CheckNumberOfficial já retorna o número normalizado (sem +)
    return waId;
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
    numberArray = await wbot.onWhatsApp(`${number}@s.whatsapp.net`);
  }

  const isNumberExit = numberArray;

  if (!isNumberExit[0]?.exists) {
    throw new AppError("Este número não está cadastrado no whatsapp");
  }

  return isGroup ? number.split("@")[0] : isNumberExit[0].jid.split("@")[0];
};

export default CheckContactNumber;