import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as InvoicesController from "../controllers/InvoicesController";

const invoiceRoutes = express.Router();

invoiceRoutes.get("/invoices", isAuth, checkPermission("financeiro.view"), InvoicesController.index);
invoiceRoutes.get("/invoices/list", isAuth, checkPermission("financeiro.view"), InvoicesController.list);
invoiceRoutes.get("/invoices/all", isAuth, checkPermission("financeiro.view"), InvoicesController.list);
invoiceRoutes.get("/invoices/:Invoiceid", isAuth, checkPermission("financeiro.view"), InvoicesController.show);
invoiceRoutes.put("/invoices/:id", isAuth, checkPermission("financeiro.view"), InvoicesController.update);


export default invoiceRoutes;
