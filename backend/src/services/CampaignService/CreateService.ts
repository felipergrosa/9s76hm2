import * as Yup from "yup";
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import ContactList from "../../models/ContactList";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";

interface Data {
  name: string;
  status: string;
  confirmation: boolean;
  scheduledAt: string;
  companyId: number;
  contactListId: number;
  whatsappId?: number;
  tagListId?: string | number | null;
  negativeTagListIds?: number[] | string | null;
  campaignTagId?: string | number | null;
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
  contactListIds?: number[] | string | null;
  userId: number | string;
  userIds?: number[] | string | null;
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
  metaTemplateVariables?: Record<string, any> | null;  // Mapeamento de variáveis do template
  sendMediaSeparately?: boolean;  // Enviar mídia separada do texto
  // Recorrência do disparo: none | daily | weekly | monthly + data limite opcional
  recurrence?: string | null;
  recurrenceEndAt?: string | null;
}

// Valores aceitos para recorrência — qualquer outro vira "none"
const RECURRENCE_VALUES = ["none", "daily", "weekly", "monthly"];

// N2: extrai IDs numéricos de campo que pode vir como número, array ou JSON string
const toIdList = (value: any): number[] => {
  if (value === null || value === undefined || value === "") return [];
  let arr: any[] = Array.isArray(value) ? value : [value];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) arr = parsed;
    } catch { /* valor escalar */ }
  }
  return arr.map(Number).filter((n: number) => Number.isInteger(n));
};

// N2: garante que FKs referenciadas pertencem ao tenant da empresa
const assertSameCompany = async (
  model: any,
  ids: number[],
  companyId: number,
  label: string
): Promise<void> => {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  const found = await model.count({ where: { id: unique, companyId } });
  if (found !== unique.length) {
    throw new AppError(`${label} não pertence a esta empresa`, 400);
  }
};

// Canais que suportam disparo em massa (channelType null = baileys legado)
const WHATSAPP_CHANNEL_TYPES = ["baileys", "official"];

// N2: impede apontar campanha para instagram/facebook/telegram/webchat —
// esses canais falhariam silenciosamente no dispatch
const assertWhatsappChannel = async (
  ids: number[],
  companyId: number
): Promise<void> => {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  // NOT IN não casa NULL — legados sem channelType passam como baileys
  const nonWhatsapp = await Whatsapp.count({
    where: {
      id: unique,
      companyId,
      channelType: { [Op.notIn]: WHATSAPP_CHANNEL_TYPES }
    }
  });
  if (nonWhatsapp > 0) {
    throw new AppError(
      "Campanhas só podem usar conexões WhatsApp (Baileys ou API Oficial)",
      400
    );
  }
};

const CreateService = async (data: Data): Promise<Campaign> => {
  const { name } = data;

  const ticketnoteSchema = Yup.object().shape({
    name: Yup.string()
      .min(3, "ERR_CAMPAIGN_INVALID_NAME")
      .required("ERR_CAMPAIGN_REQUIRED")
  });

  try {
    await ticketnoteSchema.validate({ name });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // Status inicial é definido pelo servidor: nunca confiar no cliente.
  // EM_ANDAMENTO/FINALIZADA na criação virariam campanhas zumbis
  // (nenhum fluxo enfileira campanhas criadas nesses estados).
  if (!["INATIVA", "PROGRAMADA", "CANCELADA"].includes(data.status)) {
    data.status = "INATIVA";
  }

  if (data.scheduledAt != null && data.scheduledAt != "") {
    data.status = "PROGRAMADA";
  } else if (data.status === "PROGRAMADA") {
    // PROGRAMADA sem agendamento nunca é capturada pelo cron → INATIVA
    data.status = "INATIVA";
  }

  // Normaliza recorrência: valor fora da whitelist vira "none" e
  // recurrenceEndAt só faz sentido com recorrência ativa
  if (!data.recurrence || !RECURRENCE_VALUES.includes(data.recurrence)) {
    data.recurrence = "none";
  }
  if (data.recurrence === "none") {
    data.recurrenceEndAt = null;
  }

  // N2: valida que todas as FKs informadas pertencem ao tenant antes de gravar
  await assertSameCompany(ContactList, toIdList(data.contactListId), data.companyId, "Lista de contatos");
  await assertSameCompany(ContactList, toIdList(data.contactListIds), data.companyId, "Listas de contatos");
  await assertSameCompany(Tag, toIdList(data.tagListId), data.companyId, "Tag");
  await assertSameCompany(Tag, toIdList(data.negativeTagListIds), data.companyId, "Tags de exclusão");
  await assertSameCompany(Tag, toIdList(data.campaignTagId), data.companyId, "Tag de controle");
  await assertSameCompany(Whatsapp, toIdList(data.whatsappId), data.companyId, "Conexão WhatsApp");
  await assertSameCompany(Whatsapp, toIdList(data.allowedWhatsappIds), data.companyId, "Conexões permitidas");
  await assertWhatsappChannel(
    [...toIdList(data.whatsappId), ...toIdList(data.allowedWhatsappIds)],
    data.companyId
  );
  await assertSameCompany(Queue, toIdList(data.queueId), data.companyId, "Fila");
  await assertSameCompany(User, toIdList(data.userId), data.companyId, "Usuário");
  await assertSameCompany(User, toIdList(data.userIds), data.companyId, "Usuários");

  // Serializa allowedWhatsappIds e contactListIds se vierem como array/objeto
  const payload: any = { ...data };

  // "" vindo do formulário ("Nenhuma") não é inteiro válido → null
  if (payload.campaignTagId === "" || payload.campaignTagId === undefined) {
    payload.campaignTagId = null;
  } else if (payload.campaignTagId !== null) {
    payload.campaignTagId = Number(payload.campaignTagId);
  }
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

  if (
    payload.userIds != null &&
    typeof payload.userIds !== "string"
  ) {
    try {
      payload.userIds = JSON.stringify(payload.userIds);
    } catch (e) {
      payload.userIds = String(payload.userIds);
    }
  }

  if (
    payload.contactListIds != null &&
    typeof payload.contactListIds !== "string"
  ) {
    try {
      payload.contactListIds = JSON.stringify(payload.contactListIds);
    } catch (e) {
      payload.contactListIds = String(payload.contactListIds);
    }
  }

  if (
    payload.negativeTagListIds != null &&
    typeof payload.negativeTagListIds !== "string"
  ) {
    try {
      payload.negativeTagListIds = JSON.stringify(payload.negativeTagListIds);
    } catch (e) {
      payload.negativeTagListIds = String(payload.negativeTagListIds);
    }
  }

  const record = await Campaign.create(payload);

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

export default CreateService;
