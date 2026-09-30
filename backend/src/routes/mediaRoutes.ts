import { Router } from "express";

const mediaRoutes = Router();

// SEGURANÇA (N2): rotas GET /media/:companyId/:filename e .../thumbnail removidas.
// Eram públicas, sem autenticação e vulneráveis a path traversal (filename
// entrava direto em path.join). Nada no frontend consome /media/ — o acesso
// a mídias é feito exclusivamente por /public, protegido por authorizePublicMedia.
// O router permanece registrado em routes/index.ts, mas sem endpoints.

export default mediaRoutes;
