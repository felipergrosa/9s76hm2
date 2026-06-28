import fs from "fs";

/**
 * Cache de existência de arquivo com TTL curto.
 *
 * Motivação: o getter `urlPicture` do model Contact faz `fs.existsSync` síncrono
 * toda vez que é lido. Em listas grandes (contatos, tickets) isso multiplica o I/O
 * de disco por contato a cada requisição. Este cache evita o stat repetido para o
 * mesmo caminho dentro de uma janela curta.
 *
 * Segurança:
 * - Resultados NEGATIVOS (arquivo ausente) usam TTL bem curto, pois o arquivo pode
 *   passar a existir logo após (download de avatar) — não queremos servir `null`
 *   por muito tempo.
 * - Resultados POSITIVOS usam TTL maior (raramente um arquivo existente some).
 * - Em qualquer escrita/remoção de avatar, chame `invalidateExistsCache(path)` para
 *   refletir a mudança imediatamente.
 */

interface Entry {
  exists: boolean;
  ts: number;
}

const cache = new Map<string, Entry>();
const POSITIVE_TTL_MS = 60_000; // 60s
const NEGATIVE_TTL_MS = 4_000; // 4s
const MAX_ENTRIES = 10_000;

const ttlFor = (exists: boolean) => (exists ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS);

export const cachedExistsSync = (absolutePath: string): boolean => {
  const now = Date.now();
  const hit = cache.get(absolutePath);
  if (hit && now - hit.ts < ttlFor(hit.exists)) {
    return hit.exists;
  }

  const exists = fs.existsSync(absolutePath);

  if (cache.size >= MAX_ENTRIES) {
    // Eviction simples: remove entradas expiradas; se ainda cheio, limpa tudo.
    for (const [key, entry] of cache) {
      if (now - entry.ts >= ttlFor(entry.exists)) cache.delete(key);
    }
    if (cache.size >= MAX_ENTRIES) cache.clear();
  }

  cache.set(absolutePath, { exists, ts: now });
  return exists;
};

export const invalidateExistsCache = (absolutePath: string): void => {
  cache.delete(absolutePath);
};
