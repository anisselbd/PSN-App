// src/psn-friends.js
// 1. Legacy endpoint → 74 profils + présence de base en 1 appel (affiché immédiatement)
// 2. Moderne getBasicPresence → présence exacte pour TOUS, en background progressif
//    Si le moderne échoue pour un ami, on garde le legacy (jamais de "indisponible")

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

  // === Étape 1 : legacy — profils + présence de base en 1 appel ===
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
      console.log(`[friends] Legacy: ${friends.length} amis`);
    }
  } catch (err) {
    console.warn("[friends] Legacy failed:", err.message);
    throw err;
  }

  // === Étape 2 : présence moderne pour TOUS les amis ===
  // Batch de 4 avec 4s de pause (~18 req/min, sous la limite de 20/min)
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

    // Mettre à jour — garder le legacy si le moderne échoue
    for (const r of results) {
      if (!r.presence) continue; // garder legacy
      const friend = friends.find((f) => f.accountId === r.id);
      if (friend) {
        friend.presence = r.presence;
        modernCount++;
      }
    }

    // Si tout le batch a échoué (rate limit), on arrête et on garde le legacy
    if (results.every((r) => !r.presence)) {
      console.log(`[friends] Presence moderne: rate limited après ${modernCount} amis, on garde le legacy pour le reste`);
      break;
    }

    if (i + 4 < accountIds.length) {
      await new Promise((r) => setTimeout(r, 4000));
    }
  }

  const onlineCount = friends.filter((f) => f.presence?.isOnline).length;
  console.log(`[friends] Final: ${onlineCount} en ligne, ${modernCount} avec presence moderne`);

  return { total, friends };
}
