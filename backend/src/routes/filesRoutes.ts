import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import { createUpload } from "../config/uploadFactory";
import validateUploadedFiles from "../middleware/validateUploadedFiles";

import * as FilesController from "../controllers/FilesController";

const upload = createUpload({
  privacy: "public",
  subfolder: "files",
  dynamic: true,
  paramId: "fileId"
});

const filesRoutes = express.Router();

filesRoutes.get("/files/list", isAuth, checkPermission("files.view"), FilesController.list);
filesRoutes.get("/files", isAuth, checkPermission("files.view"), FilesController.index);
filesRoutes.post("/files", isAuth, checkPermission("files.upload"), upload.array("files"), FilesController.store);
filesRoutes.put("/files/:fileId", isAuth, checkPermission("files.upload"), upload.array("files"), FilesController.update);
filesRoutes.get("/files/:fileId", isAuth, checkPermission("files.view"), FilesController.show);
filesRoutes.delete("/files/:fileId", isAuth, checkPermission("files.delete"), FilesController.remove);
filesRoutes.delete("/files", isAuth, checkPermission("files.delete"), FilesController.removeAll);

export default filesRoutes;
