import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as UserGroupPermissionController from "../controllers/UserGroupPermissionController";

const userGroupPermissionRoutes = express.Router();

// Lista todos os grupos disponíveis na empresa (agrupados por conexão)
userGroupPermissionRoutes.get(
  "/group-permissions/available",
  isAuth,
  checkPermission("users.view"),
  UserGroupPermissionController.listAvailableGroups
);

// Lista permissões de grupo de um usuário específico
userGroupPermissionRoutes.get(
  "/group-permissions/user/:userId",
  isAuth,
  checkPermission("users.view"),
  UserGroupPermissionController.listUserPermissions
);

// Atualiza permissões de grupo de um usuário
userGroupPermissionRoutes.put(
  "/group-permissions/user/:userId",
  isAuth,
  checkPermission("users.edit"),
  UserGroupPermissionController.updateUserPermissions
);

export default userGroupPermissionRoutes;
