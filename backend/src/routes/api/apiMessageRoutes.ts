import express from "express";

import * as MessageController from "../../controllers/api/MessageController";
import isAuth from "../../middleware/isAuth";
import checkPermission from "../../middleware/checkPermission";

const apiMessageRoutes = express.Router();

apiMessageRoutes.get("/messagesRange", isAuth, checkPermission("tickets.view"), MessageController.show);

export default apiMessageRoutes;
