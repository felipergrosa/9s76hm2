import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as ScheduleMesageController from "../controllers/ScheduledMessagesController";
import multer from "multer";
import uploadConfig from "../config/upload";
const upload = multer(uploadConfig);

const scheduleMessageRoutes = express.Router();

scheduleMessageRoutes.get("/schedules-message", isAuth, checkPermission("schedules.view"), ScheduleMesageController.index);

scheduleMessageRoutes.post("/schedules-message", isAuth, checkPermission("schedules.create"), upload.array("file"), ScheduleMesageController.store);

scheduleMessageRoutes.put("/schedules-message/:scheduleId", isAuth, checkPermission("schedules.edit"), upload.array("file"), ScheduleMesageController.update);

scheduleMessageRoutes.get("/schedules-message/:scheduleId", isAuth, checkPermission("schedules.view"), ScheduleMesageController.show);

scheduleMessageRoutes.delete("/schedules-message/:scheduleId", isAuth, checkPermission("schedules.delete"), ScheduleMesageController.remove);

export default scheduleMessageRoutes;
