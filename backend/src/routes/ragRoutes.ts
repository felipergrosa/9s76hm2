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

// Coleções RAG disponíveis
ragRoutes.get("/helps/rag/collections", isAuth, RAGController.listCollections);

// Sitemap e reindexação
ragRoutes.post("/helps/rag/index-sitemap", isAuth, RAGController.indexSitemap);
ragRoutes.post("/helps/rag/reindex-document/:id", isAuth, RAGController.reindexDocument);
ragRoutes.post("/helps/rag/reindex-all", isAuth, RAGController.reindexAll);

export default ragRoutes;
