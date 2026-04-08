// src/cache.js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, "..", ".cache");

// Créer le dossier cache si nécessaire
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function filePath(key) {
  return path.join(CACHE_DIR, `${key}.json`);
}

export function getCache(key) {
  try {
    const fp = filePath(key);
    if (!fs.existsSync(fp)) return null;
    const raw = JSON.parse(fs.readFileSync(fp, "utf-8"));
    return raw;
  } catch {
    return null;
  }
}

export function setCache(key, data) {
  try {
    fs.writeFileSync(
      filePath(key),
      JSON.stringify({ data, updatedAt: Date.now() })
    );
  } catch {}
}

/**
 * Pattern stale-while-revalidate avec TTL.
 * - Si le cache a moins de maxAge ms → retourne le cache, pas de refresh
 * - Si le cache est plus vieux → retourne le cache + refresh en background
 * - Si pas de cache → attend le fetch
 */
export async function staleWhileRevalidate(key, fetchFn, onFresh, maxAge = 5 * 60 * 1000) {
  const cached = getCache(key);

  // Cache frais → pas besoin de refresh
  if (cached && (Date.now() - cached.updatedAt) < maxAge) {
    return { data: cached.data, fromCache: true };
  }

  // Cache périmé ou absent → lancer le fetch
  const refreshPromise = fetchFn()
    .then((freshData) => {
      // Ne pas écraser le cache si le nouveau résultat est pire (moins d'amis, etc.)
      const old = getCache(key);
      const oldCount = old?.data?.friends?.length ?? 0;
      const newCount = freshData?.friends?.length ?? 0;
      if (oldCount > 0 && newCount > 0 && newCount < oldCount * 0.5) {
        console.warn(`[cache] Skip save for ${key}: ${newCount} < ${oldCount} (partiel)`);
        return freshData;
      }
      setCache(key, freshData);
      if (onFresh) onFresh(freshData);
      return freshData;
    })
    .catch((err) => {
      console.warn(`[cache] Refresh failed for ${key}:`, err.message);
      return null;
    });

  // Si on a du cache (périmé), le retourner immédiatement
  if (cached) {
    return { data: cached.data, fromCache: true, refreshPromise };
  }

  // Pas de cache du tout : attendre le fetch
  const freshData = await refreshPromise;
  if (freshData === null) throw new Error("Impossible de charger les données");
  return { data: freshData, fromCache: false };
}
