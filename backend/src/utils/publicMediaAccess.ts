import { createHmac, timingSafeEqual } from "crypto";
import { Request, Response, NextFunction } from "express";
import { verify } from "jsonwebtoken";
import authConfig from "../config/auth";

const COOKIE_NAME = "wm_media";
const COOKIE_TTL_SECONDS = 60 * 60;
const MAX_SIGNED_URL_TTL_SECONDS = 5 * 60;

const digest = (value: string): string =>
  createHmac("sha256", `public-media-v1:${authConfig.secret}`).update(value).digest("hex");

const equal = (left: string, right: string): boolean => {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
};

const companyFromPath = (pathname: string): number | null => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\\") || decoded.includes("\0") || /%[a-f0-9]{2}/i.test(decoded) || decoded.split("/").some(part => part === "." || part === "..")) {
    return null;
  }
  const match = /^\/public\/company([1-9]\d*)\/(.+)$/i.exec(decoded);
  return match ? Number(match[1]) : null;
};

const readCookie = (req: Request): string | undefined => {
  const match = new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`).exec(req.headers.cookie || "");
  return match?.[1];
};

const validCookie = (req: Request, companyId: number): boolean => {
  const value = readCookie(req);
  if (!value) return false;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature || !equal(signature, digest(`cookie:${encoded}`))) return false;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    return parsed.companyId === companyId && Number.isSafeInteger(parsed.expires) && parsed.expires > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
};

const validSignedUrl = (req: Request, companyId: number): boolean => {
  const { mediaCompany, mediaExpires, mediaSignature } = req.query;
  if (typeof mediaCompany !== "string" || typeof mediaExpires !== "string" || typeof mediaSignature !== "string") return false;
  const expires = Number(mediaExpires);
  const now = Math.floor(Date.now() / 1000);
  if (Number(mediaCompany) !== companyId || !Number.isSafeInteger(expires) || expires <= now || expires > now + MAX_SIGNED_URL_TTL_SECONDS) return false;
  return equal(mediaSignature, digest(`url:${companyId}:${expires}:/public${req.path}`));
};

/** Add short-lived access to local company media for server-to-server downloads. */
export const signPublicMediaUrl = (url: string, companyId: number, ttlSeconds = MAX_SIGNED_URL_TTL_SECONDS): string => {
  if (!Number.isSafeInteger(companyId) || companyId <= 0) throw new Error("Invalid media company");
  const backendOrigin = new URL(process.env.BACKEND_URL || "http://localhost:8080").origin;
  const parsed = new URL(url, backendOrigin);
  if (parsed.origin !== backendOrigin || companyFromPath(parsed.pathname) !== companyId) return url;
  const expires = Math.floor(Date.now() / 1000) + Math.max(1, Math.min(MAX_SIGNED_URL_TTL_SECONDS, Math.floor(ttlSeconds)));
  parsed.searchParams.set("mediaCompany", String(companyId));
  parsed.searchParams.set("mediaExpires", String(expires));
  parsed.searchParams.set("mediaSignature", digest(`url:${companyId}:${expires}:${parsed.pathname}`));
  return /^https?:\/\//i.test(url) ? parsed.toString() : `${parsed.pathname}${parsed.search}`;
};

/** Browser images cannot attach Authorization, so issue a media-only cookie on JWT API requests. */
export const issuePublicMediaCookie = (req: Request, res: Response, next: NextFunction): void => {
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || "");
  if (match) {
    try {
      const claims = verify(match[1], authConfig.secret) as { companyId?: number; exp?: number };
      const companyId = Number(claims.companyId);
      const expires = Math.min(Number(claims.exp) || 0, Math.floor(Date.now() / 1000) + COOKIE_TTL_SECONDS);
      if (Number.isSafeInteger(companyId) && companyId > 0 && expires > Math.floor(Date.now() / 1000)) {
        const encoded = Buffer.from(JSON.stringify({ companyId, expires })).toString("base64");
        res.cookie(COOKIE_NAME, `${encoded}.${digest(`cookie:${encoded}`)}`, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
          path: "/public",
          maxAge: (expires - Math.floor(Date.now() / 1000)) * 1000
        });
      }
    } catch {
      // Authentication remains the responsibility of each API route.
    }
  }
  next();
};

/** Require a tenant-bound cookie, bearer JWT, or a short-lived signed URL. */
export const authorizePublicMedia = (req: Request, res: Response, next: NextFunction): void => {
  const companyId = companyFromPath(`/public${req.path}`);
  if (companyId === null) {
    // Non-company assets include shared application images and login branding.
    const decoded = (() => { try { return decodeURIComponent(req.path); } catch { return req.path; } })();
    if (/^\/company/i.test(decoded) || req.path.includes("..") || /%2f|%5c|%25/i.test(req.path)) {
      res.sendStatus(403);
      return;
    }
    next();
    return;
  }
  const bearer = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization || "");
  let authorized = validCookie(req, companyId) || validSignedUrl(req, companyId);
  if (!authorized && bearer) {
    try {
      const claims = verify(bearer[1], authConfig.secret) as { companyId?: number };
      authorized = Number(claims.companyId) === companyId;
    } catch { /* ignore invalid bearer */ }
  }
  if (!authorized) {
    res.sendStatus(403);
    return;
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Vary", "Cookie, Authorization");
  next();
};
