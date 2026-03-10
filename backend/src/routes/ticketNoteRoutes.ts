import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import * as TicketNoteController from "../controllers/TicketNoteController";

const ticketNoteRoutes = express.Router();

ticketNoteRoutes.get(
  "/ticket-notes/list",
  isAuth,
  checkPermission("tickets.view"),
  TicketNoteController.findFilteredList
);

ticketNoteRoutes.get("/ticket-notes", isAuth, checkPermission("tickets.view"), TicketNoteController.index);

ticketNoteRoutes.get("/ticket-notes/:id", isAuth, checkPermission("tickets.view"), TicketNoteController.show);

ticketNoteRoutes.post("/ticket-notes", isAuth, checkPermission("tickets.edit"), TicketNoteController.store);

ticketNoteRoutes.put("/ticket-notes/:id", isAuth, checkPermission("tickets.edit"), TicketNoteController.update);

ticketNoteRoutes.delete(
  "/ticket-notes/:id",
  isAuth,
  checkPermission("tickets.edit"),
  TicketNoteController.remove
);

export default ticketNoteRoutes;
