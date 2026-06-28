import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as RoleController from "../controllers/RoleController";

const roleRoutes = express.Router();

roleRoutes.get("/roles", isAuth, checkPermission("roles.view"), RoleController.index);
roleRoutes.get("/roles/:id", isAuth, checkPermission("roles.view"), RoleController.show);
roleRoutes.post("/roles", isAuth, checkPermission("roles.create"), RoleController.store);
roleRoutes.put("/roles/:id", isAuth, checkPermission("roles.edit"), RoleController.update);
roleRoutes.delete("/roles/:id", isAuth, checkPermission("roles.delete"), RoleController.remove);

roleRoutes.get("/users/:userId/roles", isAuth, checkPermission("roles.view"), RoleController.showUserRoles);
roleRoutes.put("/users/:userId/roles", isAuth, checkPermission("roles.edit"), RoleController.setUserRoles);

export default roleRoutes;
