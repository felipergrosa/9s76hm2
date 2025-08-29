import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactTag from "../../models/ContactTag";
import Tag from "../../models/Tag";
import Whatsapp from "../../models/Whatsapp";
import ShowContactService from "./ShowContactService";

export type SituationType = 'Ativo' | 'Baixado' | 'Ex-Cliente' | 'Excluido' | 'Futuro' | 'Inativo';

interface BulkUpdateData {
  tagIds?: number[];
  situation?: SituationType;
  whatsappId?: number | null;
}

interface BulkUpdateRequest {
  companyId: number;
  contactIds: number[];
  data: BulkUpdateData;
}

const BulkUpdateContactsService = async ({ companyId, contactIds, data }: BulkUpdateRequest) => {
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    throw new AppError("Nenhum ID de contato fornecido para atualização em massa.", 400);
  }

  const { tagIds, situation, whatsappId } = data || {};

  // Valida situação se fornecida
  if (typeof situation !== "undefined") {
    const allowed: SituationType[] = ['Ativo', 'Baixado', 'Ex-Cliente', 'Excluido', 'Futuro', 'Inativo'];
    if (!allowed.includes(situation)) {
      throw new AppError("Situação inválida.", 400);
    }
  }

  // Valida conexão (whatsapp) se fornecida (permite null para limpar)
  if (typeof whatsappId !== "undefined" && whatsappId !== null) {
    const whats = await Whatsapp.findOne({ where: { id: whatsappId, companyId } });
    if (!whats) {
      throw new AppError("Conexão WhatsApp inválida para esta empresa.", 400);
    }
  }

  // Valida tags se fornecidas (todas devem pertencer à empresa)
  let validTagIds: number[] | undefined = undefined;
  if (Array.isArray(tagIds)) {
    if (tagIds.length === 0) {
      validTagIds = [];
    } else {
      const rows = await Tag.findAll({ where: { id: { [Op.in]: tagIds }, companyId }, attributes: ["id"] });
      validTagIds = rows.map(r => r.id);
      if (validTagIds.length !== tagIds.length) {
        throw new AppError("Uma ou mais tags são inválidas para esta empresa.", 400);
      }
    }
  }

  // Carrega contatos pertencentes à empresa
  const contacts = await Contact.findAll({ where: { id: { [Op.in]: contactIds }, companyId } });
  if (contacts.length === 0) {
    throw new AppError("Nenhum contato encontrado para atualização.", 404);
  }

  const updatedContacts: Contact[] = [];

  for (const c of contacts) {
    const updatePayload: any = {};
    if (typeof situation !== "undefined") updatePayload.situation = situation;
    if (typeof whatsappId !== "undefined") updatePayload.whatsappId = whatsappId;

    if (Object.keys(updatePayload).length > 0) {
      await c.update(updatePayload);
    }

    if (typeof validTagIds !== "undefined") {
      await ContactTag.destroy({ where: { contactId: c.id } });
      const list = validTagIds.map(tagId => ({ tagId, contactId: c.id }));
      if (list.length > 0) await ContactTag.bulkCreate(list);
    }

    const reloaded = await ShowContactService(c.id, companyId);
    updatedContacts.push(reloaded);
  }

  return updatedContacts;
};

export default BulkUpdateContactsService;
