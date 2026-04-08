// src/psn-auth.js
import "dotenv/config";
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

let cachedTokens = null;
let tokenExpiresAt = 0;
let refreshTokenExpiresAt = 0;
let myAccountId = null;

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
}

/**
 * Retourne l'accountId de l'utilisateur connecté.
 * Doit être appelé après getAuthorization().
 */
export function getMyAccountId() {
  return myAccountId;
}
