import { Request, Response } from "express";

import FindAllContactService from "../../services/ContactServices/FindAllContactsServices";
import CreateOrUpdateContactServiceForImport from "../../services/ContactServices/CreateOrUpdateContactServiceForImport";
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";
import AppError from "../../errors/AppError";
import * as Yup from "yup";
import Contact from "../../models/Contact";
import { Op } from "sequelize";
import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";

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

interface ContactData {
  name: string;
  number: string;
  email?: string;
  cpfCnpj?: string;
  representativeCode?: string;
  city?: string;
  instagram?: string;
  situation?: 'Ativo' | 'Baixado' | 'Ex-Cliente' | 'Excluido' | 'Futuro' | 'Inativo';
  fantasyName?: string;
  foundationDate?: Date;
  creditLimit?: string;
  tags?: string;
  tagIds?: number[];
  segment?: string;
}

export const show = async (req: Request, res:Response): Promise<Response> => {
   const { companyId } = req.body as IndexQuery;
   
   const contacts = await FindAllContactService({companyId});

   return res.json({count:contacts.length, contacts});
}

export const count = async (req: Request, res:Response): Promise<Response> => {
    const { companyId } = req.body as IndexQuery;
    
    const contacts = await FindAllContactService({companyId});
 
    return res.json({count:contacts.length}); 
 }

 export const sync = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.body as IndexQuery;
  const contactData = req.body as ContactData;

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
    instagram: Yup.string().nullable(),
    situation: Yup.string().oneOf(['Ativo', 'Baixado', 'Ex-Cliente', 'Excluido', 'Futuro', 'Inativo']).nullable(),
    fantasyName: Yup.string().nullable(),
    foundationDate: Yup.date().nullable(),
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
    tagIds: Yup.array().of(Yup.number()).nullable(),
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

  try {
    const contact = await CreateOrUpdateContactServiceForImport({
      ...contactData,
      companyId: companyId,
      isGroup: false,
      profilePicUrl: ""
    });

    if (contactData.tags) {
      const tagList = contactData.tags.split(',').map(tag => tag.trim());

      for (const tagName of tagList) {
        try {
          let [tag, created] = await Tag.findOrCreate({
            where: { name: tagName, companyId, color: "#A4CCCC", kanban: 0 }
          });

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

    if (contactData.tagIds && contactData.tagIds.length > 0) {
      for (const tagId of contactData.tagIds) {
        try {
          await ContactTag.findOrCreate({
            where: {
              contactId: contact.id,
              tagId: tagId
            }
          });
        } catch (error) {
          logger.info(`Erro ao associar Tag ID ${tagId} ao contato`, error);
        }
      }
    }

    const io = getIO();
    io.of(`/workspace-${companyId}`).emit(`company-${companyId}-contact`, {
      action: "create",
      contact
    });

    return res.status(200).json(contact);
  } catch (error) {
    logger.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
