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
// Config do troncal SIP para o softphone: qualquer usuário autenticado
// (agentes sem settings.view também usam o softphone). Path distinto para
// não colidir com "/companySettings/:companyId".
companySettingsRoutes.get("/companySipTrunk", isAuth, CompanySettingsController.showSipTrunk);

export default companySettingsRoutes;