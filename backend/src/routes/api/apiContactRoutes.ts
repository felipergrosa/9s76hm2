import express, { Router } from "express";

import * as ContactController from "../../controllers/api/ContactController";
import isAuth from "../../middleware/isAuth";
import tokenAuth from "../../middleware/tokenAuth";
import isAuthCompany from "../../middleware/isAuthCompany";
import { checkPermission } from "../../middleware/checkPermission";

const apiContactRoutes = Router();

apiContactRoutes.get("/contacts", isAuth, checkPermission("contacts.view"), ContactController.show);
apiContactRoutes.get("/contacts-count", isAuth, checkPermission("contacts.view"), ContactController.count);
apiContactRoutes.get("/contacts/segments", isAuth, checkPermission("contacts.view"), ContactController.segments);
apiContactRoutes.get("/contacts/empresas", isAuth, checkPermission("contacts.view"), ContactController.empresas);
// /contacts/sync aceita COMPANY_TOKEN (isAuthCompany) ou JWT de sessão (isAuth)
apiContactRoutes.post("/contacts/sync", isAuthCompany, ContactController.sync);
// /contacts/:id para exclusão via API (usa COMPANY_TOKEN)
apiContactRoutes.delete("/contacts/:id", isAuthCompany, ContactController.remove);


export default apiContactRoutes;
