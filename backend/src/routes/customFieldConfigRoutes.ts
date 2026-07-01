import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as C from "../controllers/CustomFieldConfigController";

const routes = Router();
routes.get("/custom-field-configs", isAuth, C.list);
routes.post("/custom-field-configs", isAuth, C.create);
routes.put("/custom-field-configs/:id", isAuth, C.update);
routes.delete("/custom-field-configs/:id", isAuth, C.remove);
export default routes;
