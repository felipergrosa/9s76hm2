import AppError from "../../errors/AppError";
import CampaignSetting from "../../models/CampaignSetting";

interface Data {
  id: number | string,
  companyId: number,
  value?: any,
  messageInterval: number | string,
  longerIntervalAfter: number | string,
  greaterInterval: number | string,
  variables: any[],
  sabado: boolean,
  domingo: boolean,
  startHour: string,
  endHour: string
}

const UpdateServiceCampaignSettings = async (data: Data): Promise<CampaignSetting> => {
  const { id, companyId } = data;

  // N2 (IDOR): só localiza configuração do próprio tenant
  const record = await CampaignSetting.findOne({ where: { id, companyId } });

  if (!record) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  // N2 (mass assignment): atualiza apenas o campo value (evita trocar key/companyId)
  await record.update({ value: data.value });

  // await record.reload({
  //   include: [
  //     { model: ContactList },
  //     { model: Whatsapp, attributes: ["id", "name"] }
  //   ]
  // });

  return record;
};

export default UpdateServiceCampaignSettings;
