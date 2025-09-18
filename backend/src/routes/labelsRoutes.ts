import express from "express";
import isAuth from "../middleware/isAuth";
import * as LabelsController from "../controllers/LabelsController";

const labelsRoutes = express.Router();

// Sincronizar labels do WhatsApp para o banco
labelsRoutes.post("/sync", isAuth, LabelsController.syncLabels);

// Obter estatísticas das labels
labelsRoutes.get("/stats", isAuth, LabelsController.getLabelsStats);

// Importar contatos de uma label específica
labelsRoutes.post("/import/:labelId", isAuth, LabelsController.importContactsByLabel);

// Adicionar label a um contato
labelsRoutes.post("/add-to-contact", isAuth, LabelsController.addLabelToContact);

// Remover label de um contato
labelsRoutes.post("/remove-from-contact", isAuth, LabelsController.removeLabelFromContact);

// Criar nova label
labelsRoutes.post("/create", isAuth, LabelsController.createLabel);

export default labelsRoutes;
