import express from "express";
import isAuth from "../middleware/isAuth";
import * as RAGController from "../controllers/RAGController";

const ragRoutes = express.Router();

ragRoutes.post("/helps/rag/index-text", isAuth, RAGController.indexText);
ragRoutes.post("/helps/rag/index-file", isAuth, RAGController.indexFile);
ragRoutes.get("/helps/rag/search", isAuth, RAGController.search);
ragRoutes.get("/helps/rag/documents", isAuth, RAGController.listDocuments);
ragRoutes.delete("/helps/rag/documents/:id", isAuth, RAGController.removeDocument);

// Auto-indexação de conversas
ragRoutes.post("/helps/rag/auto-index", isAuth, RAGController.autoIndexConversations);
ragRoutes.post("/helps/rag/auto-index-range", isAuth, RAGController.autoIndexByDateRange);
ragRoutes.get("/helps/rag/indexable-stats", isAuth, RAGController.getIndexableStats);

// Fontes da base de conhecimento
ragRoutes.get("/helps/rag/sources", isAuth, RAGController.listSources);
ragRoutes.post("/helps/rag/index-url", isAuth, RAGController.indexUrl);
ragRoutes.delete("/helps/rag/external-link", isAuth, RAGController.removeExternalLink);

export default ragRoutes;
