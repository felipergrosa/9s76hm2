import { Response } from "express";

export const SendRefreshToken = (res: Response, token: string): void => {
  // Persist cookie across browser restarts, aligned to refresh token TTL (365 days by default)
  // Security flags: HttpOnly to prevent JS access, SameSite Lax to reduce CSRF risk,
  // Secure only in production with HTTPS, and path root to be accessible by all routes.
  const isProductionSecure = process.env.NODE_ENV === "production" && process.env.BACKEND_URL?.startsWith("https://");
  
  res.cookie("jrt", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProductionSecure,
    path: "/",
    maxAge: 365 * 24 * 60 * 60 * 1000 // 365 days in ms
  });
};
