import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as FlowDefaultController from "../controllers/FlowDefaultController";

const flowDefaultRoutes = express.Router();

flowDefaultRoutes.post(
  "/flowdefault",
  isAuth,
  checkPermission("flowbuilder.edit"),
  FlowDefaultController.createFlowDefault
);

flowDefaultRoutes.put("/flowdefault", isAuth, checkPermission("flowbuilder.edit"), FlowDefaultController.updateFlow);

flowDefaultRoutes.get("/flowdefault", isAuth, checkPermission("flowbuilder.view"), FlowDefaultController.getFlows);

export default flowDefaultRoutes;