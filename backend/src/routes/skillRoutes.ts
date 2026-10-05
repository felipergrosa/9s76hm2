/**
 * skillRoutes.ts
 * 
 * Rotas REST para gerenciamento de Skills
 * Integrado com WebSocket para notificações em tempo real
 */

import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as SkillController from "../controllers/SkillController";

const skillRoutes = Router();

// ========== ROTAS LITERAIS ==========
// IMPORTANTE: rotas literais (/skills/export, /skills/validate, etc.) devem
// vir ANTES de /skills/:id — registradas depois ficam inalcançáveis
// (Express casa ":id" primeiro).

// Listar todas as skills
skillRoutes.get(
  "/skills",
  isAuth,
  checkPermission("ai-settings.view"),
  SkillController.index
);

// Exportar skills
skillRoutes.get(
  "/skills/export",
  isAuth,
  checkPermission("ai-settings.view"),
  SkillController.exportSkills
);

// Estatísticas do cache e WebSocket
skillRoutes.get(
  "/skills/cache/stats",
  isAuth,
  checkPermission("ai-settings.view"),
  SkillController.cacheStats
);

// Validar skill
skillRoutes.post(
  "/skills/validate",
  isAuth,
  checkPermission("ai-settings.view"),
  SkillController.validate
);

// Importar skills em massa
skillRoutes.post(
  "/skills/import",
  isAuth,
  checkPermission("ai-settings.edit"),
  SkillController.importSkills
);

// ========== CRUD BÁSICO ==========

// Buscar skill específica
skillRoutes.get(
  "/skills/:id",
  isAuth,
  checkPermission("ai-settings.view"),
  SkillController.show
);

// Criar nova skill
skillRoutes.post(
  "/skills",
  isAuth,
  checkPermission("ai-settings.edit"),
  SkillController.create
);

// Atualizar skill
skillRoutes.put(
  "/skills/:id",
  isAuth,
  checkPermission("ai-settings.edit"),
  SkillController.update
);

// Deletar skill (soft delete)
skillRoutes.delete(
  "/skills/:id",
  isAuth,
  checkPermission("ai-settings.edit"),
  SkillController.destroy
);

// ========== AÇÕES ESPECÍFICAS ==========

// Duplicar skill (fork)
skillRoutes.post(
  "/skills/:id/fork",
  isAuth,
  checkPermission("ai-settings.edit"),
  SkillController.fork
);

// Ativar/Desativar skill (toggle)
skillRoutes.patch(
  "/skills/:id/toggle",
  isAuth,
  checkPermission("ai-settings.edit"),
  SkillController.toggle
);

// Publicar skill
skillRoutes.post(
  "/skills/:id/publish",
  isAuth,
  checkPermission("ai-settings.edit"),
  SkillController.publish
);

export default skillRoutes;
