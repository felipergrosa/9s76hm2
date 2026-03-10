import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";

import multer from "multer";
import { createUpload } from "../config/uploadFactory";
import validateUploadedFiles from "../middleware/validateUploadedFiles";

import * as FlowBuilderController from "../controllers/FlowBuilderController";

// Exportação já existente
import FlowExportController from "../controllers/FlowExportController";

// ---------- FIX: importação ----------
import FlowImportController from "../controllers/FlowImportController";
// --------------------------------------

const upload = createUpload({ privacy: "public", subfolder: "flowbuilder" });
const uploadMemory = multer();        // usado para import (buffer em memória)

const flowBuilder = express.Router();

flowBuilder.post("/flowbuilder", isAuth, checkPermission("flowbuilder.create"), FlowBuilderController.createFlow);
flowBuilder.put("/flowbuilder", isAuth, checkPermission("flowbuilder.edit"), FlowBuilderController.updateFlow);

flowBuilder.delete(
  "/flowbuilder/:idFlow",
  isAuth,
  checkPermission("flowbuilder.delete"),
  FlowBuilderController.deleteFlow
);

flowBuilder.get("/flowbuilder", isAuth, checkPermission("flowbuilder.view"), FlowBuilderController.myFlows);
flowBuilder.get("/flowbuilder/:idFlow", isAuth, checkPermission("flowbuilder.view"), FlowBuilderController.flowOne);

// Rota para exportar um fluxo específico como .zip
flowBuilder.get(
  "/flowbuilder/export/:id",
  isAuth,
  checkPermission("flowbuilder.view"),
  FlowExportController
);

// ---------- FIX: rota de importação (.zip) ----------
flowBuilder.post(
  "/flowbuilder/import",
  isAuth,
  checkPermission("flowbuilder.create"),
  uploadMemory.single("file"),  // recebe o arquivo zip em buffer
  FlowImportController
);
// ----------------------------------------------------

flowBuilder.post(
  "/flowbuilder/flow",
  isAuth,
  checkPermission("flowbuilder.edit"),
  FlowBuilderController.FlowDataUpdate
);

flowBuilder.post(
  "/flowbuilder/duplicate",
  isAuth,
  checkPermission("flowbuilder.create"),
  FlowBuilderController.FlowDuplicate
);

flowBuilder.get(
  "/flowbuilder/flow/:idFlow",
  isAuth,
  checkPermission("flowbuilder.view"),
  FlowBuilderController.FlowDataGetOne
);

flowBuilder.post(
  "/flowbuilder/img",
  isAuth,
  checkPermission("flowbuilder.edit"),
  upload.array("medias"),
  validateUploadedFiles(),
  FlowBuilderController.FlowUploadImg
);

flowBuilder.post(
  "/flowbuilder/audio",
  isAuth,
  checkPermission("flowbuilder.edit"),
  upload.array("medias"),
  validateUploadedFiles(),
  FlowBuilderController.FlowUploadAudio
);

flowBuilder.post(
  "/flowbuilder/content",
  isAuth,
  checkPermission("flowbuilder.edit"),
  upload.array("medias"),
  validateUploadedFiles(),
  FlowBuilderController.FlowUploadAll
);

export default flowBuilder;
