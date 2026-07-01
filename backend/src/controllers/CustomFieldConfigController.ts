import { Request, Response } from "express";
import CustomFieldConfig from "../models/CustomFieldConfig";

export const list = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const { entityType } = req.query as any;
    const where: any = { companyId };
    if (entityType) where.entityType = entityType;
    const configs = await CustomFieldConfig.findAll({ where, order: [["entityType", "ASC"], ["position", "ASC"]] });
    return res.json(configs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao listar campos" });
  }
};

export const create = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const { entityType, key, label, type, options, required, position } = req.body;
    const config = await CustomFieldConfig.create({ companyId, entityType, key, label, type: type || "text", options, required: !!required, position: position || 0 } as any);
    return res.status(201).json(config);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao criar campo" });
  }
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const config = await CustomFieldConfig.findOne({ where: { id: req.params.id, companyId } });
    if (!config) return res.status(404).json({ error: "Não encontrado" });
    await config.update(req.body);
    return res.json(config);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao atualizar campo" });
  }
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const config = await CustomFieldConfig.findOne({ where: { id: req.params.id, companyId } });
    if (!config) return res.status(404).json({ error: "Não encontrado" });
    await config.destroy();
    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao remover campo" });
  }
};
