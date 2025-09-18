import express from "express";
import isAuth from "../middleware/isAuth";
import * as RAGController from "../controllers/RAGController";

const ragRoutes = express.Router();

ragRoutes.post("/helps/rag/index-text", isAuth, RAGController.indexText);
ragRoutes.post("/helps/rag/index-file", isAuth, RAGController.indexFile);
ragRoutes.get("/helps/rag/search", isAuth, RAGController.search);
ragRoutes.get("/helps/rag/documents", isAuth, RAGController.listDocuments);
ragRoutes.delete("/helps/rag/documents/:id", isAuth, RAGController.removeDocument);

export default ragRoutes;
