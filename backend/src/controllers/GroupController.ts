import { Request, Response } from "express";
import logger from "../utils/logger";
import GetGroupParticipantsService from "../services/WbotServices/GetGroupParticipantsService";
import {
  addParticipants,
  removeParticipants,
  promoteParticipants,
  demoteParticipants,
  leaveGroup,
  getInviteLink,
  updateGroupSubject,
  updateGroupDescription,
  updateGroupPicture,
  updateGroupSettings
} from "../services/WbotServices/GroupActionsService";

// Interface para request autenticado
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    companyId: number;
    profile: string;
  };
}

/**
 * Buscar participantes e metadados de um grupo
 * GET /groups/:contactId/participants
 */
export const participants = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  try {
    const groupInfo = await GetGroupParticipantsService({
      contactId: Number(contactId),
      companyId
    });

    return res.json(groupInfo);
  } catch (error: any) {
    logger.error(`[GroupController.participants] Erro: ${error.message}`);
    return res.status(400).json({
      error: error.message || "Erro ao buscar participantes do grupo"
    });
  }
};

/**
 * Adicionar participantes ao grupo
 * POST /groups/:contactId/participants/add
 */
export const addMembers = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;
  const { numbers } = req.body as { numbers: string[] };

  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: "Informe ao menos um número" });
  }

  try {
    const result = await addParticipants({
      contactId: Number(contactId),
      companyId,
      participantNumbers: numbers
    });

    return res.json(result);
  } catch (error: any) {
    logger.error(`[GroupController.addMembers] Erro: ${error.message}`);
    return res.status(400).json({ error: error.message || "Erro ao adicionar participantes" });
  }
};

/**
 * Remover participantes do grupo
 * POST /groups/:contactId/participants/remove
 */
export const removeMembers = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;
  const { numbers } = req.body as { numbers: string[] };

  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: "Informe ao menos um número" });
  }

  try {
    const result = await removeParticipants({
      contactId: Number(contactId),
      companyId,
      participantNumbers: numbers
    });

    return res.json(result);
  } catch (error: any) {
    logger.error(`[GroupController.removeMembers] Erro: ${error.message}`);
    return res.status(400).json({ error: error.message || "Erro ao remover participantes" });
  }
};

/**
 * Promover participantes a admin
 * POST /groups/:contactId/participants/promote
 */
export const promote = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;
  const { numbers } = req.body as { numbers: string[] };

  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: "Informe ao menos um número" });
  }

  try {
    const result = await promoteParticipants({
      contactId: Number(contactId),
      companyId,
      participantNumbers: numbers
    });

    return res.json(result);
  } catch (error: any) {
    logger.error(`[GroupController.promote] Erro: ${error.message}`);
    return res.status(400).json({ error: error.message || "Erro ao promover participantes" });
  }
};

/**
 * Rebaixar participantes de admin
 * POST /groups/:contactId/participants/demote
 */
export const demote = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;
  const { numbers } = req.body as { numbers: string[] };

  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: "Informe ao menos um número" });
  }

  try {
    const result = await demoteParticipants({
      contactId: Number(contactId),
      companyId,
      participantNumbers: numbers
    });

    return res.json(result);
  } catch (error: any) {
    logger.error(`[GroupController.demote] Erro: ${error.message}`);
    return res.status(400).json({ error: error.message || "Erro ao rebaixar participantes" });
  }
};

/**
 * Sair do grupo
 * POST /groups/:contactId/leave
 */
export const leave = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  try {
    const result = await leaveGroup({
      contactId: Number(contactId),
      companyId
    });

    return res.json(result);
  } catch (error: any) {
    logger.error(`[GroupController.leave] Erro: ${error.message}`);
    return res.status(400).json({ error: error.message || "Erro ao sair do grupo" });
  }
};

/**
 * Obter link de convite do grupo
 * GET /groups/:contactId/invite-link
 */
export const inviteLink = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  try {
    const link = await getInviteLink({
      contactId: Number(contactId),
      companyId
    });

    return res.json({ link });
  } catch (error: any) {
    logger.error(`[GroupController.inviteLink] Erro: ${error.message}`);
    return res.status(400).json({ error: error.message || "Erro ao gerar link de convite" });
  }
};

/**
 * Alterar nome do grupo
 * PUT /groups/:contactId/subject
 */
export const updateSubject = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;
  const { subject } = req.body as { subject: string };

  if (!subject || !subject.trim()) {
    return res.status(400).json({ error: "Informe o novo nome do grupo" });
  }

  try {
    const result = await updateGroupSubject({
      contactId: Number(contactId),
      companyId,
      subject: subject.trim()
    });
    return res.json(result);
  } catch (error: any) {
    logger.error(`[GroupController.updateSubject] Erro: ${error.message}`);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * Alterar descrição do grupo
 * PUT /groups/:contactId/description
 */
export const updateDescription = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;
  const { description } = req.body as { description: string };

  try {
    const result = await updateGroupDescription({
      contactId: Number(contactId),
      companyId,
      description: (description || "").trim()
    });
    return res.json(result);
  } catch (error: any) {
    logger.error(`[GroupController.updateDescription] Erro: ${error.message}`);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * Alterar foto do grupo
 * PUT /groups/:contactId/picture
 */
export const updatePicture = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;

  if (!req.file) {
    return res.status(400).json({ error: "Envie uma imagem" });
  }

  try {
    const result = await updateGroupPicture({
      contactId: Number(contactId),
      companyId,
      imageBuffer: req.file.buffer
    });
    return res.json(result);
  } catch (error: any) {
    logger.error(`[GroupController.updatePicture] Erro: ${error.message}`);
    return res.status(400).json({ error: error.message });
  }
};

/**
 * Alterar configurações do grupo
 * PUT /groups/:contactId/settings
 */
export const updateSettings = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const { contactId } = req.params;
  const { companyId } = req.user;
  const { setting } = req.body as { setting: "announcement" | "not_announcement" | "locked" | "unlocked" };

  const validSettings = ["announcement", "not_announcement", "locked", "unlocked"];
  if (!setting || !validSettings.includes(setting)) {
    return res.status(400).json({ error: `Configuração inválida. Use: ${validSettings.join(", ")}` });
  }

  try {
    const result = await updateGroupSettings({
      contactId: Number(contactId),
      companyId,
      setting
    });
    return res.json(result);
  } catch (error: any) {
    logger.error(`[GroupController.updateSettings] Erro: ${error.message}`);
    return res.status(400).json({ error: error.message });
  }
};
