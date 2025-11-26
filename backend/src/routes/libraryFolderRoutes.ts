import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as LibraryFolderController from "../controllers/LibraryFolderController";

const libraryFolderRoutes = Router();

libraryFolderRoutes.get("/library/folders", isAuth, LibraryFolderController.index);
libraryFolderRoutes.post("/library/folders", isAuth, LibraryFolderController.store);
libraryFolderRoutes.get("/library/folders/:folderId", isAuth, LibraryFolderController.show);
libraryFolderRoutes.put("/library/folders/:folderId", isAuth, LibraryFolderController.update);
libraryFolderRoutes.delete("/library/folders/:folderId", isAuth, LibraryFolderController.remove);

// Ações de indexação RAG
libraryFolderRoutes.post("/library/folders/:folderId/index", isAuth, LibraryFolderController.indexFolder);
libraryFolderRoutes.post("/library/folders/:folderId/reindex", isAuth, LibraryFolderController.reindexFolder);
libraryFolderRoutes.post("/library/index-all", isAuth, LibraryFolderController.indexAll);

export default libraryFolderRoutes;
