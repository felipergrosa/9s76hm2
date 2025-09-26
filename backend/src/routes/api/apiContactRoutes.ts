import express from "express";

import * as ContactController from "../../controllers/api/ContactController";
import isAuthCompany from "../../middleware/isAuthCompany";

const apiContactRoutes = express.Router();

apiContactRoutes.get("/contacts", isAuthCompany, ContactController.show);
apiContactRoutes.get("/contacts-count", isAuthCompany, ContactController.count);
apiContactRoutes.get("/contacts/segments", isAuthCompany, ContactController.segments);
apiContactRoutes.get("/contacts/empresas", isAuthCompany, ContactController.empresas);
apiContactRoutes.post("/contacts/sync", isAuthCompany, ContactController.sync);


export default apiContactRoutes;
