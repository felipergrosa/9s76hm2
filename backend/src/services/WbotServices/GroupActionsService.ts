import { getWbot, getWbotOrRecover } from "../../libs/wbot";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";

interface GroupActionRequest {
  contactId: number; // ID do contato do grupo no sistema
  companyId: number;
  participantNumbers: string[]; // Números dos participantes (ex: ["5511999999999"])
}

interface GroupActionResult {
  success: boolean;
  message: string;
  results?: Array<{
    number: string;
    status: "success" | "error";
    message?: string;
  }>;
}

/**
 * Obtém o wbot e JID do grupo a partir do contactId
 */
const getGroupContext = async (contactId: number, companyId: number) => {
  const groupContact = await Contact.findOne({
    where: { id: contactId, companyId, isGroup: true }
  });

  if (!groupContact) {
    throw new Error("Grupo não encontrado");
  }

  let groupJid = groupContact.number;
  if (!groupJid.includes("@g.us")) {
    groupJid = `${groupJid}@g.us`;
  }

  const whatsappId = groupContact.whatsappId;
  if (!whatsappId) {
    throw new Error("Grupo não está associado a nenhuma conexão WhatsApp");
  }

  const whatsapp = await Whatsapp.findByPk(whatsappId);
  if (!whatsapp || whatsapp.status !== "CONNECTED") {
    throw new Error("Conexão WhatsApp não está ativa");
  }

  const wbot = await getWbotOrRecover(whatsappId, 30000);
  if (!wbot) {
    throw new Error("Sessão WhatsApp não disponível. Tente novamente em alguns segundos.");
  }
  return { wbot, groupJid, groupContact };
};

/**
 * Converte números para JIDs do WhatsApp
 */
const numbersToJids = (numbers: string[]): string[] => {
  return numbers.map(n => {
    const clean = n.replace(/\D/g, "");
    return clean.includes("@") ? clean : `${clean}@s.whatsapp.net`;
  });
};

/**
 * Adicionar participantes ao grupo
 */
export const addParticipants = async ({
  contactId,
  companyId,
  participantNumbers
}: GroupActionRequest): Promise<GroupActionResult> => {
  const { wbot, groupJid } = await getGroupContext(contactId, companyId);
  const jids = numbersToJids(participantNumbers);

  try {
    const result = await wbot.groupParticipantsUpdate(groupJid, jids, "add");
    logger.info(`[GroupActions] Participantes adicionados ao grupo ${groupJid}: ${JSON.stringify(result)}`);

    return {
      success: true,
      message: `${jids.length} participante(s) adicionado(s) com sucesso`,
      results: jids.map((jid, i) => ({
        number: participantNumbers[i],
        status: "success" as const
      }))
    };
  } catch (error: any) {
    logger.error(`[GroupActions] Erro ao adicionar participantes: ${error.message}`);
    throw new Error(`Erro ao adicionar participantes: ${error.message}`);
  }
};

/**
 * Remover participantes do grupo
 */
export const removeParticipants = async ({
  contactId,
  companyId,
  participantNumbers
}: GroupActionRequest): Promise<GroupActionResult> => {
  const { wbot, groupJid } = await getGroupContext(contactId, companyId);
  const jids = numbersToJids(participantNumbers);

  try {
    const result = await wbot.groupParticipantsUpdate(groupJid, jids, "remove");
    logger.info(`[GroupActions] Participantes removidos do grupo ${groupJid}: ${JSON.stringify(result)}`);

    return {
      success: true,
      message: `${jids.length} participante(s) removido(s) com sucesso`,
      results: jids.map((jid, i) => ({
        number: participantNumbers[i],
        status: "success" as const
      }))
    };
  } catch (error: any) {
    logger.error(`[GroupActions] Erro ao remover participantes: ${error.message}`);
    throw new Error(`Erro ao remover participantes: ${error.message}`);
  }
};

/**
 * Promover participantes a admin do grupo
 */
export const promoteParticipants = async ({
  contactId,
  companyId,
  participantNumbers
}: GroupActionRequest): Promise<GroupActionResult> => {
  const { wbot, groupJid } = await getGroupContext(contactId, companyId);
  const jids = numbersToJids(participantNumbers);

  try {
    const result = await wbot.groupParticipantsUpdate(groupJid, jids, "promote");
    logger.info(`[GroupActions] Participantes promovidos no grupo ${groupJid}: ${JSON.stringify(result)}`);

    return {
      success: true,
      message: `${jids.length} participante(s) promovido(s) a admin`,
      results: jids.map((jid, i) => ({
        number: participantNumbers[i],
        status: "success" as const
      }))
    };
  } catch (error: any) {
    logger.error(`[GroupActions] Erro ao promover participantes: ${error.message}`);
    throw new Error(`Erro ao promover participantes: ${error.message}`);
  }
};

/**
 * Rebaixar participantes de admin do grupo
 */
export const demoteParticipants = async ({
  contactId,
  companyId,
  participantNumbers
}: GroupActionRequest): Promise<GroupActionResult> => {
  const { wbot, groupJid } = await getGroupContext(contactId, companyId);
  const jids = numbersToJids(participantNumbers);

  try {
    const result = await wbot.groupParticipantsUpdate(groupJid, jids, "demote");
    logger.info(`[GroupActions] Participantes rebaixados no grupo ${groupJid}: ${JSON.stringify(result)}`);

    return {
      success: true,
      message: `${jids.length} participante(s) rebaixado(s) de admin`,
      results: jids.map((jid, i) => ({
        number: participantNumbers[i],
        status: "success" as const
      }))
    };
  } catch (error: any) {
    logger.error(`[GroupActions] Erro ao rebaixar participantes: ${error.message}`);
    throw new Error(`Erro ao rebaixar participantes: ${error.message}`);
  }
};

/**
 * Sair do grupo
 */
export const leaveGroup = async ({
  contactId,
  companyId
}: { contactId: number; companyId: number }): Promise<GroupActionResult> => {
  const { wbot, groupJid } = await getGroupContext(contactId, companyId);

  try {
    await wbot.groupLeave(groupJid);
    logger.info(`[GroupActions] Saiu do grupo ${groupJid}`);

    return {
      success: true,
      message: "Saiu do grupo com sucesso"
    };
  } catch (error: any) {
    logger.error(`[GroupActions] Erro ao sair do grupo: ${error.message}`);
    throw new Error(`Erro ao sair do grupo: ${error.message}`);
  }
};

/**
 * Obter link de convite do grupo
 */
export const getInviteLink = async ({
  contactId,
  companyId
}: { contactId: number; companyId: number }): Promise<string> => {
  const { wbot, groupJid } = await getGroupContext(contactId, companyId);

  try {
    const code = await wbot.groupInviteCode(groupJid);
    const link = `https://chat.whatsapp.com/${code}`;
    logger.info(`[GroupActions] Link de convite gerado para grupo ${groupJid}`);
    return link;
  } catch (error: any) {
    logger.error(`[GroupActions] Erro ao gerar link de convite: ${error.message}`);
    throw new Error(`Erro ao gerar link de convite: ${error.message}`);
  }
};

/**
 * Alterar nome (subject) do grupo
 */
export const updateGroupSubject = async ({
  contactId,
  companyId,
  subject
}: { contactId: number; companyId: number; subject: string }): Promise<GroupActionResult> => {
  const { wbot, groupJid, groupContact } = await getGroupContext(contactId, companyId);

  try {
    await wbot.groupUpdateSubject(groupJid, subject);
    // Atualizar nome no banco local
    await groupContact.update({ name: subject });
    logger.info(`[GroupActions] Nome do grupo ${groupJid} alterado para: ${subject}`);

    return { success: true, message: "Nome do grupo alterado com sucesso" };
  } catch (error: any) {
    logger.error(`[GroupActions] Erro ao alterar nome do grupo: ${error.message}`);
    throw new Error(`Erro ao alterar nome do grupo: ${error.message}`);
  }
};

/**
 * Alterar descrição do grupo
 */
export const updateGroupDescription = async ({
  contactId,
  companyId,
  description
}: { contactId: number; companyId: number; description: string }): Promise<GroupActionResult> => {
  const { wbot, groupJid } = await getGroupContext(contactId, companyId);

  try {
    await wbot.groupUpdateDescription(groupJid, description);
    logger.info(`[GroupActions] Descrição do grupo ${groupJid} alterada`);

    return { success: true, message: "Descrição do grupo alterada com sucesso" };
  } catch (error: any) {
    logger.error(`[GroupActions] Erro ao alterar descrição do grupo: ${error.message}`);
    throw new Error(`Erro ao alterar descrição do grupo: ${error.message}`);
  }
};

/**
 * Alterar foto do grupo
 * @param imageBuffer - Buffer da imagem (JPEG/PNG)
 */
export const updateGroupPicture = async ({
  contactId,
  companyId,
  imageBuffer
}: { contactId: number; companyId: number; imageBuffer: Buffer }): Promise<GroupActionResult> => {
  const { wbot, groupJid } = await getGroupContext(contactId, companyId);

  try {
    await wbot.updateProfilePicture(groupJid, imageBuffer);
    logger.info(`[GroupActions] Foto do grupo ${groupJid} alterada`);

    return { success: true, message: "Foto do grupo alterada com sucesso" };
  } catch (error: any) {
    logger.error(`[GroupActions] Erro ao alterar foto do grupo: ${error.message}`);
    throw new Error(`Erro ao alterar foto do grupo: ${error.message}`);
  }
};

/**
 * Alterar configurações do grupo
 * @param setting - "announcement" (só admins enviam) ou "not_announcement" (todos enviam)
 *                  "locked" (só admins editam info) ou "unlocked" (todos editam info)
 */
export const updateGroupSettings = async ({
  contactId,
  companyId,
  setting
}: { contactId: number; companyId: number; setting: "announcement" | "not_announcement" | "locked" | "unlocked" }): Promise<GroupActionResult> => {
  const { wbot, groupJid } = await getGroupContext(contactId, companyId);

  try {
    await wbot.groupSettingUpdate(groupJid, setting);

    const settingLabels: Record<string, string> = {
      "announcement": "Apenas admins podem enviar mensagens",
      "not_announcement": "Todos podem enviar mensagens",
      "locked": "Apenas admins podem editar dados do grupo",
      "unlocked": "Todos podem editar dados do grupo"
    };

    logger.info(`[GroupActions] Configuração do grupo ${groupJid} alterada: ${setting}`);
    return { success: true, message: settingLabels[setting] || "Configuração alterada" };
  } catch (error: any) {
    logger.error(`[GroupActions] Erro ao alterar configuração do grupo: ${error.message}`);
    throw new Error(`Erro ao alterar configuração do grupo: ${error.message}`);
  }
};
