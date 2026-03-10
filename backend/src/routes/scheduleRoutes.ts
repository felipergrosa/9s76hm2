import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as ScheduleController from "../controllers/ScheduleController";
import multer from "multer";
import uploadConfig from "../config/upload";

const upload = multer(uploadConfig);

const scheduleRoutes = express.Router();

scheduleRoutes.get("/schedules", isAuth, checkPermission("schedules.view"), ScheduleController.index);

scheduleRoutes.post("/schedules", isAuth, checkPermission("schedules.create"), ScheduleController.store);

scheduleRoutes.put("/schedules/:scheduleId", isAuth, checkPermission("schedules.edit"), ScheduleController.update);

scheduleRoutes.get("/schedules/:scheduleId", isAuth, checkPermission("schedules.view"), ScheduleController.show);

scheduleRoutes.delete("/schedules/:scheduleId", isAuth, checkPermission("schedules.delete"), ScheduleController.remove);

scheduleRoutes.post("/schedules/:id/media-upload", isAuth, checkPermission("schedules.edit"), upload.array("file"), ScheduleController.mediaUpload);

scheduleRoutes.delete("/schedules/:id/media-upload", isAuth, checkPermission("schedules.edit"), ScheduleController.deleteMedia);

export default scheduleRoutes;
