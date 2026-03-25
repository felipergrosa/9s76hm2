import { Router } from "express";
import isAuth from "../middleware/isAuth";
import checkPermission from "../middleware/checkPermission";

const router = Router();

/**
 * Rota stub para compatibilidade com frontend legado
 * A funcionalidade de Prompts foi removida e substituída por AI Agents
 * Esta rota retorna array vazio para evitar erros 404
 */
router.get(
  "/prompt",
  isAuth,
  checkPermission("prompts.view"),
  (req, res) => {
    return res.json({ prompts: [] });
  }
);

export default router;
