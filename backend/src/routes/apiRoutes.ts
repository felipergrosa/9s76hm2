import express from "express";
import multer from "multer";
import uploadConfig from "../config/upload";

import * as ApiController from "../controllers/ApiController";
import isAuthCompany from "../middleware/isAuthCompany";

const upload = multer(uploadConfig);

const ApiRoutes = express.Router();

ApiRoutes.post("/send", isAuthCompany, upload.array("medias"), ApiController.index);
// ApiRoutes.post("/send/linkPdf", isAuthCompany, ApiController.indexLink);
ApiRoutes.post("/send/linkImage", isAuthCompany, ApiController.indexImage);
ApiRoutes.post("/checkNumber", isAuthCompany, ApiController.checkNumber)

// ApiRoutes.post("/send/linkVideo", isAuthCompany, ApiController.indexVideo);
// ApiRoutes.post("/send/toManyText", isAuthCompany, ApiController.indexToMany);
// ApiRoutes.post("/send/toManyLinkPdf", isAuthCompany, ApiController.indexToManyLinkPdf);
// ApiRoutes.post("/send/toManyImage", isAuthCompany, ApiController.indexToManyImage);

// retornar os whatsapp e seus status
// ApiRoutes.get("/getWhatsappsId", isAuthCompany, ApiController.indexWhatsappsId);

export default ApiRoutes;
