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
 * Pattern stale-while-revalidate.
 * Retourne le cache immédiatement si dispo, puis lance le fetch en background.
 * Le callback onFresh est appelé quand les données fraîches arrivent.
 */
export async function staleWhileRevalidate(key, fetchFn, onFresh) {
  const cached = getCache(key);

  // Lancer le fetch en background
  const refreshPromise = fetchFn()
    .then((freshData) => {
      setCache(key, freshData);
      if (onFresh) onFresh(freshData);
      return freshData;
    })
    .catch((err) => {
      console.warn(`[cache] Refresh failed for ${key}:`, err.message);
      return null;
    });

  // Si on a du cache, le retourner immédiatement
  if (cached) {
    return { data: cached.data, fromCache: true, refreshPromise };
  }

  // Pas de cache : attendre le fetch
  const freshData = await refreshPromise;
  if (freshData === null) throw new Error("Impossible de charger les données");
  return { data: freshData, fromCache: false, refreshPromise: null };
}
