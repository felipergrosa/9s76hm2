import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as PermissionController from "../controllers/PermissionController";

const permissionRoutes = express.Router();

// Catálogo expõe a superfície de autorização — restringe a quem pode ver roles
permissionRoutes.get("/permissions/catalog", isAuth, checkPermission("roles.view"), PermissionController.index);
permissionRoutes.get("/permissions/list", isAuth, checkPermission("roles.view"), PermissionController.list);

export default permissionRoutes;
