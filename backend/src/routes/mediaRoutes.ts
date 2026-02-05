import { Router } from "express";
import { serveMedia, getVideoThumbnail } from "../controllers/MediaController";

const mediaRoutes = Router();

// Rota para servir mídia com suporte a thumbnails
// Exemplo: GET /media/company1/image.jpg?thumb=1&quality=30
mediaRoutes.get("/:companyId/:filename", serveMedia);

// Rota para thumbnail de vídeo
mediaRoutes.get("/:companyId/:filename/thumbnail", getVideoThumbnail);

export default mediaRoutes;
