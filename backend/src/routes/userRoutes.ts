import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission, checkAdminOrSuper } from "../middleware/checkPermission";
import * as UserController from "../controllers/UserController";
import { upload } from "../controllers/UserController";

const userRoutes = express.Router();

// Rotas públicas de listagem
userRoutes.get("/users", isAuth, UserController.index);
userRoutes.get("/users/list", isAuth, UserController.list);

// Rotas que precisam de permissão específica
userRoutes.post("/users", isAuth, checkPermission("users.create"), UserController.store);
userRoutes.put("/users/:userId", isAuth, UserController.update); // Validação no controller permite editar próprio perfil
userRoutes.get("/users/:userId", isAuth, UserController.show);
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
