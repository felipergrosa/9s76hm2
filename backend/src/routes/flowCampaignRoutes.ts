import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as FlowCampaignController from "../controllers/FlowCampaignController";


const flowCampaignRoutes = express.Router();

flowCampaignRoutes.post("/flowcampaign", isAuth, checkPermission("phrase-campaigns.create"), FlowCampaignController.createFlowCampaign);

flowCampaignRoutes.get("/flowcampaign", isAuth, checkPermission("phrase-campaigns.view"), FlowCampaignController.flowCampaigns);

flowCampaignRoutes.get("/flowcampaign/:idFlow", isAuth, checkPermission("phrase-campaigns.view"), FlowCampaignController.flowCampaign);

flowCampaignRoutes.put("/flowcampaign", isAuth, checkPermission("phrase-campaigns.edit"), FlowCampaignController.updateFlowCampaign);

flowCampaignRoutes.delete(
  "/flowcampaign/:idFlow",
  isAuth,
  checkPermission("phrase-campaigns.delete"),
  FlowCampaignController.deleteFlowCampaign
);

export default flowCampaignRoutes;
