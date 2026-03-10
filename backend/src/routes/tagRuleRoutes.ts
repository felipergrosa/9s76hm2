import express from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as TagRuleController from "../controllers/TagRuleController";

const tagRuleRoutes = express.Router();

// Lista regras de uma tag
tagRuleRoutes.get("/tag-rules/tag/:tagId", isAuth, checkPermission("tags.view"), TagRuleController.index);

// Cria nova regra
tagRuleRoutes.post("/tag-rules", isAuth, checkPermission("tags.edit"), TagRuleController.store);

// Atualiza regra
tagRuleRoutes.put("/tag-rules/:ruleId", isAuth, checkPermission("tags.edit"), TagRuleController.update);

// Remove regra
tagRuleRoutes.delete("/tag-rules/:ruleId", isAuth, checkPermission("tags.edit"), TagRuleController.remove);

// Busca valores únicos de um campo
tagRuleRoutes.get("/tag-rules/field-values/:field", isAuth, checkPermission("tags.view"), TagRuleController.getFieldValues);

// Preview de contatos que serão afetados
tagRuleRoutes.get("/tag-rules/preview/:tagId", isAuth, checkPermission("tags.view"), TagRuleController.preview);

// Aplica regras manualmente (todas ou de uma tag específica)
tagRuleRoutes.post("/tag-rules/apply/:tagId?", isAuth, checkPermission("tags.edit"), TagRuleController.apply);

export default tagRuleRoutes;
