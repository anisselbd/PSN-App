// src/psn-friends.js
// Chargement en 2 temps :
// 1. fetchFriendsLegacy() → 74 profils + présence de base en 1 appel (instant)
// 2. enrichPresence() → présence moderne progressive en background
//    Met à jour le cache au fur et à mesure, jamais de perte de données

import { call, getBasicPresence } from "psn-api";
import { getAuthorization, withRetry } from "./psn-auth.js";

const LEGACY_BASE = "https://us-prof.np.community.playstation.net/userProfile/v1/users";

function mapLegacyPresence(presences) {
  if (!Array.isArray(presences) || presences.length === 0) return null;

  const online = presences.find((p) => p.onlineStatus === "online");
  const primary = online ?? presences[0];

  const onlineStatus = primary?.onlineStatus ?? null;
  const platform = primary?.platform ?? null;
  const lastOnlineDate = primary?.lastOnlineDate ?? null;
  const isOnline = onlineStatus === "online";
  const titleName = primary?.titleName ?? null;

  return {
    availability: isOnline ? "available" : "unavailable",
    onlineStatus,
    isOnline,
    platform,
    lastOnlineDate,
    titleName,
    titleFormat: platform ?? null,
    titleIconUrl: null,
    _isLegacy: true,
  };
}

function mapModernPresence(rawResponse) {
  if (!rawResponse) return null;
  const p = rawResponse.basicPresence ?? rawResponse;
  const game = p.gameTitleInfoList?.[0] ?? null;
  const availability = p.availability ?? null;
  const rawOnlineStatus = p.primaryPlatformInfo?.onlineStatus ?? null;
  const hasGame = Array.isArray(p.gameTitleInfoList) && p.gameTitleInfoList.length > 0;

  return {
    availability,
    onlineStatus: rawOnlineStatus,
    isOnline: rawOnlineStatus === "online" || availability === "availableToPlay" || availability === "available" || hasGame,
    platform: p.primaryPlatformInfo?.platform ?? game?.format ?? null,
    lastOnlineDate: p.primaryPlatformInfo?.lastOnlineDate ?? p.lastAvailableDate ?? null,
    titleName: game?.titleName ?? null,
    titleFormat: game?.format ?? null,
    titleIconUrl: game?.npTitleIconUrl ?? game?.conceptIconUrl ?? null,
    _isLegacy: false,
  };
}

function extractAvatarFromLegacy(avatarUrls) {
  if (!Array.isArray(avatarUrls) || avatarUrls.length === 0) return null;
  const preferred = avatarUrls.find((a) => a.size === "xl" || a.avatarUrlType === "xl");
  if (preferred) return preferred.avatarUrl ?? preferred.url ?? null;
  return avatarUrls[avatarUrls.length - 1]?.avatarUrl ?? avatarUrls[0]?.url ?? null;
}

/**
 * Étape 1 — Charge tous les amis via legacy (1 appel, instant).
 * Retourne les profils avec une présence de base (PS4 fiable, PS5 partiel).
 */
export async function fetchFriendsLegacy(limit = 100) {
  const auth = await getAuthorization();

  const url = `${LEGACY_BASE}/me/friends/profiles2?fields=onlineId,accountId,avatarUrls,plus,personalDetail(firstName,lastName),presences(@default,@titleInfo,platform,lastOnlineDate,hasBroadcastData)&sort=name-onlineId&offset=0&limit=${limit}`;

  const response = await withRetry(() => call({ url }, auth));

  if (!response?.profiles) throw new Error("Legacy: pas de profils");

  const friends = response.profiles.map((p) => {
    const firstName = p.personalDetail?.firstName ?? null;
    const lastName = p.personalDetail?.lastName ?? null;
    const realName = firstName ? `${firstName} ${lastName ?? ""}`.trim() : null;

    return {
      accountId: p.accountId ?? p.npId ?? "",
      onlineId: p.onlineId ?? "(inconnu)",
      realName,
      avatarUrl: extractAvatarFromLegacy(p.avatarUrls),
      isPlus: p.plus === 1 || p.plus === true,
      presence: mapLegacyPresence(p.presences),
    };
  });

  console.log(`[friends] Legacy: ${friends.length} amis`);

  return {
    total: response.totalResults ?? friends.length,
    friends,
  };
}

/**
 * Étape 2 — Enrichit la présence avec l'API moderne (background).
 * Batch de 4 avec 4s de pause. Met à jour les amis in-place.
 * Retourne les amis mis à jour.
 */
export async function enrichPresence(friends) {
  const auth = await getAuthorization();
  const accountIds = friends.map((f) => f.accountId).filter(Boolean);
  let modernCount = 0;

  for (let i = 0; i < accountIds.length; i += 4) {
    const batch = accountIds.slice(i, i + 4);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const raw = await withRetry(() => getBasicPresence(auth, id));
          return { id, presence: mapModernPresence(raw) };
        } catch {
          return { id, presence: null };
        }
      })
    );

    for (const r of results) {
      if (!r.presence) continue;
      const friend = friends.find((f) => f.accountId === r.id);
      if (friend) {
        friend.presence = r.presence;
        modernCount++;
      }
    }

    // Rate limit → on arrête, le legacy reste pour le reste
    if (results.every((r) => !r.presence)) {
      console.log(`[friends] Presence: rate limited après ${modernCount}, legacy pour le reste`);
      break;
    }

    if (i + 4 < accountIds.length) {
      await new Promise((r) => setTimeout(r, 4000));
    }
  }

  const onlineCount = friends.filter((f) => f.presence?.isOnline).length;
  console.log(`[friends] Presence: ${onlineCount} en ligne, ${modernCount} modernes`);

  return friends;
}

/**
 * Fonction legacy combinée (pour le presence-monitor et la rétrocompatibilité).
 * Fait les deux étapes d'un coup.
 */
export async function fetchFriends(limit = 100) {
  const result = await fetchFriendsLegacy(limit);
  await enrichPresence(result.friends);
  return result;
}
