import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as LibraryFileController from "../controllers/LibraryFileController";

const libraryFileRoutes = Router();

libraryFileRoutes.get("/library/files", isAuth, checkPermission("files.view"), LibraryFileController.index);
libraryFileRoutes.get("/library/tags", isAuth, checkPermission("files.view"), LibraryFileController.listTags);
libraryFileRoutes.post("/library/files/check-duplicates", isAuth, checkPermission("files.upload"), LibraryFileController.checkDuplicates);
libraryFileRoutes.post("/library/files", isAuth, checkPermission("files.upload"), LibraryFileController.store);
libraryFileRoutes.put("/library/files/:fileId", isAuth, checkPermission("files.upload"), LibraryFileController.update);
libraryFileRoutes.delete("/library/files/:fileId", isAuth, checkPermission("files.delete"), LibraryFileController.remove);

// Ações de indexação RAG
libraryFileRoutes.post("/library/files/:fileId/index", isAuth, checkPermission("files.upload"), LibraryFileController.indexFile);
libraryFileRoutes.post("/library/files/:fileId/reindex", isAuth, checkPermission("files.upload"), LibraryFileController.reindexFile);

export default libraryFileRoutes;
