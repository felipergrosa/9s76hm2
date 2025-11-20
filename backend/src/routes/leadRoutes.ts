import express from "express";
import * as LeadController from "../controllers/LeadController";

const leadRoutes = express.Router();

// Rota pública para criação de leads (sem autenticação)
leadRoutes.post("/leads", LeadController.store);

export default leadRoutes;

