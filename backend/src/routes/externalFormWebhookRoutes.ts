import express from "express";
import * as ExternalFormWebhookController from "../controllers/ExternalFormWebhookController";

const routes = express.Router();

routes.post("/webhooks/external-form/:token", ExternalFormWebhookController.receive);

export default routes;
