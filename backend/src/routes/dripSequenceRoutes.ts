import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as DripSequenceController from "../controllers/DripSequenceController";

const routes = express.Router();

routes.get("/drip-sequences", isAuth, checkPermission("drip-sequences.view"), DripSequenceController.index);
routes.get("/drip-sequences/:id", isAuth, checkPermission("drip-sequences.view"), DripSequenceController.show);
routes.get("/drip-sequences/:id/enrollments", isAuth, checkPermission("drip-sequences.view"), DripSequenceController.enrollments);
routes.post("/drip-sequences", isAuth, checkPermission("drip-sequences.create"), DripSequenceController.store);
routes.put("/drip-sequences/:id", isAuth, checkPermission("drip-sequences.edit"), DripSequenceController.update);
routes.delete("/drip-sequences/:id", isAuth, checkPermission("drip-sequences.delete"), DripSequenceController.remove);

export default routes;
