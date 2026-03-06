import { Request, Response, NextFunction } from "express";
import CacheManager from "../helpers/CacheManager";
import AppError from "../errors/AppError";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}

class RateLimiter {
  /**
   * Rate limiter por IP
   */
  byIp(config: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip || req.connection.remoteAddress || "unknown";
      const key = `ratelimit:ip:${ip}`;

      try {
        const count = await CacheManager.incr(key, Math.ceil(config.windowMs / 1000));
        
        if (count > config.maxRequests) {
          throw new AppError(
            config.message || "Muitas requisições. Tente novamente mais tarde.",
            429
          );
        }

        // Headers informativos
        res.setHeader("X-RateLimit-Limit", config.maxRequests.toString());
        res.setHeader("X-RateLimit-Remaining", Math.max(0, config.maxRequests - count).toString());

        next();
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        // Se Redis falhar, permite a requisição (fail-open)
        next();
      }
    };
  }

  /**
   * Rate limiter por usuário
   */
  byUser(config: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user?.id || "anonymous";
      const key = `ratelimit:user:${userId}`;

      try {
        const count = await CacheManager.incr(key, Math.ceil(config.windowMs / 1000));
        
        if (count > config.maxRequests) {
          throw new AppError(
            config.message || "Limite de requisições excedido.",
            429
          );
        }

        res.setHeader("X-RateLimit-Limit", config.maxRequests.toString());
        res.setHeader("X-RateLimit-Remaining", Math.max(0, config.maxRequests - count).toString());

        next();
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        next();
      }
    };
  }

  /**
   * Rate limiter por conexão WhatsApp (previne spam)
   */
  byWhatsApp(config: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const whatsappId = req.body?.whatsappId || req.params?.whatsappId;
      if (!whatsappId) {
        return next();
      }

      const key = `ratelimit:whatsapp:${whatsappId}`;

      try {
        const count = await CacheManager.incr(key, Math.ceil(config.windowMs / 1000));
        
        if (count > config.maxRequests) {
          throw new AppError(
            "Limite de mensagens por minuto excedido para esta conexão.",
            429
          );
        }

        next();
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        next();
      }
    };
  }

  /**
   * Throttle para evitar múltiplas requisições simultâneas
   */
  throttle(key: string, delayMs: number = 1000) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const throttleKey = `throttle:${key}:${req.user?.id || req.ip}`;

      try {
        const exists = await CacheManager.exists(throttleKey);
        
        if (exists) {
          throw new AppError(
            "Aguarde um momento antes de fazer outra requisição.",
            429
          );
        }

        await CacheManager.set(throttleKey, true, Math.ceil(delayMs / 1000));
        next();
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        next();
      }
    };
  }
}

export default new RateLimiter();
