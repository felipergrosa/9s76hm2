import express from "express";

import * as ContactController from "../../controllers/api/ContactController";
import isAuth from "../../middleware/isAuth";
import tokenAuth from "../../middleware/tokenAuth";
import isAuthCompany from "../../middleware/isAuthCompany";

const apiContactRoutes = express.Router();

apiContactRoutes.get("/contacts", isAuth, ContactController.show);
apiContactRoutes.get("/contacts-count", isAuth, ContactController.count);
apiContactRoutes.get("/contacts/segments", isAuth, ContactController.segments);
apiContactRoutes.get("/contacts/empresas", isAuth, ContactController.empresas);
// /contacts/sync aceita COMPANY_TOKEN (isAuthCompany) ou JWT de sessão (isAuth)
apiContactRoutes.post("/contacts/sync", isAuthCompany, ContactController.sync);
// /contacts/:id para exclusão via API (usa COMPANY_TOKEN)
apiContactRoutes.delete("/contacts/:id", isAuthCompany, ContactController.remove);


export default apiContactRoutes;
