import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import AppError from "../errors/AppError";

import CreateService from "../services/TagServices/CreateService";
import ListService from "../services/TagServices/ListService";
import UpdateService from "../services/TagServices/UpdateService";
import ShowService from "../services/TagServices/ShowService";
import DeleteService from "../services/TagServices/DeleteService";
import SimpleListService from "../services/TagServices/SimpleListService";
import SyncTagService from "../services/TagServices/SyncTagsService";
import Tag from "../models/Tag";
import KanbanListService from "../services/TagServices/KanbanListService";
import ContactTag from "../models/ContactTag";
import ListAllTagsService from "../services/TagServices/ListAllTagsService";
import SyncContactWalletsAndPersonalTagsService from "../services/ContactServices/SyncContactWalletsAndPersonalTagsService";

type IndexQuery = {
  searchParam?: string;
  pageNumber?: string | number;
  kanban?: number;
  tagId?: number;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { pageNumber, searchParam, kanban, tagId } = req.query as IndexQuery;
  const { companyId, profile } = req.user;

  const { tags, count, hasMore } = await ListService({
    searchParam,
    pageNumber,
    companyId,
    kanban,
    tagId,
    profile
  });

  return res.json({ tags, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, color, kanban,
    timeLane,
    nextLaneId,
    greetingMessageLane,
    rollbackLaneId } = req.body;
  const { companyId, profile } = req.user;

  // Usuários não-admin só podem criar tags transacionais (sem #)
  if (profile !== "admin") {
    if (name && name.startsWith("#")) {
      throw new AppError("Usuários não-admin só podem criar tags transacionais (sem #)", 403);
    }
  }

  const tag = await CreateService({
    name,
    color,
    kanban,
    companyId,
    timeLane,
    nextLaneId,
    greetingMessageLane,
    rollbackLaneId
  });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company${companyId}-tag`, {
      action: "create",
      tag
    });

  return res.status(200).json(tag);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { tagId } = req.params;

  const tag = await ShowService(tagId);

  return res.status(200).json(tag);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tagId } = req.params;
  const tagData = req.body;
  const { companyId, profile } = req.user;

  // Usuários não-admin só podem editar tags transacionais (sem #)
  if (profile !== "admin") {
    // Busca a tag atual
    const currentTag = await ShowService(tagId);
    
    // Não pode editar tag de permissão (#)
    if (currentTag.name && currentTag.name.startsWith("#")) {
      throw new AppError("Usuários não-admin não podem editar tags de permissão (#)", 403);
    }
    
    // Não pode renomear para tag de permissão (#)
    if (tagData.name && tagData.name.startsWith("#")) {
      throw new AppError("Usuários não-admin só podem criar/editar tags transacionais (sem #)", 403);
    }
  }

  const tag = await UpdateService({ tagData, id: tagId });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company${companyId}-tag`, {
      action: "update",
      tag
    });

  return res.status(200).json(tag);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tagId } = req.params;
  const { companyId, profile } = req.user;

  // Usuários não-admin só podem deletar tags transacionais (sem #)
  if (profile !== "admin") {
    const currentTag = await ShowService(tagId);
    
    if (currentTag.name && currentTag.name.startsWith("#")) {
      throw new AppError("Usuários não-admin não podem deletar tags de permissão (#)", 403);
    }
  }

  await DeleteService(tagId);

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company${companyId}-tag`, {
      action: "delete",
      tagId
    });

  return res.status(200).json({ message: "Tag deleted" });
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, kanban } = req.query as IndexQuery;
  const { companyId } = req.user;

  const tags = await SimpleListService({ searchParam, kanban, companyId });

  return res.json(tags);
};

export const kanban = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;

  const tags = await KanbanListService({ companyId });

  return res.json({ lista: tags });
};

export const syncTags = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const data = req.body as any;
  const { companyId } = req.user;

  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  // Normaliza a entrada de tags para aceitar:
  // - string ("CLIENTES")
  // - array de strings (["CLIENTES", "VIP"])
  // - array de objetos com id ou name ([{ id: 1, name: "CLIENTES" }])
  const normalizeToExistingTags = async (): Promise<Array<{ id: number }>> => {
    let incoming = data?.tags;
    if (incoming === undefined || incoming === null) return [];

    // Se vier como string única
    if (typeof incoming === "string") {
      incoming = [incoming];
    }

    // Se vier como lista separada por vírgulas
    if (Array.isArray(incoming) === false && typeof incoming === "object" && (incoming as any).toString) {
      // mantém como está
    }

    const result: Array<{ id: number }> = [];

    if (Array.isArray(incoming)) {
      // Strings ou objetos
      const names: string[] = [];
      const ids: number[] = [];
      for (const t of incoming) {
        if (t && typeof t === "object") {
          if (typeof (t as any).id === "number") ids.push((t as any).id);
          else if (typeof (t as any).name === "string") names.push((t as any).name);
        } else if (typeof t === "string") {
          // separa por vírgula se necessário
          const parts = t.split(',').map(s => s.trim()).filter(Boolean);
          names.push(...parts);
        } else if (typeof t === "number") {
          ids.push(t);
        }
      }

      // Busca por ids válidos dessa empresa
      if (ids.length) {
        const foundById = await Tag.findAll({ where: { id: ids, companyId } });
        result.push(...foundById.map(t => ({ id: t.id })));
      }

      // Busca por nome (case-insensitive) nessa empresa
      if (names.length) {
        const uniqueNames = Array.from(new Set(names.map(n => n.trim()).filter(Boolean)));
        if (uniqueNames.length) {
          const foundByName = await Tag.findAll({
            where: { companyId },
          });
          const mapByLower = new Map(foundByName.map(t => [String(t.name).toLowerCase(), t]));
          for (const nm of uniqueNames) {
            const match = mapByLower.get(nm.toLowerCase());
            if (match) result.push({ id: match.id });
          }
        }
      }
    }

    // Remove duplicados
    const uniq = Array.from(new Set(result.map(r => r.id))).map(id => ({ id }));
    return uniq;
  };

  const existingTags = await normalizeToExistingTags();
  const payload = existingTags.length ? { ...data, tags: existingTags } : { ...data, tags: [] };

  const tags = await SyncTagService({ ...payload, companyId });

  return res.json(tags);
};

export const removeContactTag = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { tagId, contactId } = req.params;
  const { companyId } = req.user;

  console.log(tagId, contactId)

  await ContactTag.destroy({
    where: {
      tagId,
      contactId
    }
  });

  const tag = await ShowService(tagId);

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company${companyId}-tag`, {
      action: "update",
      tag
    });

  try {
    await SyncContactWalletsAndPersonalTagsService({
      companyId,
      contactId,
      source: "tags"
    });
  } catch (err) {
    console.warn("[TagController.removeContactTag] Falha ao sincronizar carteiras e tags pessoais", err);
  }

  return res.status(200).json({ message: "Tag deleted" });
};

/**
 * Autocomplete de tags para arquivos e pastas
 * Retorna tags já usadas na empresa para sugestão
 */
export const autocomplete = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { search, limit } = req.query;

  const tags = await ListAllTagsService({
    companyId,
    search: search as string,
    limit: limit ? Number(limit) : 50
  });

  return res.json(tags);
};