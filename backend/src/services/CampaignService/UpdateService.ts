import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import ContactList from "../../models/ContactList";
import Queue from "../../models/Queue";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";

interface Data {
  id: number | string;
  name: string;
  status: string;
  confirmation: boolean;
  scheduledAt: string;
  companyId: number;
  contactListId: number;
  whatsappId?: number;
  message1?: string;
  message2?: string;
  message3?: string;
  message4?: string;
  message5?: string;
  confirmationMessage1?: string;
  confirmationMessage2?: string;
  confirmationMessage3?: string;
  confirmationMessage4?: string;
  confirmationMessage5?: string;
  userId: number | string;
  queueId: number | string;
  statusTicket: string;
  openTicket: string;
  dispatchStrategy?: string; // 'single' | 'round_robin'
  allowedWhatsappIds?: number[] | string | null;
  // Mídia por mensagem (1..5)
  mediaUrl1?: string | null;
  mediaName1?: string | null;
  mediaUrl2?: string | null;
  mediaName2?: string | null;
  mediaUrl3?: string | null;
  mediaName3?: string | null;
  mediaUrl4?: string | null;
  mediaName4?: string | null;
  mediaUrl5?: string | null;
  mediaName5?: string | null;
  metaTemplateName?: string | null;
  metaTemplateLanguage?: string | null;
}

const UpdateService = async (data: Data): Promise<Campaign> => {
  const { id } = data;

  const record = await Campaign.findByPk(id);

  if (!record) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  // Permite edição apenas de campanhas que não estão em andamento ou finalizadas
  if (["INATIVA", "PROGRAMADA", "CANCELADA"].indexOf(data.status) === -1) {
    throw new AppError(
      "Só é permitido alterar campanha Inativa, Programada ou Cancelada (Pausada)",
      400
    );
  }

  if (
    data.scheduledAt != null &&
    data.scheduledAt != "" &&
    data.status === "INATIVA"
  ) {
    data.status = "PROGRAMADA";
  }

  // Serializa allowedWhatsappIds se vier como array/objeto
  const payload: any = { ...data };
  if (
    payload.allowedWhatsappIds != null &&
    typeof payload.allowedWhatsappIds !== "string"
  ) {
    try {
      payload.allowedWhatsappIds = JSON.stringify(payload.allowedWhatsappIds);
    } catch (e) {
      payload.allowedWhatsappIds = String(payload.allowedWhatsappIds);
    }
  }

  await record.update(payload);

  await record.reload({
    include: [
      { model: ContactList },
      { model: Whatsapp, attributes: ["id", "name"] },
      { model: User, attributes: ["id", "name"] },
      { model: Queue, attributes: ["id", "name"] },
    ]
  });

  return record;
};

export default UpdateService;
