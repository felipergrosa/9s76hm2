import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as D from "../controllers/DealController";

const routes = Router();

routes.get("/deal-stages", isAuth, D.listStages);
routes.post("/deal-stages", isAuth, D.createStage);
routes.put("/deal-stages/:id", isAuth, D.updateStage);
routes.delete("/deal-stages/:id", isAuth, D.deleteStage);

routes.get("/deals", isAuth, D.listDeals);
routes.get("/deals/kanban", isAuth, D.kanban);
routes.post("/deals", isAuth, D.createDeal);
routes.put("/deals/:id", isAuth, D.updateDeal);
routes.delete("/deals/:id", isAuth, D.deleteDeal);

export default routes;
