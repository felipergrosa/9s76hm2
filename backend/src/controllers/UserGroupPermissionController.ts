import { Request, Response } from "express";
import ListAvailableGroupsService from "../services/UserGroupPermissionServices/ListAvailableGroupsService";
import ListUserGroupPermissionsService from "../services/UserGroupPermissionServices/ListUserGroupPermissionsService";
import UpdateUserGroupPermissionsService from "../services/UserGroupPermissionServices/UpdateUserGroupPermissionsService";
import AppError from "../errors/AppError";

/**
 * Lista todos os grupos disponíveis na empresa, agrupados por conexão.
 * GET /group-permissions/available
 */
export const listAvailableGroups = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;

  const groups = await ListAvailableGroupsService(companyId);

  return res.status(200).json(groups);
};

/**
 * Lista os contactIds dos grupos permitidos para um usuário.
 * GET /group-permissions/user/:userId
 */
export const listUserPermissions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;
  const { companyId } = req.user;

  const contactIds = await ListUserGroupPermissionsService(
    Number(userId),
    companyId
  );

  return res.status(200).json(contactIds);
};

/**
 * Atualiza as permissões de grupo de um usuário.
 * PUT /group-permissions/user/:userId
 * Body: { contactIds: number[] }
 */
export const updateUserPermissions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;
  const { contactIds } = req.body;
  const { companyId } = req.user;

  if (!Array.isArray(contactIds)) {
    throw new AppError("ERR_INVALID_PARAMS", 400);
  }

  const result = await UpdateUserGroupPermissionsService(
    Number(userId),
    companyId,
    contactIds
  );

  return res.status(200).json(result);
};
