// src/psn-friends.js
// Stratégie : endpoint legacy pour profils + présence en 1 appel.
// Si la présence legacy détecte des amis "online", on enrichit avec l'API moderne
// pour avoir le jeu en cours (quelques appels seulement, pas tous).

import { call, getBasicPresence } from "psn-api";
import { getAuthorization, withRetry } from "./psn-auth.js";

const LEGACY_BASE = "https://us-prof.np.community.playstation.net/userProfile/v1/users";

function mapLegacyPresence(presences) {
  if (!Array.isArray(presences) || presences.length === 0) return null;

  // Chercher une présence "online"
  const online = presences.find((p) => p.onlineStatus === "online");
  const primary = online ?? presences[0];

  const onlineStatus = primary?.onlineStatus ?? null;
  const platform = primary?.platform ?? null;
  const lastOnlineDate = primary?.lastOnlineDate ?? null;
  const isOnline = onlineStatus === "online";

  // Le legacy peut retourner le jeu via titleInfo
  const titleName = primary?.titleName ?? primary?.npTitleId ?? null;

  return {
    availability: isOnline ? "available" : "unavailable",
    onlineStatus,
    isOnline,
    platform,
    lastOnlineDate,
    titleName: titleName && titleName !== primary?.npTitleId ? titleName : null,
    titleFormat: platform ?? null,
    titleIconUrl: null,
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
  };
}

function extractAvatarFromLegacy(avatarUrls) {
  if (!Array.isArray(avatarUrls) || avatarUrls.length === 0) return null;
  const preferred = avatarUrls.find((a) => a.size === "xl" || a.avatarUrlType === "xl");
  if (preferred) return preferred.avatarUrl ?? preferred.url ?? null;
  return avatarUrls[avatarUrls.length - 1]?.avatarUrl ?? avatarUrls[0]?.url ?? null;
}

export async function fetchFriends(limit = 100) {
  const auth = await getAuthorization();

  // === Étape 1 : legacy — profils + présence en 1 appel ===
  let friends = [];
  let total = 0;

  try {
    const url = `${LEGACY_BASE}/me/friends/profiles2?fields=onlineId,accountId,avatarUrls,plus,personalDetail(firstName,lastName),presences(@default,@titleInfo,platform,lastOnlineDate,hasBroadcastData)&sort=name-onlineId&offset=0&limit=${limit}`;

    const response = await withRetry(() => call({ url }, auth));

    if (response?.profiles) {
      friends = response.profiles.map((p) => {
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

      total = response.totalResults ?? friends.length;
      const legacyOnline = friends.filter((f) => f.presence?.isOnline).length;
      console.log(`[friends] Legacy: ${friends.length} amis, ${legacyOnline} en ligne`);
    }
  } catch (err) {
    console.warn("[friends] Legacy failed:", err.message);
    throw err;
  }

  // === Étape 2 : enrichir SEULEMENT les amis en ligne avec la présence moderne ===
  // (pour avoir le nom du jeu + icône — quelques appels seulement)
  const onlineFriends = friends.filter((f) => f.presence?.isOnline);

  if (onlineFriends.length > 0 && onlineFriends.length <= 20) {
    try {
      const results = await Promise.all(
        onlineFriends.map(async (friend) => {
          try {
            const raw = await withRetry(() => getBasicPresence(auth, friend.accountId));
            return { accountId: friend.accountId, presence: mapModernPresence(raw) };
          } catch {
            return null;
          }
        })
      );

      for (const r of results) {
        if (!r?.presence) continue;
        const friend = friends.find((f) => f.accountId === r.accountId);
        if (friend) friend.presence = r.presence;
      }

      console.log(`[friends] Presence moderne: ${results.filter(Boolean).length} enrichis`);
    } catch (err) {
      console.warn("[friends] Presence moderne failed, on garde le legacy:", err.message);
      // On garde la présence legacy — pas de perte de données
    }
  }

  return { total, friends };
}
