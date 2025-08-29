import express from "express";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";

import * as ContactListController from "../controllers/ContactListController";
import multer from "multer";

const routes = express.Router();

const upload = multer(uploadConfig);

routes.get("/contact-lists/list", isAuth, ContactListController.findList);
routes.get("/contact-lists", isAuth, ContactListController.index);
routes.get("/contact-lists/:id", isAuth, ContactListController.show);
routes.post("/contact-lists", isAuth, ContactListController.store);
routes.post("/contact-lists/:id/upload",isAuth,upload.array("file"),ContactListController.upload);
routes.post("/contact-lists/:id/sync", isAuth, ContactListController.syncNow);
routes.put("/contact-lists/:id", isAuth, ContactListController.update);
routes.delete("/contact-lists/:id", isAuth, ContactListController.remove);
routes.delete(
  "/contact-lists/:id/items",
  isAuth,
  ContactListController.clearItems
);

export default routes;
