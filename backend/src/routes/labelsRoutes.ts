import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as LabelsController from "../controllers/LabelsController";

const labelsRoutes = express.Router();

// Sincronizar labels do WhatsApp para o banco
labelsRoutes.post("/sync", isAuth, checkPermission("tags.create"), LabelsController.syncLabels);

// Obter estatísticas das labels
labelsRoutes.get("/stats", isAuth, checkPermission("tags.view"), LabelsController.getLabelsStats);

// Importar contatos de uma label específica
labelsRoutes.post("/import/:labelId", isAuth, checkPermission("contacts.import"), LabelsController.importContactsByLabel);

// Adicionar label a um contato
labelsRoutes.post("/add-to-contact", isAuth, checkPermission("contacts.edit-tags"), LabelsController.addLabelToContact);

// Remover label de um contato
labelsRoutes.post("/remove-from-contact", isAuth, checkPermission("contacts.edit-tags"), LabelsController.removeLabelFromContact);

// Criar nova label
labelsRoutes.post("/create", isAuth, checkPermission("tags.create"), LabelsController.createLabel);

export default labelsRoutes;
