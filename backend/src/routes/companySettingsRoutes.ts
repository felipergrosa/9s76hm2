/** 
 * @TercioSantos-0 |
 * routes/configurações das empresas |å
 */
import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as CompanySettingsController from "../controllers/CompanySettingsController";

const companySettingsRoutes = express.Router();

companySettingsRoutes.get("/companySettings/:companyId", isAuth, checkPermission("settings.view"), CompanySettingsController.show);
companySettingsRoutes.get("/companySettingOne/", isAuth, checkPermission("settings.view"), CompanySettingsController.showOne);
companySettingsRoutes.put("/companySettings/", isAuth, checkPermission("settings.edit"), CompanySettingsController.update);

export default companySettingsRoutes;