import express from "express";
import isAuth from "../middleware/isAuth";
import * as TagRuleController from "../controllers/TagRuleController";

const tagRuleRoutes = express.Router();

// Lista regras de uma tag
tagRuleRoutes.get("/tag-rules/tag/:tagId", isAuth, TagRuleController.index);

// Cria nova regra
tagRuleRoutes.post("/tag-rules", isAuth, TagRuleController.store);

// Atualiza regra
tagRuleRoutes.put("/tag-rules/:ruleId", isAuth, TagRuleController.update);

// Remove regra
tagRuleRoutes.delete("/tag-rules/:ruleId", isAuth, TagRuleController.remove);

// Busca valores únicos de um campo
tagRuleRoutes.get("/tag-rules/field-values/:field", isAuth, TagRuleController.getFieldValues);

// Preview de contatos que serão afetados
tagRuleRoutes.get("/tag-rules/preview/:tagId", isAuth, TagRuleController.preview);

// Aplica regras manualmente (todas ou de uma tag específica)
tagRuleRoutes.post("/tag-rules/apply/:tagId?", isAuth, TagRuleController.apply);

export default tagRuleRoutes;
