/**
 * featureFlagRoutes.ts
 * 
 * Rotas REST para gerenciamento de Feature Flags
 */

import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as FeatureFlagController from "../controllers/FeatureFlagController";

const featureFlagRoutes = Router();

// CRUD básico
featureFlagRoutes.get(
  "/feature-flags",
  isAuth,
  checkPermission("ai-settings.view"),
  FeatureFlagController.index
);

featureFlagRoutes.get(
  "/feature-flags/:id",
  isAuth,
  checkPermission("ai-settings.view"),
  FeatureFlagController.show
);

featureFlagRoutes.post(
  "/feature-flags",
  isAuth,
  checkPermission("ai-settings.edit"),
  FeatureFlagController.create
);

featureFlagRoutes.put(
  "/feature-flags/:id",
  isAuth,
  checkPermission("ai-settings.edit"),
  FeatureFlagController.update
);

featureFlagRoutes.delete(
  "/feature-flags/:id",
  isAuth,
  checkPermission("ai-settings.edit"),
  FeatureFlagController.destroy
);

// Avaliar flag para contexto
featureFlagRoutes.post(
  "/feature-flags/:key/evaluate",
  isAuth,
  checkPermission("ai-settings.view"),
  FeatureFlagController.evaluate
);

// Rollout gradual
featureFlagRoutes.post(
  "/feature-flags/:id/rollout",
  isAuth,
  checkPermission("ai-settings.edit"),
  FeatureFlagController.gradualRollout
);

// Estatísticas
featureFlagRoutes.get(
  "/feature-flags/stats/all",
  isAuth,
  checkPermission("ai-settings.view"),
  FeatureFlagController.stats
);

// Bulk update
featureFlagRoutes.post(
  "/feature-flags/bulk/update",
  isAuth,
  checkPermission("ai-settings.edit"),
  FeatureFlagController.bulkUpdate
);

export default featureFlagRoutes;
