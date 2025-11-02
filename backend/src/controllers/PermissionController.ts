import { Request, Response } from "express";
import { getPermissionsCatalog, getAllAvailablePermissions } from "../helpers/PermissionAdapter";

/**
 * Retorna o catálogo completo de permissões organizadas por categoria
 * Usado no frontend para exibir no dual-list
 */
export const index = async (req: Request, res: Response): Promise<Response> => {
  const catalog = getPermissionsCatalog();
  return res.status(200).json(catalog);
};

/**
 * Retorna lista flat de todas as permissões disponíveis
 */
export const list = async (req: Request, res: Response): Promise<Response> => {
  const permissions = getAllAvailablePermissions();
  return res.status(200).json(permissions);
};
