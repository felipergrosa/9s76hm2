import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as QuickMessageController from "../controllers/QuickMessageController";
import multer from "multer";
import uploadConfig from "../config/upload";

const upload = multer(uploadConfig);

const routes = express.Router();

routes.get("/quick-messages/list", isAuth, checkPermission("quick-messages.view"), QuickMessageController.findList);

routes.get("/quick-messages", isAuth, checkPermission("quick-messages.view"), QuickMessageController.index);

routes.get("/quick-messages/:id", isAuth, checkPermission("quick-messages.view"), QuickMessageController.show);

routes.post("/quick-messages", isAuth, checkPermission("quick-messages.create"), QuickMessageController.store);

routes.put("/quick-messages/:id", isAuth, checkPermission("quick-messages.edit"), QuickMessageController.update);

routes.delete("/quick-messages/:id", isAuth, checkPermission("quick-messages.delete"), QuickMessageController.remove);

routes.post(
    "/quick-messages/:id/media-upload",
    isAuth,
    checkPermission("quick-messages.edit"),
    upload.array("file"),
    QuickMessageController.mediaUpload
  );
  
  routes.delete(
    "/quick-messages/:id/media-upload",
    isAuth,
    checkPermission("quick-messages.edit"),
    QuickMessageController.deleteMedia
  );
  
export default routes;
