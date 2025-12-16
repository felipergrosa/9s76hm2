import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as ContactReleaseRequestController from "../controllers/ContactReleaseRequestController";

const routes = express.Router();

// Admins (ou quem tem permissão de settings) veem e resolvem solicitações
routes.get(
  "/contact-release-requests",
  isAuth,
  checkPermission("settings.view"),
  ContactReleaseRequestController.index
);

routes.post(
  "/contact-release-requests/:id/resolve",
  isAuth,
  checkPermission("settings.view"),
  ContactReleaseRequestController.resolve
);

export default routes;
