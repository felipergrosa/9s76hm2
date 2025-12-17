import express from "express";
import isAuth from "../middleware/isAuth";
import { checkAdminOrSuper } from "../middleware/checkPermission";

import * as TagController from "../controllers/TagController";

const tagRoutes = express.Router();

tagRoutes.get("/tags/list", isAuth, TagController.list);
tagRoutes.get("/tags/autocomplete", isAuth, TagController.autocomplete);
tagRoutes.get("/tags", isAuth, TagController.index);
tagRoutes.get("/tags/:tagId", isAuth, TagController.show);
tagRoutes.get("/tag/kanban", isAuth, TagController.kanban);

tagRoutes.post("/tags", isAuth, TagController.store);
tagRoutes.post("/tags/sync", isAuth, checkAdminOrSuper(), TagController.syncTags);

tagRoutes.put("/tags/:tagId", isAuth, TagController.update);

tagRoutes.delete("/tags/:tagId", isAuth, TagController.remove);
tagRoutes.delete("/tags-contacts/:tagId/:contactId", isAuth, TagController.removeContactTag);

export default tagRoutes;
