import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import uploadConfig from "../config/upload";

import * as ContactListController from "../controllers/ContactListController";
import multer from "multer";

const routes = express.Router();

const upload = multer(uploadConfig);

routes.get("/contact-lists/list", isAuth, checkPermission("contact-lists.view"), ContactListController.findList);
routes.get("/contact-lists", isAuth, checkPermission("contact-lists.view"), ContactListController.index);
routes.get("/contact-lists/:id", isAuth, checkPermission("contact-lists.view"), ContactListController.show);
routes.post("/contact-lists", isAuth, checkPermission("contact-lists.create"), ContactListController.store);
routes.post("/contact-lists/:id/upload", isAuth, checkPermission("contact-lists.edit"), upload.array("file"), ContactListController.upload);
routes.post("/contact-lists/:id/sync", isAuth, checkPermission("contact-lists.edit"), ContactListController.syncNow);
routes.put("/contact-lists/:id", isAuth, checkPermission("contact-lists.edit"), ContactListController.update);
routes.delete("/contact-lists/:id", isAuth, checkPermission("contact-lists.delete"), ContactListController.remove);
routes.delete(
  "/contact-lists/:id/items",
  isAuth,
  checkPermission("contact-lists.edit"),
  ContactListController.clearItems
);

// Rotas de validação de números WhatsApp
routes.post(
  "/contact-lists/:id/validate",
  isAuth,
  checkPermission("contact-lists.edit"),
  ContactListController.validateNumbers
);

routes.get(
  "/contact-lists/:id/validation-stats",
  isAuth,
  checkPermission("contact-lists.view"),
  ContactListController.validationStats
);

// Rota para corrigir vínculos de contatos não vinculados
routes.post(
  "/contact-lists/:id/fix-links",
  isAuth,
  checkPermission("contact-lists.edit"),
  ContactListController.fixLinks
);


export default routes;
