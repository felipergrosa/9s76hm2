import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as EmailCampaignController from "../controllers/EmailCampaignController";

const routes = express.Router();

routes.get("/email-campaigns", isAuth, checkPermission("email-campaigns.view"), EmailCampaignController.index);
routes.get("/email-campaigns/:id", isAuth, checkPermission("email-campaigns.view"), EmailCampaignController.show);
routes.get("/email-campaigns/:id/report", isAuth, checkPermission("email-campaigns.view"), EmailCampaignController.report);
routes.post("/email-campaigns", isAuth, checkPermission("email-campaigns.create"), EmailCampaignController.store);
routes.put("/email-campaigns/:id", isAuth, checkPermission("email-campaigns.edit"), EmailCampaignController.update);
routes.delete("/email-campaigns/:id", isAuth, checkPermission("email-campaigns.delete"), EmailCampaignController.remove);
routes.post("/email-campaigns/:id/cancel", isAuth, checkPermission("email-campaigns.edit"), EmailCampaignController.cancel);
routes.post("/email-campaigns/:id/send-now", isAuth, checkPermission("email-campaigns.edit"), EmailCampaignController.sendNow);

export default routes;
