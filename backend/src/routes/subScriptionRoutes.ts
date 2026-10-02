import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as SubscriptionController from "../controllers/SubscriptionController";

const subscriptionRoutes = express.Router();
// Cria checkout de pagamento da fatura da própria empresa → financeiro.edit
subscriptionRoutes.post("/subscription", isAuth, checkPermission("financeiro.edit"), SubscriptionController.createSubscription);
subscriptionRoutes.post("/subscription/create/webhook", SubscriptionController.createWebhook);
subscriptionRoutes.post("/subscription/webhook/:type?", SubscriptionController.webhook);

export default subscriptionRoutes;
