import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as TicketController from "../controllers/TicketController";
import * as TicketMergeController from "../controllers/TicketMergeController";

const ticketRoutes = express.Router();

ticketRoutes.get("/tickets", isAuth, checkPermission("tickets.view"), TicketController.index);

ticketRoutes.get("/tickets/:ticketId", isAuth, checkPermission("tickets.view"), TicketController.show);

ticketRoutes.get("/tickets-log/:ticketId", isAuth, checkPermission("tickets.view"), TicketController.showLog);

ticketRoutes.get("/ticket/kanban", isAuth, checkPermission("kanban.view"), TicketController.kanban);

ticketRoutes.get("/ticketreport/reports", isAuth, checkPermission("reports.view"), TicketController.report);

ticketRoutes.get("/tickets/u/:uuid", isAuth, checkPermission("tickets.view"), TicketController.showFromUUID);

ticketRoutes.post("/tickets", isAuth, checkPermission("tickets.create"), TicketController.store);

ticketRoutes.put("/tickets/:ticketId", isAuth, checkPermission("tickets.update"), TicketController.update);

ticketRoutes.post(
  "/tickets/:ticketId/transfer-to-bot",
  isAuth,
  checkPermission("tickets.transfer"),
  TicketController.transferToBot
);

ticketRoutes.delete("/tickets/:ticketId", isAuth, checkPermission("tickets.delete"), TicketController.remove);

ticketRoutes.post("/tickets/closeAll", isAuth, checkPermission("tickets.close"), TicketController.closeAll);

ticketRoutes.post("/tickets/bulk-process", isAuth, checkPermission("tickets.update"), TicketController.bulkProcess);

// Rotas para merge de tickets duplicados (importação)
ticketRoutes.get("/tickets/duplicate-check", isAuth, checkPermission("tickets.view"), TicketMergeController.checkDuplicateTickets);

ticketRoutes.post("/tickets/merge-duplicates", isAuth, checkPermission("tickets.update"), TicketMergeController.mergeDuplicateTickets);

// Rota para status da janela de sessão 24h (API Oficial)
ticketRoutes.get("/tickets/:ticketId/session-window", isAuth, checkPermission("tickets.view"), TicketController.getSessionWindow);

// Rotas para marcar notificações como lidas
ticketRoutes.post("/tickets/:ticketId/mark-as-read", isAuth, TicketController.markNotificationAsRead);
ticketRoutes.post("/tickets/mark-all-as-read", isAuth, TicketController.markAllNotificationsAsRead);

export default ticketRoutes;
