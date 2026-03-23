import AppError from "../../errors/AppError";
import CompaniesSettings from "../../models/CompaniesSettings";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import logger from "../../utils/logger";
import { Op } from "sequelize";
import User from "../../models/User";
import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";
import { safeNormalizePhoneNumber } from "../../utils/phone";
import DispatchContactWebhookService from "./DispatchContactWebhookService";
import CreateContactReleaseRequestService from "./CreateContactReleaseRequestService";

interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  email?: string;
  profilePicUrl?: string;
  acceptAudioMessage?: boolean;
  active?: boolean;
  companyId: number;
  extraInfo?: ExtraInfo[];
  remoteJid?: string;
  userId?: string | number;

  // Novos campos
  cpfCnpj?: string;
  representativeCode?: string;
  city?: string;
  region?: string;
  instagram?: string;
  situation?: 'Ativo' | 'Baixado' | 'Ex-Cliente' | 'Excluido' | 'Futuro' | 'Inativo';
  fantasyName?: string;
  foundationDate?: Date;
  creditLimit?: string;
  segment?: string;
  contactName?: string;
  florder?: boolean;
  dtUltCompra?: Date | string | null;
  vlUltCompra?: number | string | null;
  bzEmpresa?: string;
  clientCode?: string;
  channels?: string[];
}

const shouldReplaceName = (currentName: string | null | undefined, fallbackNumber: string): boolean => {
  const normalized = (currentName || "").trim();
  if (!normalized) return true;

  const digitsOnly = normalized.replace(/\D/g, "");
  return digitsOnly === fallbackNumber;
};

const mergeContactData = (contact: Contact, canonicalNumber: string, payload: any) => {
  const updates: any = {};

  const mergeStringField = (field: string) => {
    const incoming = payload[field];
    if (typeof incoming === "undefined" || incoming === null) return;

    const incomingStr = typeof incoming === "string" ? incoming.trim() : incoming;
    if (incomingStr === "" || incomingStr === null) return;

    const current = (contact as any)[field];
    if (!current || (typeof current === "string" && current.trim() === "")) {
      updates[field] = incoming;
    }
  };

  const mergeDirectField = (field: string) => {
    const incoming = payload[field];
    if (typeof incoming === "undefined" || incoming === null) return;
    const current = (contact as any)[field];
    if (current === null || typeof current === "undefined") {
      updates[field] = incoming;
    }
  };

  mergeStringField("email");
  mergeStringField("representativeCode");
  mergeStringField("city");
  mergeStringField("region");
  mergeStringField("instagram");
  mergeStringField("fantasyName");
  mergeStringField("creditLimit");
  mergeStringField("segment");
  mergeStringField("contactName");
  mergeStringField("bzEmpresa");
  mergeStringField("cpfCnpj");
  mergeStringField("clientCode");

  mergeDirectField("foundationDate");
  mergeDirectField("dtUltCompra");
  mergeDirectField("vlUltCompra");

  if (payload.situation && !contact.situation) {
    updates.situation = payload.situation;
  }

  if (shouldReplaceName(contact.name, canonicalNumber) && payload.name) {
    updates.name = payload.name;
  }

  updates.number = canonicalNumber;
  updates.canonicalNumber = canonicalNumber;

  if (Object.keys(updates).length > 0) {
    return contact.update(updates);
  }

  if (contact.canonicalNumber !== canonicalNumber) {
    return contact.update({ number: canonicalNumber, canonicalNumber });
  }

  return contact;
};

const CreateContactService = async ({
  name,
  number,
  email = "",
  acceptAudioMessage,
  active,
  companyId,
  extraInfo = [],
  remoteJid = "",
  userId,

  // Novos campos
  cpfCnpj,
  representativeCode,
  city,
  region,
  instagram,
  situation,
  fantasyName,
  foundationDate,
  creditLimit,
  segment,
  contactName,
  florder,
  dtUltCompra,
  vlUltCompra,
  bzEmpresa,
  clientCode,
  channels,
}: Request): Promise<Contact> => {
  const { canonical } = safeNormalizePhoneNumber(number);

  if (!canonical) {
    throw new AppError("ERR_INVALID_PHONE_NUMBER");
  }

  // Validação: Bloquear LIDs ou números muito longos que não sejam grupos
  const numberDigits = canonical.replace(/\D/g, "");
  if (numberDigits.length >= 14 && !number.includes("@g.us")) {
    // LIDs tem 15 dígitos, BR tem max 13 (55+2+9).
    // Permitir apenas se for um grupo explicitamente.
    throw new AppError("ERR_INVALID_PHONE_NUMBER_LID");
  }

  const existingContact = await Contact.findOne({
    where: { companyId, canonicalNumber: canonical }
  });

  const cleanCpfCnpj = typeof cpfCnpj === "string" ? cpfCnpj.replace(/\D/g, "") : null;
  const existingByCpfCnpj = cleanCpfCnpj
    ? await Contact.findOne({
      where: {
        companyId,
        cpfCnpj: cleanCpfCnpj,
        ...(existingContact?.id ? { id: { [Op.ne]: existingContact.id } } : {})
      }
    })
    : null;

  const existingLocked = existingContact || existingByCpfCnpj;

  const canUserSeeContact = async (contactId: number, uid: number): Promise<boolean> => {
    const user = await User.findByPk(uid, {
      attributes: ["id", "profile", "allowedContactTags"]
    });
    if (!user) return false;

    // Admin vê tudo (exceto se houver lógica de exclusão específica)
    if (user.profile === "admin") {
      return true;
    }

    // Verificar se usuário tem tags pessoais configuradas
    const userAllowedContactTags = (user as any).allowedContactTags || [];
    
    if (userAllowedContactTags.length > 0) {
      // Filtrar apenas tags pessoais (começam com # mas não com ##)
      const personalTags = await Tag.findAll({
        where: {
          id: { [Op.in]: userAllowedContactTags },
          companyId,
          name: {
            [Op.and]: [
              { [Op.like]: "#%" },
              { [Op.notLike]: "##%" }
            ]
          }
        },
        attributes: ["id"]
      });
      const personalTagIds = personalTags.map(t => t.id);
      
      if (personalTagIds.length > 0) {
        // Contato deve ter PELO MENOS UMA das tags pessoais do usuário
        const hasAnyTag = await ContactTag.findOne({
          where: {
            contactId,
            tagId: { [Op.in]: personalTagIds }
          }
        });
        return !!hasAnyTag;
      }
    }

    // Usuário sem tag pessoal pode ver todos os contatos
    return true;
  };

  // Se já existe (por número ou cpf/cnpj) e quem está tentando criar não pode ver,
  // bloqueia com mensagem amigável para solicitar liberação.
  if (existingLocked && userId) {
    const uid = Number(userId);
    if (Number.isInteger(uid)) {
      const canSee = await canUserSeeContact(existingLocked.id, uid);
      if (!canSee) {
        try {
          await CreateContactReleaseRequestService({
            companyId,
            contactId: existingLocked.id,
            requesterId: uid,
            reason: "Contato já cadastrado, porém não está liberado para sua carteira."
          });
        } catch (e: any) {
          logger.warn(`[CreateContactService] Falha ao criar solicitação de liberação: ${e?.message}`);
        }
        throw new AppError(
          "Contato já cadastrado, porém não está liberado para sua carteira. Solicite a liberação para um administrador.",
          403
        );
      }
    }
  }

  // Validação de CPF/CNPJ
  if (cpfCnpj) {
    const cleanDoc = cpfCnpj.replace(/\D/g, '');
    if (![11, 14].includes(cleanDoc.length)) {
      throw new AppError("CPF/CNPJ inválido");
    }
  }

  const settings = await CompaniesSettings.findOne({
    where: { companyId }
  });

  const { acceptAudioMessageContact } = settings;

  // Função auxiliar para converter strings vazias/whitespace em null
  const emptyToNull = (value: any) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    return value;
  };

  // Definindo a interface para o contactData incluindo o userId como opcional

  // Validação da data de fundação
  let foundationDateValue: Date | null = null;
  if (foundationDate && typeof foundationDate === 'string' && foundationDate !== '') {
    const date = new Date(foundationDate);
    if (isNaN(date.getTime())) {
      throw new AppError("INVALID_FOUNDATION_DATE");
    } else {
      foundationDateValue = date;
    }
  }

  // Converter string vazia para null para foundationDate
  if (typeof foundationDate === 'string' && foundationDate === '') {
    foundationDateValue = null;
  }

  // Validação/normalização da data de última compra
  let dtUltCompraValue: Date | null = null;
  if (dtUltCompra && typeof dtUltCompra === 'string' && dtUltCompra !== '') {
    const d = new Date(dtUltCompra);
    if (isNaN(d.getTime())) {
      throw new AppError("INVALID_LAST_PURCHASE_DATE");
    } else {
      dtUltCompraValue = d;
    }
  }
  if (typeof dtUltCompra === 'string' && dtUltCompra === '') {
    dtUltCompraValue = null;
  }

  // Normalização do valor da última compra (aceita string BRL)
  const MAX_LAST_PURCHASE = 10000000000; // 10 bilhões (limite DECIMAL(12,2))

  const parseMoney = (val: any): number | null => {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'number') return val;
    const cleaned = String(val)
      .replace(/\s+/g, '')
      .replace(/R\$?/gi, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return null;
    if (Math.abs(num) >= MAX_LAST_PURCHASE) {
      throw new AppError("INVALID_LAST_PURCHASE_AMOUNT");
    }
    return num;
  };
  const vlUltCompraValue = parseMoney(vlUltCompra as any);

  const contactData: {
    name: string;
    number: string;
    email: string;
    acceptAudioMessage: boolean;
    active: boolean;
    extraInfo: ExtraInfo[];
    companyId: number;
    remoteJid: string | null;
    cpfCnpj: string | null;
    representativeCode: string | null;
    city: string | null;
    region: string | null;
    instagram: string | null;
    situation: string;
    fantasyName: string | null;
    foundationDate: Date | null;
    creditLimit: string | null;
    userId?: number | string;
    segment: string | null;
    contactName?: string | null;
    florder?: boolean;
    dtUltCompra?: Date | null;
    vlUltCompra?: number | null;
    bzEmpresa?: string | null;
    clientCode?: string | null;
    channels?: string[];
    canonicalNumber: string;
  } = {
    name: name || '',
    number: canonical,
    email: (() => {
      if (email === undefined || email === null) return '';
      const e = typeof email === 'string' ? email.trim() : String(email);
      return e === '' ? '' : e;
    })(),
    acceptAudioMessage: acceptAudioMessageContact === 'enabled' ? true : false,
    active: active !== undefined ? active : true,
    extraInfo: extraInfo || [],
    companyId,
    remoteJid: remoteJid || null,

    // Novos campos com tratamento para valores vazios
    cpfCnpj: emptyToNull(cpfCnpj),
    representativeCode: emptyToNull(representativeCode),
    city: emptyToNull(city),
    region: emptyToNull(region),
    instagram: emptyToNull(instagram),
    situation: situation || 'Ativo',
    fantasyName: emptyToNull(fantasyName),
    foundationDate: foundationDateValue,
    creditLimit: emptyToNull(creditLimit),
    segment: emptyToNull(segment),
    contactName: typeof contactName === 'string' ? (contactName.trim() || null) : null,
    florder: !!florder,
    dtUltCompra: dtUltCompraValue,
    vlUltCompra: vlUltCompraValue,
    bzEmpresa: emptyToNull(bzEmpresa),
    clientCode: emptyToNull(clientCode),
    channels: channels || [],
    canonicalNumber: canonical,
  };

  if (existingContact) {
    const merged = await mergeContactData(existingContact, canonical, {
      ...contactData,
      userId,
      dtUltCompra: dtUltCompraValue,
      vlUltCompra: vlUltCompraValue
    });

    return merged;
  }

  // Apenas adiciona o userId se ele for fornecido
  if (userId) {
    contactData.userId = userId;
  }

  const contact = await Contact.create(contactData, {
    include: ["extraInfo"]
  });

  // Chama o serviço centralizado para atualizar nome/avatar com proteção
  try {
    const RefreshContactAvatarService = (await import("./RefreshContactAvatarService")).default;
    await RefreshContactAvatarService({ contactId: contact.id, companyId });
  } catch (err) {
    logger.warn("Falha ao atualizar avatar/nome centralizado", err);
  }

  // Aplica regras de tags automaticamente (forma assíncrona, não bloqueia)
  setImmediate(async () => {
    try {
      const ApplyTagRulesService = (await import("../TagServices/ApplyTagRulesService")).default;
      await ApplyTagRulesService({ companyId, contactId: contact.id });
    } catch (err) {
      logger.warn(`Falha ao aplicar regras de tags no contato ${contact.id}`, err);
    }
  });

  try {
    await DispatchContactWebhookService({
      companyId,
      contact,
      event: "create",
      source: "create"
    });
  } catch (err) {
    logger.warn("[CreateContactService] Falha ao disparar webhook de contato (create)", err);
  }

  return contact;

};

export default CreateContactService;
