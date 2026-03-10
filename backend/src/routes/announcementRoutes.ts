import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as AnnouncementController from "../controllers/AnnouncementController";
import multer from "multer";
import uploadConfig from "../config/upload";

const upload = multer(uploadConfig);

const routes = express.Router();

routes.get("/announcements/list", isAuth, checkPermission("announcements.view"), AnnouncementController.findList);
routes.get("/announcements", isAuth, checkPermission("announcements.view"), AnnouncementController.index);
routes.get("/announcements/:id", isAuth, checkPermission("announcements.view"), AnnouncementController.show);
routes.post("/announcements", isAuth, checkPermission("announcements.create"), AnnouncementController.store);
routes.put("/announcements/:id", isAuth, checkPermission("announcements.edit"), upload.array("file"), AnnouncementController.update);
routes.delete("/announcements/:id", isAuth, checkPermission("announcements.delete"), AnnouncementController.remove);
routes.post("/announcements/:id/media-upload", isAuth, checkPermission("announcements.edit"), upload.array("file"), AnnouncementController.mediaUpload);
routes.delete("/announcements/:id/media-upload", isAuth, checkPermission("announcements.edit"), AnnouncementController.deleteMedia);

export default routes;
