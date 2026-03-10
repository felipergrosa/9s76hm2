import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as TicketTagController from "../controllers/TicketTagController";

const ticketTagRoutes = express.Router();

ticketTagRoutes.put("/ticket-tags/:ticketId/:tagId", isAuth, checkPermission("tickets.update"), TicketTagController.store);
ticketTagRoutes.delete("/ticket-tags/:ticketId", isAuth, checkPermission("tickets.update"), TicketTagController.remove);

export default ticketTagRoutes;
