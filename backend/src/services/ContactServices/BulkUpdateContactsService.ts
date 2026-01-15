import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactTag from "../../models/ContactTag";
import Tag from "../../models/Tag";
import Whatsapp from "../../models/Whatsapp";
import ContactWallet from "../../models/ContactWallet";
import User from "../../models/User";
import ShowContactService from "./ShowContactService";
import SyncContactWalletsAndPersonalTagsService from "./SyncContactWalletsAndPersonalTagsService";

export type SituationType = 'Ativo' | 'Baixado' | 'Ex-Cliente' | 'Excluido' | 'Futuro' | 'Inativo';

interface BulkUpdateData {
  tagIds?: number[];
  situation?: SituationType;
  whatsappId?: number | null;
  walletIds?: number[]; // IDs dos usuários para atribuir carteira
  disableBot?: boolean; // Desabilitar chatbot
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

  const { tagIds, situation, whatsappId, walletIds, disableBot } = data || {};

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
    if (typeof disableBot !== "undefined") updatePayload.disableBot = disableBot;

    if (Object.keys(updatePayload).length > 0) {
      await c.update(updatePayload);
    }

    if (typeof validTagIds !== "undefined") {
      await ContactTag.destroy({ where: { contactId: c.id } });
      const list = validTagIds.map(tagId => ({ tagId, contactId: c.id }));
      if (list.length > 0) await ContactTag.bulkCreate(list);

      try {
        await SyncContactWalletsAndPersonalTagsService({
          companyId,
          contactId: c.id,
          source: "tags"
        });
      } catch (err) {
        console.warn("[BulkUpdateContactsService] Falha ao sincronizar carteiras e tags pessoais", err);
      }
    }

    const reloaded = await ShowContactService(c.id, companyId);
    updatedContacts.push(reloaded);
  }

  // Atualiza carteiras em massa (fora do loop para eficiência)
  if (Array.isArray(walletIds)) {
    // Valida que os usuários existem na empresa
    const validUsers = await User.findAll({
      where: { id: { [Op.in]: walletIds }, companyId },
      attributes: ['id']
    });
    const validUserIds = validUsers.map(u => u.id);

    // Para cada contato, remove carteiras antigas e adiciona novas
    for (const c of contacts) {
      await ContactWallet.destroy({ where: { contactId: c.id } });

      if (validUserIds.length > 0) {
        const walletEntries = validUserIds.map(userId => ({
          walletId: userId,
          contactId: c.id,
          companyId
        }));
        await ContactWallet.bulkCreate(walletEntries as any);
      }
    }
  }

  return updatedContacts;
};

export default BulkUpdateContactsService;
