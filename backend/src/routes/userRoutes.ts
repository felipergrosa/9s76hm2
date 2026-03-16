import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission, checkAdminOrSuper } from "../middleware/checkPermission";
import * as UserController from "../controllers/UserController";
import { upload } from "../controllers/UserController";

const userRoutes = express.Router();

// Endpoint público para seleção de usuários em contextos operacionais (SEM permissão)
userRoutes.get("/users/available", isAuth, UserController.listAvailable);

// Rotas públicas de listagem (COM permissão)
userRoutes.get("/users", isAuth, checkPermission("users.view"), UserController.index);
userRoutes.get("/users/list", isAuth, checkPermission("users.view"), UserController.list);

// Rotas que precisam de permissão específica
userRoutes.post("/users", isAuth, checkPermission("users.create"), UserController.store);
userRoutes.put("/users/:userId", isAuth, UserController.update); // Validação no controller permite editar próprio perfil
userRoutes.get("/users/:userId", isAuth, UserController.show); // Validação no controller permite ver próprio perfil
userRoutes.delete("/users/:userId", isAuth, checkPermission("users.delete"), UserController.remove);
userRoutes.post(
  "/users/:userId/media-upload",
  isAuth,
  upload.array("profileImage"),
  UserController.mediaUpload
);
userRoutes.put(
  "/users/toggleChangeWidht/:userId",
  isAuth,
  checkPermission("users.edit"),
  UserController.toggleChangeWidht
);
userRoutes.put(
  "/users/:userId/language",
  isAuth,
  UserController.updateLanguage
);
userRoutes.get(
  "/settings/userCreation",
  UserController.getUserCreationStatus
);

// ✅ Avatar
userRoutes.post(
  "/users/:userId/avatar",
  isAuth,
  upload.single("file"),
  UserController.uploadAvatar
);

export default userRoutes;
