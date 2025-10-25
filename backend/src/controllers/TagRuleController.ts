import { Request, Response } from "express";
import TagRule from "../models/TagRule";
import Tag from "../models/Tag";
import ApplyTagRulesService from "../services/TagServices/ApplyTagRulesService";
import PreviewTagRulesService from "../services/TagServices/PreviewTagRulesService";
import GetFieldValuesService from "../services/TagServices/GetFieldValuesService";

// Lista regras de uma tag
export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { tagId } = req.params;

  const rules = await TagRule.findAll({
    where: { companyId, tagId },
    include: [{ model: Tag, as: "tag", attributes: ["id", "name", "color"] }],
    order: [["id", "ASC"]]
  });

  return res.json(rules);
};

// Cria nova regra
export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { tagId, field, operator, value, active } = req.body;

  const rule = await TagRule.create({
    tagId,
    companyId,
    field,
    operator: operator || "equals",
    value,
    active: active !== undefined ? active : true
  });

  await rule.reload({ include: [{ model: Tag, as: "tag" }] });

  return res.status(201).json(rule);
};

// Atualiza regra
export const update = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { ruleId } = req.params;
  const { field, operator, value, active } = req.body;

  const rule = await TagRule.findOne({
    where: { id: ruleId, companyId }
  });

  if (!rule) {
    return res.status(404).json({ error: "Regra não encontrada" });
  }

  await rule.update({
    field: field || rule.field,
    operator: operator || rule.operator,
    value: value !== undefined ? value : rule.value,
    active: active !== undefined ? active : rule.active
  });

  await rule.reload({ include: [{ model: Tag, as: "tag" }] });

  return res.json(rule);
};

// Remove regra
export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { ruleId } = req.params;

  const rule = await TagRule.findOne({
    where: { id: ruleId, companyId }
  });

  if (!rule) {
    return res.status(404).json({ error: "Regra não encontrada" });
  }

  await rule.destroy();

  return res.json({ message: "Regra removida com sucesso" });
};

// Preview de contatos que serão afetados
export const preview = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { tagId } = req.params;

  const result = await PreviewTagRulesService({
    companyId,
    tagId: Number(tagId)
  });

  return res.json(result);
};

// Busca valores únicos de um campo
export const getFieldValues = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { field } = req.params;

  const { values } = await GetFieldValuesService({
    companyId,
    field
  });

  return res.json({ values });
};

// Aplica regras manualmente
export const apply = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { tagId } = req.params;
  const { contactId } = req.body;

  try {
    const results = await ApplyTagRulesService({
      companyId,
      tagId: tagId ? Number(tagId) : undefined,
      contactId: contactId ? Number(contactId) : undefined
    });

    return res.json({
      message: "Regras aplicadas com sucesso",
      results
    });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao aplicar regras" });
  }
};
