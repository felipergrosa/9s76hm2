import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as LeadScraperController from "../controllers/LeadScraperController";

const routes = Router();

routes.post("/lead-scraper/jobs", isAuth, LeadScraperController.startJob);
routes.get("/lead-scraper/jobs", isAuth, LeadScraperController.listJobs);
routes.get("/lead-scraper/jobs/:id", isAuth, LeadScraperController.getJob);
routes.post("/lead-scraper/jobs/:id/import", isAuth, LeadScraperController.importJobResults);

export default routes;
