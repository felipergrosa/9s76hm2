import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import { embeddedSignup } from "../controllers/MetaEmbeddedSignupController";

const routes = Router();

// WhatsApp Embedded Signup (Meta): finaliza o cadastro do número oficial.
// Autenticado — o usuário do CRM precisa poder criar conexões.
routes.post(
  "/whatsapp/embedded-signup",
  isAuth,
  checkPermission("connections.create"),
  embeddedSignup
);

export default routes;
