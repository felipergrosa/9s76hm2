import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import ContactList from "../../models/ContactList";
import Queue from "../../models/Queue";
import Tag from "../../models/Tag";
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

// N2 (mass assignment): whitelist explícita de campos editáveis da campanha.
// Nunca aceita id, companyId, mediaPath/mediaName (somente via upload) ou timestamps.
const EDITABLE_FIELDS = [
  "name", "status", "confirmation", "scheduledAt",
  "message1", "message2", "message3", "message4", "message5",
  "confirmationMessage1", "confirmationMessage2", "confirmationMessage3",
  "confirmationMessage4", "confirmationMessage5",
  "contactListId", "contactListIds", "tagListId", "negativeTagListIds",
  "campaignTagId",
  "whatsappId", "userId", "userIds", "queueId",
  "statusTicket", "openTicket", "dispatchStrategy", "allowedWhatsappIds",
  "mediaUrl1", "mediaName1", "mediaUrl2", "mediaName2",
  "mediaUrl3", "mediaName3", "mediaUrl4", "mediaName4",
  "mediaUrl5", "mediaName5", "sendMediaSeparately",
  "metaTemplateName", "metaTemplateLanguage", "metaTemplateVariables",
  "recurrence", "recurrenceEndAt"
];

const UpdateService = async (data: Data): Promise<Campaign> => {
  const { id, companyId } = data;

  // DEBUG: Log para verificar se metaTemplateVariables está chegando
  console.log('[UpdateService] metaTemplateVariables recebido:', JSON.stringify(data.metaTemplateVariables));

  // N2 (IDOR): só localiza campanha do próprio tenant
  const record = await Campaign.findOne({ where: { id, companyId } });

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

  if (
    (data.scheduledAt == null || data.scheduledAt === "") &&
    data.status === "PROGRAMADA"
  ) {
    // PROGRAMADA sem scheduledAt nunca é capturada pelo cron → INATIVA
    data.status = "INATIVA";
  }

  // N2: valida que todas as FKs informadas pertencem ao tenant antes de gravar
  await assertSameCompany(ContactList, toIdList(data.contactListId), companyId, "Lista de contatos");
  await assertSameCompany(ContactList, toIdList(data.contactListIds), companyId, "Listas de contatos");
  await assertSameCompany(Tag, toIdList(data.tagListId), companyId, "Tag");
  await assertSameCompany(Tag, toIdList(data.negativeTagListIds), companyId, "Tags de exclusão");
  await assertSameCompany(Tag, toIdList(data.campaignTagId), companyId, "Tag de controle");
  await assertSameCompany(Whatsapp, toIdList(data.whatsappId), companyId, "Conexão WhatsApp");
  await assertSameCompany(Whatsapp, toIdList(data.allowedWhatsappIds), companyId, "Conexões permitidas");
  await assertWhatsappChannel(
    [...toIdList(data.whatsappId), ...toIdList(data.allowedWhatsappIds)],
    companyId
  );
  await assertSameCompany(Queue, toIdList(data.queueId), companyId, "Fila");
  await assertSameCompany(User, toIdList(data.userId), companyId, "Usuário");
  await assertSameCompany(User, toIdList(data.userIds), companyId, "Usuários");

  // Monta payload apenas com campos da whitelist (impede mass assignment)
  const payload: any = {};
  EDITABLE_FIELDS.forEach(field => {
    if ((data as any)[field] !== undefined) {
      payload[field] = (data as any)[field];
    }
  });

  // Normaliza recorrência: valor fora da whitelist vira "none" e
  // recurrenceEndAt só faz sentido com recorrência ativa
  if (payload.recurrence !== undefined) {
    if (!payload.recurrence || !RECURRENCE_VALUES.includes(payload.recurrence)) {
      payload.recurrence = "none";
    }
    if (payload.recurrence === "none") {
      payload.recurrenceEndAt = null;
    }
  }

  // "" vindo do formulário ("Nenhuma") não é inteiro válido → null
  if (payload.campaignTagId === "") {
    payload.campaignTagId = null;
  } else if (payload.campaignTagId != null) {
    payload.campaignTagId = Number(payload.campaignTagId);
  }

  // Serializa allowedWhatsappIds e contactListIds se vierem como array/objeto
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
