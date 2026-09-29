import { Request, Response } from "express";
import CustomFieldConfig from "../models/CustomFieldConfig";

// Somente "lead" possui storage/consumo implementado (ContactCustomField + form de contato).
const VALID_ENTITY_TYPES = ["lead"];
const VALID_TYPES = ["text", "number", "date", "boolean", "select"];
const KEY_REGEX = /^[a-z0-9_]{1,100}$/;

type ValidatedPayload = {
  entityType: string;
  key: string;
  label: string;
  type: string;
  options: string[] | null;
  required: boolean;
  position: number;
};

const validatePayload = (body: any): ValidatedPayload | string => {
  const { entityType, key, label, type, options, required, position } = body || {};

  if (!VALID_ENTITY_TYPES.includes(entityType)) {
    return "entityType inválido";
  }
  if (typeof key !== "string" || !KEY_REGEX.test(key)) {
    return "Chave inválida: use snake_case (a-z, 0-9, _)";
  }
  if (typeof label !== "string" || !label.trim()) {
    return "Rótulo é obrigatório";
  }
  const safeType = VALID_TYPES.includes(type) ? type : "text";
  let safeOptions: string[] | null = null;
  if (safeType === "select") {
    safeOptions = Array.isArray(options) ? options.map(String).filter(Boolean) : [];
    if (!safeOptions.length) {
      return "Campo do tipo Seleção exige ao menos uma opção";
    }
  }
  return {
    entityType,
    key,
    label: label.trim(),
    type: safeType,
    options: safeOptions,
    required: !!required,
    position: Number.isInteger(position) ? position : 0
  };
};

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
    const parsed = validatePayload(req.body);
    if (typeof parsed === "string") {
      return res.status(400).json({ error: parsed });
    }
    const config = await CustomFieldConfig.create({ companyId, ...parsed } as any);
    return res.status(201).json(config);
  } catch (err: any) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ error: "Já existe um campo com essa chave" });
    }
    return res.status(500).json({ error: err.message || "Erro ao criar campo" });
  }
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const config = await CustomFieldConfig.findOne({ where: { id: req.params.id, companyId } });
    if (!config) return res.status(404).json({ error: "Não encontrado" });

    // key/entityType/companyId são imutáveis — alterar a key órfã os valores salvos
    if (req.body.key !== undefined && req.body.key !== config.key) {
      return res.status(400).json({ error: "A chave não pode ser alterada" });
    }
    if (req.body.entityType !== undefined && req.body.entityType !== config.entityType) {
      return res.status(400).json({ error: "A entidade não pode ser alterada" });
    }

    const parsed = validatePayload({
      entityType: config.entityType,
      key: config.key,
      ...req.body
    });
    if (typeof parsed === "string") {
      return res.status(400).json({ error: parsed });
    }

    const { entityType, key, ...updatable } = parsed;
    await config.update(updatable);
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
    // valores já salvos em ContactCustomField são preservados (viram entradas legadas)
    await config.destroy();
    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao remover campo" });
  }
};
