import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { checkPermission } from "../middleware/checkPermission";
import * as LeadScraperController from "../controllers/LeadScraperController";

const routes = Router();

routes.post("/lead-scraper/jobs", isAuth, checkPermission("contacts.import"), LeadScraperController.startJob);
routes.get("/lead-scraper/jobs", isAuth, LeadScraperController.listJobs);
routes.get("/lead-scraper/jobs/:id", isAuth, LeadScraperController.getJob);
routes.post("/lead-scraper/jobs/:id/import", isAuth, checkPermission("contacts.import"), LeadScraperController.importJobResults);
routes.delete("/lead-scraper/jobs", isAuth, checkPermission("contacts.import"), LeadScraperController.clearJobs);
routes.delete("/lead-scraper/jobs/:id", isAuth, checkPermission("contacts.import"), LeadScraperController.deleteJob);

export default routes;
