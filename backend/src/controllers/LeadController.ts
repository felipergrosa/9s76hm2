import { Request, Response } from "express";
import * as Yup from "yup";
import Contact from "../models/Contact";
import Company from "../models/Company";
import Tag from "../models/Tag";
import ContactTag from "../models/ContactTag";
import logger from "../utils/logger";
import AppError from "../errors/AppError";
import SendWelcomeMessageService from "../services/LeadService/SendWelcomeMessageService";

interface LeadData {
  name: string;
  email: string;
  phone: string;
  company?: string;
  message?: string;
}

export const store = async (req: Request, res: Response): Promise<Response> => {
  const schema = Yup.object().shape({
    name: Yup.string().required("Nome é obrigatório"),
    email: Yup.string().email("Email inválido").required("Email é obrigatório"),
    phone: Yup.string().required("Telefone é obrigatório"),
    company: Yup.string().nullable(),
    message: Yup.string().max(500, "Mensagem muito longa").nullable(),
  });

  let leadData: LeadData;
  try {
    leadData = await schema.validate(req.body);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  try {
    // Buscar a primeira empresa disponível ou criar uma empresa padrão para leads
    // Por padrão, vamos usar a empresa com ID 1 ou a primeira disponível
    let company = await Company.findOne({ order: [["id", "ASC"]] });
    
    if (!company) {
      logger.warn("Nenhuma empresa encontrada para salvar lead");
      return res.status(400).json({ error: "Sistema não configurado corretamente" });
    }

    // Limpar e formatar o número de telefone
    const cleanedPhone = leadData.phone.replace(/\D/g, "");
    const canonicalNumber = cleanedPhone.endsWith("@s.whatsapp.net") 
      ? cleanedPhone 
      : `${cleanedPhone}@s.whatsapp.net`;

    // Verificar se já existe um contato com esse número
    const existingContact = await Contact.findOne({
      where: {
        number: cleanedPhone,
        companyId: company.id,
      },
    });

    if (existingContact) {
      // Atualizar contato existente com informações do lead
      existingContact.name = leadData.name;
      existingContact.email = leadData.email || existingContact.email;
      if (leadData.company) {
        existingContact.bzEmpresa = leadData.company;
      }
      await existingContact.save();

      // Adicionar tag "Lead" se não tiver
      try {
        const [leadTag] = await Tag.findOrCreate({
          where: { name: "Lead", companyId: company.id },
          defaults: { color: "#25D366", kanban: 0 }
        });
        await ContactTag.findOrCreate({
          where: { contactId: existingContact.id, tagId: leadTag.id }
        });
      } catch (err) {
        logger.warn("Erro ao adicionar tag Lead ao contato existente", err);
      }

      logger.info({ contactId: existingContact.id, companyId: company.id }, "Lead atualizado em contato existente");
      return res.status(200).json({ 
        contact: existingContact,
        message: "Lead atualizado com sucesso",
        isNew: false
      });
    }

    // Criar novo contato/lead
    const contactData: any = {
      name: leadData.name,
      email: leadData.email || "",
      number: cleanedPhone,
      canonicalNumber: canonicalNumber,
      companyId: company.id,
      active: true,
      bzEmpresa: leadData.company || null,
    };

    const contact = await Contact.create(contactData);

    // Adicionar mensagem como extraInfo se necessário (após criar o contato)
    if (leadData.message && contact.id) {
      try {
        const ContactCustomField = (await import("../models/ContactCustomField")).default;
        await ContactCustomField.create({
          contactId: contact.id,
          name: "Mensagem do Lead",
          value: leadData.message,
        });
      } catch (err) {
        logger.warn("Erro ao adicionar mensagem como extraInfo", err);
      }
    }

    // Adicionar tag "Lead" automaticamente
    try {
      const [leadTag] = await Tag.findOrCreate({
        where: { name: "Lead", companyId: company.id },
        defaults: { color: "#25D366", kanban: 0 }
      });
      await ContactTag.findOrCreate({
        where: { contactId: contact.id, tagId: leadTag.id }
      });
      logger.info({ contactId: contact.id, tagId: leadTag.id }, "Tag 'Lead' adicionada ao contato");
    } catch (err) {
      logger.warn("Erro ao adicionar tag Lead", err);
    }

    // Enviar mensagem de boas-vindas automaticamente (de forma assíncrona)
    setImmediate(async () => {
      try {
        await SendWelcomeMessageService({
          contact,
          companyId: company.id,
        });
      } catch (err) {
        logger.error({ error: err, contactId: contact.id }, "Erro ao enviar mensagem de boas-vindas (não bloqueia resposta)");
      }
    });

    logger.info({ contactId: contact.id, companyId: company.id }, "Lead criado com sucesso");
    return res.status(201).json({ 
      contact,
      message: "Lead criado com sucesso",
      isNew: true
    });
  } catch (error: any) {
    logger.error({ error: error.message }, "Erro ao criar lead");
    throw new AppError("Erro ao processar lead. Tente novamente.");
  }
};

