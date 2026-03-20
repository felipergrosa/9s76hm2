import { Request, Response } from "express";

import FindAllContactService from "../../services/ContactServices/FindAllContactsServices";
import CreateOrUpdateContactServiceForImport from "../../services/ContactServices/CreateOrUpdateContactServiceForImport";
import ShowContactService from "../../services/ContactServices/ShowContactService"; // ✅ Importação faltante
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";
import AppError from "../../errors/AppError";
import * as Yup from "yup";
import Contact from "../../models/Contact";
import { Op } from "sequelize";
import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";
import User from "../../models/User"; // ✅ Importação faltante

type IndexQuery = {
  companyId: number;
};

export const segments = async (req: Request, res: Response): Promise<Response> => {
  const bodyCompanyId = (req.body as any)?.companyId;
  const queryCompanyId = (req.query as any)?.companyId;
  const companyId = Number(bodyCompanyId ?? queryCompanyId);

  if (!companyId || Number.isNaN(companyId)) {
    throw new AppError("companyId é obrigatório", 400);
  }

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

  const segments = Array.from(set).sort((a, b) => a.localeCompare(b));
  return res.json({ count: segments.length, segments });
}

export const empresas = async (req: Request, res: Response): Promise<Response> => {
  const bodyCompanyId = (req.body as any)?.companyId;
  const queryCompanyId = (req.query as any)?.companyId;
  const companyId = Number(bodyCompanyId ?? queryCompanyId);

  if (!companyId || Number.isNaN(companyId)) {
    throw new AppError("companyId é obrigatório", 400);
  }

  const rows = await Contact.findAll({
    where: {
      companyId,
      bzEmpresa: { [Op.ne]: null }
    },
    attributes: ["bzEmpresa"],
    raw: true
  });

  const set = new Set<string>();
  for (const r of rows as any[]) {
    const e = (r.bzEmpresa || "").trim();
    if (e) set.add(e);
  }

  const empresas = Array.from(set).sort((a, b) => a.localeCompare(b));
  return res.json({ count: empresas.length, empresas });
}

interface ContactData {
  name: string;
  number: string;
  email?: string;
  cpfCnpj?: string;
  representativeCode?: string;
  city?: string;
  region?: string;
  instagram?: string;
  situation?: 'Ativo' | 'Baixado' | 'Ex-Cliente' | 'Excluido' | 'Futuro' | 'Inativo';
  fantasyName?: string;
  foundationDate?: Date;
  creditLimit?: string;
  tags?: string;
  tagIds?: number[];
  segment?: string;
  bzEmpresa?: string;
  clientCode?: string;
  dtUltCompra?: Date | string | null;
  vlUltCompra?: number | string | null;
  contactName?: string; // ✅ Adicionado campo faltante
}

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.body as IndexQuery;

  const contacts = await FindAllContactService({ companyId });

  return res.json({ count: contacts.length, contacts });
}

export const count = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.body as IndexQuery;

  const contacts = await FindAllContactService({ companyId });

  return res.json({ count: contacts.length });
}

export const sync = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.body as IndexQuery;
  const contactData = req.body as ContactData;

  // Normaliza silentMode vindo do body (true, "true", etc.)
  const rawSilentMode = (req.body as any)?.silentMode;
  const silentMode = rawSilentMode === true || String(rawSilentMode).toLowerCase() === "true";

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    number: Yup.string().required(),
    email: Yup.string()
      .transform((value, originalValue) => {
        const v = typeof originalValue === 'string' ? originalValue.trim() : originalValue;
        return v === '' || v === undefined ? null : v;
      })
      .nullable(),
    cpfCnpj: Yup.string().nullable(),
    representativeCode: Yup.string().nullable(),
    city: Yup.string().nullable(),
    region: Yup.string().nullable(),
    instagram: Yup.string().nullable(),
    situation: Yup.string().oneOf(['Ativo', 'Baixado', 'Ex-Cliente', 'Excluido', 'Futuro', 'Inativo']).nullable(),
    fantasyName: Yup.string().nullable(),
    foundationDate: Yup.date().nullable().transform((value, originalValue) => originalValue === "" ? null : value),
    dtUltCompra: Yup.date().nullable().transform((value, originalValue) => originalValue === "" ? null : value),
    vlUltCompra: Yup.mixed().nullable(),
    creditLimit: Yup.string()
      .transform((value, originalValue) => {
        const v = typeof originalValue === 'string' ? originalValue.trim() : originalValue;
        return v === '' || v === undefined ? null : v;
      })
      .nullable(),
    segment: Yup.string()
      .transform((value, originalValue) => {
        const v = typeof originalValue === 'string' ? originalValue.trim() : originalValue;
        return v === '' || v === undefined ? null : v;
      })
      .nullable(),
    bzEmpresa: Yup.string()
      .transform((value, originalValue) => {
        const v = typeof originalValue === 'string' ? originalValue.trim() : originalValue;
        return v === '' || v === undefined ? null : v;
      })
      .nullable(),
    clientCode: Yup.string().nullable(),
    tagIds: Yup.array().of(Yup.number()).nullable(),
    contactName: Yup.string().nullable(), // ✅ Adicionado validação do campo faltante
  });

  try {
    await schema.validate(contactData);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // Normalização pós-validação: email como string vazia, creditLimit como null quando vazio
  if (Object.prototype.hasOwnProperty.call(contactData, 'email')) {
    if (contactData.email === null || contactData.email === undefined) {
      contactData.email = '' as any;
    } else if (typeof contactData.email === 'string') {
      contactData.email = contactData.email.trim();
    }
  }

  if (Object.prototype.hasOwnProperty.call(contactData, 'creditLimit')) {
    if (typeof contactData.creditLimit === 'string' && contactData.creditLimit.trim() === '') {
      contactData.creditLimit = null as any;
    }
  }

  if (Object.prototype.hasOwnProperty.call(contactData, 'segment')) {
    if (contactData.segment === null || contactData.segment === undefined) {
      // mantém null/undefined
    } else if (typeof contactData.segment === 'string') {
      const s = contactData.segment.trim();
      contactData.segment = (s === '') ? (null as any) : s;
    }
  }

  if (Object.prototype.hasOwnProperty.call(contactData, 'region')) {
    if (contactData.region === null || contactData.region === undefined) {
      // mantém null/undefined
    } else if (typeof contactData.region === 'string') {
      const r = contactData.region.trim();
      contactData.region = (r === '') ? (null as any) : r;
    }
  }

  if (Object.prototype.hasOwnProperty.call(contactData, 'bzEmpresa')) {
    if (contactData.bzEmpresa === null || contactData.bzEmpresa === undefined) {
      // mantém null/undefined
    } else if (typeof contactData.bzEmpresa === 'string') {
      const e = contactData.bzEmpresa.trim();
      contactData.bzEmpresa = (e === '') ? (null as any) : e;
    }
  }

  if (Object.prototype.hasOwnProperty.call(contactData, 'clientCode')) {
    if (typeof contactData.clientCode === 'string' && contactData.clientCode.trim() === '') {
      contactData.clientCode = null as any;
    }
  }

  try {
    const contact = await CreateOrUpdateContactServiceForImport({
      ...contactData,
      companyId: companyId,
      isGroup: false,
      profilePicUrl: "",
      silentMode
    });

    let hasTagAssociation = false;

    if (contactData.tags) {
      const tagList = contactData.tags.split(',').map(tag => tag.trim());

      for (const tagName of tagList) {
        let tag: any = null;
        let cleanTagName = "";
        
        try {
          // Limpar nome da tag
          cleanTagName = tagName.trim().replace(/\s+/g, ' ');
          if (!cleanTagName) continue;
          
          // Primeiro tenta encontrar tag existente apenas por nome e companyId
          tag = await Tag.findOne({
            where: { name: cleanTagName, companyId }
          });

          // Se não encontrou, tenta criar nova tag
          if (!tag) {
            // Verificar se existe usuário sistema (ID 1), senão usar qualquer usuário da empresa
            let systemUserId = 1;
            try {
              const systemUser = await User.findByPk(1);
              if (!systemUser) {
                // Buscar primeiro usuário da empresa
                const firstUser = await User.findOne({ where: { companyId } });
                systemUserId = firstUser?.id || 1;
              }
            } catch (err) {
              logger.warn(`Não foi possível verificar usuário sistema, usando ID 1:`, err);
            }
            
            try {
              tag = await Tag.create({
                name: cleanTagName,
                companyId,
                color: "#A4CCCC",
                kanban: 0,
                userId: systemUserId
              });
              
              logger.info(`Tag '${cleanTagName}' criada com sucesso para companyId ${companyId} (API - userId: ${systemUserId})`);
            } catch (createError: any) {
              // Se falhar criação, pode ser que já foi criada por outro processo
              if (createError?.name === 'SequelizeUniqueConstraintError' || 
                  createError?.code === '23505') {
                logger.info(`Tag '${cleanTagName}' já existe (criação concorrente), buscando novamente...`);
                tag = await Tag.findOne({
                  where: { name: cleanTagName, companyId }
                });
              } else {
                throw createError; // Re-lançar outros erros
              }
            }
          }

          if (tag) {
            // Tenta associar tag ao contato
            try {
              await ContactTag.findOrCreate({
                where: {
                  contactId: contact.id,
                  tagId: tag.id
                }
              });
              hasTagAssociation = true;
            } catch (associationError: any) {
              // Se já existe associação, ignora
              if (associationError?.name === 'SequelizeUniqueConstraintError' || 
                  associationError?.code === '23505') {
                logger.info(`Tag '${cleanTagName}' já associada ao contato ${contact.id}`);
              } else {
                throw associationError; // Re-lançar outros erros
              }
            }
          }
        } catch (error: any) {
          // Log EXTREMAMENTE detalhado para debug - FORÇADO sempre
          console.error(`[TAG-ERROR] Erro completo ao processar Tag '${tagName}':`, {
            errorMessage: error?.message,
            errorName: error?.name,
            errorCode: error?.code,
            errorType: error?.constructor?.name,
            stack: error?.stack,
            sql: error?.sql,
            fields: error?.fields,
            originalError: error,
            tagName,
            cleanTagName,
            contactId: contact.id,
            companyId,
            tagExists: !!tag,
            contactData: {
              name: contactData.name,
              number: contactData.number,
              tags: contactData.tags,
              tagIds: contactData.tagIds
            }
          });
          
          // Também log como INFO para garantir que apareça nos logs normais
          logger.info(`[TAG-ERROR-DETALHADO] Erro ao processar Tag '${tagName}' para o contato ${contact.id}:`, {
            error: error?.message,
            tagName,
            contactId: contact.id,
            companyId,
            errorCode: error?.code,
            errorType: error?.constructor?.name,
            sql: error?.sql,
            fields: error?.fields,
            stack: error?.stack
          });
          
          logger.warn(`Erro ao processar Tag '${tagName}' para o contato ${contact.id}:`, {
            error: error?.message,
            tagName,
            contactId: contact.id,
            companyId,
            errorCode: error?.code,
            errorType: error?.constructor?.name
          });
        }
      }
    }

    if (contactData.tagIds && contactData.tagIds.length > 0) {
      for (const tagId of contactData.tagIds) {
        try {
          await ContactTag.findOrCreate({
            where: {
              contactId: contact.id,
              tagId: tagId
            }
          });
          hasTagAssociation = true;
        } catch (error) {
          logger.info(`Erro ao associar Tag ID ${tagId} ao contato`, error);
        }
      }
    }

    // Após migração para tags pessoais, não é necessário sincronizar carteiras

    const io = getIO();
    io.of(`/workspace-${companyId}`).emit(`company-${companyId}-contact`, {
      action: "create",
      contact
    });

    // Buscar contato atualizado COM tags para retornar
    const contactWithTags = await ShowContactService(contact.id, companyId);

    return res.status(200).json(contactWithTags);
  } catch (error: any) {
    logger.error(error);
    return res.status(500).json({ error: error?.message || "Internal server error" });
  }
};
