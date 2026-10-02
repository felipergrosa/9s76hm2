import express from "express";
import isAuth from "../middleware/isAuth";
import checkSuper from "../middleware/checkSuper";
import checkPermission, { checkAnyPermission } from "../middleware/checkPermission";

import * as CompanyController from "../controllers/CompanyController";

const companyRoutes = express.Router();

// SEGURANÇA (multitenant): endpoints abaixo podem expor dados de TODAS as
// empresas quando o usuário é super — exigem a permissão companies.view,
// que só existe no grupo super (admin comum não possui). O controller
// também faz isolamento por tenant como segunda camada.
companyRoutes.get("/companies/list", isAuth, checkPermission("companies.view"), CompanyController.list);
companyRoutes.get("/companies", isAuth, checkPermission("companies.view"), CompanyController.index);
// GET /companies/:id também é usado por admin de tenant para a PRÓPRIA empresa
// (horários em SettingsCustom, Financeiro) — o controller isola por tenant;
// aqui basta uma das permissões.
companyRoutes.get("/companies/:id", isAuth, checkAnyPermission(["companies.view", "settings.view"]), CompanyController.show);
// SEGURANÇA: criação de empresa exige super admin real (verificado no DB)
companyRoutes.post("/companies", isAuth, checkSuper, CompanyController.store);
// PUT /:id e /:id/schedules são usados por admin de tenant (config própria) —
// controller faz whitelist de campos para não-super; exige settings.edit ou companies.edit.
companyRoutes.put("/companies/:id", isAuth, checkAnyPermission(["companies.edit", "settings.edit"]), CompanyController.update);
companyRoutes.put("/companies/:id/schedules", isAuth, checkAnyPermission(["companies.edit", "settings.edit"]), CompanyController.updateSchedules);
// SEGURANÇA: deletar empresa é exclusivo do console SaaS (super)
companyRoutes.delete("/companies/:id", isAuth, checkPermission("companies.delete"), CompanyController.remove);

// Rota para listar o plano da empresa
companyRoutes.get("/companies/listPlan/:id", isAuth, checkPermission("companies.view"), CompanyController.listPlan);
companyRoutes.get("/companiesPlan", isAuth, checkPermission("companies.view"), CompanyController.indexPlan);

export default companyRoutes;
