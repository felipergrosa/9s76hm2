import express from "express";

import * as ContactController from "../../controllers/api/ContactController";
import isAuth from "../../middleware/isAuth";

const apiContactRoutes = express.Router();

apiContactRoutes.get("/contacts", isAuth, ContactController.show);
apiContactRoutes.get("/contacts-count", isAuth, ContactController.count);
apiContactRoutes.get("/contacts/segments", isAuth, ContactController.segments);
apiContactRoutes.get("/contacts/empresas", isAuth, ContactController.empresas);
apiContactRoutes.post("/contacts/sync", isAuth, ContactController.sync);


export default apiContactRoutes;
