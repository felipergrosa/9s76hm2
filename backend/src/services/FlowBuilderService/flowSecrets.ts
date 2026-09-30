/**
 * Helpers para não expor segredos (apiKey/voiceKey/voiceRegion de nós
 * "openai") no JSON do fluxo servido ao frontend, preservando os valores
 * reais no banco quando o fluxo é salvo de volta.
 */

const SENSITIVE_KEYS = new Set(["apiKey", "voiceKey", "voiceRegion"]);

// Marcador enviado no lugar do valor real. O backend restaura o valor
// anterior quando recebe esse marcador de volta no save.
export const SECRET_MASK = "********";

const isPlainObject = (v: any): v is Record<string, any> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Deep-walk do JSON do fluxo substituindo valores de chaves sensíveis por
 * SECRET_MASK (mantém a forma do objeto para o editor do frontend).
 */
export const sanitizeFlowSecrets = (flow: any): any => {
  if (Array.isArray(flow)) {
    return flow.map(sanitizeFlowSecrets);
  }
  if (isPlainObject(flow)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(flow)) {
      if (SENSITIVE_KEYS.has(k) && typeof v === "string" && v.length > 0) {
        out[k] = SECRET_MASK;
      } else {
        out[k] = sanitizeFlowSecrets(v);
        }
    }
    return out;
  }
  return flow;
};

/**
 * Deep-walk paralelo entre o flow novo (vindo do frontend) e o antigo
 * (banco). Chaves sensíveis que vierem mascaradas/ausentes restauram o
 * valor anterior — evita que o save apague credenciais que nunca saíram
 * do servidor.
 */
export const restoreFlowSecrets = (next: any, prev: any): any => {
  if (Array.isArray(next)) {
    return next.map((item, idx) => {
      // Para nós de fluxo, casar pelo id quando possível
      let prevItem = Array.isArray(prev) ? prev[idx] : undefined;
      if (isPlainObject(item) && item.id && Array.isArray(prev)) {
        const byId = prev.find((p: any) => isPlainObject(p) && p.id === item.id);
        if (byId) prevItem = byId;
      }
      return restoreFlowSecrets(item, prevItem);
    });
  }
  if (isPlainObject(next)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(next)) {
      const prevVal = isPlainObject(prev) ? prev[k] : undefined;
      if (SENSITIVE_KEYS.has(k)) {
        if (v === SECRET_MASK || v === undefined || v === null || v === "") {
          out[k] = prevVal;
          continue;
        }
        out[k] = v;
        continue;
      }
      out[k] = restoreFlowSecrets(v, prevVal);
    }
    // Restaura chaves sensíveis removidas do payload (ex.: cliente antigo)
    if (isPlainObject(prev)) {
      for (const k of SENSITIVE_KEYS) {
        if (!(k in out) && prev[k] !== undefined) {
          out[k] = prev[k];
        }
      }
    }
    return out;
  }
  return next;
};
