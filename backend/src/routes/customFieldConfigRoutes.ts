import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkAdminOrSuper } from "../middleware/checkPermission";
import * as C from "../controllers/CustomFieldConfigController";

const routes = Router();

// leitura liberada p/ qualquer usuário autenticado (formulários consomem a config)
routes.get("/custom-field-configs", isAuth, C.list);
// escrita restrita a admin/super
routes.post("/custom-field-configs", isAuth, checkAdminOrSuper(), C.create);
routes.put("/custom-field-configs/:id", isAuth, checkAdminOrSuper(), C.update);
routes.delete("/custom-field-configs/:id", isAuth, checkAdminOrSuper(), C.remove);

export default routes;
