import { Request, Response } from "express";
import { Op } from "sequelize";
import AppError from "../errors/AppError";
import AIAgent from "../models/AIAgent";
import FunnelStage from "../models/FunnelStage";
import AIPromptVersion from "../models/AIPromptVersion";

export const createVersion = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const { agentId, stageId, systemPrompt, changeDescription, changeType } = req.body || {};

  if (!agentId || !stageId) {
    throw new AppError("agentId e stageId são obrigatórios", 400);
  }

  if (!systemPrompt || typeof systemPrompt !== "string") {
    throw new AppError("systemPrompt é obrigatório", 400);
  }

  const agent = await AIAgent.findOne({ where: { id: Number(agentId), companyId } });
  if (!agent) throw new AppError("ERR_AGENT_NOT_FOUND", 404);

  const stage = await FunnelStage.findOne({ where: { id: Number(stageId), agentId: agent.id } });
  if (!stage) throw new AppError("ERR_FUNNEL_STAGE_NOT_FOUND", 404);

  const lastVersion = await AIPromptVersion.findOne({
    where: { companyId, agentId: agent.id, stageId: stage.id },
    order: [["version", "DESC"]]
  });

  const newVersionNumber = lastVersion ? lastVersion.version + 1 : 1;

  await AIPromptVersion.update(
    { isActive: false },
    { where: { companyId, agentId: agent.id, stageId: stage.id } }
  );

  const version = await AIPromptVersion.create({
    companyId,
    userId: Number(userId),
    agentId: agent.id,
    stageId: stage.id,
    version: newVersionNumber,
    systemPrompt: String(systemPrompt).trim(),
    changeDescription: changeDescription ? String(changeDescription).trim() : null,
    changeType: changeType || "manual",
    isActive: true,
    testScore: null
  });

  return res.status(201).json({ version });
};

export const listVersions = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { agentId, stageId, limit } = req.query;

  if (!agentId || !stageId) {
    throw new AppError("agentId e stageId são obrigatórios", 400);
  }

  const versions = await AIPromptVersion.findAll({
    where: {
      companyId,
      agentId: Number(agentId),
      stageId: Number(stageId)
    },
    order: [["version", "DESC"]],
    limit: limit ? Number(limit) : 50
  });

  return res.status(200).json({ versions });
};

export const getVersion = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { versionId } = req.params;

  const version = await AIPromptVersion.findOne({
    where: { id: Number(versionId), companyId }
  });

  if (!version) throw new AppError("ERR_VERSION_NOT_FOUND", 404);

  return res.status(200).json({ version });
};

export const rollbackToVersion = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const { versionId } = req.params;

  const targetVersion = await AIPromptVersion.findOne({
    where: { id: Number(versionId), companyId }
  });

  if (!targetVersion) throw new AppError("ERR_VERSION_NOT_FOUND", 404);

  const agent = await AIAgent.findOne({ where: { id: targetVersion.agentId, companyId } });
  if (!agent) throw new AppError("ERR_AGENT_NOT_FOUND", 404);

  const stage = await FunnelStage.findOne({ where: { id: targetVersion.stageId, agentId: agent.id } });
  if (!stage) throw new AppError("ERR_FUNNEL_STAGE_NOT_FOUND", 404);

  await stage.update({ systemPrompt: targetVersion.systemPrompt });

  const lastVersion = await AIPromptVersion.findOne({
    where: { companyId, agentId: agent.id, stageId: stage.id },
    order: [["version", "DESC"]]
  });

  const newVersionNumber = lastVersion ? lastVersion.version + 1 : 1;

  await AIPromptVersion.update(
    { isActive: false },
    { where: { companyId, agentId: agent.id, stageId: stage.id } }
  );

  const newVersion = await AIPromptVersion.create({
    companyId,
    userId: Number(userId),
    agentId: agent.id,
    stageId: stage.id,
    version: newVersionNumber,
    systemPrompt: targetVersion.systemPrompt,
    changeDescription: `Rollback para versão ${targetVersion.version}`,
    changeType: "rollback",
    isActive: true,
    testScore: targetVersion.testScore
  });

  return res.status(200).json({
    ok: true,
    message: `Rollback para versão ${targetVersion.version} realizado`,
    newVersion,
    appliedPrompt: targetVersion.systemPrompt
  });
};

export const compareVersions = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { versionIdA, versionIdB } = req.query;

  if (!versionIdA || !versionIdB) {
    throw new AppError("versionIdA e versionIdB são obrigatórios", 400);
  }

  const versionA = await AIPromptVersion.findOne({
    where: { id: Number(versionIdA), companyId }
  });

  const versionB = await AIPromptVersion.findOne({
    where: { id: Number(versionIdB), companyId }
  });

  if (!versionA || !versionB) {
    throw new AppError("ERR_VERSION_NOT_FOUND", 404);
  }

  const diff = generateDiff(versionA.systemPrompt, versionB.systemPrompt);

  return res.status(200).json({
    versionA: {
      id: versionA.id,
      version: versionA.version,
      systemPrompt: versionA.systemPrompt,
      changeDescription: versionA.changeDescription,
      createdAt: versionA.createdAt
    },
    versionB: {
      id: versionB.id,
      version: versionB.version,
      systemPrompt: versionB.systemPrompt,
      changeDescription: versionB.changeDescription,
      createdAt: versionB.createdAt
    },
    diff
  });
};

function generateDiff(textA: string, textB: string): Array<{ type: string; content: string }> {
  const linesA = String(textA || "").split("\n");
  const linesB = String(textB || "").split("\n");
  const diff: Array<{ type: string; content: string }> = [];

  const maxLines = Math.max(linesA.length, linesB.length);

  for (let i = 0; i < maxLines; i++) {
    const lineA = linesA[i];
    const lineB = linesB[i];

    if (lineA === undefined && lineB !== undefined) {
      diff.push({ type: "added", content: lineB });
    } else if (lineA !== undefined && lineB === undefined) {
      diff.push({ type: "removed", content: lineA });
    } else if (lineA !== lineB) {
      diff.push({ type: "removed", content: lineA });
      diff.push({ type: "added", content: lineB });
    } else {
      diff.push({ type: "unchanged", content: lineA });
    }
  }

  return diff;
}
