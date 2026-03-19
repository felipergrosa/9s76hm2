import express from "express";

import * as ContactController from "../../controllers/api/ContactController";
import isAuth from "../../middleware/isAuth";
import tokenAuth from "../../middleware/tokenAuth";

const apiContactRoutes = express.Router();

apiContactRoutes.get("/contacts", isAuth, ContactController.show);
apiContactRoutes.get("/contacts-count", isAuth, ContactController.count);
apiContactRoutes.get("/contacts/segments", isAuth, ContactController.segments);
apiContactRoutes.get("/contacts/empresas", isAuth, ContactController.empresas);
// /contacts/sync aceita token de API (tokenAuth) ou JWT de sessão (isAuth)
apiContactRoutes.post("/contacts/sync", tokenAuth, ContactController.sync);


export default apiContactRoutes;
