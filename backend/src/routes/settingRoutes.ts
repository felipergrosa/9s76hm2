import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import envTokenAuth from "../middleware/envTokenAuth";
import multer from "multer";

import * as SettingController from "../controllers/SettingController";
import isSuper from "../middleware/isSuper";
import { createUpload } from "../config/uploadFactory";
import validateUploadedFiles from "../middleware/validateUploadedFiles";

const upload = createUpload({ privacy: "public" });
const uploadPrivate = createUpload({ privacy: "private" });

const settingRoutes = Router();

settingRoutes.get("/settings", isAuth, checkPermission("settings.view"), SettingController.index);
// SavedFilter Cron Config (específico) - definir ANTES de '/settings/:settingKey'
settingRoutes.get("/settings/saved-filter-cron", isAuth, checkPermission("settings.view"), SettingController.getSavedFilterCronConfig);
settingRoutes.put("/settings/saved-filter-cron", isAuth, checkPermission("settings.edit"), SettingController.updateSavedFilterCronConfig);

settingRoutes.get("/settings/:settingKey", isAuth, checkPermission("settings.view"), SettingController.showOne);

// change setting key to key in future
settingRoutes.put("/settings/:settingKey", isAuth, checkPermission("settings.edit"), SettingController.update);

settingRoutes.get("/setting/:settingKey", isAuth, checkPermission("settings.view"), SettingController.getSetting);

settingRoutes.put("/setting/:settingKey", isAuth, checkPermission("settings.edit"), SettingController.updateOne);

settingRoutes.get("/public-settings/:settingKey", envTokenAuth, SettingController.publicShow);

settingRoutes.post(
  "/settings-whitelabel/logo",
  isAuth,
  checkPermission("settings.edit"),
  upload.single("file"),
  validateUploadedFiles(),
  SettingController.storeLogo
);

settingRoutes.post(
  "/settings/privateFile",
  isAuth,
  checkPermission("settings.edit"),
  uploadPrivate.single("file"),
  validateUploadedFiles(),
  SettingController.storePrivateFile
)

export default settingRoutes;
