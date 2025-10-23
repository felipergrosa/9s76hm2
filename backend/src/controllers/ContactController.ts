import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { emitToCompanyNamespace } from "../libs/socketEmit";

import { head } from "lodash";

import { Op } from "sequelize";

// Interface estendida para incluir o usuário autenticado
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    companyId: number;
    profile: string;
    username?: string;
  };
  files?: any;
}

import ListContactsService from "../services/ContactServices/ListContactsService";
import CreateContactService from "../services/ContactServices/CreateContactService";
import ShowContactService from "../services/ContactServices/ShowContactService";
import UpdateContactService from "../services/ContactServices/UpdateContactService";
import DeleteContactService from "../services/ContactServices/DeleteContactService";
import GetContactService from "../services/ContactServices/GetContactService";
import BulkDeleteContactsService from "../services/ContactServices/BulkDeleteContactsService";
import BulkRefreshContactAvatarsService from "../services/ContactServices/BulkRefreshContactAvatarsService";

import CheckContactNumber from "../services/WbotServices/CheckNumber";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";
import GetProfilePicUrl from "../services/WbotServices/GetProfilePicUrl";
import AppError from "../errors/AppError";
import SimpleListService, {
  SearchContactParams
} from "../services/ContactServices/SimpleListService";
import ContactCustomField from "../models/ContactCustomField";
import ToggleAcceptAudioContactService from "../services/ContactServices/ToggleAcceptAudioContactService";
import BlockUnblockContactService from "../services/ContactServices/BlockUnblockContactService";
import { ImportContactsService, getImportProgress } from "../services/ContactServices/ImportContactsService";
import NumberSimpleListService from "../services/ContactServices/NumberSimpleListService";
import CreateOrUpdateContactServiceForImport from "../services/ContactServices/CreateOrUpdateContactServiceForImport";
import UpdateContactWalletsService from "../services/ContactServices/UpdateContactWalletsService";
import BulkUpdateContactsService from "../services/ContactServices/BulkUpdateContactsService";
import NormalizeContactNumbersService from "../services/ContactServices/NormalizeContactNumbersService";

import FindContactTags from "../services/ContactServices/FindContactTags";
import { log } from "console";
import ToggleDisableBotContactService from "../services/ContactServices/ToggleDisableBotContactService";
import GetDefaultWhatsApp from "../helpers/GetDefaultWhatsApp";
import Contact from "../models/Contact";
import Tag from "../models/Tag";
import ContactTag from "../models/ContactTag";
import logger from "../utils/logger";
import ValidateContactService from "../services/ContactServices/ValidateContactService";
import { isValidCPF, isValidCNPJ } from "../utils/validators";
import GetDeviceTagsService from "../services/WbotServices/GetDeviceTagsService";
import GetDeviceLabelsService from "../services/WbotServices/GetDeviceLabelsService";
import ShowBaileysService from "../services/BaileysServices/ShowBaileysService";
import { getLabels, getAllChatLabels } from "../libs/labelCache";
import ForceAppStateSyncService from "../services/WbotServices/ForceAppStateSyncService";
import { getWbot } from "../libs/wbot";
import GetDeviceContactsService from "../services/WbotServices/GetDeviceContactsService";
import ImportDeviceContactsAutoService from "../services/ContactServices/ImportDeviceContactsAutoService";
import RebuildDeviceTagsService from "../services/WbotServices/RebuildDeviceTagsService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  contactTag: string;
  isGroup?: string;
  limit?: string;
  orderBy?: string;
  order?: string;
  segment?: string | string[];
  dtUltCompraStart?: string;
  dtUltCompraEnd?: string;
  channel?: string | string[];
  representativeCode?: string | string[];
  city?: string | string[];
  situation?: string | string[];
  foundationMonths?: string | string[];
  minCreditLimit?: string;
  maxCreditLimit?: string;
  minVlUltCompra?: string;
  maxVlUltCompra?: string;
  florder?: string;
  bzEmpresa?: string | string[];
  isWhatsappValid?: string;
};

type IndexGetContactQuery = {
  name: string;
  number: string;
};

interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}
interface ContactData {
  name: string;
  number: string;
  email?: string;
  extraInfo?: ExtraInfo[];
  disableBot?: boolean;
  remoteJid?: string;
  wallets?: null | number[] | string[];
  cpfCnpj?: string;
  representativeCode?: string;
  city?: string;
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
}

export const importXls = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { number, name, email, validateContact, tags, cpfCnpj, representativeCode, city, instagram, situation, fantasyName, foundationDate, creditLimit, segment } = req.body;
  const simpleNumber = String(number).replace(/[^\d.-]+/g, '');
  let validNumber = simpleNumber;


  if (validateContact === "true") {
    validNumber = await CheckContactNumber(simpleNumber, companyId);
  }

  /**
   * Código desabilitado por demora no retorno
   */
  //
  // const profilePicUrl = await GetProfilePicUrl(validNumber, companyId);
  // const defaultWhatsapp = await GetDefaultWhatsApp(companyId);

  const contactData = {
    name: `${name}`,
    number: validNumber,
    profilePicUrl: "",
    isGroup: false,
    email,
    companyId,
    cpfCnpj: cpfCnpj ? String(cpfCnpj) : null,
    representativeCode: representativeCode ? String(representativeCode) : null,
    city,
    instagram,
    situation,
    fantasyName,
    foundationDate,
    creditLimit: creditLimit ? String(creditLimit) : null,
    segment
    // whatsappId: defaultWhatsapp.id
  };

  const contact = await CreateOrUpdateContactServiceForImport(contactData);

  // Associações de tags (por nome ou por IDs), evitando duplicar por cor
  try {
    const tagIds = (req.body as any).tagIds as number[] | undefined;
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      const rows = await Tag.findAll({ where: { id: tagIds, companyId } });
      for (const tag of rows) {
        await ContactTag.findOrCreate({ where: { contactId: contact.id, tagId: tag.id } });
      }
    } else if (tags) {
      const tagList = String(tags).split(',').map((t: string) => t.trim()).filter(Boolean);
      for (const tagName of tagList) {
        const [tag] = await Tag.findOrCreate({
          where: { name: tagName, companyId },
          defaults: { color: "#A4CCCC", kanban: 0 }
        });
        await ContactTag.findOrCreate({ where: { contactId: contact.id, tagId: tag.id } });
      }
    }
  } catch (error) {
    logger.info("Erro ao associar Tags (importXls)", error);
  }
  await emitToCompanyNamespace(
    companyId,
    `company-${companyId}-contact`,
    {
      action: "create",
      contact
    }
  );

  return res.status(200).json(contact);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber, contactTag: tagIdsStringified, isGroup, limit, orderBy, order, dtUltCompraStart, dtUltCompraEnd } = req.query as IndexQuery;
  // <<-- ALTERAÇÃO 1: Adicionado 'profile' para obter o perfil do usuário
  const { id: userId, companyId, profile } = req.user;


let tagsIds: number[] = [];

if (tagIdsStringified) {
  try {
    tagsIds = JSON.parse(tagIdsStringified);
  } catch (_) {
    tagsIds = [];
  }
}

const tagsQuery = (req.query as any).tags;
if (tagsQuery) {
  let parsed: number[] = [];
  if (Array.isArray(tagsQuery)) {
    parsed = tagsQuery.map((t: any) => Number(t)).filter((t) => Number.isInteger(t));
  } else if (typeof tagsQuery === "string") {
    try {
      const parsedJson = JSON.parse(tagsQuery);
      if (Array.isArray(parsedJson)) parsed = parsedJson.map((t: any) => Number(t)).filter(Number.isInteger);
    } catch {
      parsed = tagsQuery.split(",").map((t: any) => Number(t.trim())).filter(Number.isInteger);
    }
  }
  if (parsed.length) {
    tagsIds = Array.from(new Set([...(tagsIds || []), ...parsed].filter(n => Number.isInteger(n))));
  }
}

  // Parse robusto do parâmetro 'segment' (aceita string, array, JSON ou CSV)
  const parseSegment = (q: any): string | string[] | undefined => {
    const pick = (q && (q as any).segment !== undefined) ? (q as any).segment : (q && (q as any)["segment[]"]);
    const raw = pick;
    const norm = (v: any) => typeof v === "string" ? v.trim() : v;
    if (Array.isArray(raw)) {
      const arr = raw.map(norm).filter((s: any) => typeof s === 'string' ? s !== '' : !!s);
      return arr.length > 0 ? arr : undefined;
    }
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (!s) return undefined;
      if (s.startsWith('[') && s.endsWith(']')) {
        try {
          const arr = JSON.parse(s);
          if (Array.isArray(arr)) {
            const clean = arr.map(norm).filter((x: any) => typeof x === 'string' ? x !== '' : !!x);
            return clean.length > 0 ? clean : undefined;
          }
        } catch (_) { /* ignora */ }
      }
      if (s.includes(',')) {
        const arr = s.split(',').map(t => t.trim()).filter(Boolean);
        return arr.length > 0 ? arr : undefined;
      }
      return s;
    }
    return undefined;
  };

  const segment = parseSegment(req.query);

  const pickQueryValue = (key: string): any => {
    const query = req.query as any;
    if (query[key] !== undefined) return query[key];
    if (query[`${key}[]`] !== undefined) return query[`${key}[]`];
    return undefined;
  };

  const parseStringArrayParam = (key: string): string[] | undefined => {
    const raw = pickQueryValue(key);
    if (raw === undefined || raw === null) return undefined;
    const normalize = (val: any) => (val == null ? "" : String(val)).trim();

    if (Array.isArray(raw)) {
      const arr = raw.map(normalize).filter(Boolean);
      return arr.length ? Array.from(new Set(arr)) : undefined;
    }

    const str = normalize(raw);
    if (!str) return undefined;

    if (str.startsWith("[") && str.endsWith("]")) {
      try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) {
          const arr = parsed.map(normalize).filter(Boolean);
          return arr.length ? Array.from(new Set(arr)) : undefined;
        }
      } catch (_) {
        // ignora parse inválido
      }
    }

    if (str.includes(",")) {
      const arr = str.split(",").map(normalize).filter(Boolean);
      return arr.length ? Array.from(new Set(arr)) : undefined;
    }

    return [str];
  };

  const parseNumberArrayParam = (key: string): number[] | undefined => {
    const arr = parseStringArrayParam(key);
    if (!arr) return undefined;
    const nums = arr
      .map(val => Number(val))
      .filter(val => Number.isInteger(val) && val >= 1 && val <= 12);
    return nums.length ? Array.from(new Set(nums)) : undefined;
  };

  const parseDecimalParam = (key: string): number | undefined => {
    const raw = (req.query as any)[key];
    if (raw === undefined || raw === null || raw === "") return undefined;
    const str = String(raw)
      .trim()
      .replace(/R\$?\s*/gi, "")
      .replace(/\./g, "")
      .replace(/,/g, ".");
    if (!str) return undefined;
    const num = Number(str);
    return Number.isFinite(num) ? num : undefined;
  };

  const parseFloatParam = (key: string): number | undefined => {
    const raw = (req.query as any)[key];
    if (raw === undefined || raw === null || raw === "") return undefined;
    const num = Number(String(raw).trim().replace(/R\$?\s*/gi, ""));
    return Number.isFinite(num) ? num : undefined;
  };

  const parseBooleanParam = (key: string): boolean | undefined => {
    const raw = (req.query as any)[key];
    if (raw === undefined || raw === null || raw === "") return undefined;
    const value = String(raw).trim().toLowerCase();
    if (["true", "1", "sim", "yes"].includes(value)) return true;
    if (["false", "0", "nao", "não", "no"].includes(value)) return false;
    return undefined;
  };

  const channel = parseStringArrayParam("channel");
  const representativeCodes = parseStringArrayParam("representativeCode");
  const cities = parseStringArrayParam("city");
  const situations = parseStringArrayParam("situation");
  const foundationMonths = parseNumberArrayParam("foundationMonths");
  const bzEmpresas = parseStringArrayParam("bzEmpresa");
  const minCreditLimit = parseDecimalParam("minCreditLimit");
  const maxCreditLimit = parseDecimalParam("maxCreditLimit");
  const minVlUltCompra = parseFloatParam("minVlUltCompra");
  const maxVlUltCompra = parseFloatParam("maxVlUltCompra");
  const florder = parseBooleanParam("florder");
  const isWhatsappValid = parseBooleanParam("isWhatsappValid");

  const result = await ListContactsService({
    searchParam,
    pageNumber,
    companyId,
    tagsIds,
    isGroup,
    userId: Number(userId),
    profile, // <<-- ALTERAÇÃO 2: 'profile' é enviado para o serviço
    limit,
    orderBy,
    order,
    segment,
    dtUltCompraStart,
    dtUltCompraEnd,
    channel,
    representativeCode: representativeCodes,
    city: cities,
    situation: situations,
    foundationMonths,
    minCreditLimit,
    maxCreditLimit,
    minVlUltCompra,
    maxVlUltCompra,
    florder,
    bzEmpresa: bzEmpresas,
    isWhatsappValid
  });

  // Dispara validações em background sem bloquear a resposta
  try {
    // Forçar revalidação imediata durante os testes: TTL = 0h (voltar para 24 quando terminar)
    const ttlHours = 0;
    const now = Date.now();
    const ttlMs = ttlHours * 60 * 60 * 1000;
    result.contacts.forEach(c => {
      const isWhats = c.channel === "whatsapp";
      const notGroup = !c.isGroup;
      const last = c.validatedAt ? new Date(c.validatedAt as any).getTime() : 0;
      const stale = !last || now - last > ttlMs || c.isWhatsappValid === null || typeof c.isWhatsappValid === "undefined";
      if (isWhats && notGroup && stale) {
        // fire-and-forget
        ValidateContactService({ contactId: c.id, companyId, ttlHours })
          .catch(err => logger.warn({ contactId: c.id, companyId, error: err?.message }, "[Contacts.index] validação assíncrona falhou"));
      }
    });
  } catch (e: any) {
    logger.warn({ companyId, error: e?.message }, "[Contacts.index] falha ao agendar validações");
  }

  return res.json(result);
};

export const getContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { name, number } = req.body as IndexGetContactQuery;
  const { companyId } = req.user;


  const contact = await GetContactService({
    name,
    number,
    companyId
  });

  return res.status(200).json(contact);
};

// Retorna uma lista simples de contatos (nome opcional), usada por "/contacts/list"
export const list = async (req: Request, res: Response): Promise<Response> => {
  const { name } = req.query as unknown as SearchContactParams;
  const { companyId } = req.user;

  const contacts = await SimpleListService({ name, companyId });

  return res.json(contacts);
};

// Lista distintos segmentos para a empresa autenticada
export const segments = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const rows = await Contact.findAll({
    where: {
      companyId,
      segment: { [Op.ne]: null }
    },
    attributes: ["segment"],
    raw: true
  });

  const set = new Set<string>();
  for (const r of rows as any[]) {
    const s = (r.segment || "").trim();
    if (s) set.add(s);
  }

  const list = Array.from(set).sort((a, b) => a.localeCompare(b));
  return res.json({ count: list.length, segments: list });
};

// Lista distintas empresas para a empresa autenticada
export const empresas = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const rows = await Contact.findAll({
    where: { 
      companyId,
      bzEmpresa: { [Op.ne]: null }
    },
    attributes: ["bzEmpresa"],
    group: ["bzEmpresa"],
    raw: true
  });

  const set = new Set<string>();
  for (const row of rows) {
    if (row.bzEmpresa && typeof row.bzEmpresa === "string") {
      set.add(row.bzEmpresa.trim());
    }
  }

  const list = Array.from(set).sort((a, b) => a.localeCompare(b));
  return res.json({ count: list.length, empresas: list });
};


export const store = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const newContact: ContactData = req.body;

  // Tratar foundationDate para null se for string vazia ou inválida
  if (typeof newContact.foundationDate === 'string' && (newContact.foundationDate === '' || newContact.foundationDate === null)) {
    newContact.foundationDate = null;
  }

  const newRemoteJid = newContact.number;


  const findContact = await Contact.findOne({
    where: {
      number: newContact.number.replace("-", "").replace(" ", ""),
      companyId
    }
  })
  if (findContact) {
    throw new AppError("Contact already exists");
  }

  newContact.number = newContact.number.replace("-", "").replace(" ", "");


  const schema = Yup.object().shape({
    name: Yup.string().required(),
    number: Yup.string()
      .transform((value, originalValue) =>
        typeof originalValue === "string" ? originalValue.replace(/\D/g, "") : originalValue
      )
      .required()
      .matches(/^\d+$/, "Invalid number format. Only numbers is allowed."),

    cpfCnpj: Yup.string()
      .transform((value, originalValue) => {
        const v = typeof originalValue === "string" ? originalValue.replace(/\D/g, "").trim() : originalValue;
        return v === "" || v === undefined ? null : v;
      })
      .nullable()
      .test('cpf-cnpj', 'CPF/CNPJ inválido', (value) => {
        if (!value) return true;
        return isValidCPF(value) || isValidCNPJ(value);
      }),
    creditLimit: Yup.string()
      .transform((value, originalValue) => {
        const v = typeof originalValue === "string" ? originalValue.trim() : originalValue;
        return v === "" || v === undefined ? null : v;
      })
      .nullable(),
    representativeCode: Yup.string().nullable(),
    city: Yup.string().nullable(),
    instagram: Yup.string().nullable(),
    situation: Yup.string().oneOf(['Ativo', 'Baixado', 'Ex-Cliente', 'Excluido', 'Futuro', 'Inativo']).nullable(),
    fantasyName: Yup.string().nullable(),
    foundationDate: Yup.date().nullable(),
    dtUltCompra: Yup.date().nullable(),
    vlUltCompra: Yup.mixed().nullable(),
    email: Yup.string()
      .transform((value, originalValue) => {
        const v = typeof originalValue === "string" ? originalValue.trim() : originalValue;
        return v === "" || v === undefined ? null : v;
      })
      .email()
      .nullable(),
    contactName: Yup.string()
      .transform((value, originalValue) => {
        const v = typeof originalValue === "string" ? originalValue.trim() : originalValue;
        return v === "" || v === undefined ? null : v;
      })
      .nullable(),
    florder: Yup.boolean().nullable(),
    segment: Yup.string()
      .transform((value, originalValue) => {
        const v = typeof originalValue === "string" ? originalValue.trim() : originalValue;
        return v === "" || v === undefined ? null : v;
      })
      .nullable()
  });

  try {
    await schema.validate(newContact);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // Normaliza email: evita null no model (que não permite) e remove espaços
  if (newContact.hasOwnProperty("email")) {
    if (newContact.email === null || newContact.email === undefined) {
      newContact.email = "";
    } else if (typeof newContact.email === "string") {
      newContact.email = newContact.email.trim();
    }
  }

  // Normaliza contactName: string vazia -> null
  if (Object.prototype.hasOwnProperty.call(newContact, 'contactName')) {
    if (newContact.contactName === null || newContact.contactName === undefined) {
      // mantém null/undefined
    } else if (typeof (newContact as any).contactName === 'string') {
      const s = (newContact as any).contactName.trim();
      (newContact as any).contactName = s === '' ? null : s;
    }
  }

  // Normaliza dtUltCompra: string vazia -> null
  if (Object.prototype.hasOwnProperty.call(newContact, 'dtUltCompra')) {
    if (typeof (newContact as any).dtUltCompra === 'string' && (newContact as any).dtUltCompra.trim() === '') {
      (newContact as any).dtUltCompra = null as any;
    }
  }

  // Normaliza vlUltCompra (string BRL -> número)
  if (Object.prototype.hasOwnProperty.call(newContact, 'vlUltCompra')) {
    const parseMoney = (val: any): number | null => {
      if (val === undefined || val === null || val === '') return null;
      if (typeof val === 'number') return val;
      const cleaned = String(val).replace(/\s+/g, '').replace(/R\$?/gi, '').replace(/\./g, '').replace(',', '.');
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    };
    (newContact as any).vlUltCompra = parseMoney((newContact as any).vlUltCompra);
  }

  // Normaliza florder: coerção booleana quando enviado
  if (Object.prototype.hasOwnProperty.call(newContact, 'florder')) {
    (newContact as any).florder = !!(newContact as any).florder;
  }

  // Normaliza creditLimit: converte vazio/whitespace para null
  if (newContact.hasOwnProperty("creditLimit")) {
    if (typeof newContact.creditLimit === "string" && newContact.creditLimit.trim() === "") {
      newContact.creditLimit = null as any;
    }
  }

  // Normaliza cpfCnpj: mantém apenas dígitos ou null
  if (newContact.hasOwnProperty("cpfCnpj")) {
    if (newContact.cpfCnpj === null || newContact.cpfCnpj === undefined || newContact.cpfCnpj === "") {
      newContact.cpfCnpj = null as any;
    } else if (typeof newContact.cpfCnpj === "string") {
      const digits = newContact.cpfCnpj.replace(/\D/g, "");
      newContact.cpfCnpj = (digits && digits.length > 0) ? digits : (null as any);
    }
  }

  // Normaliza segment: string vazia -> null; mantém undefined quando não presente
  if (Object.prototype.hasOwnProperty.call(newContact, 'segment')) {
    if (newContact.segment === null || newContact.segment === undefined) {
      // mantém como está (null/undefined)
    } else if (typeof newContact.segment === 'string') {
      const s = newContact.segment.trim();
      newContact.segment = (s === '') ? (null as any) : s;
    }
  }


  const validNumber = await CheckContactNumber(newContact.number, companyId);

  /**
   * Código desabilitado por demora no retorno
   */
  // const profilePicUrl = await GetProfilePicUrl(validNumber.jid, companyId);



  const contact = await CreateContactService({
    ...newContact,
    number: validNumber,
    // profilePicUrl,
    companyId,
    userId: req.user.id // Adicionando o userId ao criar o contato
  });

  // Validar contato após a criação
  await ValidateContactService({ contactId: contact.id, companyId, ttlHours: 0 }).catch(err => {
    logger.warn({ contactId: contact.id, companyId, error: err?.message }, "[Contacts.store] validação após a criação falhou");
  });

  // Suporte a tagIds e tags por nome no store
  try {
    const { tagIds, tags } = req.body as any;
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      const rows = await Tag.findAll({ where: { id: tagIds, companyId } });
      for (const tag of rows) {
        await ContactTag.findOrCreate({ where: { contactId: contact.id, tagId: tag.id } });
      }
    } else if (typeof tags === 'string' && tags.trim() !== '') {
      const tagList = tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      for (const tagName of tagList) {
        const [tag] = await Tag.findOrCreate({
          where: { name: tagName, companyId },
          defaults: { color: "#A4CCCC", kanban: 0 }
        });
        await ContactTag.findOrCreate({ where: { contactId: contact.id, tagId: tag.id } });
      }
    }
  } catch (error) {
    logger.info("Erro ao associar Tags (store)", error);
  }

  await emitToCompanyNamespace(
    companyId,
    `company-${companyId}-contact`,
    {
      action: "create",
      contact
    }
  );

  return res.status(200).json(contact);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  const contact = await ShowContactService(contactId, companyId);

  return res.status(200).json(contact);
};

  export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const contactData: ContactData = req.body;
  const { companyId } = req.user;
  const { contactId } = req.params;

  // Tratar foundationDate para null se for string vazia ou inválida
  if (typeof contactData.foundationDate === 'string' && (contactData.foundationDate === '' || contactData.foundationDate === null)) {
    contactData.foundationDate = null;
  }

  const schema = Yup.object().shape({
    name: Yup.string().nullable(),
    number: Yup.string()
      .transform((value, originalValue) =>
        typeof originalValue === "string" ? originalValue.replace(/\D/g, "") : originalValue
      )
      .nullable()
      .matches(/^\d+$/, "Invalid number format. Only numbers is allowed."),
    email: Yup.string()
      .transform((value, originalValue) => {
        const v = typeof originalValue === "string" ? originalValue.trim() : originalValue;
        return v === "" || v === undefined ? null : v;
      })
      .email()
      .nullable(),
    contactName: Yup.string()
      .transform((value, originalValue) => {
        const v = typeof originalValue === "string" ? originalValue.trim() : originalValue;
        return v === "" || v === undefined ? null : v;
      })
      .nullable(),
    florder: Yup.boolean().nullable(),
    cpfCnpj: Yup.string()
      .transform((value, originalValue) => {
        const v = typeof originalValue === "string" ? originalValue.replace(/\D/g, "").trim() : originalValue;
        return v === "" || v === undefined ? null : v;
      })
      .nullable()
      .test('cpf-cnpj', 'CPF/CNPJ inválido', (value) => {
        if (!value) return true;
        return isValidCPF(value) || isValidCNPJ(value);
      }),
    creditLimit: Yup.string()
      .transform((value, originalValue) => {
        const v = typeof originalValue === "string" ? originalValue.trim() : originalValue;
        return v === "" || v === undefined ? null : v;
      })
      .nullable(),
    representativeCode: Yup.string().nullable(),
    city: Yup.string().nullable(),
    instagram: Yup.string().nullable(),
    situation: Yup.string().oneOf(['Ativo', 'Baixado', 'Ex-Cliente', 'Excluido', 'Futuro', 'Inativo']).nullable(),
    fantasyName: Yup.string().nullable(),
    foundationDate: Yup.date().nullable(),
    segment: Yup.string()
      .transform((value, originalValue) => {
        const v = typeof originalValue === "string" ? originalValue.trim() : originalValue;
        return v === "" || v === undefined ? null : v;
      })
      .nullable()
  });

  try {
    await schema.validate(contactData);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // Normaliza email: evita null no model (que não permite) e remove espaços
  if (contactData.hasOwnProperty("email")) {
    if (contactData.email === null || contactData.email === undefined) {
      contactData.email = "";
    } else if (typeof contactData.email === "string") {
      contactData.email = contactData.email.trim();
    }
  }

  // Normaliza contactName: string vazia -> null
  if (Object.prototype.hasOwnProperty.call(contactData, 'contactName')) {
    if ((contactData as any).contactName === null || (contactData as any).contactName === undefined) {
      // mantém null/undefined
    } else if (typeof (contactData as any).contactName === 'string') {
      const s = (contactData as any).contactName.trim();
      (contactData as any).contactName = s === '' ? null : s;
    }
  }

  // Normaliza florder: coerção booleana quando enviado
  if (Object.prototype.hasOwnProperty.call(contactData, 'florder')) {
    (contactData as any).florder = !!(contactData as any).florder;
  }

  // Normaliza vlUltCompra (string BRL -> número)
  if (Object.prototype.hasOwnProperty.call(contactData, 'vlUltCompra')) {
    const parseMoney = (val: any): number | null => {
      if (val === undefined || val === null || val === '') return null;
      if (typeof val === 'number') return val;
      const cleaned = String(val).replace(/\s+/g, '').replace(/R\$?/gi, '').replace(/\./g, '').replace(',', '.');
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    };
    (contactData as any).vlUltCompra = parseMoney((contactData as any).vlUltCompra);
  }

  // Normaliza creditLimit: converte vazio/whitespace para null
  if (contactData.hasOwnProperty("creditLimit")) {
    if (typeof contactData.creditLimit === "string" && contactData.creditLimit.trim() === "") {
      contactData.creditLimit = null as any;
    }
  }

  // Normaliza cpfCnpj: mantém apenas dígitos ou null
  if (contactData.hasOwnProperty("cpfCnpj")) {
    if (contactData.cpfCnpj === null || contactData.cpfCnpj === undefined || (typeof contactData.cpfCnpj === "string" && contactData.cpfCnpj.trim() === "")) {
      contactData.cpfCnpj = null as any;
    } else if (typeof contactData.cpfCnpj === "string") {
      const digits = contactData.cpfCnpj.replace(/\D/g, "");
      contactData.cpfCnpj = (digits && digits.length > 0) ? digits : (null as any);
    }
  }

  // Normaliza segment: string vazia -> null; mantém undefined quando não presente
  if (Object.prototype.hasOwnProperty.call(contactData, 'segment')) {
    if (contactData.segment === null || contactData.segment === undefined) {
      // mantém como está
    } else if (typeof contactData.segment === 'string') {
      const s = contactData.segment.trim();
      contactData.segment = (s === '') ? (null as any) : s;
    }
  }

  const oldContact = await ShowContactService(contactId, companyId);

  if (oldContact.number != contactData.number && oldContact.channel == "whatsapp") {
    const isGroup = oldContact && oldContact.remoteJid ? oldContact.remoteJid.endsWith("@g.us") : oldContact.isGroup;
    const validNumber = await CheckContactNumber(contactData.number, companyId, isGroup);
    const number = validNumber;
    contactData.number = number;
  }

  // Validar contato após a atualização
  await ValidateContactService({ contactId: Number(contactId), companyId, ttlHours: 0 }).catch(err => {
    logger.warn({ contactId: Number(contactId), companyId, error: err?.message }, "[Contacts.update] validação assíncrona falhou");
  });

  const contact = await UpdateContactService({
    contactData,
    contactId,
    companyId,
    userId: req.user?.id ? parseInt(req.user.id, 10) : undefined
  });

  await emitToCompanyNamespace(
    companyId,
    `company-${companyId}-contact`,
    {
      action: "update",
      contact
    }
  );

  return res.status(200).json(contact);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  await ShowContactService(contactId, companyId);

  await DeleteContactService(contactId);

  await emitToCompanyNamespace(
    companyId,
    `company-${companyId}-contact`,
    {
      action: "delete",
      contactId
    }
  );

  return res.status(200).json({ message: "Contact deleted" });
};

// ATUALIZAÇÃO EM MASSA DE CONTATOS (apenas admin)
export const bulkUpdate = async (req: Request, res: Response): Promise<Response> => {
  const { contactIds, data } = req.body as { contactIds: number[]; data: { tagIds?: number[]; situation?: 'Ativo' | 'Baixado' | 'Ex-Cliente' | 'Excluido' | 'Futuro' | 'Inativo'; whatsappId?: number | null } };
  const { companyId, profile } = req.user;

  if (profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    throw new AppError("Nenhum ID de contato fornecido para atualização em massa.", 400);
  }

  const updated = await BulkUpdateContactsService({ companyId, contactIds, data: data || {} });

  for (const contact of updated) {
    await emitToCompanyNamespace(
      companyId,
      `company-${companyId}-contact`,
      {
        action: "update",
        contact
      }
    );
  }

  return res.status(200).json({ updated: updated.map(c => c.id), count: updated.length });
};

// NOVA FUNÇÃO: DELETAR MÚLTIPLOS CONTATOS
export const bulkRemove = async (req: Request, res: Response): Promise<Response> => {
  const { contactIds } = req.body as { contactIds: number[] }; // Espera um array de IDs
  const { companyId } = req.user; // Obtém o companyId do usuário autenticado

  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    throw new AppError("Nenhum ID de contato fornecido para exclusão em massa.", 400);
  }

  try {
    // Chamar o novo serviço para deletar múltiplos contatos
    await BulkDeleteContactsService(contactIds, companyId); // Passa contactIds e companyId

    // Emitir evento para cada ID deletado para atualizar o frontend em tempo real
    for (const id of contactIds) {
      await emitToCompanyNamespace(
        companyId,
        `company-${companyId}-contact`,
        {
          action: "delete",
          contactId: id
        }
      );
    }

    return res.status(200).json({ message: `${contactIds.length} contatos deletados com sucesso.` });
  } catch (error: any) {
    // Captura o AppError lançado pelo serviço ou qualquer outro erro
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Erro inesperado no controller bulkRemove:", error); // Log para depuração
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
};
export const toggleAcceptAudio = async (req: Request, res: Response): Promise<Response> => {
  var { contactId } = req.params;
  const { companyId } = req.user;
  const contact = await ToggleAcceptAudioContactService({ contactId });

  await emitToCompanyNamespace(
    companyId,
    `company-${companyId}-contact`,
    {
      action: "update",
      contact
    }
  );

  return res.status(200).json(contact);
};

export const blockUnblock = async (
  req: Request,
  res: Response
): Promise<Response> => {
  var { contactId } = req.params;
  const { companyId } = req.user;
  const { active } = req.body;

  const contact = await BlockUnblockContactService({ contactId, companyId, active });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-contact`, {
      action: "update",
      contact
    });

  return res.status(200).json(contact);
};

export const upload = async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  const file: Express.Multer.File = head(files) as Express.Multer.File;
  const { companyId } = req.user;

  const response = await ImportContactsService(companyId, file);

  const io = getIO();
  await emitToCompanyNamespace(
    companyId,
    `company-${companyId}-contact`,
    {
      action: "reload",
      records: response
    }
  );

  return res.status(200).json(response);
};

export const getContactProfileURL = async (req: Request, res: Response) => {
  const { number } = req.params
  const { companyId } = req.user;

  if (number) {
    const validNumber = await CheckContactNumber(number, companyId);


    const profilePicUrl = await GetProfilePicUrl(validNumber, companyId);

    const contact = await NumberSimpleListService({ number: validNumber, companyId: companyId })

    let obj: any;
    if (contact.length > 0) {
      obj = {
        contactId: contact[0].id,
        profilePicUrl: profilePicUrl
      }
    } else {
      obj = {
        contactId: 0,
        profilePicUrl: profilePicUrl
      }
    }

    return res.status(200).json(obj);
  }

  };

  export const getContactVcard = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { name, number } = req.query as IndexGetContactQuery;
    const { companyId } = req.user;

    let vNumber = number;
    const numberDDI = vNumber.toString().substr(0, 2);
    const numberDDD = vNumber.toString().substr(2, 2);
    const numberUser = vNumber.toString().substr(-8, 8);

    if (numberDDD <= '30' && numberDDI === '55') {
      vNumber = `${numberDDI + numberDDD + 9 + numberUser}@s.whatsapp.net`;
    } else if (numberDDD > '30' && numberDDI === '55') {
      vNumber = `${numberDDI + numberDDD + numberUser}@s.whatsapp.net`;
    } else {
      vNumber = `${number}@s.whatsapp.net`;
    }


    const contact = await GetContactService({
      name,
      number,
      companyId
    });

    return res.status(200).json(contact);
  };

  // Força validação imediata de um contato (ignora TTL)
  export const forceValidate = async (req: Request, res: Response): Promise<Response> => {
    const { contactId } = req.params;
    const { companyId } = req.user;
    const { ttlHours } = req.body as { ttlHours?: number };

    const contact = await ValidateContactService({
      contactId: Number(contactId),
      companyId,
      force: true,
      ttlHours
    });

    const io = getIO();
    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-contact`, {
        action: "update",
        contact
      });

    return res.status(200).json(contact);
  };

  export const getContactTags = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { contactId } = req.params;

    const contactTags = await FindContactTags({ contactId });

    let tags = false;

    if (contactTags.length > 0) {
      tags = true;
    }

    return res.status(200).json({ tags: tags });

  }

  export const toggleDisableBot = async (req: Request, res: Response): Promise<Response> => {
    var { contactId } = req.params;
    const { companyId } = req.user;
    const contact = await ToggleDisableBotContactService({ contactId });

    const io = getIO();
    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-contact`, {
        action: "update",
        contact
      });

    return res.status(200).json(contact);
  };

  export const updateContactWallet = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { wallets } = req.body;
    const { contactId } = req.params;
    const { companyId } = req.user;

    const contact = await UpdateContactWalletsService({
      wallets,
      contactId,
      companyId
    });

    return res.status(200).json(contact);
  };

  export const listWhatsapp = async (req: Request, res: Response): Promise<Response> => {

    const { name } = req.query as unknown as SearchContactParams;
    const { companyId } = req.user;

    const contactsAll = await SimpleListService({ name, companyId });

    const contacts = contactsAll.filter(contact => contact.channel == "whatsapp");

    return res.json(contacts);
  };

  export const bulkRefreshAvatars = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const { contactIds, limit } = req.body;
    const { companyId } = req.user;

    try {
      await BulkRefreshContactAvatarsService({
        companyId,
        contactIds,
        limit
      });

      return res.status(200).json({ message: "Avatares atualizados com sucesso" });
    } catch (error) {
      return res.status(500).json({ error: "Erro ao atualizar avatares" });
    }
  };

  export const getDeviceTags = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { whatsappId } = req.query as any;

    try {
      // Prioridade 1: cache (App State / BinaryInfo via eventos labels.*)
      let deviceTags = await GetDeviceLabelsService(companyId, whatsappId ? Number(whatsappId) : undefined);

      // Fallback: dados persistidos do Baileys (pode estar desatualizado)
      if (deviceTags.length === 0) {
        logger.info("Nenhuma tag encontrada no cache, tentando dados persistidos do Baileys...");
        // Antes de cair para Baileys, força resync e aguarda labels chegarem
        try {
          const sync = await ForceAppStateSyncService(companyId, whatsappId ? Number(whatsappId) : undefined);
          logger.info(`[getDeviceTags] ForceAppStateSyncService -> labelsCount=${(sync as any)?.labelsCount}`);
          const refetched = await GetDeviceLabelsService(companyId, whatsappId ? Number(whatsappId) : undefined);
          if (refetched.length > 0) {
            deviceTags = refetched;
          } else {
            deviceTags = await GetDeviceTagsService(companyId, whatsappId ? Number(whatsappId) : undefined);
          }
        } catch (e: any) {
          logger.warn(`[getDeviceTags] falha no resync antes do fallback: ${e?.message}`);
          deviceTags = await GetDeviceTagsService(companyId, whatsappId ? Number(whatsappId) : undefined);
        }
      }
      
      return res.status(200).json({ tags: deviceTags });
    } catch (error) {
      logger.error("Erro ao obter tags do dispositivo:", error);
      return res.status(500).json({ error: "Erro ao obter tags do dispositivo" });
    }
  };

  // Lista contatos do dispositivo (via store/baileys) já com as tags associadas
  export const getDeviceContacts = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { whatsappId, page = '1', pageSize = '50' } = req.query as any;
    try {
      const contacts = await GetDeviceContactsService(companyId, whatsappId ? Number(whatsappId) : undefined);

      const p = Math.max(1, parseInt(String(page)) || 1);
      const ps = Math.min(500, Math.max(1, parseInt(String(pageSize)) || 50));
      const start = (p - 1) * ps;
      const end = start + ps;
      const slice = contacts.slice(start, end);
      const total = contacts.length;
      const hasMore = end < total;

      return res.status(200).json({ contacts: slice, total, page: p, pageSize: ps, hasMore });
    } catch (error: any) {
      logger.error("Erro ao obter contatos do dispositivo:", error);
      return res.status(500).json({ error: error?.message || "Erro ao obter contatos do dispositivo" });
    }
  };

  // Reconstrói tags a partir dos chats persistidos (Baileys) — útil quando os patches de labels não chegaram
  export const rebuildDeviceTags = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { whatsappId } = req.query as any;
    try {
      const result = await RebuildDeviceTagsService(companyId, whatsappId ? Number(whatsappId) : undefined);
      return res.status(200).json(result);
    } catch (error: any) {
      logger.error("Erro ao reconstruir tags do dispositivo:", error);
      return res.status(500).json({ error: error?.message || "Erro ao reconstruir tags do dispositivo" });
    }
  };

  // Importa contatos do dispositivo e associa tags por nome (cria tags se necessário)
  export const importDeviceContactsAuto = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { whatsappId, selectedJids, autoCreateTags } = req.body as any;
    try {
      const result = await ImportDeviceContactsAutoService({
        companyId,
        whatsappId: whatsappId ? Number(whatsappId) : undefined,
        selectedJids: Array.isArray(selectedJids) ? selectedJids : undefined,
        autoCreateTags: typeof autoCreateTags === 'boolean' ? autoCreateTags : true
      });
      return res.status(200).json(result);
    } catch (error: any) {
      logger.error("Erro ao importar contatos do dispositivo:", error);
      return res.status(500).json({ error: error?.message || "Erro ao importar contatos do dispositivo" });
    }
  };

  export const importWithTags = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { tagMapping, whatsappId, progressId } = req.body as any;

    try {
      // Importar contatos com mapeamento de tags
      if (tagMapping && progressId) {
        tagMapping.__options = { ...(tagMapping.__options || {}), progressId };
      }
      const result = await ImportContactsService(companyId, undefined, tagMapping, whatsappId);
      return res.status(200).json(result);
    } catch (error) {
      logger.error("Erro ao importar contatos com tags:", error);
      return res.status(500).json({ error: "Erro ao importar contatos com tags" });
    }
  };

  export const importProgress = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { progressId } = req.query as any;
      const prog = getImportProgress(String(progressId || ''));
      return res.status(200).json({ success: true, progress: prog });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error?.message || 'Erro ao obter progresso de importação' });
    }
  };

  export const debugDeviceData = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { whatsappId } = req.query as any;

    try {
      const defaultWhatsapp = await GetDefaultWhatsApp(whatsappId ? Number(whatsappId) : undefined, companyId);
      const baileysData = await ShowBaileysService(defaultWhatsapp.id);
      
      const parseMaybeJSON = (val: any) => {
        try {
          if (!val) return null;
          if (typeof val === 'string') return JSON.parse(val);
          return val;
        } catch {
          return null;
        }
      };

      const contacts = parseMaybeJSON((baileysData as any).contacts);
      const chats = parseMaybeJSON((baileysData as any).chats);
      const labelsCache = getLabels(defaultWhatsapp.id);
      const chatLabelsMap = getAllChatLabels(defaultWhatsapp.id);
      const chatLabelsArray = Array.from(chatLabelsMap.entries()).map(([chatId, set]) => ({ chatId, labels: Array.from(set) }));
      
      // Analisar estrutura dos dados
      const debugInfo = {
        whatsappId: defaultWhatsapp.id,
        hasContacts: !!contacts,
        contactsCount: contacts ? (Array.isArray(contacts) ? contacts.length : 'não é array') : 0,
        hasChats: !!chats,
        chatsCount: chats ? (Array.isArray(chats) ? chats.length : 'não é array') : 0,
        sampleChat: chats && Array.isArray(chats) && chats.length > 0 ? chats[0] : null,
        sampleContact: contacts && Array.isArray(contacts) && contacts.length > 0 ? contacts[0] : null,
        labelsFromCache: labelsCache,
        chatLabelsFromCache: chatLabelsArray
      };
      
      return res.status(200).json(debugInfo);
    } catch (error) {
      logger.error("Erro ao obter dados de debug:", error);
      return res.status(500).json({ error: "Erro ao obter dados de debug" });
    }
  };

  export const forceAppStateSync = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { whatsappId } = req.query as any;
    try {
      const result = await ForceAppStateSyncService(companyId, whatsappId ? Number(whatsappId) : undefined);
      return res.status(200).json(result);
    } catch (error: any) {
      logger.error("Erro ao forçar resync do App State:", error);
      return res.status(500).json({ error: error?.message || "Erro ao forçar resync do App State" });
    }
  };

  export const testCreateLabel = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { whatsappId } = req.query as any;
    const { name = "Teste Label", color = 1 } = req.body;

    try {
      const defaultWhatsapp = await GetDefaultWhatsApp(whatsappId ? Number(whatsappId) : undefined, companyId);
      const wbot = getWbot(defaultWhatsapp.id) as any;
      
      if (!wbot) {
        throw new Error("Socket WhatsApp não encontrado");
      }

      logger.info(`[testCreateLabel] Tentando criar label: ${name} com cor ${color}`);
      
      // Tentar usar a API do Baileys para criar label
      if (typeof wbot.addLabel === 'function') {
        const labelId = `test_${Date.now()}`;
        await wbot.addLabel('', {
          id: labelId,
          name,
          color
        });
        logger.info(`[testCreateLabel] Label criada via addLabel: ${labelId}`);
        return res.status(200).json({ success: true, labelId, method: 'addLabel' });
      } else {
        logger.warn(`[testCreateLabel] Função addLabel não disponível no socket`);
        return res.status(400).json({ error: "Função addLabel não disponível no socket atual" });
      }
    } catch (error: any) {
      logger.error("Erro ao criar label de teste:", error);
      return res.status(500).json({ error: error?.message || "Erro ao criar label de teste" });
    }
  };

  export const normalizeNumbers = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { dryRun = false } = req.body;

    try {
      const result = await NormalizeContactNumbersService({
        companyId,
        dryRun: Boolean(dryRun)
      });

      return res.status(200).json(result);
    } catch (error: any) {
      logger.error("Erro ao normalizar números de contatos:", error);
      return res.status(500).json({ 
        error: "Erro interno do servidor",
        message: error?.message || "Erro desconhecido"
      });
    }
  };
