import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import { getLabelsDebug, listGroups, syncGroups, rebuildTags, forceLabelsSync, rebuildCacheFromBaileys } from "../controllers/WbotLabelsController";

const wbotLabelsRoutes = express.Router();

wbotLabelsRoutes.get("/wbot/:whatsappId/labels/debug", isAuth, checkPermission("tags.view"), getLabelsDebug);
wbotLabelsRoutes.get("/wbot/:whatsappId/groups", isAuth, checkPermission("contacts.view"), listGroups);
wbotLabelsRoutes.post("/wbot/:whatsappId/groups/sync", isAuth, checkPermission("contacts.edit"), syncGroups);
wbotLabelsRoutes.post("/wbot/:whatsappId/labels/rebuild", isAuth, checkPermission("tags.edit"), rebuildTags);
wbotLabelsRoutes.post("/wbot/:whatsappId/labels/force-sync", isAuth, checkPermission("tags.edit"), forceLabelsSync);
wbotLabelsRoutes.post("/wbot/:whatsappId/labels/rebuild-cache", isAuth, checkPermission("tags.edit"), rebuildCacheFromBaileys);

export default wbotLabelsRoutes;
