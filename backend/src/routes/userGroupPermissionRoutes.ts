import express from "express";
import isAuth from "../middleware/isAuth";
import * as UserGroupPermissionController from "../controllers/UserGroupPermissionController";

const userGroupPermissionRoutes = express.Router();

// Lista todos os grupos disponíveis na empresa (agrupados por conexão)
userGroupPermissionRoutes.get(
  "/group-permissions/available",
  isAuth,
  UserGroupPermissionController.listAvailableGroups
);

// Lista permissões de grupo de um usuário específico
userGroupPermissionRoutes.get(
  "/group-permissions/user/:userId",
  isAuth,
  UserGroupPermissionController.listUserPermissions
);

// Atualiza permissões de grupo de um usuário
userGroupPermissionRoutes.put(
  "/group-permissions/user/:userId",
  isAuth,
  UserGroupPermissionController.updateUserPermissions
);

export default userGroupPermissionRoutes;
