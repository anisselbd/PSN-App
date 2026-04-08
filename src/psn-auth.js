// src/psn-auth.js
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  exchangeRefreshTokenForAuthTokens,
} from "psn-api";

const npsso = process.env.PSN_NPSSO;

if (!npsso) {
  console.error("PSN_NPSSO manquant dans .env");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(__dirname, "..", ".psn-tokens.json");

let cachedTokens = null;
let tokenExpiresAt = 0;
let refreshTokenExpiresAt = 0;
let myAccountId = null;

// Charger les tokens depuis le disque au démarrage
try {
  if (fs.existsSync(TOKEN_FILE)) {
    const saved = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8"));
    cachedTokens = saved.tokens;
    tokenExpiresAt = saved.tokenExpiresAt;
    refreshTokenExpiresAt = saved.refreshTokenExpiresAt;
    myAccountId = saved.myAccountId;
    console.log("[auth] Tokens chargés depuis le cache disque");
  }
} catch {}

/**
 * Retourne un objet { accessToken } valide,
 * en utilisant le cache ou le refresh token si possible.
 */
export async function getAuthorization() {
  const now = Date.now();

  // Token encore valide
  if (cachedTokens && now < tokenExpiresAt) {
    return { accessToken: cachedTokens.accessToken };
  }

  // Token expiré mais refresh token valide
  if (cachedTokens?.refreshToken && now < refreshTokenExpiresAt) {
    console.log("[auth] Refresh du token...");
    try {
      const tokens = await exchangeRefreshTokenForAuthTokens(
        cachedTokens.refreshToken
      );
      cacheTokens(tokens);
      return { accessToken: tokens.accessToken };
    } catch (err) {
      console.warn("[auth] Refresh échoué, full re-auth:", err.message);
    }
  }

  // Full auth depuis NPSSO
  console.log("[auth] Authentification complète...");
  const accessCode = await exchangeNpssoForAccessCode(npsso);
  const tokens = await exchangeAccessCodeForAuthTokens(accessCode);
  cacheTokens(tokens);
  return { accessToken: tokens.accessToken };
}

function cacheTokens(tokens) {
  cachedTokens = tokens;
  tokenExpiresAt = Date.now() + (tokens.expiresIn - 60) * 1000;
  refreshTokenExpiresAt =
    Date.now() + (tokens.refreshTokenExpiresIn - 60) * 1000;

  // Extraire l'accountId depuis l'idToken JWT
  if (tokens.idToken) {
    try {
      const payload = JSON.parse(
        Buffer.from(tokens.idToken.split(".")[1], "base64url").toString()
      );
      myAccountId = payload.sub ?? payload.account_id ?? null;
    } catch {}
  }

  // Persister sur disque
  try {
    fs.writeFileSync(
      TOKEN_FILE,
      JSON.stringify({
        tokens,
        tokenExpiresAt,
        refreshTokenExpiresAt,
        myAccountId,
      })
    );
  } catch {}
}

/**
 * Retourne l'accountId de l'utilisateur connecté.
 * Doit être appelé après getAuthorization().
 */
export function getMyAccountId() {
  return myAccountId;
}

/**
 * Wrapper avec retry automatique pour les appels API rate-limités.
 */
export async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 =
        err.message?.includes("Too Many Requests") ||
        err.message?.includes("429");
      if (is429 && attempt < maxRetries) {
        const delay = (attempt + 1) * 2000;
        console.log(`[retry] Rate limited, attente ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}
