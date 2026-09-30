import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as RAGController from "../controllers/RAGController";

const ragRoutes = express.Router();

// Leituras: helps.view | Escritas/indexação/deleção: ai-settings.edit
ragRoutes.post("/helps/rag/index-text", isAuth, checkPermission("ai-settings.edit"), RAGController.indexText);
ragRoutes.post("/helps/rag/index-file", isAuth, checkPermission("ai-settings.edit"), RAGController.indexFile);
ragRoutes.get("/helps/rag/search", isAuth, checkPermission("helps.view"), RAGController.search);
ragRoutes.get("/helps/rag/documents", isAuth, checkPermission("helps.view"), RAGController.listDocuments);
ragRoutes.delete("/helps/rag/documents/:id", isAuth, checkPermission("ai-settings.edit"), RAGController.removeDocument);

// Auto-indexação de conversas
ragRoutes.post("/helps/rag/auto-index", isAuth, checkPermission("ai-settings.edit"), RAGController.autoIndexConversations);
ragRoutes.post("/helps/rag/auto-index-range", isAuth, checkPermission("ai-settings.edit"), RAGController.autoIndexByDateRange);
ragRoutes.get("/helps/rag/indexable-stats", isAuth, checkPermission("helps.view"), RAGController.getIndexableStats);

// Fontes da base de conhecimento
ragRoutes.get("/helps/rag/sources", isAuth, checkPermission("helps.view"), RAGController.listSources);
ragRoutes.post("/helps/rag/index-url", isAuth, checkPermission("ai-settings.edit"), RAGController.indexUrl);
ragRoutes.delete("/helps/rag/external-link", isAuth, checkPermission("ai-settings.edit"), RAGController.removeExternalLink);

// Coleções RAG disponíveis
ragRoutes.get("/helps/rag/collections", isAuth, checkPermission("helps.view"), RAGController.listCollections);

// Sitemap e reindexação
ragRoutes.post("/helps/rag/index-sitemap", isAuth, checkPermission("ai-settings.edit"), RAGController.indexSitemap);
ragRoutes.post("/helps/rag/reindex-document/:id", isAuth, checkPermission("ai-settings.edit"), RAGController.reindexDocument);
ragRoutes.post("/helps/rag/reindex-all", isAuth, checkPermission("ai-settings.edit"), RAGController.reindexAll);

export default ragRoutes;
