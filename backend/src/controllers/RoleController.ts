import { Request, Response } from "express";
import ListService from "../services/RoleService/ListService";
import ShowService from "../services/RoleService/ShowService";
import CreateService from "../services/RoleService/CreateService";
import UpdateService from "../services/RoleService/UpdateService";
import DeleteService from "../services/RoleService/DeleteService";
import SetUserRolesService from "../services/RoleService/SetUserRolesService";
import ListUserRolesService from "../services/RoleService/ListUserRolesService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { searchParam } = req.query as { searchParam?: string };

  const roles = await ListService({ companyId, searchParam });

  return res.status(200).json(roles);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  const role = await ShowService(id, companyId);

  return res.status(200).json(role);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { name, description, permissions } = req.body;

  const role = await CreateService({ name, description, permissions, companyId });

  return res.status(200).json(role);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;
  const { name, description, permissions } = req.body;

  const role = await UpdateService({ id, companyId, name, description, permissions });

  return res.status(200).json(role);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { id } = req.params;

  await DeleteService(id, companyId);

  return res.status(200).json({ message: "ROLE_DELETED" });
};

export const showUserRoles = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { userId } = req.params;

  const roles = await ListUserRolesService(userId, companyId);

  return res.status(200).json(roles);
};

export const setUserRoles = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { userId } = req.params;
  const { roleIds } = req.body;

  const userRoles = await SetUserRolesService({ userId, companyId, roleIds });

  return res.status(200).json(userRoles);
};
