import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import uploadConfig from "../config/upload";
import * as LeadController from "../controllers/LeadController";

const routes = express.Router();
const upload = multer(uploadConfig);

// Importação de leads gerados externamente (CNPJ + Google Maps scraping —
// item 8 do plano). Reaproveita o mesmo pipeline de criação/atualização de
// Contact + ContactCustomField tipado (item 4) usado pelos demais imports;
// reutiliza a permissão "contacts.import" já existente, sem criar uma nova.
routes.post(
  "/leads/import",
  isAuth,
  checkPermission("contacts.import"),
  upload.single("file"),
  LeadController.importLeads
);

export default routes;
