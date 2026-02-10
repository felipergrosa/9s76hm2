import express from "express";
import isAuth from "../middleware/isAuth";

import * as TicketController from "../controllers/TicketController";
import * as TicketMergeController from "../controllers/TicketMergeController";

const ticketRoutes = express.Router();

ticketRoutes.get("/tickets", isAuth, TicketController.index);

ticketRoutes.get("/tickets/:ticketId", isAuth, TicketController.show);

ticketRoutes.get("/tickets-log/:ticketId", isAuth, TicketController.showLog);

ticketRoutes.get("/ticket/kanban", isAuth, TicketController.kanban);

ticketRoutes.get("/ticketreport/reports", isAuth, TicketController.report);

ticketRoutes.get("/tickets/u/:uuid", isAuth, TicketController.showFromUUID);

ticketRoutes.post("/tickets", isAuth, TicketController.store);

ticketRoutes.put("/tickets/:ticketId", isAuth, TicketController.update);

ticketRoutes.post(
  "/tickets/:ticketId/transfer-to-bot",
  isAuth,
  TicketController.transferToBot
);

ticketRoutes.delete("/tickets/:ticketId", isAuth, TicketController.remove);

ticketRoutes.post("/tickets/closeAll", isAuth, TicketController.closeAll);

ticketRoutes.post("/tickets/bulk-process", isAuth, TicketController.bulkProcess);

// Rotas para merge de tickets duplicados (importação)
ticketRoutes.get("/tickets/duplicate-check", isAuth, TicketMergeController.checkDuplicateTickets);

ticketRoutes.post("/tickets/merge-duplicates", isAuth, TicketMergeController.mergeDuplicateTickets);

export default ticketRoutes;
