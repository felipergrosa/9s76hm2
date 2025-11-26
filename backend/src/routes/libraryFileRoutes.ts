import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as LibraryFileController from "../controllers/LibraryFileController";

const libraryFileRoutes = Router();

libraryFileRoutes.get("/library/files", isAuth, LibraryFileController.index);
libraryFileRoutes.get("/library/tags", isAuth, LibraryFileController.listTags);
libraryFileRoutes.post("/library/files/check-duplicates", isAuth, LibraryFileController.checkDuplicates);
libraryFileRoutes.post("/library/files", isAuth, LibraryFileController.store);
libraryFileRoutes.put("/library/files/:fileId", isAuth, LibraryFileController.update);
libraryFileRoutes.delete("/library/files/:fileId", isAuth, LibraryFileController.remove);

// Ações de indexação RAG
libraryFileRoutes.post("/library/files/:fileId/index", isAuth, LibraryFileController.indexFile);
libraryFileRoutes.post("/library/files/:fileId/reindex", isAuth, LibraryFileController.reindexFile);

export default libraryFileRoutes;
