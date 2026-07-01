import { Request, Response } from "express";
import Deal from "../models/Deal";
import DealStage from "../models/DealStage";
import Contact from "../models/Contact";
import User from "../models/User";
import { Op } from "sequelize";

// ── DealStages ──────────────────────────────────────────────────────────────

export const listStages = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const stages = await DealStage.findAll({ where: { companyId }, order: [["position", "ASC"]] });
  return res.json(stages);
};

export const createStage = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { name, color, position } = req.body;
  const stage = await DealStage.create({ companyId, name, color: color || "#5C5C5C", position: position ?? 0 } as any);
  return res.status(201).json(stage);
};

export const updateStage = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const stage = await DealStage.findOne({ where: { id: req.params.id, companyId } });
  if (!stage) return res.status(404).json({ error: "Estágio não encontrado" });
  await stage.update(req.body);
  return res.json(stage);
};

export const deleteStage = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const stage = await DealStage.findOne({ where: { id: req.params.id, companyId } });
  if (!stage) return res.status(404).json({ error: "Estágio não encontrado" });
  await stage.destroy();
  return res.status(204).send();
};

// ── Deals ────────────────────────────────────────────────────────────────────

export const listDeals = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { stageId, status } = req.query as any;
  const where: any = { companyId };
  if (stageId) where.stageId = Number(stageId);
  if (status) where.status = String(status);

  const deals = await Deal.findAll({
    where,
    include: [
      { model: Contact, attributes: ["id", "name", "number", "profilePicUrl"] },
      { model: User, attributes: ["id", "name"] },
      { model: DealStage, attributes: ["id", "name", "color"] }
    ],
    order: [["createdAt", "DESC"]]
  });
  return res.json(deals);
};

export const createDeal = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { stageId, contactId, userId, title, value, description } = req.body;
  const deal = await Deal.create({ companyId, stageId, contactId, userId, title, value: value || 0, description, status: "open" } as any);
  const full = await Deal.findByPk(deal.id, { include: [Contact, User, DealStage] });
  return res.status(201).json(full);
};

export const updateDeal = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const deal = await Deal.findOne({ where: { id: req.params.id, companyId } });
  if (!deal) return res.status(404).json({ error: "Negócio não encontrado" });
  await deal.update(req.body);
  const full = await Deal.findByPk(deal.id, { include: [Contact, User, DealStage] });
  return res.json(full);
};

export const deleteDeal = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const deal = await Deal.findOne({ where: { id: req.params.id, companyId } });
  if (!deal) return res.status(404).json({ error: "Negócio não encontrado" });
  await deal.destroy();
  return res.status(204).send();
};

// Returns all stages with their deals (for Kanban)
export const kanban = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const stages = await DealStage.findAll({ where: { companyId }, order: [["position", "ASC"]] });
  const deals = await Deal.findAll({
    where: { companyId, status: "open" },
    include: [
      { model: Contact, attributes: ["id", "name", "number", "profilePicUrl"] },
      { model: User, attributes: ["id", "name"] }
    ],
    order: [["createdAt", "DESC"]]
  });

  const dealsByStage = stages.map(s => ({
    ...s.toJSON(),
    deals: deals.filter(d => d.stageId === s.id)
  }));

  return res.json({ stages: dealsByStage, total: deals.length });
};
