import { Router } from "express";
import * as SessionController from "../controllers/SessionController";
import * as UserController from "../controllers/UserController";
import isAuth from "../middleware/isAuth";
import envTokenAuth from "../middleware/envTokenAuth";
import {
  loginRateLimit,
  forgotPasswordRateLimit,
  signupRateLimit
} from "../middleware/rateLimit";

const authRoutes = Router();

// Rate limits previnem brute force, spam de e-mails e criação em massa.
authRoutes.post("/signup", signupRateLimit, UserController.store);
authRoutes.post("/login", loginRateLimit, SessionController.store);
authRoutes.post("/refresh_token", SessionController.update);
authRoutes.delete("/logout", isAuth, SessionController.remove);
authRoutes.get("/me", isAuth, SessionController.me);
authRoutes.post("/forgot-password", forgotPasswordRateLimit, SessionController.forgotPassword);
authRoutes.post("/reset-password", forgotPasswordRateLimit, SessionController.resetPassword);

export default authRoutes;
