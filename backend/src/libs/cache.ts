import hmacSHA512 from "crypto-js/hmac-sha512";
import Base64 from "crypto-js/enc-base64";
import { REDIS_URI_CONNECTION } from "../config/redis";

class CacheSingleton {
  // Usa any para permitir fallback em memória quando não houver Redis
  private redis: any;

  private static instance: CacheSingleton;

  private constructor(redisInstance: any) {
    this.redis = redisInstance;
  }

  public static getInstance(redisInstance: any): CacheSingleton {
    if (!CacheSingleton.instance) {
      CacheSingleton.instance = new CacheSingleton(redisInstance);
    }
    return CacheSingleton.instance;
  }

  private static encryptParams(params: any) {
    const str = JSON.stringify(params);
    const key = Base64.stringify(hmacSHA512(str, str));
    return key;
  }

  public async set(
    key: string,
    value: string,
    option?: string,
    optionValue?: string | number
  ): Promise<string> {
    if (option !== undefined && optionValue !== undefined) {
      return this.redis.set(key, value, option, optionValue);
    }
    return this.redis.set(key, value);
  }

  public async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  public async getKeys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  public async del(key: string): Promise<number> {
    return this.redis.del(key);
  }

  public async delFromPattern(pattern: string): Promise<void> {
    const all = await this.getKeys(pattern);
    await Promise.all(all.map(item => this.del(item)));
  }

  public async setFromParams(
    key: string,
    params: any,
    value: string,
    option?: string,
    optionValue?: string | number
  ): Promise<string> {
    const finalKey = `${key}:${CacheSingleton.encryptParams(params)}`;
    if (option !== undefined && optionValue !== undefined) {
      return this.set(finalKey, value, option, optionValue);
    }
    return this.set(finalKey, value);
  }

  public async getFromParams(key: string, params: any): Promise<string | null> {
    const finalKey = `${key}:${CacheSingleton.encryptParams(params)}`;
    return this.get(finalKey);
  }

  public async delFromParams(key: string, params: any): Promise<number> {
    const finalKey = `${key}:${CacheSingleton.encryptParams(params)}`;
    return this.del(finalKey);
  }

  public getRedisInstance(): any {
    return this.redis;
  }
}

// Fallback simples em memória quando REDIS_URI não estiver configurado
function createInMemoryRedis() {
  const store = new Map<string, { value: string; expires?: number }>();
  return {
    async set(key: string, value: string, ...args: any[]) {
      let expires: number | undefined;
      // Suporte a EX seconds (ioredis style: set(key, value, "EX", seconds))
      if (args.length >= 2 && args[0] === "EX") {
        expires = Date.now() + (args[1] as number) * 1000;
      }
      store.set(key, { value, expires });
      return "OK";
    },
    async get(key: string) {
      const item = store.get(key);
      if (!item) return null;
      if (item.expires && Date.now() > item.expires) {
        store.delete(key);
        return null;
      }
      return item.value;
    },
    async expire(key: string, seconds: number) {
      const item = store.get(key);
      if (!item) return 0;
      item.expires = Date.now() + seconds * 1000;
      return 1;
    },
    async keys(pattern: string) {
      // suporte básico a '*' no final/meio
      const regex = new RegExp(
        "^" + pattern.replace(/[.+^${}()|\\[\\]\\\\]/g, "\\$&").replace(/\\\*/g, ".*") + "$"
      );
      const now = Date.now();
      return Array.from(store.entries())
        .filter(([k, v]) => (!v.expires || v.expires > now) && regex.test(k))
        .map(([k]) => k);
    },
    async del(key: string) {
      return store.delete(key) ? 1 : 0;
    },
    // Mock do eval para scripts Lua usados pelo wbotMutex
    async eval(script: string, numKeys: number, ...args: any[]) {
      const keys = args.slice(0, numKeys) as string[];
      const argv = args.slice(numKeys) as string[];
      const key = keys[0];
      const current = await this.get(key);
      
      // Script de aquisição de lock (wbotMutex)
      if (script.includes('redis.call("set", KEYS[1], ARGV[1], "EX", ARGV[2])') && script.includes("return 1")) {
        if (!current) {
          await this.set(key, argv[0], "EX", parseInt(argv[1]));
          return 1;
        }
        // Extrair host do ownerId (formato: host:token)
        const currentHost = current?.split(":")[0];
        const myHost = argv[0]?.split(":")[0];
        if (currentHost === myHost) {
          await this.set(key, argv[0], "EX", parseInt(argv[1]));
          return 1;
        }
        return 0;
      }
      
      // Script de renew (expire)
      if (script.includes('redis.call("expire"')) {
        const ownerId = argv[0];
        if (current === ownerId) {
          return await this.expire(key, parseInt(argv[1]));
        }
        return 0;
      }
      
      // Script de delete (release)
      if (script.includes('redis.call("del"')) {
        const ownerId = argv[0];
        if (current === ownerId) {
          return await this.del(key);
        }
        return 0;
      }
      
      return 0;
    }
  };
}

let redisInstance: any = null;
try {
  const Redis = require("ioredis");
  if (REDIS_URI_CONNECTION) {
    redisInstance = new Redis(REDIS_URI_CONNECTION);
  } else {
    redisInstance = createInMemoryRedis();
  }
} catch (e) {
  // ioredis não instalado: usa fallback em memória
  redisInstance = createInMemoryRedis();
}

export default CacheSingleton.getInstance(redisInstance);