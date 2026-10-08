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

// Negócios (deals) do Kanban: tickets manuais com isDeal
ticketRoutes.post("/tickets/deal", isAuth, checkPermission("kanban.view"), TicketController.storeDeal);
ticketRoutes.put("/tickets/:ticketId/deal", isAuth, checkPermission("kanban.view"), TicketController.updateDeal);
ticketRoutes.delete("/tickets/:ticketId/deal", isAuth, checkPermission("kanban.view"), TicketController.removeDeal);

ticketRoutes.put("/tickets/:ticketId", isAuth, checkPermission("tickets.update"), TicketController.update);

ticketRoutes.post(
  "/tickets/:ticketId/transfer-to-bot",
  isAuth,
  checkPermission("tickets.transfer"),
  TicketController.transferToBot
);

ticketRoutes.delete("/tickets/:ticketId", isAuth, checkPermission("tickets.delete"), TicketController.remove);

ticketRoutes.post("/tickets/closeAll", isAuth, checkPermission("tickets.close"), TicketController.closeAll);

// Frontend só abre o modal de processamento em massa com "tickets.bulk-process";
// as ações individuais são verificadas de forma granular no controller.
ticketRoutes.post("/tickets/bulk-process", isAuth, checkPermission("tickets.bulk-process"), TicketController.bulkProcess);

// Rotas para merge de tickets duplicados (importação)
ticketRoutes.get("/tickets/duplicate-check", isAuth, checkPermission("tickets.view"), TicketMergeController.checkDuplicateTickets);

ticketRoutes.post("/tickets/merge-duplicates", isAuth, checkPermission("tickets.update"), TicketMergeController.mergeDuplicateTickets);

// Rota para status da janela de sessão 24h (API Oficial)
ticketRoutes.get("/tickets/:ticketId/session-window", isAuth, checkPermission("tickets.view"), TicketController.getSessionWindow);

// Rotas para marcar notificações como lidas
ticketRoutes.post("/tickets/:ticketId/mark-as-read", isAuth, checkPermission("tickets.update"), TicketController.markNotificationAsRead);
ticketRoutes.post("/tickets/mark-all-as-read", isAuth, checkPermission("tickets.update"), TicketController.markAllNotificationsAsRead);

// Disparo manual de fluxo do FlowBuilder no ticket ("Disparar Fluxo").
// GET lista os fluxos ativos da empresa (permissão de leitura); POST executa.
ticketRoutes.get("/tickets/:ticketId/flows", isAuth, checkPermission("tickets.view"), TicketController.listTicketFlows);
ticketRoutes.post("/tickets/:ticketId/trigger-flow", isAuth, checkPermission("tickets.update"), TicketController.triggerFlow);

export default ticketRoutes;
