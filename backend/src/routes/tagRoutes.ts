import express from "express";
import isAuth from "../middleware/isAuth";
import { checkAdminOrSuper, checkPermission } from "../middleware/checkPermission";

import * as TagController from "../controllers/TagController";

const tagRoutes = express.Router();

tagRoutes.get("/tags/list", isAuth, checkPermission("tags.view"), TagController.list);
tagRoutes.get("/tags/autocomplete", isAuth, checkPermission("tags.view"), TagController.autocomplete);
tagRoutes.get("/tags", isAuth, checkPermission("tags.view"), TagController.index);
tagRoutes.get("/tags/:tagId", isAuth, checkPermission("tags.view"), TagController.show);
tagRoutes.get("/tag/kanban", isAuth, checkPermission("kanban.view"), TagController.kanban);

tagRoutes.post("/tags", isAuth, checkPermission("tags.create"), TagController.store);
tagRoutes.post("/tags/sync", isAuth, checkAdminOrSuper(), TagController.syncTags);

tagRoutes.put("/tags/:tagId", isAuth, checkPermission("tags.edit"), TagController.update);

tagRoutes.delete("/tags/:tagId", isAuth, checkPermission("tags.delete"), TagController.remove);
tagRoutes.delete("/tags-contacts/:tagId/:contactId", isAuth, checkPermission("tags.edit"), TagController.removeContactTag);

export default tagRoutes;
