import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as C from "../controllers/CustomFieldConfigController";

const routes = Router();

// leitura liberada p/ qualquer usuário autenticado (formulários consomem a config)
// Decisão intencional (revisão de segurança N2): a config é necessária em telas de
// formulário para todos os perfis; dados retornados já são escopados por companyId.
routes.get("/custom-field-configs", isAuth, C.list);
// escrita = gestão de configuração da empresa → settings.edit
// (era checkAdminOrSuper; migrado para granular na faxina de perfis legados)
routes.post("/custom-field-configs", isAuth, checkPermission("settings.edit"), C.create);
routes.put("/custom-field-configs/:id", isAuth, checkPermission("settings.edit"), C.update);
routes.delete("/custom-field-configs/:id", isAuth, checkPermission("settings.edit"), C.remove);

export default routes;
