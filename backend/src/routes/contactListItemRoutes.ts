import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as ContactListItemController from "../controllers/ContactListItemController";

const routes = express.Router();

routes.get(
  "/contact-list-items/list",
  isAuth,
  checkPermission("contact-lists.view"),
  ContactListItemController.findList
);

routes.get("/contact-list-items", isAuth, checkPermission("contact-lists.view"), ContactListItemController.index);

routes.get("/contact-list-items/:id", isAuth, checkPermission("contact-lists.view"), ContactListItemController.show);

routes.post("/contact-list-items", isAuth, checkPermission("contact-lists.edit"), ContactListItemController.store);

routes.put("/contact-list-items/:id", isAuth, checkPermission("contact-lists.edit"), ContactListItemController.update);

routes.delete(
  "/contact-list-items/:id",
  isAuth,
  checkPermission("contact-lists.edit"),
  ContactListItemController.remove
);

routes.post(
  "/contact-list-items/:contactListId/add-filtered-contacts",
  isAuth,
  checkPermission("contact-lists.edit"),
  ContactListItemController.addFilteredContacts
);

routes.post(
  "/contact-list-items/:contactListId/add-manual-contacts",
  isAuth,
  checkPermission("contact-lists.edit"),
  ContactListItemController.addManualContacts
);

export default routes;
