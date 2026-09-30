import dns from "dns";
import { URL } from "url";

/**
 * Valida que uma URL aponta para um host público (anti-SSRF).
 *
 * - Só permite http/https;
 * - Rejeita credentials embutidas;
 * - Resolve o hostname (DNS) e rejeita IPs privados/loopback/link-local/
 *   metadata cloud (169.254.169.254) e IPv6 equivalentes.
 *
 * Deve ser chamada em cada hop de redirect também.
 */
const isPrivateIPv4 = (ip: string): boolean => {
  const parts = ip.split(".").map(p => parseInt(p, 10));
  if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) {
    return true; // formato inesperado → rejeita por segurança
  }
  const [a, b] = parts;
  if (a === 0) return true;                    // 0.0.0.0/8
  if (a === 10) return true;                   // 10.0.0.0/8
  if (a === 127) return true;                  // loopback
  if (a === 169 && b === 254) return true;     // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
  if (a === 192 && b === 168) return true;     // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true;                   // multicast/reservado
  return false;
};

const isPrivateIPv6 = (ip: string): boolean => {
  const norm = ip.toLowerCase();
  if (norm === "::1" || norm === "::") return true;
  if (norm.startsWith("::ffff:")) {
    // IPv4-mapped → valida a parte IPv4
    const v4 = norm.replace("::ffff:", "");
    return isPrivateIPv4(v4);
  }
  if (norm.startsWith("fc") || norm.startsWith("fd")) return true; // ULA fc00::/7
  if (/^fe[89ab]/.test(norm)) return true;      // link-local fe80::/10
  return false;
};

const isPrivateIP = (ip: string): boolean =>
  ip.includes(":") ? isPrivateIPv6(ip) : isPrivateIPv4(ip);

const assertPublicUrl = async (rawUrl: string): Promise<URL> => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL inválida");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Somente URLs http/https são permitidas");
  }

  if (parsed.username || parsed.password) {
    throw new Error("URL com credenciais não é permitida");
  }

  const hostname = parsed.hostname;
  if (!hostname || hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Host não permitido");
  }

  // Host informado diretamente como IP
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(":")) {
    if (isPrivateIP(hostname)) {
      throw new Error("Endereço IP não permitido");
    }
    return parsed;
  }

  // Resolve DNS e rejeita se QUALQUER registro for privado
  const records = await dns.promises.lookup(hostname, { all: true }).catch(() => {
    throw new Error("Não foi possível resolver o host da URL");
  });

  if (!records || records.length === 0) {
    throw new Error("Não foi possível resolver o host da URL");
  }

  for (const rec of records) {
    if (isPrivateIP(rec.address)) {
      throw new Error("Host resolve para endereço interno");
    }
  }

  return parsed;
};

export default assertPublicUrl;
