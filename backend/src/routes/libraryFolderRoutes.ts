import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as LibraryFolderController from "../controllers/LibraryFolderController";

const libraryFolderRoutes = Router();

libraryFolderRoutes.get("/library/folders", isAuth, checkPermission("files.view"), LibraryFolderController.index);
libraryFolderRoutes.post("/library/folders", isAuth, checkPermission("files.upload"), LibraryFolderController.store);
libraryFolderRoutes.get("/library/folders/:folderId", isAuth, checkPermission("files.view"), LibraryFolderController.show);
libraryFolderRoutes.put("/library/folders/:folderId", isAuth, checkPermission("files.upload"), LibraryFolderController.update);
libraryFolderRoutes.delete("/library/folders/:folderId", isAuth, checkPermission("files.delete"), LibraryFolderController.remove);

// Ações de indexação RAG
libraryFolderRoutes.post("/library/folders/:folderId/index", isAuth, checkPermission("files.upload"), LibraryFolderController.indexFolder);
libraryFolderRoutes.post("/library/folders/:folderId/reindex", isAuth, checkPermission("files.upload"), LibraryFolderController.reindexFolder);
libraryFolderRoutes.post("/library/index-all", isAuth, checkPermission("files.upload"), LibraryFolderController.indexAll);

export default libraryFolderRoutes;
