import express from "express";
import isAuth from "../middleware/isAuth";
import * as PermissionController from "../controllers/PermissionController";

const permissionRoutes = express.Router();

// Rotas disponíveis apenas para admin (para configurar permissões de usuários)
permissionRoutes.get("/permissions/catalog", isAuth, PermissionController.index);
permissionRoutes.get("/permissions/list", isAuth, PermissionController.list);

export default permissionRoutes;
