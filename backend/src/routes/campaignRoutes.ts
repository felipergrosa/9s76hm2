import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as CampaignController from "../controllers/CampaignController";
import multer from "multer";
import uploadConfig from "../config/upload";

const upload = multer(uploadConfig);

const routes = express.Router();

routes.get("/campaigns/list", isAuth, checkPermission("campaigns.view"), CampaignController.findList);
routes.get("/campaigns/:id/detailed-report", isAuth, checkPermission("campaigns.view"), CampaignController.detailedReport);
routes.get("/campaigns/:id/cost", isAuth, checkPermission("campaigns.view"), CampaignController.campaignCost);
routes.get("/campaigns/monthly-cost", isAuth, checkPermission("campaigns.view"), CampaignController.monthlyCost);
routes.get("/campaigns", isAuth, checkPermission("campaigns.view"), CampaignController.index);
routes.get("/campaigns/:id", isAuth, checkPermission("campaigns.view"), CampaignController.show);
routes.post("/campaigns", isAuth, checkPermission("campaigns.create"), CampaignController.store);
routes.put("/campaigns/:id", isAuth, checkPermission("campaigns.edit"), CampaignController.update);
routes.delete("/campaigns/:id", isAuth, checkPermission("campaigns.delete"), CampaignController.remove);
routes.post("/campaigns/:id/cancel", isAuth, checkPermission("campaigns.edit"), CampaignController.cancel);
routes.post("/campaigns/:id/restart", isAuth, checkPermission("campaigns.edit"), CampaignController.restart);
routes.post("/campaigns/:id/clone", isAuth, checkPermission("campaigns.create"), CampaignController.clone);
routes.post("/campaigns/:id/media-upload", isAuth, checkPermission("campaigns.edit"), upload.array("file"), CampaignController.mediaUpload);
routes.delete("/campaigns/:id/media-upload", isAuth, checkPermission("campaigns.edit"), CampaignController.deleteMedia);


export default routes;
