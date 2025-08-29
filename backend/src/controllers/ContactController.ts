import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";
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
import { ImportContactsService } from "../services/ContactServices/ImportContactsService";
import NumberSimpleListService from "../services/ContactServices/NumberSimpleListService";
import CreateOrUpdateContactServiceForImport from "../services/ContactServices/CreateOrUpdateContactServiceForImport";
import UpdateContactWalletsService from "../services/ContactServices/UpdateContactWalletsService";
import BulkUpdateContactsService from "../services/ContactServices/BulkUpdateContactsService";

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

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  contactTag: string;
  isGroup?: string;
  limit?: string;
  orderBy?: string;
  order?: string;
  segment?: string | string[];
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

  if (tags) {
    const tagList = tags.split(',').map(tag => tag.trim());

    for (const tagName of tagList) {
      try {
        let [tag, created] = await Tag.findOrCreate({
          where: { name: tagName, companyId, color: "#A4CCCC", kanban: 0 }

        });


        // Associate the tag with the contact
        await ContactTag.findOrCreate({
          where: {
            contactId: contact.id,
            tagId: tag.id
          }
        });
      } catch (error) {
        logger.info("Erro ao criar Tags", error)
      }
    }
  }
  const io = getIO();



  io.of(String(companyId))
    .emit(`company-${companyId}-contact`, {
      action: "create",
      contact
    });

  return res.status(200).json(contact);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber, contactTag: tagIdsStringified, isGroup, limit, orderBy, order } = req.query as IndexQuery;
  // <<-- ALTERAÇÃO 1: Adicionado 'profile' para obter o perfil do usuário
  const { id: userId, companyId, profile } = req.user;

  console.log("index", { companyId, userId, searchParam, profile });

  let tagsIds: number[] = [];

  if (tagIdsStringified) {
    tagsIds = JSON.parse(tagIdsStringified);
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

  const { contacts, count, hasMore } = await ListContactsService({
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
    segment
  });

  // Dispara validações em background sem bloquear a resposta
  try {
    // Forçar revalidação imediata durante os testes: TTL = 0h (voltar para 24 quando terminar)
    const ttlHours = 0;
    const now = Date.now();
    const ttlMs = ttlHours * 60 * 60 * 1000;
    contacts.forEach(c => {
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

  return res.json({ contacts, count, hasMore });
};

export const getContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { name, number } = req.body as IndexGetContactQuery;
  const { companyId } = req.user;

  console.log("getContact", { companyId, name, number })

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

export const store = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const newContact: ContactData = req.body;

  // Tratar foundationDate para null se for string vazia ou inválida
  if (typeof newContact.foundationDate === 'string' && (newContact.foundationDate === '' || newContact.foundationDate === null)) {
    newContact.foundationDate = null;
  }

  const newRemoteJid = newContact.number;

  console.log("store", { companyId, newContact })

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
    email: Yup.string()
      .transform((value, originalValue) => {
        const v = typeof originalValue === "string" ? originalValue.trim() : originalValue;
        return v === "" || v === undefined ? null : v;
      })
      .email()
      .nullable(),
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

  console.log("Creating contact with user:", req.user); // Log para depuração

  const contact = await CreateContactService({
    ...newContact,
    number: validNumber,
    // profilePicUrl,
    companyId,
    userId: req.user.id // Adicionando o userId ao criar o contato
  });

  const io = getIO();
  io.of(String(companyId))
    .emit(`company-${companyId}-contact`, {
      action: "create",
      contact
    });

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

  const contact = await UpdateContactService({
    contactData,
    contactId,
    companyId,
    userId: req.user?.id ? parseInt(req.user.id, 10) : undefined
  });

  const io = getIO();
  io.of(String(companyId))
    .emit(`company-${companyId}-contact`, {
      action: "update",
      contact
    });

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

  const io = getIO();
  io.of(String(companyId))
    .emit(`company-${companyId}-contact`, {
      action: "delete",
      contactId
    });

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

  const io = getIO();
  updated.forEach(contact => {
    io.of(String(companyId))
      .emit(`company-${companyId}-contact`, {
        action: "update",
        contact
      });
  });

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

    const io = getIO();
    // Emitir evento para cada ID deletado para atualizar o frontend em tempo real
    contactIds.forEach(id => {
      io.of(String(companyId))
        .emit(`company-${companyId}-contact`, {
          action: "delete",
          contactId: id
        });
    });

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

  const io = getIO();
  io.of(String(companyId))
    .emit(`company-${companyId}-contact`, {
      action: "update",
      contact
    });

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
  io.of(String(companyId))
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

  io.of(String(companyId))
    .emit(`company-${companyId}-contact`, {
      action: "reload",
      records: response
    });

  return res.status(200).json(response);
};

export const getContactProfileURL = async (req: Request, res: Response) => {
  const { number } = req.params
  const { companyId } = req.user;

  console.log("getContactProfileURL", { number, companyId })
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
      console.log("menor 30")
      vNumber = `${numberDDI + numberDDD + 9 + numberUser}@s.whatsapp.net`;
    } else if (numberDDD > '30' && numberDDI === '55') {
      console.log("maior 30")
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
    io.of(String(companyId))
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
    io.of(String(companyId))
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
