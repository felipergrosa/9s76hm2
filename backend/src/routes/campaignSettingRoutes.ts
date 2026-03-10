import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as CampaignSettingController from "../controllers/CampaignSettingController";
import multer from "multer";
import uploadConfig from "../config/upload";

const upload = multer(uploadConfig);

const routes = express.Router();

routes.get("/campaign-settings", isAuth, checkPermission("campaigns-config.view"), CampaignSettingController.index);

routes.post("/campaign-settings", isAuth, checkPermission("campaigns.edit"), CampaignSettingController.store);
routes.put("/campaign-settings/:id", isAuth, checkPermission("campaigns.edit"), CampaignSettingController.update);


export default routes;
