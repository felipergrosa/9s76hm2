import express from "express";
import isAuth from "../middleware/isAuth";
import { getLabelsDebug, rebuildTags, forceLabelsSync, rebuildCacheFromBaileys } from "../controllers/WbotLabelsController";

const wbotLabelsRoutes = express.Router();

wbotLabelsRoutes.get("/wbot/:whatsappId/labels/debug", isAuth, getLabelsDebug);
wbotLabelsRoutes.post("/wbot/:whatsappId/labels/rebuild", isAuth, rebuildTags);
wbotLabelsRoutes.post("/wbot/:whatsappId/labels/force-sync", isAuth, forceLabelsSync);
wbotLabelsRoutes.post("/wbot/:whatsappId/labels/rebuild-cache", isAuth, rebuildCacheFromBaileys);

export default wbotLabelsRoutes;
