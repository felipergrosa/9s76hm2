import express from "express";
import isAuth from "../middleware/isAuth";

import * as ContactListItemController from "../controllers/ContactListItemController";

const routes = express.Router();

routes.get(
  "/contact-list-items/list",
  isAuth,
  ContactListItemController.findList
);

routes.get("/contact-list-items", isAuth, ContactListItemController.index);

routes.get("/contact-list-items/:id", isAuth, ContactListItemController.show);

routes.post("/contact-list-items", isAuth, ContactListItemController.store);

routes.put("/contact-list-items/:id", isAuth, ContactListItemController.update);

routes.delete(
  "/contact-list-items/:id",
  isAuth,
  ContactListItemController.remove
);

routes.post(
  "/contact-list-items/:contactListId/add-filtered-contacts",
  isAuth,
  ContactListItemController.addFilteredContacts
);

routes.post(
  "/contact-list-items/:contactListId/add-manual-contacts",
  isAuth,
  ContactListItemController.addManualContacts
);

export default routes;
