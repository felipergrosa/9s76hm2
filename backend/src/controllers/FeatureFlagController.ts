/**
 * FeatureFlagController.ts
 * 
 * Controller REST para gerenciamento de Feature Flags
 */

import { Request, Response } from "express";
import FeatureFlag from "../models/FeatureFlag";
import { featureFlagService } from "../services/IA/FeatureFlagService";
import logger from "../utils/logger";

// Criar nova flag
export const create = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const flagData = req.body;

  try {
    const flag = await featureFlagService.createFlag({
      ...flagData,
      companyId,
      createdBy: userId
    });

    return res.status(201).json({
      flag: flag.toJSON(),
      message: "Feature flag criada com sucesso"
    });
  } catch (error: any) {
    logger.error("[FeatureFlagController] Erro ao criar flag:", error);
    return res.status(400).json({ error: error.message });
  }
};

// Listar flags
export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { enabled } = req.query;

  try {
    const flags = await featureFlagService.listFlags(companyId, {
      enabled: enabled !== undefined ? enabled === "true" : undefined
    });

    return res.json({
      flags,
      count: flags.length
    });
  } catch (error) {
    logger.error("[FeatureFlagController] Erro ao listar flags:", error);
    return res.status(500).json({ error: "Erro ao listar flags" });
  }
};

// Buscar flag específica
export const show = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  try {
    const flag = await FeatureFlag.findOne({
      where: { id, companyId }
    });

    if (!flag) {
      return res.status(404).json({ error: "Feature flag não encontrada" });
    }

    return res.json({ flag });
  } catch (error) {
    logger.error("[FeatureFlagController] Erro ao buscar flag:", error);
    return res.status(500).json({ error: "Erro ao buscar flag" });
  }
};

// Atualizar flag
export const update = async (req: Request, res: Response): Promise<Response> => {
  const { id: userId } = req.user;
  const { id } = req.params;
  const updates = req.body;

  try {
    const flagId = parseInt(id as string, 10);
    if (isNaN(flagId)) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const flag = await featureFlagService.updateFlag(flagId, updates, Number(userId));

    return res.json({
      flag: flag.toJSON(),
      message: "Feature flag atualizada com sucesso"
    });
  } catch (error: any) {
    logger.error("[FeatureFlagController] Erro ao atualizar flag:", error);
    return res.status(400).json({ error: error.message });
  }
};

// Deletar flag
export const destroy = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  try {
    await featureFlagService.deleteFlag(Number(id));

    return res.json({ message: "Feature flag deletada com sucesso" });
  } catch (error: any) {
    logger.error("[FeatureFlagController] Erro ao deletar flag:", error);
    return res.status(400).json({ error: error.message });
  }
};

// Avaliar flag para contexto
export const evaluate = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const { key } = req.params;
  const context = req.body;

  try {
    const result = await featureFlagService.evaluate(key, {
      ...context,
      companyId,
      userId
    });

    return res.json({
      key,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error("[FeatureFlagController] Erro ao avaliar flag:", error);
    return res.status(500).json({ error: "Erro ao avaliar flag" });
  }
};

// Iniciar rollout gradual
export const gradualRollout = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { steps, stepDurationMinutes } = req.body;

  try {
    featureFlagService.gradualRollout(
      Number(id),
      steps,
      stepDurationMinutes
    );

    return res.json({
      message: "Rollout gradual iniciado",
      steps,
      stepDurationMinutes
    });
  } catch (error: any) {
    logger.error("[FeatureFlagController] Erro no rollout:", error);
    return res.status(400).json({ error: error.message });
  }
};

// Estatísticas
export const stats = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  try {
    const stats = await featureFlagService.getStats(companyId);
    return res.json(stats);
  } catch (error) {
    logger.error("[FeatureFlagController] Erro nas estatísticas:", error);
    return res.status(500).json({ error: "Erro ao obter estatísticas" });
  }
};

// Bulk update (atualizar múltiplas flags)
export const bulkUpdate = async (req: Request, res: Response): Promise<Response> => {
  const { id: userId } = req.user;
  const { flags } = req.body;

  try {
    const results = [];
    for (const { id, ...updates } of flags) {
      const flagId = parseInt(id as string, 10);
      if (!isNaN(flagId)) {
        const flag = await featureFlagService.updateFlag(flagId, updates, Number(userId));
        results.push(flag);
      }
    }

    return res.json({
      flags: results,
      count: results.length,
      message: `${results.length} flags atualizadas`
    });
  } catch (error: any) {
    logger.error("[FeatureFlagController] Erro no bulk update:", error);
    return res.status(400).json({ error: error.message });
  }
};
